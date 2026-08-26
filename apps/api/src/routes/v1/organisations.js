import * as organisations from '../../repositories/organisations.js';
import { withoutTenant } from '../../db/tenant.js';

/**
 * Organisations.
 *
 * Cette table n'a pas de politique d'isolation : elle DÉFINIT le périmètre au
 * lieu d'en dépendre. Le contrôle se fait donc dans le dépôt, par le rôle —
 * un compte client ne lit que sa propre organisation, quel que soit
 * l'identifiant qu'il présente.
 */
export default async function routesOrganisations(app) {
  app.get('/api/v1/organisations', async (request) => {
    const session = request.exigerSession();
    const liste = await withoutTenant((c) => organisations.lister(c, session));
    return { organisations: liste };
  });

  app.get('/api/v1/organisations/:id', async (request, reply) => {
    const session = request.exigerSession();
    const org = await withoutTenant((c) => organisations.parId(c, session, request.params.id));

    if (!org) return reply.code(404).send({ error: 'introuvable' });
    return org;
  });
}
