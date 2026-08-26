import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { buildApp } from '../src/app.js';
import { getOwnerPool } from '../src/db/pool.js';
import { hacher } from '../src/auth/passwords.js';
import { typeReel } from '../src/stockage/fichiers.js';
import { messagesEnvoyes, viderMessages } from '../src/mail/transport.js';
import { baseDisponible, RAISON_SAUT, closePools, connecterPersonnel } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\nfaux mais valide\n');
const EXECUTABLE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);

describe('Espace client', { skip: baseDisponible ? false : RAISON_SAUT }, () => {
  let app;
  let jeu;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    jeu = await preparer();
    viderMessages();
  });

  after(async () => {
    await getOwnerPool().query('delete from organisations where id = any($1)', [[jeu.a, jeu.b]]);
    await getOwnerPool().query('delete from users where id = $1', [jeu.staff]);
    await app.close();
    await closePools();
  });

  /**
   * Ouvre une session. Pour un compte 5/Sync, le second facteur est franchi
   * au passage : depuis le lot 5, une session de personnel qui ne l'a pas
   * franchi n'ouvre rien d'autre que son propre enrôlement.
   */
  const connecter = async (email) => {
    if (email.endsWith('@5sursync.com')) return connecterPersonnel(app, email);

    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/connexion',
      payload: { email, motDePasse: 'mot-de-passe-de-test' },
    });
    assert.equal(r.statusCode, 200, `connexion refusée pour ${email}`);
    return r.cookies.find((c) => c.name === '5sync_session').value;
  };

  const get = (url, jeton) =>
    app.inject({ method: 'GET', url, cookies: jeton ? { '5sync_session': jeton } : {} });

  // ── Accès ───────────────────────────────────────────────────────────────

  test('les six modules exigent une session', async () => {
    for (const m of ['tickets', 'projets', 'contrats', 'documents', 'parc', 'finances']) {
      const r = await get(`/api/v1/${m}`);
      assert.equal(r.statusCode, 401, `${m} accessible sans session`);
    }
  });

  test('un compte ne voit que son organisation, sur les six modules', async () => {
    const jetonA = await connecter(jeu.emailA);

    for (const m of ['tickets', 'projets', 'contrats', 'documents', 'parc', 'finances']) {
      const r = await get(`/api/v1/${m}`, jetonA);
      assert.equal(r.statusCode, 200);
      const lignes = r.json()[m];
      assert.equal(lignes.length, 1, `${m} : ${lignes.length} entrée(s) au lieu d'une`);
      // Les jeux de A et de B ne diffèrent que par cette lettre : chercher
      // « B » est le test qui distingue vraiment les deux périmètres.
      const serialise = JSON.stringify(lignes);
      assert.doesNotMatch(serialise, / B"|-B-/, `${m} a renvoyé une donnée de B`);
    }
  });

  test('demander explicitement une autre organisation est refusé', async () => {
    const jetonA = await connecter(jeu.emailA);
    const r = await get(`/api/v1/tickets?organisation=${jeu.b}`, jetonA);

    // 403 et non une liste vide : une tentative d'accès croisé doit laisser
    // une trace, pas produire une page qui a l'air normale.
    assert.equal(r.statusCode, 403);
  });

  test('un agent est refusé sur les pièces financières, pas sur les tickets', async () => {
    const jetonAgent = await connecter(jeu.emailAgent);

    assert.equal((await get('/api/v1/tickets', jetonAgent)).statusCode, 200);
    assert.equal((await get('/api/v1/finances', jetonAgent)).statusCode, 403);
  });

  test('une ressource d’un autre client est introuvable, pas interdite', async () => {
    const jetonA = await connecter(jeu.emailA);
    const r = await get(`/api/v1/tickets/${jeu.ticketB}`, jetonA);

    // 404 plutôt que 403 : répondre « interdit » confirmerait que la référence
    // existe, ce qui est déjà une information sur un autre client.
    assert.equal(r.statusCode, 404);
  });

  // ── Ouverture de tickets ────────────────────────────────────────────────

  test('un agent ouvre un ticket, et la référence est attribuée par le serveur', async () => {
    const jetonAgent = await connecter(jeu.emailAgent);
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      cookies: { '5sync_session': jetonAgent },
      payload: { objet: 'Imprimante hors ligne', niveau: 'n1' },
    });

    assert.equal(r.statusCode, 201);
    assert.match(r.json().reference, /^TCK-\d+$/);
    assert.equal(r.json().statut, 'ouvert');
  });

  test('l’ouverture déclenche un accusé de réception', async () => {
    viderMessages();
    const jetonAgent = await connecter(jeu.emailAgent);
    await app.inject({
      method: 'POST',
      url: '/api/v1/tickets',
      cookies: { '5sync_session': jetonAgent },
      payload: { objet: 'Seconde demande', niveau: 'n2' },
    });

    // L'envoi n'est pas attendu par la route : on laisse la file se vider.
    await new Promise((r) => setTimeout(r, 120));

    const [message] = messagesEnvoyes();
    assert.ok(message, 'aucun accusé de réception');
    assert.equal(message.to, jeu.emailAgent);
    // L'objet du courriel ne divulgue rien : « TCK-0000 » n'apprend rien à qui
    // lit par-dessus l'épaule, l'objet du ticket si.
    assert.doesNotMatch(message.subject, /Seconde demande/);
    assert.ok(message.text.includes('Seconde demande'), 'le corps doit porter l’objet');
    assert.ok(message.html && message.text, 'les deux versions sont requises');
  });

  test('un objet vide ou démesuré est refusé', async () => {
    const jetonAgent = await connecter(jeu.emailAgent);
    const envoyer = (objet) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/tickets',
        cookies: { '5sync_session': jetonAgent },
        payload: { objet },
      });

    assert.equal((await envoyer('')).statusCode, 400);
    assert.equal((await envoyer('x'.repeat(301))).statusCode, 400);
  });

  // ── Documents ───────────────────────────────────────────────────────────

  test('le type de fichier se lit dans le contenu, pas dans le nom', () => {
    assert.equal(typeReel(PDF), 'application/pdf');
    assert.equal(typeReel(EXECUTABLE), null, 'un exécutable ne doit correspondre à aucun type');
  });

  test('un client ne peut pas déposer de document', async () => {
    const jetonA = await connecter(jeu.emailA);
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/documents/${jeu.documentA}/versions`,
      cookies: { '5sync_session': jetonA },
      // Envoi conforme, pour que le refus vienne bien de la CAPACITÉ. Avec un
      // corps non-multipart, Fastify répondrait 415 avant même d'entrer dans
      // la route : le test passerait sans rien prouver du contrôle d'accès.
      payload: formulaire(PDF, 'rapport.pdf'),
      headers: { 'content-type': `multipart/form-data; boundary=${FRONTIERE}` },
    });

    // Un client consulte ses livrables, il ne les produit pas.
    assert.equal(r.statusCode, 403);
  });

  test('un corps non-multipart est rejeté avant la route', async () => {
    // Constat d'ordre, pas une faille : le refus arrive quand même. Mais il
    // faut le savoir, sinon un test de contrôle d'accès mal formé passe au
    // vert sans avoir atteint la vérification qu'il prétend couvrir.
    const jetonStaff = await connecter(jeu.emailStaff);
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/documents/${jeu.documentA}/versions`,
      cookies: { '5sync_session': jetonStaff },
      payload: PDF,
      headers: { 'content-type': 'application/pdf' },
    });

    assert.equal(r.statusCode, 415);
  });

  test('le personnel dépose, et la version s’incrémente sans écraser', async () => {
    const jetonStaff = await connecter(jeu.emailStaff);
    const versions = [];

    for (let i = 0; i < 2; i += 1) {
      const r = await app.inject({
        method: 'POST',
        url: `/api/v1/documents/${jeu.documentA}/versions`,
        cookies: { '5sync_session': jetonStaff },
        payload: formulaire(PDF, 'rapport.pdf'),
        headers: { 'content-type': `multipart/form-data; boundary=${FRONTIERE}` },
      });
      assert.equal(r.statusCode, 201, r.body);
      versions.push(r.json().version);
    }

    assert.deepEqual(versions, [1, 2]);
  });

  test('un exécutable renommé en .pdf est refusé', async () => {
    const jetonStaff = await connecter(jeu.emailStaff);
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/documents/${jeu.documentA}/versions`,
      cookies: { '5sync_session': jetonStaff },
      payload: formulaire(EXECUTABLE, 'rapport.pdf'),
      headers: { 'content-type': `multipart/form-data; boundary=${FRONTIERE}` },
    });

    assert.equal(r.statusCode, 415);
    assert.match(r.json().message, /non autorisé/i);
  });

  test('le téléchargement rend le fichier à l’octet, sans mise en cache', async () => {
    const jetonA = await connecter(jeu.emailA);
    const r = await get(`/api/v1/documents/${jeu.documentA}/telecharger`, jetonA);

    assert.equal(r.statusCode, 200);
    assert.equal(r.headers['content-type'], 'application/pdf');
    // Un document client ne doit jamais être retenu par un intermédiaire : le
    // contrôle d'accès se rejoue à chaque requête.
    assert.match(r.headers['cache-control'], /no-store/);
    assert.match(r.headers['content-disposition'], /^attachment/);
    assert.ok(r.rawPayload.equals(PDF));
  });

  test('un client ne télécharge pas le document d’un autre', async () => {
    const jetonA = await connecter(jeu.emailA);
    const r = await get(`/api/v1/documents/${jeu.documentB}/telecharger`, jetonA);
    assert.equal(r.statusCode, 404);
  });

  // ── Indicateurs ─────────────────────────────────────────────────────────

  test('les indicateurs sont calculés dans le périmètre du demandeur', async () => {
    const jetonA = await connecter(jeu.emailA);
    const jetonB = await connecter(jeu.emailB);

    const a = (await get('/api/v1/parc/indicateurs', jetonA)).json();
    const b = (await get('/api/v1/parc/indicateurs', jetonB)).json();

    // Volumes différents à dessein : à volumes égaux, un indicateur qui
    // compterait la mauvaise organisation donnerait le même chiffre.
    assert.equal(a.suivis, 12);
    assert.equal(b.suivis, 3);
  });
});

// ── Utilitaires ───────────────────────────────────────────────────────────

const FRONTIERE = '----5syncTest';

function formulaire(contenu, nom) {
  return Buffer.concat([
    Buffer.from(
      `--${FRONTIERE}\r\n` +
        `content-disposition: form-data; name="fichier"; filename="${nom}"\r\n` +
        'content-type: application/octet-stream\r\n\r\n',
    ),
    contenu,
    Buffer.from(`\r\n--${FRONTIERE}--\r\n`),
  ]);
}

async function preparer() {
  const pool = getOwnerPool();
  const suffixe = `${process.pid}-${Date.now()}`;
  const empreinte = await hacher('mot-de-passe-de-test');

  const org = async (nom) =>
    (
      await pool.query(
        'insert into organisations (nom, pays, est_demo) values ($1,$2,true) returning id',
        [`${nom} ${suffixe}`, 'Sénégal'],
      )
    ).rows[0].id;

  const a = await org('Organisation A');
  const b = await org('Organisation B');

  const compte = async (organisationId, role, email) => {
    const { rows } = await pool.query(
      `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
       values ($1,$2,$3,$4,$5) returning id`,
      [organisationId, role, email, `Compte ${role}`, empreinte],
    );
    return rows[0].id;
  };

  const emailA = `ref-a-${suffixe}@test.sn`;
  const emailB = `ref-b-${suffixe}@test.sn`;
  const emailAgent = `agent-${suffixe}@test.sn`;
  const emailStaff = `staff-${suffixe}@5sursync.com`;

  await compte(a, 'client_admin', emailA);
  await compte(b, 'client_admin', emailB);
  await compte(a, 'client_user', emailAgent);
  const staff = await compte(null, 'staff', emailStaff);

  // Une entrée par module, de chaque côté, pour que « une seule ligne » soit
  // une assertion qui distingue vraiment les deux périmètres.
  const ticketA = randomUUID();
  for (const [org_, marque] of [[a, 'A'], [b, 'B']]) {
    await pool.query(
      "insert into tickets (organisation_id, reference, objet) values ($1,$2,$3)",
      [org_, `TCK-${marque}-${suffixe}`, `Ticket ${marque}`],
    );
    const { rows: [p] } = await pool.query(
      'insert into projets (organisation_id, nom) values ($1,$2) returning id',
      [org_, `Projet ${marque}`],
    );
    await pool.query(
      "insert into jalons (organisation_id, projet_id, libelle) values ($1,$2,'J1')",
      [org_, p.id],
    );
    await pool.query(
      `insert into contrats (organisation_id, reference, intitule, forfait_heures)
       values ($1,$2,$3,100)`,
      [org_, `CT-${marque}-${suffixe}`, `Contrat ${marque}`],
    );
    await pool.query(
      'insert into equipements (organisation_id, designation, quantite) values ($1,$2,$3)',
      [org_, `Équipement ${marque}`, marque === 'A' ? 12 : 3],
    );
    await pool.query(
      `insert into pieces (organisation_id, reference, type, objet, montant_fcfa)
       values ($1,$2,'facture',$3,1000)`,
      [org_, `FAC-${marque}-${suffixe}`, `Pièce ${marque}`],
    );
  }

  const doc = async (organisationId, nom) =>
    (
      await pool.query(
        'insert into documents (organisation_id, nom) values ($1,$2) returning id',
        [organisationId, nom],
      )
    ).rows[0].id;

  const documentA = await doc(a, 'Livrable A');
  const documentB = await doc(b, 'Livrable B');

  const { rows: [tb] } = await pool.query(
    'select id from tickets where organisation_id = $1 limit 1',
    [b],
  );

  return {
    a, b, staff, documentA, documentB, ticketA,
    ticketB: tb.id,
    emailA, emailB, emailAgent, emailStaff,
  };
}
