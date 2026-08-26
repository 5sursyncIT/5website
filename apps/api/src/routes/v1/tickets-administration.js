import * as tickets from '../../repositories/tickets.js';
import * as contrats from '../../repositories/contrats.js';
import { Saisie } from '../validation.js';
import { peut } from '../../auth/contexte.js';
import { notifierReponseTicket } from '../../mail/envoi.js';

/**
 * Les gestes de l'opérateur sur un ticket.
 *
 * C'est le geste le plus fréquent du back-office : lire le fil, répondre,
 * poser une note interne, faire changer le ticket d'état, imputer le temps
 * passé au contrat qui le couvre. Ces routes existent sans écran — l'artboard
 * du détail d'un ticket n'est pas livré — mais leur comportement, lui, ne
 * dépend pas du dessin : ce qui suit est déductible du modèle de données et
 * des règles déjà écrites, et rien n'y a été deviné à la place du design.
 */

const STATUTS = ['ouvert', 'en_cours', 'escalade', 'votre_retour', 'planifie', 'resolu', 'clos'];
const NIVEAUX = ['n1', 'n2', 'n3'];
const CORPS_MAX = 20_000;

export default async function routesTicketsAdministration(app) {
  /**
   * Le fil d'un ticket.
   *
   * Les notes internes ne sont pas renvoyées à un compte client. Le filtre
   * est en SQL et non dans la vue : ce qui n'est pas envoyé ne peut pas fuir.
   */
  app.get('/api/v1/tickets/:id/messages', async (request, reply) => {
    request.exigerCapacite('tickets:lire');
    const avecInternes = peut(request.session, 'tickets:administrer');

    const [ticket, fil] = await request.dansPerimetre(async (c) => [
      await tickets.parId(c, request.params.id),
      await tickets.messages(c, request.params.id, { avecInternes }),
    ]);

    // Un ticket hors périmètre est indistinguable d'un ticket inexistant :
    // confirmer l'existence d'une référence appartenant à un autre client
    // serait déjà une fuite.
    if (!ticket) return reply.code(404).send({ error: 'introuvable' });
    return { messages: fil };
  });

  /**
   * Répondre, ou poser une note interne.
   *
   * DEUX CAPACITÉS POUR UNE SEULE ROUTE. Répondre est ouvert au client — c'est
   * son ticket. Poser une note invisible de lui demande « tickets:administrer ».
   * Sans ce second contrôle, `interne: true` dans le corps de la requête
   * suffirait à un compte client pour écrire dans un fil qu'il ne peut pas
   * relire : le message serait perdu pour son auteur et lisible du seul
   * personnel, ce qui n'est pas ce qu'il croirait faire.
   */
  app.post('/api/v1/tickets/:id/messages', async (request, reply) => {
    request.exigerCapacite('tickets:ouvrir');

    const saisie = new Saisie(request.body);
    const corps = saisie.texte('corps', { requis: true, max: CORPS_MAX });
    const interne = saisie.booleen('interne', { defaut: false });
    if (!saisie.valide) return saisie.refus(reply);

    if (interne) request.exigerCapacite('tickets:administrer');

    const resultat = await request.dansPerimetre(
      async (c) => {
        const ticket = await tickets.parId(c, request.params.id);
        if (!ticket) return null;

        const message = await tickets.repondre(c, {
          organisationId: ticket.organisation_id,
          ticketId: ticket.id,
          auteurId: request.session.userId,
          corps,
          interne,
        });
        return { ticket, message };
      },
      { organisationDemandee: request.query?.organisation ?? null },
    );

    if (!resultat) return reply.code(404).send({ error: 'introuvable' });

    // Le client est prévenu d'une réponse, jamais d'une note interne — et
    // seulement quand elle vient de chez nous : se notifier soi-même de son
    // propre message n'apprend rien à personne.
    if (!interne && request.session.estPersonnel) {
      notifierReponseTicket({ ticket: resultat.ticket }).catch((erreur) =>
        request.log.error({ err: erreur, ticketId: resultat.ticket.id }, 'notification non envoyée'),
      );
    }

    return reply.code(201).send(resultat.message);
  });

  /**
   * Statut, escalade, priorité, rattachement au contrat.
   *
   * LE RATTACHEMENT AU CONTRAT EST ICI, ET C'EST IMPORTANT. Le respect des SLA
   * ne se calcule que sur les tickets rattachés — un ticket qui n'a jamais été
   * qualifié sort de l'assiette et fait dériver l'indicateur sans que personne
   * ne comprenne pourquoi. C'est le seul écran d'où l'on peut réparer cela.
   *
   * `contrat` absent du corps laisse le rattachement en l'état ; `contrat: null`
   * le retire explicitement. Les confondre détacherait un ticket de son contrat
   * à chaque changement de statut.
   */
  app.patch('/api/v1/tickets/:id', async (request, reply) => {
    request.exigerCapacite('tickets:administrer');

    const saisie = new Saisie(request.body);
    const statut = saisie.parmi('statut', STATUTS);
    const niveau = saisie.parmi('niveau', NIVEAUX);
    const prioriteHaute = saisie.booleen('prioriteHaute');
    const contratDemande = 'contrat' in (request.body ?? {}) ? saisie.uuid('contrat') : undefined;
    if (!saisie.valide) return saisie.refus(reply);

    const ticket = await request.dansPerimetre(
      async (c) => {
        const existant = await tickets.parId(c, request.params.id);
        if (!existant) return null;

        // Le contrat visé est relu DANS le périmètre : un identifiant de
        // contrat appartenant à un autre client n'y est pas visible, donc le
        // rattachement croisé est refusé avant d'atteindre la clé étrangère.
        if (contratDemande) {
          const contrat = await contrats.parId(c, contratDemande);
          if (!contrat) return 'contrat_introuvable';
        }

        return tickets.mettreAJour(c, existant.id, {
          statut,
          niveau,
          prioriteHaute,
          ...(contratDemande === undefined ? {} : { contratId: contratDemande }),
        });
      },
      { organisationDemandee: request.query?.organisation ?? null },
    );

    if (ticket === 'contrat_introuvable') {
      return reply
        .code(400)
        .send({ error: 'validation', champs: { contrat: 'Contrat inconnu pour ce client.' } });
    }
    if (!ticket) return reply.code(404).send({ error: 'introuvable' });
    return ticket;
  });

  /**
   * Imputer des heures à un contrat.
   *
   * EN MINUTES, PAS EN HEURES DÉCIMALES. Une intervention de 1 h 40 vaut
   * 100 minutes ; écrite « 1,67 h » elle serait arrondie, et la somme des
   * arrondis d'une année de support finit par se voir sur un forfait.
   *
   * Capacité distincte de « contrats:ecrire » : imputer est le geste
   * quotidien d'un intervenant, rédiger un contrat ne l'est pas.
   */
  app.post('/api/v1/contrats/:id/heures', async (request, reply) => {
    request.exigerCapacite('contrats:imputer');

    const saisie = new Saisie(request.body);
    // Bornée à une journée : au-delà, c'est une saisie en heures prise pour
    // des minutes, ou une virgule qui a sauté. Le refus coûte une correction,
    // l'acceptation fausse un forfait.
    const minutes = saisie.entier('minutes', { requis: true, min: 1, max: 24 * 60 });
    const motif = saisie.texte('motif', { max: 300 });
    if (!saisie.valide) return saisie.refus(reply);

    const imputation = await request.dansPerimetre(
      async (c) => {
        const contrat = await contrats.parId(c, request.params.id);
        if (!contrat) return null;

        return contrats.consommer(c, {
          organisationId: contrat.organisation_id,
          contratId: contrat.id,
          minutes,
          motif,
        });
      },
      { organisationDemandee: request.query?.organisation ?? null },
    );

    if (!imputation) return reply.code(404).send({ error: 'introuvable' });
    return reply.code(201).send(imputation);
  });
}

export { STATUTS, NIVEAUX };
