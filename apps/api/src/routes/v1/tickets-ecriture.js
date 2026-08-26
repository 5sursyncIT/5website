import * as tickets from '../../repositories/tickets.js';
import { notifierOuvertureTicket } from '../../mail/envoi.js';

/**
 * Ouverture et suivi des tickets — les seules écritures qu'un compte client
 * peut déclencher dans l'espace client.
 */

const NIVEAUX = ['n1', 'n2', 'n3'];
const OBJET_MAX = 300;

/**
 * Référence lisible et unique par organisation.
 *
 * Le compteur est calculé DANS la transaction, sous verrou de la contrainte
 * d'unicité : deux ouvertures simultanées ne peuvent pas produire la même
 * référence — la seconde échouerait, et c'est le comportement voulu plutôt
 * qu'un doublon silencieux.
 */
async function prochaineReference(client) {
  const { rows } = await client.query(
    `select coalesce(max(substring(reference from 'TCK-([0-9]+)')::int), 4400) + 1 as suivant
       from tickets where reference ~ '^TCK-[0-9]+$'`,
  );
  return `TCK-${rows[0].suivant}`;
}

export default async function routesTicketsEcriture(app) {
  app.post('/api/v1/tickets', async (request, reply) => {
    request.exigerCapacite('tickets:ouvrir');
    const session = request.session;

    const objet = String(request.body?.objet ?? '').trim();
    const niveau = String(request.body?.niveau ?? 'n1');
    const siteId = request.body?.siteId ?? null;

    if (!objet) return reply.code(400).send({ error: 'validation', champs: { objet: 'Objet requis.' } });
    if (objet.length > OBJET_MAX) {
      return reply.code(400).send({
        error: 'validation',
        champs: { objet: `Maximum ${OBJET_MAX} caractères.` },
      });
    }
    if (!NIVEAUX.includes(niveau)) {
      return reply.code(400).send({ error: 'validation', champs: { niveau: 'Niveau inconnu.' } });
    }

    // Un compte client ouvre pour SON organisation. Le personnel doit dire
    // pour laquelle : sans périmètre, la politique d'isolation refuserait
    // l'insertion — ce qui est correct, mais mérite un message clair.
    const organisationDemandee = request.body?.organisation ?? null;
    if (session.estPersonnel && !organisationDemandee) {
      return reply.code(400).send({
        error: 'validation',
        champs: { organisation: 'Un compte 5/Sync doit préciser l’organisation concernée.' },
      });
    }

    const ticket = await request.dansPerimetre(
      async (client) => {
        const organisationId = session.estPersonnel ? organisationDemandee : session.organisationId;
        return tickets.ouvrir(client, {
          organisationId,
          reference: await prochaineReference(client),
          objet,
          siteId,
          niveau,
          creePar: session.userId,
        });
      },
      { organisationDemandee },
    );

    // La notification part APRÈS la transaction : un échec d'envoi ne doit
    // jamais annuler un ticket qui a bien été ouvert.
    notifierOuvertureTicket({ ticket, auteur: session }).catch((erreur) =>
      request.log.error({ err: erreur, ticketId: ticket.id }, 'notification non envoyée'),
    );

    return reply.code(201).send(ticket);
  });
}
