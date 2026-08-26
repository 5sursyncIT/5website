import * as projets from '../../repositories/projets.js';
import * as contrats from '../../repositories/contrats.js';
import * as documents from '../../repositories/documents.js';
import * as parc from '../../repositories/parc.js';
import * as finances from '../../repositories/finances.js';

/**
 * Les cinq modules de lecture de l'espace client.
 *
 * POURQUOI UNE TABLE PLUTÔT QUE CINQ FICHIERS
 * Ces routes ne diffèrent que par trois choses : le dépôt, la capacité exigée
 * et les filtres acceptés. Écrites cinq fois, elles divergeraient — et la
 * divergence qui compte ici est celle d'une capacité oubliée sur une route.
 * Rassemblées, la correspondance route/capacité se relit d'un coup d'œil, ce
 * qui est exactement ce qu'on veut pouvoir vérifier en revue.
 *
 * Les écritures, elles, restent explicites plus bas : elles n'ont pas de forme
 * commune, et les factoriser masquerait ce qu'elles font.
 */
const MODULES = [
  {
    chemin: 'projets',
    depot: projets,
    lire: 'tickets:lire', // même périmètre de lecture que le portail client
    filtres: (q) => ({ statut: q.statut ?? null }),
  },
  {
    chemin: 'contrats',
    depot: contrats,
    lire: 'tickets:lire',
    filtres: (q) => ({ statut: q.statut ?? null }),
  },
  {
    chemin: 'documents',
    depot: documents,
    lire: 'documents:lire',
    filtres: (q) => ({ type: q.type ?? null }),
  },
  {
    chemin: 'parc',
    depot: parc,
    lire: 'tickets:lire',
    filtres: (q) => ({ statut: q.statut ?? null, siteId: q.site ?? null }),
  },
  {
    // Les pièces financières ne sont pas ouvertes à tous les comptes clients :
    // « finances:lire » exclut client_user, qui n'a pas à voir les montants.
    chemin: 'finances',
    depot: finances,
    lire: 'finances:lire',
    filtres: (q) => ({ type: q.type ?? null, statut: q.statut ?? null }),
  },
];

export default async function routesModules(app) {
  for (const module of MODULES) {
    const { chemin, depot, lire, filtres } = module;

    app.get(`/api/v1/${chemin}`, async (request) => {
      request.exigerCapacite(lire);
      const q = request.query ?? {};

      const lignes = await request.dansPerimetre((c) => depot.lister(c, filtres(q)), {
        // Lu pour le personnel seulement : contexteDe() refuse la demande d'un
        // compte client qui viserait une autre organisation.
        organisationDemandee: q.organisation ?? null,
      });

      return { [chemin]: lignes };
    });

    app.get(`/api/v1/${chemin}/indicateurs`, async (request) => {
      request.exigerCapacite(lire);
      return request.dansPerimetre((c) => depot.indicateurs(c), {
        organisationDemandee: request.query?.organisation ?? null,
      });
    });

    app.get(`/api/v1/${chemin}/:id`, async (request, reply) => {
      request.exigerCapacite(lire);
      const ligne = await request.dansPerimetre((c) => depot.parId(c, request.params.id));

      // Une ressource hors périmètre est indistinguable d'une ressource
      // inexistante : confirmer l'existence d'une référence appartenant à un
      // autre client serait déjà une fuite.
      if (!ligne) return reply.code(404).send({ error: 'introuvable' });
      return ligne;
    });
  }

  // ── Détails propres à un module ────────────────────────────────────────

  app.get('/api/v1/projets/:id/jalons', async (request, reply) => {
    request.exigerCapacite('tickets:lire');
    const [projet, liste] = await request.dansPerimetre(async (c) => [
      await projets.parId(c, request.params.id),
      await projets.jalons(c, request.params.id),
    ]);

    if (!projet) return reply.code(404).send({ error: 'introuvable' });
    return { jalons: liste };
  });

  app.get('/api/v1/documents/:id/versions', async (request, reply) => {
    request.exigerCapacite('documents:lire');
    const [document, liste] = await request.dansPerimetre(async (c) => [
      await documents.parId(c, request.params.id),
      await documents.versions(c, request.params.id),
    ]);

    if (!document) return reply.code(404).send({ error: 'introuvable' });
    return { versions: liste };
  });

  app.get('/api/v1/finances/:id/lignes', async (request, reply) => {
    request.exigerCapacite('finances:lire');
    const [piece, liste] = await request.dansPerimetre(async (c) => [
      await finances.parId(c, request.params.id),
      await finances.lignes(c, request.params.id),
    ]);

    if (!piece) return reply.code(404).send({ error: 'introuvable' });
    return { lignes: liste };
  });
}

export { MODULES };
