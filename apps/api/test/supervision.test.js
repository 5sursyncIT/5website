import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildApp } from '../src/app.js';
import { config } from '../src/config.js';
import { reinitialiser } from '../src/supervision/compteurs.js';
import { formater } from '../src/supervision/format.js';
import { baseDisponible, RAISON_SAUT, closePools } from './helpers.js';

/**
 * Supervision.
 *
 * Ce qui est vérifié ici n'est pas « la route répond » mais les trois
 * propriétés dont dépend l'utilité d'une métrique : qu'elle soit fermée à qui
 * n'a pas le jeton, qu'une valeur inconnue ne soit pas rendue comme un zéro
 * rassurant, et que le nombre de séries reste borné par le code plutôt que par
 * le trafic.
 */
describe('Supervision', () => {
  let app;
  let jetonInitial;
  let repertoire;

  const JETON = 'jeton-de-supervision-pour-les-tests';

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    jetonInitial = config.metricsToken;
    repertoire = await mkdtemp(join(tmpdir(), '5sync-supervision-'));
  });

  after(async () => {
    config.metricsToken = jetonInitial;
    delete process.env.SAUVEGARDE_DIR;
    await app?.close();
    await rm(repertoire, { recursive: true, force: true });
    await closePools();
  });

  const relever = (jeton) =>
    app.inject({
      method: 'GET',
      url: '/api/v1/metrics',
      headers: jeton ? { authorization: `Bearer ${jeton}` } : {},
    });

  // ── Accès ───────────────────────────────────────────────────────────────

  test('sans jeton configuré, la route n’existe pas', async () => {
    config.metricsToken = null;
    const r = await relever(JETON);

    // 404 et non 403 : répondre « interdit » confirmerait qu'il y a des
    // métriques à cette adresse, ce qui est déjà une information.
    assert.equal(r.statusCode, 404);
  });

  test('avec un jeton configuré, le relevé est fermé sans en-tête', async () => {
    config.metricsToken = JETON;

    assert.equal((await relever(null)).statusCode, 401);
    assert.equal((await relever('mauvais-jeton')).statusCode, 401);
    // Un préfixe correct du bon jeton ne doit pas passer davantage qu'un jeton
    // quelconque : c'est ce que la comparaison à durée constante garantit.
    assert.equal((await relever(JETON.slice(0, -1))).statusCode, 401);
    assert.equal((await relever(`${JETON}x`)).statusCode, 401);
  });

  test('le bon jeton donne un relevé au format Prometheus, jamais mis en cache', async () => {
    config.metricsToken = JETON;
    const r = await relever(JETON);

    assert.equal(r.statusCode, 200);
    assert.match(r.headers['content-type'], /^text\/plain; version=0\.0\.4/);
    // Une métrique servie depuis un cache décrit un instant qui n'est plus.
    assert.match(r.headers['cache-control'], /no-store/);
    assert.match(r.body, /^# HELP cinqsync_base_disponible /m);
    assert.match(r.body, /^# TYPE cinqsync_base_disponible gauge$/m);
  });

  test('aucun nom de métrique ne commence par un chiffre', async () => {
    config.metricsToken = JETON;
    const r = await relever(JETON);

    // Prometheus impose [a-zA-Z_:][a-zA-Z0-9_:]* : « 5sync_… » se lirait dans
    // une expression PromQL comme le nombre 5 suivi de charabia, et promtool
    // refuse les règles qui l'emploient.
    for (const ligne of r.body.split('\n')) {
      if (!ligne || ligne.startsWith('#')) continue;
      const nom = ligne.split(/[ {]/)[0];
      assert.match(nom, /^[a-zA-Z_:][a-zA-Z0-9_:]*$/, `nom de métrique invalide : ${nom}`);
    }
  });

  // ── Une valeur absente n'est pas zéro ──────────────────────────────────

  test('sans sauvegarde, la série n’est pas émise — surtout pas à zéro', async () => {
    process.env.SAUVEGARDE_DIR = repertoire;
    config.metricsToken = JETON;

    const r = await relever(JETON);

    // Zéro voudrait dire « sauvegarde d'il y a une seconde », soit exactement
    // l'inverse de la vérité : l'alerte de retard ne partirait jamais. C'est
    // l'absence de série que la règle « absent(...) » attrape.
    assert.doesNotMatch(r.body, /cinqsync_sauvegarde_age_secondes/);
    assert.doesNotMatch(r.body, /cinqsync_restauration_exercice_age_secondes/);
    assert.doesNotMatch(r.body, /cinqsync_hors_site_age_secondes/);
  });

  test('l’âge de la sauvegarde vient du manifeste, pas de la date du fichier', async () => {
    process.env.SAUVEGARDE_DIR = repertoire;
    config.metricsToken = JETON;

    // Manifeste daté d'il y a deux jours, écrit à l'instant. Un âge tiré de la
    // date du FICHIER dirait « zéro seconde » — et c'est exactement ce qui
    // arrive après une copie, un rsync ou une restauration de volume, qui
    // feraient passer pour fraîche une sauvegarde de la semaine dernière.
    const ilYADeuxJours = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    const h = ilYADeuxJours.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    await writeFile(
      join(repertoire, 'dernier.manifeste'),
      `horodatage=${h}\nbase=5sync\nmethode=age\nempreinte_sha256=abc\n`,
    );

    const r = await relever(JETON);
    const age = Number(/^cinqsync_sauvegarde_age_secondes (\d+)$/m.exec(r.body)?.[1]);

    assert.ok(age > 47 * 3600 && age < 49 * 3600, `âge relevé : ${age} s`);
    assert.match(r.body, /^cinqsync_sauvegarde_authentifiee\{methode="age"\} 1$/m);
  });

  test('une sauvegarde openssl est signalée comme non authentifiée', async () => {
    process.env.SAUVEGARDE_DIR = repertoire;
    config.metricsToken = JETON;

    await writeFile(
      join(repertoire, 'dernier.manifeste'),
      `horodatage=20260101T000000Z\nbase=5sync\nmethode=openssl\n`,
    );

    const r = await relever(JETON);

    // openssl enc chiffre sans authentifier : une altération ne se verrait pas
    // au déchiffrement. C'est ce que la règle d'alerte guette.
    assert.match(r.body, /^cinqsync_sauvegarde_authentifiee\{methode="openssl"\} 0$/m);
  });

  // ── Cardinalité ─────────────────────────────────────────────────────────

  test('les séries portent le gabarit de route, jamais l’URL', async () => {
    config.metricsToken = JETON;
    reinitialiser();

    const identifiants = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '33333333-3333-4333-8333-333333333333',
    ];
    for (const id of identifiants) {
      await app.inject({ method: 'GET', url: `/api/v1/tickets/${id}` });
    }

    const r = await relever(JETON);

    // Trois identifiants, UNE série. Étiqueter par URL en produirait une par
    // ticket rencontré : quelques milliers de tickets, et le collecteur garde
    // des centaines de milliers de séries pour rien.
    for (const id of identifiants) {
      assert.doesNotMatch(r.body, new RegExp(id), 'un identifiant a fui dans une étiquette');
    }
    assert.match(r.body, /cinqsync_requetes_total\{code="401",route="\/api\/v1\/tickets\/:id"\} 3/);
  });

  test('une URL inconnue ne crée pas une série par tentative', async () => {
    config.metricsToken = JETON;
    reinitialiser();

    for (let i = 0; i < 5; i += 1) {
      await app.inject({ method: 'GET', url: `/api/v1/sonde-de-robot-${i}` });
    }

    const r = await relever(JETON);
    const series = r.body.split('\n').filter((l) => l.startsWith('cinqsync_requetes_total{'));

    // Un balayage d'URL par un robot ne doit pas faire grossir le collecteur :
    // tout ce qui n'a pas de gabarit est regroupé sous « inconnue ».
    assert.ok(
      series.some((l) => l.includes('route="inconnue"') && l.endsWith(' 5')),
      series.join('\n'),
    );
    assert.doesNotMatch(r.body, /sonde-de-robot/);
  });

  // ── Le rendu ────────────────────────────────────────────────────────────

  test('le rendu ne casse pas quand la base est à terre', () => {
    // C'est le moment où l'on a le plus besoin que le relevé réponde : si la
    // supervision tombe en même temps que la base, il ne reste rien pour dire
    // ce qui se passe.
    const sortie = formater({
      env: 'production',
      baseDisponible: 0,
      base: null,
      sauvegarde: { presente: false, ageSecondes: null, authentifiee: false },
      ageExercice: null,
      ageHorsSite: null,
    });

    assert.match(sortie, /^cinqsync_base_disponible 0$/m);
    assert.match(sortie, /^cinqsync_service_info\{env="production"\} 1$/m);
    assert.doesNotMatch(sortie, /cinqsync_organisations/);
    assert.ok(sortie.endsWith('\n'), 'le format exige une ligne finale');
  });

  // ── Métier ──────────────────────────────────────────────────────────────

  test('les chiffres métier sont relevés', { skip: baseDisponible ? false : RAISON_SAUT }, async () => {
    delete process.env.SAUVEGARDE_DIR;
    config.metricsToken = JETON;

    const r = await relever(JETON);

    assert.match(r.body, /^cinqsync_base_disponible 1$/m);
    for (const serie of [
      'cinqsync_organisations',
      'cinqsync_comptes_actifs',
      'cinqsync_sessions_actives',
      'cinqsync_tickets_ouverts',
      'cinqsync_interventions_rapport_a_deposer',
      'cinqsync_connexions_echouees_fenetre',
    ]) {
      assert.match(r.body, new RegExp(`^${serie} \\d+$`, 'm'), `${serie} absente`);
    }
  });
});
