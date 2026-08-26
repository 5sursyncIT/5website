import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { getOwnerPool } from '../src/db/pool.js';
import { baseDisponible, RAISON_SAUT, closePools } from './helpers.js';

/**
 * Formulaire de contact — la seule route d'écriture ouverte sans
 * authentification du service. Elle est donc testée comme une surface
 * d'attaque autant que comme une fonctionnalité.
 */
describe('Demandes de contact', { skip: baseDisponible ? false : RAISON_SAUT }, () => {
  let app;

  const envoyer = (corps, ip = '203.0.113.1') =>
    app.inject({
      method: 'POST',
      url: '/api/v1/leads',
      payload: corps,
      // La limitation de débit compte par adresse : chaque test s'attribue la
      // sienne, sinon l'ordre d'exécution déciderait des résultats.
      headers: { 'x-forwarded-for': ip },
    });

  const VALIDE = {
    organisation: 'Ville de Thiès',
    nom: 'Awa Ndiaye',
    email: 'awa@thies.sn',
    besoins: ['Cybersécurité'],
    contexte: 'Trois sites à interconnecter.',
  };

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
  });

  after(async () => {
    await getOwnerPool().query("delete from leads where email like '%@thies.sn' or email like '%@essai.sn'");
    await app.close();
    await closePools();
  });

  test('une demande valide est enregistrée', async () => {
    const r = await envoyer(VALIDE, '203.0.113.10');
    assert.equal(r.statusCode, 201);
    assert.equal(r.json().recu, true);

    const { rows } = await getOwnerPool().query(
      'select organisation, besoins, ip from leads where id = $1',
      [r.json().id],
    );
    assert.equal(rows[0].organisation, 'Ville de Thiès');
    assert.deepEqual(rows[0].besoins, ['Cybersécurité']);
    assert.ok(rows[0].ip, "l'adresse doit être conservée pour tracer les abus");
  });

  test('les champs requis sont exigés', async () => {
    const r = await envoyer({ organisation: '', nom: '', email: '' }, '203.0.113.11');
    assert.equal(r.statusCode, 400);
    const { champs } = r.json();
    assert.ok(champs.organisation && champs.nom && champs.email);
  });

  test('une adresse électronique malformée est refusée', async () => {
    const r = await envoyer({ ...VALIDE, email: 'pas-un-email' }, '203.0.113.12');
    assert.equal(r.statusCode, 400);
    assert.match(r.json().champs.email, /invalide/i);
  });

  test('une nature de besoin hors liste est refusée', async () => {
    // La liste est fermée côté serveur : un client ne choisit pas ses propres
    // catégories, même en postant directement sur l'API.
    const r = await envoyer({ ...VALIDE, besoins: ['Injection'] }, '203.0.113.13');
    assert.equal(r.statusCode, 400);
    assert.ok(r.json().champs.besoins);
  });

  test('un champ démesuré est refusé plutôt que tronqué', async () => {
    const r = await envoyer({ ...VALIDE, contexte: 'x'.repeat(5001) }, '203.0.113.14');
    assert.equal(r.statusCode, 400);
    assert.ok(r.json().champs.contexte);
  });

  test('le champ-piège est accepté en silence, sans rien enregistrer', async () => {
    const avant = await compter();
    const r = await envoyer({ ...VALIDE, email: 'robot@essai.sn', site: 'http://spam' }, '203.0.113.15');

    // 202 et non 400 : signaler le rejet apprendrait au robot à contourner le
    // piège. Il doit croire que sa demande est passée.
    assert.equal(r.statusCode, 202);
    assert.equal(await compter(), avant, 'aucune ligne ne doit être créée');
  });

  test('la limitation de débit se déclenche à la sixième demande', async () => {
    const ip = '203.0.113.99';
    const codes = [];
    for (let i = 0; i < 6; i += 1) {
      codes.push((await envoyer({ ...VALIDE, email: `n${i}@thies.sn` }, ip)).statusCode);
    }
    assert.deepEqual(codes.slice(0, 5), [201, 201, 201, 201, 201]);
    assert.equal(codes[5], 429);
  });

  test('la limitation compte par adresse, pas globalement', async () => {
    // Sans cela, un seul robot suffirait à fermer le formulaire pour tout le
    // monde — un déni de service à coût nul.
    const r = await envoyer({ ...VALIDE, email: 'autre@thies.sn' }, '203.0.113.200');
    assert.equal(r.statusCode, 201);
  });

  test('la liste des demandes exige une authentification', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/leads' });
    assert.equal(r.statusCode, 401);
  });

  async function compter() {
    const { rows } = await getOwnerPool().query('select count(*)::int n from leads');
    return rows[0].n;
  }
});
