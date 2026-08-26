import * as documents from '../../repositories/documents.js';
import * as fichiers from '../../stockage/fichiers.js';
import { notifierDepotDocument } from '../../mail/envoi.js';
import * as antivirus from '../../stockage/antivirus.js';

/**
 * Dépôt et téléchargement de fichiers.
 *
 * Le dépôt est réservé au personnel 5/Sync (« documents:deposer ») : un client
 * consulte ses livrables, il ne les produit pas. Le téléchargement, lui, est
 * ouvert à tout compte du périmètre — et revalidé à chaque appel.
 */
export default async function routesDocumentsFichiers(app) {
  app.post('/api/v1/documents/:id/versions', async (request, reply) => {
    request.exigerCapacite('documents:deposer');

    const partie = await request.file({ limits: { fileSize: fichiers.TAILLE_MAX } });
    if (!partie) return reply.code(400).send({ error: 'fichier_manquant' });

    const contenu = await partie.toBuffer();

    // Fastify tronque au-delà de la limite plutôt que d'échouer : sans ce
    // test, un fichier trop gros serait enregistré amputé.
    if (partie.file.truncated) {
      return reply.code(413).send({
        error: 'fichier_trop_volumineux',
        message: `Maximum ${Math.round(fichiers.TAILLE_MAX / 1024 / 1024)} Mo.`,
      });
    }

    // L'analyse a lieu AVANT toute écriture : un fichier reconnu ne doit
    // jamais toucher le disque, même le temps d'être supprimé ensuite.
    const verdict = await antivirus.analyser(contenu, { log: request.log });
    if (!verdict.analyse && antivirus.configure) {
      request.log.warn({ documentId: request.params.id }, 'dépôt non analysé');
    }

    let documentDepose = null;

    const version = await request.dansPerimetre(async (client) => {
      // On relit le document DANS la transaction : c'est ce qui vérifie qu'il
      // appartient au périmètre courant, par la politique d'isolation, avant
      // d'écrire quoi que ce soit sur disque.
      const document = await documents.parId(client, request.params.id);
      if (!document) return null;
      documentDepose = document;

      const ecrit = await fichiers.ecrire({
        organisationId: document.organisation_id,
        documentId: document.id,
        contenu,
        nomOrigine: partie.filename,
      });

      return documents.deposer(client, {
        organisationId: document.organisation_id,
        documentId: document.id,
        chemin: ecrit.chemin,
        tailleOctets: ecrit.tailleOctets,
        typeMime: ecrit.typeMime,
        empreinteSha256: ecrit.empreinte,
        deposePar: request.session.userId,
      });
    });

    if (!version) return reply.code(404).send({ error: 'introuvable' });

    request.log.info(
      { documentId: request.params.id, version: version.version, par: request.session.userId },
      'version de document déposée',
    );

    // Hors transaction et sans attente : un serveur de courrier en panne ne
    // doit pas faire échouer un dépôt qui a réussi.
    notifierDepotDocument({ document: documentDepose, version }).catch((erreur) =>
      request.log.error({ err: erreur, documentId: documentDepose.id }, 'notification non envoyée'),
    );
    return reply.code(201).send(version);
  });

  app.get('/api/v1/documents/:id/telecharger', async (request, reply) => {
    request.exigerCapacite('documents:lire');

    const demandee = request.query?.version ? Number(request.query.version) : null;

    const cible = await request.dansPerimetre((client) =>
      documents.versionPourTelechargement(client, {
        documentId: request.params.id,
        version: Number.isFinite(demandee) ? demandee : null,
      }),
    );

    if (!cible) return reply.code(404).send({ error: 'introuvable' });

    if (!(await fichiers.existe(cible.chemin))) {
      // La base connaît la version mais le fichier manque : c'est une
      // incohérence de stockage, pas une erreur du client.
      request.log.error({ chemin: cible.chemin }, 'fichier absent du stockage');
      return reply.code(500).send({ error: 'fichier_indisponible' });
    }

    const nom = `${cible.nom} — v${cible.version}`.replace(/[/\\?%*:|"<>]/g, '-');

    reply
      .header('content-type', cible.type_mime)
      .header('content-length', cible.taille_octets)
      // filename* en UTF-8 : les noms de livrables portent des accents, et le
      // paramètre filename simple les mutilerait.
      .header(
        'content-disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
      )
      // Un document client ne doit jamais être mis en cache par un
      // intermédiaire : le contrôle d'accès se joue à chaque requête.
      .header('cache-control', 'private, no-store');

    return reply.send(fichiers.lire(cible.chemin));
  });
}
