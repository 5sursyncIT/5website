import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { baseDisponible, RAISON_SAUT, jeuDeuxOrganisations, closePools } from './helpers.js';
import { config } from '../src/config.js';

/**
 * Isolation vue depuis l'extérieur.
 *
 * Les tests d'isolation.test.js prouvent que PostgreSQL refuse. Ceux-ci
 * prouvent que le refus survit à la traversée de la pile : cookie, session,
 * dérivation du périmètre, dépôt, politique. C'est le trajet que ferait une
 * vraie tentative.
 */
describe('API — isolation de bout en bout', { skip: baseDisponible ? false : RAISON_SAUT }, () => {
  let app;
  let jeu;
  let cookieA;
  let cookiePersonnel;

  const connexion = async (email) => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/connexion',
      payload: { email, motDePasse: jeu.motDePasse },
    });
    assert.equal(r.statusCode, 200, `connexion refusée pour ${email}`);
    return r.cookies.find((c) => c.name === config.cookieName).value;
  };

  before(async () => {
    jeu = await jeuDeuxOrganisations();
    app = buildApp({ logger: false });
    await app.ready();

    cookieA = await connexion(jeu.emailA);

    const { rows } = await (await import('../src/db/pool.js')).getOwnerPool().query(
      'select email from users where id = $1',
      [jeu.personnel],
    );
    cookiePersonnel = await connexion(rows[0].email);
  });

  after(async () => {
    await app?.close();
    await jeu?.nettoyer();
    await closePools();
  });

  const avec = (cookie, url) =>
    app.inject({ method: 'GET', url, cookies: { [config.cookieName]: cookie } });

  test('sans cookie, tout est refusé', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/v1/tickets' });

    assert.equal(r.statusCode, 401);
  });

  test('un cookie inventé est refusé', async () => {
    const r = await avec('jeton-fabrique-de-toutes-pieces-0000', '/api/v1/tickets');

    assert.equal(r.statusCode, 401);
  });

  test('un client ne reçoit que ses propres tickets', async () => {
    const r = await avec(cookieA, '/api/v1/tickets');

    assert.equal(r.statusCode, 200);
    const { tickets } = r.json();
    assert.equal(tickets.length, 1);
    assert.equal(tickets[0].objet, 'Dossier confidentiel de A');
  });

  test('demander explicitement une autre organisation renvoie 403', async () => {
    // La tentative la plus directe : passer l'identifiant d'un autre client
    // dans la requête.
    const r = await avec(cookieA, `/api/v1/tickets?organisation=${jeu.b}`);

    assert.equal(r.statusCode, 403);
  });

  test('demander sa propre organisation reste permis', async () => {
    const r = await avec(cookieA, `/api/v1/tickets?organisation=${jeu.a}`);

    assert.equal(r.statusCode, 200);
  });

  test('un ticket d’un autre client répond 404, pas 403', async () => {
    // 403 confirmerait que la référence existe. 404 ne dit rien : un ticket
    // hors périmètre est indistinguable d'un ticket inexistant.
    const r = await avec(cookieA, `/api/v1/tickets/${jeu.ticketB}`);

    assert.equal(r.statusCode, 404);

    const inexistant = await avec(cookieA, '/api/v1/tickets/00000000-0000-0000-0000-000000000000');
    assert.equal(inexistant.statusCode, 404);
  });

  test('les indicateurs ne comptent que le périmètre du client', async () => {
    const r = await avec(cookieA, '/api/v1/tickets/indicateurs');

    assert.equal(r.json().ouverts, 1);
  });

  test('le personnel 5/Sync peut ouvrir le périmètre d’un client', async () => {
    const a = await avec(cookiePersonnel, `/api/v1/tickets?organisation=${jeu.a}`);
    const b = await avec(cookiePersonnel, `/api/v1/tickets?organisation=${jeu.b}`);

    assert.equal(a.json().tickets[0].objet, 'Dossier confidentiel de A');
    assert.equal(b.json().tickets[0].objet, 'Dossier confidentiel de B');
  });

  test('la déconnexion coupe l’accès immédiatement', async () => {
    const cookie = await connexion(jeu.emailA);
    assert.equal((await avec(cookie, '/api/v1/tickets')).statusCode, 200);

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/deconnexion',
      cookies: { [config.cookieName]: cookie },
    });

    assert.equal((await avec(cookie, '/api/v1/tickets')).statusCode, 401);
  });

  test('le cookie de session est httpOnly et sameSite', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/connexion',
      payload: { email: jeu.emailA, motDePasse: jeu.motDePasse },
    });

    const cookie = r.cookies.find((c) => c.name === config.cookieName);
    assert.equal(cookie.httpOnly, true, 'un XSS pourrait lire la session');
    assert.equal(cookie.sameSite.toLowerCase(), 'lax');
  });

  test('des identifiants invalides ne distinguent pas les cas', async () => {
    const mauvaisMotDePasse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/connexion',
      payload: { email: jeu.emailA, motDePasse: 'faux' },
    });
    const emailInconnu = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/connexion',
      payload: { email: 'personne@nulle-part.sn', motDePasse: 'faux' },
    });

    assert.equal(mauvaisMotDePasse.statusCode, 401);
    assert.deepEqual(mauvaisMotDePasse.json(), emailInconnu.json());
  });
});
