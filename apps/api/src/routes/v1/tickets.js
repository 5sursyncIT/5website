import * as tickets from '../../repositories/tickets.js';

export default async function routesTickets(app) {
  app.get('/api/v1/tickets', async (request) => {
    request.exigerCapacite('tickets:lire');

    // organisation n'est lu que pour le personnel : contexteDe() refuse la
    // demande d'un compte client qui viserait une autre organisation.
    const { statut = null, organisation = null } = request.query ?? {};

    const lignes = await request.dansPerimetre((c) => tickets.lister(c, { statut }), {
      organisationDemandee: organisation,
    });

    return { tickets: lignes };
  });

  app.get('/api/v1/tickets/indicateurs', async (request) => {
    request.exigerCapacite('tickets:lire');
    const { organisation = null } = request.query ?? {};

    return request.dansPerimetre((c) => tickets.indicateurs(c), {
      organisationDemandee: organisation,
    });
  });

  app.get('/api/v1/tickets/:id', async (request, reply) => {
    request.exigerCapacite('tickets:lire');

    const ticket = await request.dansPerimetre((c) => tickets.parId(c, request.params.id));

    // Un ticket hors périmètre est indistinguable d'un ticket inexistant : on
    // ne confirme pas l'existence d'une référence appartenant à un autre client.
    if (!ticket) return reply.code(404).send({ error: 'introuvable' });
    return ticket;
  });
}
