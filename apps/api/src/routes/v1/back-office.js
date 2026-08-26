import { randomInt } from 'node:crypto';

import * as organisations from '../../repositories/organisations.js';
import * as projets from '../../repositories/projets.js';
import * as contrats from '../../repositories/contrats.js';
import * as finances from '../../repositories/finances.js';
import * as interventions from '../../repositories/interventions.js';
import { allouer } from '../../repositories/references.js';
import { hacher } from '../../auth/passwords.js';
import { Saisie } from '../validation.js';

/**
 * Les cinq créations du back-office : client, projet, contrat, intervention,
 * pièce financière.
 *
 * CE QUE CES ROUTES NE FONT PAS
 * Elles ne décident d'aucune forme d'écran. Les artboards de création ne sont
 * pas livrés, et le nombre de champs affichés, leur ordre, ce qui se passe
 * après l'enregistrement sont des décisions de design que rien ici ne
 * préempte. Ce qui est fixé ici est ce que le modèle de données impose de
 * toute façon : ce qui est requis en base est requis ici, ce qui est
 * facultatif le reste, et rien n'a été inventé.
 *
 * POURQUOI « organisation » EST TOUJOURS EXIGÉ
 * Ces cinq capacités ne sont accordées qu'au personnel 5/Sync, dont la session
 * ne porte aucun périmètre. Sans organisation désignée, la politique
 * d'isolation refuserait l'insertion — ce qui est correct, mais se présenterait
 * comme une erreur de base de données là où c'est un champ manquant.
 */

const PHASES = ['cadrage', 'conception', 'deploiement', 'recette', 'clos'];
const STATUTS_PROJET = ['cadrage', 'en_cours', 'recette', 'suspendu', 'clos'];
const STATUTS_ORGANISATION = ['actif', 'audit', 'projet', 'clos'];
const TYPES_PIECE = ['devis', 'facture', 'avoir'];
const STATUTS_PIECE = ['brouillon', 'a_valider', 'en_attente', 'reglee', 'annulee'];

/**
 * Mot de passe provisoire du premier référent.
 *
 * L'alphabet exclut les caractères que personne ne sait dicter au téléphone —
 * 0/O, 1/l/I — parce que c'est ainsi qu'il sera transmis en pratique. Cinq
 * groupes de quatre valent un peu plus de 100 bits : largement au-dessus de
 * ce qu'une limitation de débit à six essais laisse deviner.
 */
function motDePasseProvisoire() {
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const groupe = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return Array.from({ length: 5 }, groupe).join('-');
}

/** Lit et valide l'organisation visée, commune aux quatre créations cloisonnées. */
function organisationVisee(saisie) {
  return saisie.uuid('organisation', { requis: true });
}

export default async function routesBackOffice(app) {
  /**
   * Nouveau client — l'organisation, ses sites, et son premier référent.
   *
   * Les trois dans la même transaction : une organisation sans référent est
   * une coquille que personne ne peut ouvrir, et la reprendre demanderait de
   * deviner ce qui a été créé et ce qui ne l'a pas été.
   */
  app.post('/api/v1/organisations', async (request, reply) => {
    request.exigerCapacite('organisations:ecrire');

    const saisie = new Saisie(request.body);
    const nom = saisie.texte('nom', { requis: true, max: 200 });
    const pays = saisie.texte('pays', { requis: true, max: 80 });
    const statut = saisie.parmi('statut', STATUTS_ORGANISATION, { defaut: 'actif' });
    const sites = saisie.lignes('sites', (l) => l.texte('nom', { requis: true, max: 200 }), { max: 50 });

    const referentSaisie = new Saisie(request.body?.referent);
    const referentNom = referentSaisie.texte('nom', { requis: true, max: 120 });
    const referentEmail = referentSaisie.texte('email', { requis: true, max: 320 });
    // Volontairement permissif, comme le formulaire de contact : une
    // validation d'e-mail stricte rejette des adresses valides, et le seul
    // test qui prouve quoi que ce soit est l'envoi effectif d'un message.
    if (referentEmail && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(referentEmail)) {
      referentSaisie.erreurs.email = 'Adresse électronique invalide.';
    }
    for (const [champ, message] of Object.entries(referentSaisie.erreurs)) {
      saisie.erreurs[`referent.${champ}`] = message;
    }

    if (!saisie.valide) return saisie.refus(reply);

    const motDePasse = motDePasseProvisoire();
    const empreinte = await hacher(motDePasse);

    let client;
    try {
      // POURQUOI dansPerimetre ET NON withoutTenant, ALORS QU'AUCUNE DES TROIS
      // TABLES N'A DE PÉRIMÈTRE À RESPECTER ICI.
      // `organisations` et `users` sont hors cloisonnement, mais `sites` ne
      // l'est pas : sa politique exige un contexte, et une transaction ouverte
      // sans contexte s'y voit refuser l'insertion. Le contexte du personnel
      // — transverse, `app.is_staff()` — est le seul qui permette de créer les
      // trois dans la même transaction. Le faire en deux temps rendrait
      // possible l'organisation sans ses sites.
      client = await request.dansPerimetre((c) =>
        organisations.creer(c, request.session, {
          nom,
          pays,
          statut,
          sites,
          referent: { nom: referentNom, email: referentEmail, empreinte },
        }),
      );
    } catch (erreur) {
      // Adresse déjà employée : c'est une saisie à corriger, pas une panne.
      if (erreur.code === '23505') {
        return reply.code(409).send({
          error: 'conflit',
          champs: { 'referent.email': 'Cette adresse est déjà rattachée à un compte.' },
        });
      }
      throw erreur;
    }

    request.log.info(
      { organisationId: client.id, par: request.session.userId },
      'organisation créée',
    );

    // Le mot de passe provisoire n'est rendu qu'ici, et une seule fois : il
    // n'est stocké qu'en empreinte et aucune route ne peut le relire. Voir le
    // dépôt pour la raison — il n'existe pas encore de parcours de
    // réinitialisation, et un compte dont personne ne connaît le secret est
    // un compte inutilisable.
    return reply.code(201).send({ ...client, motDePasseProvisoire: motDePasse });
  });

  /** Nouveau projet, et ses jalons. */
  app.post('/api/v1/projets', async (request, reply) => {
    request.exigerCapacite('projets:ecrire');

    const saisie = new Saisie(request.body);
    const organisation = organisationVisee(saisie);
    const nom = saisie.texte('nom', { requis: true, max: 200 });
    const phase = saisie.parmi('phase', PHASES, { defaut: 'cadrage' });
    const statut = saisie.parmi('statut', STATUTS_PROJET, { defaut: 'cadrage' });
    const echeance = saisie.date('echeance');
    const jalons = saisie.lignes(
      'jalons',
      (l) => ({
        libelle: l.texte('libelle', { requis: true, max: 200 }),
        echeance: l.date('echeance'),
        poids: l.entier('poids', { min: 1, max: 100 }) ?? 1,
      }),
      { max: 100 },
    );
    if (!saisie.valide) return saisie.refus(reply);

    const projet = await request.dansPerimetre(
      (c) => projets.creer(c, { organisationId: organisation, nom, phase, statut, echeance, jalons }),
      { organisationDemandee: organisation },
    );

    return reply.code(201).send(projet);
  });

  /** Nouveau contrat. La référence est attribuée, jamais saisie. */
  app.post('/api/v1/contrats', async (request, reply) => {
    request.exigerCapacite('contrats:ecrire');

    const saisie = new Saisie(request.body);
    const organisation = organisationVisee(saisie);
    const intitule = saisie.texte('intitule', { requis: true, max: 200 });
    const perimetre = saisie.texte('perimetre', { max: 2000 });
    // Bornes hautes volontairement larges : un engagement à 720 h existe.
    // C'est le zéro qui est refusé — une GTR de zéro heure n'est pas un
    // engagement tenable, c'est une case remplie machinalement.
    const gtiHeures = saisie.entier('gtiHeures', { min: 1, max: 8760 });
    const gtrHeures = saisie.entier('gtrHeures', { min: 1, max: 8760 });
    const forfaitHeures = saisie.entier('forfaitHeures', { min: 1, max: 8760 });
    const echeance = saisie.date('echeance');
    if (!saisie.valide) return saisie.refus(reply);

    if (gtiHeures && gtrHeures && gtrHeures < gtiHeures) {
      return reply.code(400).send({
        error: 'validation',
        champs: {
          gtrHeures:
            'Le délai de rétablissement ne peut pas être plus court que le délai de prise en charge.',
        },
      });
    }

    const contrat = await request.dansPerimetre(
      async (c) =>
        contrats.creer(c, {
          organisationId: organisation,
          reference: await allouer(c, {
            forme: 'contrats',
            organisationId: organisation,
            annee: new Date().getUTCFullYear(),
          }),
          intitule,
          perimetre,
          gtiHeures,
          gtrHeures,
          forfaitHeures,
          echeance,
        }),
      { organisationDemandee: organisation },
    );

    return reply.code(201).send(contrat);
  });

  /**
   * Planifier une intervention.
   *
   * Le rattachement au contrat est proposé ici parce que c'est le moment où
   * l'information est connue : imputer le temps passé suppose de savoir quel
   * forfait le porte, et le retrouver trois semaines plus tard coûte plus
   * cher que de le poser maintenant.
   */
  app.post('/api/v1/interventions', async (request, reply) => {
    request.exigerCapacite('interventions:ecrire');

    const saisie = new Saisie(request.body);
    const organisation = organisationVisee(saisie);
    const objet = saisie.texte('objet', { requis: true, max: 300 });
    const survenueLe = saisie.date('survenueLe', { requis: true });
    const siteId = saisie.uuid('site');
    const ticketId = saisie.uuid('ticket');
    const contratId = saisie.uuid('contrat');
    const intervenantId = saisie.uuid('intervenant');
    const minutes = saisie.entier('minutes', { min: 1, max: 24 * 60 });
    if (!saisie.valide) return saisie.refus(reply);

    const intervention = await request.dansPerimetre(
      async (c) =>
        interventions.planifier(c, {
          organisationId: organisation,
          reference: await allouer(c, {
            forme: 'interventions',
            organisationId: organisation,
            annee: Number(survenueLe.slice(0, 4)),
          }),
          objet,
          survenueLe,
          siteId,
          ticketId,
          contratId,
          intervenantId,
          minutes,
        }),
      { organisationDemandee: organisation },
    );

    return reply.code(201).send(intervention);
  });

  /**
   * Créer une pièce — devis, facture ou avoir.
   *
   * Le montant est calculé à partir des lignes quand il y en a. Deux sources
   * pour un même total finissent par diverger, et le jour où elles divergent
   * c'est sur une facture, donc devant un client.
   */
  app.post('/api/v1/finances', async (request, reply) => {
    request.exigerCapacite('finances:ecrire');

    const saisie = new Saisie(request.body);
    const organisation = organisationVisee(saisie);
    const type = saisie.parmi('type', TYPES_PIECE, { requis: true });
    const objet = saisie.texte('objet', { requis: true, max: 300 });
    const statut = saisie.parmi('statut', STATUTS_PIECE, { defaut: 'brouillon' });
    const echeance = saisie.date('echeance');
    const projetId = saisie.uuid('projet');
    const lignes = saisie.lignes(
      'lignes',
      (l) => ({
        libelle: l.texte('libelle', { requis: true, max: 300 }),
        quantite: l.decimal('quantite', { min: 0.01, max: 100_000 }) ?? 1,
        prixUnitaireFcfa: l.entier('prixUnitaireFcfa', { requis: true, min: 0 }),
      }),
      { max: 200 },
    );
    // Le franc CFA n'a pas de sous-unité : les montants sont des entiers, et
    // un montant direct n'est lu que si aucune ligne n'est fournie.
    const montantFcfa =
      lignes.length === 0 ? saisie.entier('montantFcfa', { requis: true, min: 0 }) : null;
    if (!saisie.valide) return saisie.refus(reply);

    const piece = await request.dansPerimetre(
      async (c) =>
        finances.creer(c, {
          organisationId: organisation,
          reference: await allouer(c, {
            // Le préfixe dépend du type : DEV-, FAC-, AV-.
            forme: type,
            organisationId: organisation,
            annee: new Date().getUTCFullYear(),
          }),
          type,
          objet,
          montantFcfa,
          echeance,
          projetId,
          statut,
          lignes,
        }),
      { organisationDemandee: organisation },
    );

    return reply.code(201).send(piece);
  });

  // ── Lecture des interventions ────────────────────────────────────────────
  // Elles n'ont pas de vue côté client à ce jour : la maquette ne les montre
  // que dans le back-office, et « interventions:lire » n'est accordée qu'au
  // personnel. Le jour où un artboard client existe, il suffira d'ouvrir la
  // capacité — la route, elle, ne changera pas.

  app.get('/api/v1/interventions', async (request) => {
    request.exigerCapacite('interventions:lire');
    const q = request.query ?? {};

    const liste = await request.dansPerimetre(
      (c) => interventions.lister(c, { statut: q.statut ?? null, contratId: q.contrat ?? null }),
      { organisationDemandee: q.organisation ?? null },
    );

    return { interventions: liste };
  });

  app.get('/api/v1/interventions/indicateurs', async (request) => {
    request.exigerCapacite('interventions:lire');
    return request.dansPerimetre((c) => interventions.indicateurs(c), {
      organisationDemandee: request.query?.organisation ?? null,
    });
  });

  app.get('/api/v1/interventions/:id', async (request, reply) => {
    request.exigerCapacite('interventions:lire');
    const ligne = await request.dansPerimetre((c) => interventions.parId(c, request.params.id));

    if (!ligne) return reply.code(404).send({ error: 'introuvable' });
    return ligne;
  });
}

export { PHASES, STATUTS_PROJET, TYPES_PIECE, STATUTS_PIECE, motDePasseProvisoire };
