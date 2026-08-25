import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { withTenant, withoutTenant } from '../src/db/tenant.js';
import { contexteDe, exiger, peut, ErreurAcces } from '../src/auth/contexte.js';
import * as tickets from '../src/repositories/tickets.js';
import { baseDisponible, RAISON_SAUT, jeuDeuxOrganisations, sessionDe, closePools } from './helpers.js';

/**
 * CRITÈRE DE FIN DU LOT 2.
 *
 * « Les tests d'isolation entre organisations passent ; toute tentative
 *   d'accès croisé échoue. »
 *
 * Ces tests ne vérifient pas que le code filtre bien : ils vérifient que
 * PostgreSQL refuse, y compris quand le code ne filtre pas. C'est la
 * différence entre une isolation par convention et une isolation structurelle.
 */

describe('Isolation entre organisations', { skip: baseDisponible ? false : RAISON_SAUT }, () => {
  let jeu;

  before(async () => {
    jeu = await jeuDeuxOrganisations();
  });

  after(async () => {
    await jeu?.nettoyer();
    await closePools();
  });

  test('un client ne voit que ses propres tickets', async () => {
    const vus = await withTenant({ organisationId: jeu.a }, (c) => tickets.lister(c));

    assert.equal(vus.length, 1);
    assert.equal(vus[0].objet, 'Dossier confidentiel de A');
  });

  test("demander nommément l'identifiant d'une autre organisation ne renvoie rien", async () => {
    // Le pire cas réaliste : une requête qui filtre explicitement sur une autre
    // organisation, parce qu'un identifiant est arrivé depuis l'extérieur.
    const lignes = await withTenant({ organisationId: jeu.a }, async (c) =>
      (await c.query('select * from tickets where organisation_id = $1', [jeu.b])).rows,
    );

    assert.equal(lignes.length, 0);
  });

  test('lire un ticket par son identifiant exact, depuis une autre organisation, échoue', async () => {
    const ticket = await withTenant({ organisationId: jeu.a }, (c) => tickets.parId(c, jeu.ticketB));

    assert.equal(ticket, null);
  });

  test('une requête sans aucun filtre ne voit toujours que son périmètre', async () => {
    // Le cas du dépôt mal écrit : aucun « where organisation_id ».
    const lignes = await withTenant({ organisationId: jeu.b }, async (c) =>
      (await c.query('select organisation_id from tickets')).rows,
    );

    assert.ok(lignes.length >= 1);
    assert.ok(
      lignes.every((l) => l.organisation_id === jeu.b),
      'des lignes hors périmètre ont fui malgré Row-Level Security',
    );
  });

  test('écrire dans une autre organisation est refusé par la base', async () => {
    await assert.rejects(
      () =>
        withTenant({ organisationId: jeu.a }, (c) =>
          c.query('insert into tickets (organisation_id, reference, objet) values ($1,$2,$3)', [
            jeu.b,
            'TCK-INTRUS',
            'Injection depuis A',
          ]),
        ),
      /row-level security/i,
    );
  });

  test("modifier le ticket d'une autre organisation ne touche aucune ligne", async () => {
    const modifiees = await withTenant({ organisationId: jeu.a }, async (c) =>
      (await c.query("update tickets set objet = 'détourné' where id = $1", [jeu.ticketB])).rowCount,
    );

    assert.equal(modifiees, 0);

    const intact = await withTenant({ organisationId: jeu.b }, (c) => tickets.parId(c, jeu.ticketB));
    assert.equal(intact.objet, 'Dossier confidentiel de B');
  });

  test("supprimer le ticket d'une autre organisation ne touche aucune ligne", async () => {
    const supprimees = await withTenant({ organisationId: jeu.a }, async (c) =>
      (await c.query('delete from tickets where id = $1', [jeu.ticketB])).rowCount,
    );

    assert.equal(supprimees, 0);
  });

  test('hors de tout périmètre, rien n’est visible — le défaut est le refus', async () => {
    const n = await withoutTenant(async (c) =>
      Number((await c.query('select count(*)::int as n from tickets')).rows[0].n),
    );

    assert.equal(n, 0);
  });

  test('le personnel 5/Sync voit les deux organisations', async () => {
    const vus = await withTenant({ organisationId: null, isStaff: true }, async (c) =>
      (await c.query('select organisation_id from tickets where organisation_id = any($1)', [
        [jeu.a, jeu.b],
      ])).rows,
    );

    assert.equal(vus.length, 2);
  });

  test('le personnel restreint à un périmètre ne voit que celui-là', async () => {
    // Le privilège du personnel est de POUVOIR tout voir, pas de tout voir
    // toujours. Quand le back-office ouvre la fiche d'un client, la page ne
    // doit pas mélanger les dossiers de deux institutions.
    const vus = await withTenant({ organisationId: jeu.a, isStaff: true }, (c) => tickets.lister(c));

    assert.equal(vus.length, 1);
    assert.equal(vus[0].objet, 'Dossier confidentiel de A');
  });

  test('le contexte ne fuit pas d’une transaction à la suivante', async () => {
    // set_config(..., true) est local à la transaction. Sans ce « true », la
    // connexion rendue au pool garderait le périmètre du client précédent —
    // exactement la fuite que tout ce dispositif vise à rendre impossible.
    await withTenant({ organisationId: jeu.a }, (c) => tickets.lister(c));

    const n = await withoutTenant(async (c) =>
      Number((await c.query('select count(*)::int as n from tickets')).rows[0].n),
    );

    assert.equal(n, 0, 'le périmètre de la transaction précédente a survécu dans le pool');
  });
});

describe('Périmètre dérivé de la session', () => {
  test('un compte client ne peut pas demander une autre organisation', () => {
    const session = sessionDe({ userId: 'u1', role: 'client_admin', organisationId: 'org-a' });

    assert.throws(() => contexteDe(session, { organisationDemandee: 'org-b' }), ErreurAcces);
  });

  test('un compte client obtient toujours son propre périmètre', () => {
    const session = sessionDe({ userId: 'u1', role: 'client_user', organisationId: 'org-a' });
    const contexte = contexteDe(session);

    assert.equal(contexte.organisationId, 'org-a');
    assert.equal(contexte.isStaff, false);
  });

  test('le personnel peut ouvrir le périmètre d’un client', () => {
    const session = sessionDe({ userId: 'u2', role: 'staff', organisationId: null });
    const contexte = contexteDe(session, { organisationDemandee: 'org-b' });

    assert.equal(contexte.organisationId, 'org-b');
    assert.equal(contexte.isStaff, true);
  });

  test('l’auteur est toujours transmis au journal d’audit', () => {
    const session = sessionDe({ userId: 'u3', role: 'client_admin', organisationId: 'org-a' });

    assert.equal(contexteDe(session).actorId, 'u3');
  });
});

describe('Capacités par rôle', () => {
  const client = (role) => sessionDe({ userId: 'u', role, organisationId: 'org-a' });

  test('un agent client ne lit pas les finances', () => {
    assert.equal(peut(client('client_user'), 'finances:lire'), false);
    assert.throws(() => exiger(client('client_user'), 'finances:lire'), ErreurAcces);
  });

  test('un référent client lit les finances mais n’écrit pas', () => {
    assert.equal(peut(client('client_admin'), 'finances:lire'), true);
    assert.equal(peut(client('client_admin'), 'finances:ecrire'), false);
  });

  test('aucun compte client ne lit les demandes entrantes ni le journal d’audit', () => {
    for (const role of ['client_admin', 'client_user']) {
      assert.equal(peut(client(role), 'leads:lire'), false);
      assert.equal(peut(client(role), 'audit:lire'), false);
    }
  });

  test('une capacité inconnue lève plutôt que d’accorder', () => {
    assert.throws(() => peut(client('admin'), 'tout:faire'), /Capacité inconnue/);
  });
});
