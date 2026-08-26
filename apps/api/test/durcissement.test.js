import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

import { buildApp } from '../src/app.js';
import { getOwnerPool } from '../src/db/pool.js';
import { hacher } from '../src/auth/passwords.js';
import * as totp from '../src/auth/totp.js';
import * as antivirus from '../src/stockage/antivirus.js';
import { SEUILS } from '../src/auth/limitation.js';
import { baseDisponible, RAISON_SAUT, closePools } from './helpers.js';

describe('Durcissement', { skip: baseDisponible ? false : RAISON_SAUT }, () => {
  let app;
  let jeu;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    jeu = await preparer();
  });

  after(async () => {
    const pool = getOwnerPool();
    await pool.query('delete from organisations where id = $1', [jeu.org]);
    await pool.query('delete from users where id = $1', [jeu.staff]);
    await pool.query('delete from tentatives_connexion where email like $1', ['%@durcissement.test']);
    await app.close();
    await closePools();
  });

  const connecter = (email, motDePasse = 'mot-de-passe-de-test', ip = '198.51.100.1') =>
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/connexion',
      payload: { email, motDePasse },
      headers: { 'x-forwarded-for': ip },
    });

  const jetonDe = (reponse) => reponse.cookies.find((c) => c.name === '5sync_session')?.value;

  // ── TOTP : conformité de l'algorithme ───────────────────────────────────

  test('les codes suivent la RFC 6238', () => {
    // Vecteurs officiels de la RFC : secret ASCII « 12345678901234567890 ».
    // Vérifier contre la norme et non contre soi-même est la seule façon de
    // savoir qu'une implémentation de crypto est juste.
    const RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const vrai = Date.now;

    try {
      Date.now = () => 59_000;
      assert.equal(totp.verifier(RFC, '287082'), true, 'vecteur T=59');

      Date.now = () => 1_111_111_109_000;
      assert.equal(totp.verifier(RFC, '081804'), true, 'vecteur T=1111111109');

      Date.now = () => 1_234_567_890_000;
      assert.equal(totp.verifier(RFC, '005924'), true, 'vecteur T=1234567890');
    } finally {
      Date.now = vrai;
    }
  });

  test('un code malformé ou erroné est refusé', () => {
    const secret = totp.genererSecret();
    for (const mauvais of ['', '00000', '0000000', 'abcdef', null, undefined, '12 34 56']) {
      assert.equal(totp.verifier(secret, mauvais), false, `accepté : ${mauvais}`);
    }
  });

  test('deux secrets générés diffèrent, et font 160 bits', () => {
    const a = totp.genererSecret();
    const b = totp.genererSecret();
    assert.notEqual(a, b);
    assert.equal(a.length, 32, '32 caractères base32 = 160 bits');
  });

  // ── TOTP : le verrou ────────────────────────────────────────────────────

  test('une session 5/Sync sans second facteur n’ouvre rien', async () => {
    const jeton = jetonDe(await connecter(jeu.emailStaff));
    assert.ok(jeton);

    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/organisations',
      cookies: { '5sync_session': jeton },
    });

    assert.equal(r.statusCode, 403);
    assert.equal(r.json().error, 'second_facteur_requis');
  });

  test('elle peut en revanche atteindre son propre enrôlement', async () => {
    // Sans cette exception, un compte 5/Sync nouvellement créé aurait besoin
    // d'un second facteur pour poser son second facteur.
    const jeton = jetonDe(await connecter(jeu.emailStaff, 'mot-de-passe-de-test', '198.51.100.2'));

    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/enrolement',
      cookies: { '5sync_session': jeton },
    });

    assert.equal(r.statusCode, 200);
    assert.equal(r.json().secret.length, 32);
    assert.match(r.json().uri, /^otpauth:\/\/totp\//);
  });

  test('le parcours complet ouvre la session, un code erroné ne l’ouvre pas', async () => {
    const jeton = jetonDe(await connecter(jeu.emailStaff, 'mot-de-passe-de-test', '198.51.100.3'));
    const entete = { '5sync_session': jeton };

    // On repart d'un compte sans secret pour ce test.
    await getOwnerPool().query('update users set totp_secret = null where id = $1', [jeu.staff]);

    const enrolement = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/enrolement',
      cookies: entete,
    });
    const { secret } = enrolement.json();

    const mauvais = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/verifier',
      cookies: entete,
      payload: { code: '000000' },
      headers: { 'x-forwarded-for': '198.51.100.3' },
    });
    assert.equal(mauvais.statusCode, 401);

    const bon = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/verifier',
      cookies: entete,
      payload: { code: codeCourant(secret) },
      headers: { 'x-forwarded-for': '198.51.100.3' },
    });
    assert.equal(bon.statusCode, 200);

    const apres = await app.inject({
      method: 'GET',
      url: '/api/v1/organisations',
      cookies: entete,
    });
    assert.equal(apres.statusCode, 200, 'la session doit être ouverte après le second facteur');
  });

  test('un compte client n’est pas soumis au second facteur', async () => {
    const jeton = jetonDe(await connecter(jeu.emailClient, 'mot-de-passe-de-test', '198.51.100.4'));
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/tickets',
      cookies: { '5sync_session': jeton },
    });
    assert.equal(r.statusCode, 200);
  });

  test('un secret déjà posé ne se remplace pas sur simple demande', async () => {
    // Ce serait le moyen le plus simple de contourner le second facteur depuis
    // une session volée.
    const jeton = jetonDe(await connecter(jeu.emailStaff, 'mot-de-passe-de-test', '198.51.100.5'));
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/totp/enrolement',
      cookies: { '5sync_session': jeton },
    });
    assert.equal(r.statusCode, 409);
  });

  // ── Limitation des tentatives ───────────────────────────────────────────

  test('le compte se verrouille après cinq échecs, quelle que soit l’adresse', async () => {
    const email = `verrou-${Date.now()}@durcissement.test`;
    await creerCompte(email);

    const codes = [];
    for (let i = 0; i < SEUILS.parCompte + 1; i += 1) {
      // Adresse différente à chaque essai : seule la limite PAR COMPTE peut
      // arrêter cela, et c'est précisément le cas qu'une limite par adresse
      // laisse passer.
      const r = await connecter(email, 'mauvais', `203.0.113.${20 + i}`);
      codes.push(r.statusCode);
    }

    assert.deepEqual(codes.slice(0, SEUILS.parCompte), Array(SEUILS.parCompte).fill(401));
    assert.equal(codes.at(-1), 429);
  });

  test('le blocage annonce quand réessayer', async () => {
    const email = `retry-${Date.now()}@durcissement.test`;
    await creerCompte(email);
    for (let i = 0; i <= SEUILS.parCompte; i += 1) await connecter(email, 'mauvais', '203.0.113.90');

    const r = await connecter(email, 'mauvais', '203.0.113.90');
    assert.equal(r.statusCode, 429);
    assert.ok(Number(r.headers['retry-after']) > 0);
    assert.ok(r.json().reprendreDans > 0);
  });

  test('une connexion réussie efface l’ardoise', async () => {
    // Sans cela, quatre erreurs de frappe suivies d'une réussite laisseraient
    // le compte à une tentative du verrouillage.
    const email = `ardoise-${Date.now()}@durcissement.test`;
    await creerCompte(email);

    for (let i = 0; i < SEUILS.parCompte - 1; i += 1) await connecter(email, 'mauvais', '203.0.113.95');
    assert.equal((await connecter(email, 'mot-de-passe-de-test', '203.0.113.95')).statusCode, 200);

    const { rows } = await getOwnerPool().query(
      'select count(*)::int n from tentatives_connexion where email = $1 and not reussie',
      [email],
    );
    assert.equal(rows[0].n, 0);
  });

  test('les tentatives sont tracées, réussies comme échouées', async () => {
    const email = `trace-${Date.now()}@durcissement.test`;
    await creerCompte(email);
    await connecter(email, 'mauvais', '203.0.113.99');

    const { rows } = await getOwnerPool().query(
      'select reussie, ip from tentatives_connexion where email = $1',
      [email],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].reussie, false);
    assert.ok(rows[0].ip, "l'adresse doit être conservée pour tracer les abus");
  });

  // ── Antivirus ───────────────────────────────────────────────────────────

  test('sans antivirus configuré, le dépôt passe mais hors production', async () => {
    const verdict = await antivirus.analyser(Buffer.from('%PDF-1.4'), { env: 'test' });
    assert.equal(verdict.analyse, false);
  });

  test('en production, un antivirus configuré mais injoignable fait échouer le dépôt', async (t) => {
    // Accepter « parce que le scanner est en panne » revient à n'avoir aucun
    // scanner les jours où ça compte.
    const ancien = process.env.CLAMD_HOST;
    process.env.CLAMD_HOST = '127.0.0.1';
    process.env.CLAMD_PORT = '1'; // port fermé
    t.after(() => {
      if (ancien === undefined) delete process.env.CLAMD_HOST;
      else process.env.CLAMD_HOST = ancien;
    });

    // Le module lit sa configuration au chargement : on réimporte pour que le
    // changement soit pris en compte.
    const frais = await import(`../src/stockage/antivirus.js?t=${Date.now()}`);
    await assert.rejects(
      () => frais.analyser(Buffer.from('%PDF'), { env: 'production' }),
      /injoignable/i,
    );
  });

  // ── Utilitaires ─────────────────────────────────────────────────────────

  function codeCourant(secret) {
    // Recalcule le code comme le ferait l'application du téléphone.
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = '';
    for (const c of secret) bits += A.indexOf(c).toString(2).padStart(5, '0');
    const octets = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) octets.push(Number.parseInt(bits.slice(i, i + 8), 2));

    const compteur = Buffer.alloc(8);
    compteur.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));

    const h = createHmac('sha1', Buffer.from(octets)).update(compteur).digest();
    const d = h[h.length - 1] & 0x0f;
    const b =
      ((h[d] & 0x7f) << 24) | ((h[d + 1] & 0xff) << 16) | ((h[d + 2] & 0xff) << 8) | (h[d + 3] & 0xff);
    return String(b % 1_000_000).padStart(6, '0');
  }

  async function creerCompte(email) {
    const empreinte = await hacher('mot-de-passe-de-test');
    await getOwnerPool().query(
      `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
       values ($1, 'client_user', $2, 'Compte de test', $3)`,
      [jeu.org, email, empreinte],
    );
  }

  async function preparer() {
    const pool = getOwnerPool();
    const suffixe = `${process.pid}-${Date.now()}`;
    const empreinte = await hacher('mot-de-passe-de-test');

    const { rows: [org] } = await pool.query(
      'insert into organisations (nom, pays, est_demo) values ($1, $2, true) returning id',
      [`Durcissement ${suffixe}`, 'Sénégal'],
    );

    const emailStaff = `staff-${suffixe}@durcissement.test`;
    const emailClient = `client-${suffixe}@durcissement.test`;

    const { rows: [staff] } = await pool.query(
      `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
       values (null, 'staff', $1, 'Intervenant', $2) returning id`,
      [emailStaff, empreinte],
    );
    await pool.query(
      `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
       values ($1, 'client_admin', $2, 'Référent', $3)`,
      [org.id, emailClient, empreinte],
    );

    return { org: org.id, staff: staff.id, emailStaff, emailClient };
  }
});
