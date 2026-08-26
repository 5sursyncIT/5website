import { withoutTenant } from '../../db/tenant.js';
import * as audit from '../../repositories/audit.js';
import { Saisie } from '../validation.js';

/**
 * Le journal d'audit, en lecture.
 *
 * Il existait depuis le lot 2 — alimenté par un déclencheur sur chaque table
 * cloisonnée, en écriture seule — et rien ne le lisait. Un journal que
 * personne ne peut consulter n'est pas une traçabilité : c'est du stockage.
 * La capacité « audit:lire » était déclarée dès le premier jour et n'était
 * accordée à aucune route ; elle l'est ici, et à « admin » seul.
 *
 * IL N'Y A PAS D'ÉCRITURE, ET IL NE DOIT PAS Y EN AVOIR. Ni POST, ni PATCH,
 * ni DELETE, ni purge : un journal qu'une route peut modifier ne prouve plus
 * rien, et c'est précisément la propriété qu'on lui demande. La rotation, le
 * jour où le volume l'imposera, sera une tâche d'exploitation avec sa propre
 * trace — pas un appel d'API.
 */

const ACTIONS = ['insert', 'update', 'delete'];

/**
 * Tables dont le journal peut être filtré.
 *
 * Liste fermée plutôt que nom libre : `table_cible` est indexée, et laisser
 * passer une chaîne quelconque ferait balayer le journal entier à chaque
 * faute de frappe. C'est aussi la seule liste qui dit, en un coup d'œil, ce
 * que ce service trace réellement.
 */
const TABLES = [
  'sites', 'tickets', 'ticket_messages', 'projets', 'jalons',
  'contrats', 'contrat_heures', 'documents', 'document_versions',
  'equipements', 'pieces', 'piece_lignes', 'interventions', 'activites', 'leads',
];

export default async function routesAudit(app) {
  app.get('/api/v1/audit', async (request, reply) => {
    request.exigerCapacite('audit:lire');

    const saisie = new Saisie(request.query);
    const organisationId = saisie.uuid('organisation');
    const acteurId = saisie.uuid('acteur');
    const table = saisie.parmi('table', TABLES);
    const action = saisie.parmi('action', ACTIONS);
    const depuis = saisie.date('depuis');
    const limite = saisie.entier('limite', { min: 1, max: audit.LIMITE_MAX }) ?? 50;
    // Curseur de pagination : l'identifiant de la dernière ligne déjà reçue.
    const avant = saisie.entier('avant', { min: 1 });
    if (!saisie.valide) return saisie.refus(reply);

    // withoutTenant, et non dansPerimetre : le journal n'a pas de politique
    // d'isolation — l'exemption est motivée en commentaire de table, migration
    // 012 — parce qu'il doit pouvoir enregistrer un événement hors de tout
    // périmètre. Le contrôle d'accès est fait au-dessus, par la capacité, et
    // le filtre par organisation ci-dessous est une commodité de lecture, pas
    // une protection : il n'est atteignable que par un compte « admin », qui
    // voit déjà toutes les organisations.
    const lignes = await withoutTenant((c) =>
      audit.lister(c, request.session, {
        organisationId,
        acteurId,
        table,
        action,
        depuis,
        avant,
        limite,
      }),
    );

    return {
      audit: lignes,
      // Le curseur de la page suivante est renvoyé plutôt que déduit par
      // l'appelant : c'est le service qui sait comment il pagine.
      suivant: lignes.length === limite ? lignes[lignes.length - 1].id : null,
    };
  });
}

export { TABLES, ACTIONS };
