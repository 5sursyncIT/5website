import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildApp } from '../src/app.js';
import { getOwnerPool } from '../src/db/pool.js';
import { hacher } from '../src/auth/passwords.js';
import { baseDisponible, RAISON_SAUT, closePools, connecterPersonnel } from './helpers.js';

/**
 * Le back-office, vu depuis l'API.
 *
 * CES ROUTES N'ONT PAS D'ÉCRAN, ET C'EST PRÉCISÉMENT POURQUOI ELLES SONT
 * TESTÉES ICI. Les artboards du back-office ne sont pas livrés ; sans écran
 * pour les exercer, une route se vérifie par son test ou ne se vérifie pas du
 * tout. Ce qui est éprouvé ci-dessous est ce qui ne dépend pas du dessin :
 * qui a le droit, ce qui est calculé plutôt que reçu, et ce que le refus
 * révèle.
 */
describe('Back-office', { skip: baseDisponible ? false : RAISON_SAUT }, () => {
  let app;
  let jeu;
  /** Organisations créées par les tests eux-mêmes, à effacer après coup. */
  const creees = [];
  /**
   * Les trois sessions sont ouvertes UNE FOIS.
   *
   * Se reconnecter à chaque test ferait vingt-trois connexions là où trois
   * suffisent, et rien de ce qui est éprouvé ici ne porte sur l'ouverture de
   * session — c'est le sujet de auth.test.js et durcissement.test.js.
   */
  let jetonClient;
  let jetonStaff;
  let jetonAdmin;

  before(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    jeu = await preparer();

    jetonClient = await connecter(jeu.emailA);
    jetonStaff = await connecter(jeu.emailStaff);
    jetonAdmin = await connecter(jeu.emailAdmin);
  });

  after(async () => {
    const pool = getOwnerPool();
    await pool.query('delete from organisations where id = any($1)', [[jeu.a, jeu.b, ...creees]]);
    await pool.query('delete from users where id = any($1)', [[jeu.staff, jeu.admin]]);
    await pool.query('delete from tentatives_connexion where email = any($1)', [
      [jeu.emailA, jeu.emailStaff, jeu.emailAdmin],
    ]);
    await app.close();
    await closePools();
  });

  const connecter = async (email) =>
    email.endsWith('@5sursync.com')
      ? connecterPersonnel(app, email)
      : (async () => {
          const r = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/connexion',
            payload: { email, motDePasse: 'mot-de-passe-de-test' },
          });
          assert.equal(r.statusCode, 200, `connexion refusée pour ${email}`);
          return r.cookies.find((c) => c.name === '5sync_session').value;
        })();

  const appel = (method, url, jeton, payload) =>
    app.inject({ method, url, cookies: jeton ? { '5sync_session': jeton } : {}, payload });

  const get = (url, jeton) => appel('GET', url, jeton);
  const post = (url, jeton, payload) => appel('POST', url, jeton, payload);
  const patch = (url, jeton, payload) => appel('PATCH', url, jeton, payload);

  // ── Qui a le droit ───────────────────────────────────────────────────────

  test('les cinq créations sont fermées à un compte client', async () => {

    const tentatives = [
      ['/api/v1/organisations', { nom: 'X', pays: 'Sénégal', referent: { nom: 'X', email: 'x@x.sn' } }],
      ['/api/v1/projets', { organisation: jeu.a, nom: 'X' }],
      ['/api/v1/contrats', { organisation: jeu.a, intitule: 'X' }],
      ['/api/v1/interventions', { organisation: jeu.a, objet: 'X', survenueLe: '2026-09-01' }],
      ['/api/v1/finances', { organisation: jeu.a, type: 'devis', objet: 'X', montantFcfa: 1 }],
    ];

    for (const [url, corps] of tentatives) {
      const r = await post(url, jetonClient, corps);
      assert.equal(r.statusCode, 403, `${url} ouvert à un compte client`);
    }
  });

  test('un contrat se rédige en « admin », des heures s’imputent en « staff »', async () => {

    // Le staff ne rédige pas de contrat…
    const redaction = await post('/api/v1/contrats', jetonStaff, {
      organisation: jeu.a,
      intitule: 'Support ×2',
    });
    assert.equal(redaction.statusCode, 403);

    // …mais impute bien le temps passé sur celui qui existe.
    const imputation = await post(`/api/v1/contrats/${jeu.contratA}/heures`, jetonStaff, {
      minutes: 100,
      motif: 'Intervention sur site',
    });
    assert.equal(imputation.statusCode, 201, imputation.body);
    assert.equal(imputation.json().minutes, 100);
  });

  // ── Nouveau client ───────────────────────────────────────────────────────

  test('créer un client rend un compte référent utilisable sur-le-champ', async () => {
    const email = `referent-${jeu.suffixe}@collectivite.sn`;

    const r = await post('/api/v1/organisations', jetonAdmin, {
      nom: `Commune de Test ${jeu.suffixe}`,
      pays: 'Sénégal',
      sites: [{ nom: 'Hôtel de ville' }, { nom: 'Annexe technique' }],
      referent: { nom: 'Référente DSI', email },
    });

    assert.equal(r.statusCode, 201, r.body);
    const client = r.json();
    creees.push(client.id);

    assert.equal(client.sites.length, 2);
    assert.equal(client.referent.role, 'client_admin');
    assert.ok(client.motDePasseProvisoire, 'aucun mot de passe provisoire rendu');

    // LE TEST QUI COMPTE : le compte créé s'ouvre vraiment. Une création qui
    // rend un identifiant mais pas un accès n'a rien créé d'utilisable.
    const connexion = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/connexion',
      payload: { email, motDePasse: client.motDePasseProvisoire },
    });
    assert.equal(connexion.statusCode, 200, connexion.body);
    // Un compte client n'a pas de second facteur à franchir : le verrou du
    // lot 5 ne porte que sur les comptes 5/Sync.
    assert.equal(connexion.json().secondFacteurRequis ?? false, false);
  });

  test('une adresse déjà employée est un conflit, pas une panne', async () => {

    const r = await post('/api/v1/organisations', jetonAdmin, {
      nom: `Doublon ${jeu.suffixe}`,
      pays: 'Sénégal',
      referent: { nom: 'Doublon', email: jeu.emailA },
    });

    assert.equal(r.statusCode, 409, r.body);
    assert.match(r.json().champs['referent.email'], /déjà rattachée/);
  });

  test('un référent sans adresse valide bloque toute la création', async () => {
    const nom = `Jamais créée ${jeu.suffixe}`;

    const r = await post('/api/v1/organisations', jetonAdmin, {
      nom,
      pays: 'Sénégal',
      sites: [{ nom: 'Site' }],
      referent: { nom: 'Sans adresse', email: 'pas-une-adresse' },
    });

    assert.equal(r.statusCode, 400);
    assert.ok(r.json().champs['referent.email']);

    // Tout ou rien : l'organisation ne doit pas exister à moitié. Le nom
    // resterait pris, et « Nouveau client » échouerait ensuite sans dire
    // pourquoi.
    const { rows } = await getOwnerPool().query('select id from organisations where nom = $1', [nom]);
    assert.equal(rows.length, 0, 'une organisation a survécu à une création refusée');
  });

  // ── Références attribuées ────────────────────────────────────────────────

  test('les références de contrat sont attribuées, et se suivent par client', async () => {
    const annee = new Date().getUTCFullYear();

    const premier = await post('/api/v1/contrats', jetonAdmin, {
      organisation: jeu.a,
      intitule: 'Support N2',
      gtiHeures: 2,
      gtrHeures: 8,
      forfaitHeures: 120,
    });
    const second = await post('/api/v1/contrats', jetonAdmin, {
      organisation: jeu.a,
      intitule: 'Infrastructure',
      gtiHeures: 4,
      gtrHeures: 24,
    });
    // L'autre client repart de 1 : la référence est unique par organisation,
    // pas globalement. Numéroter en continu ferait deviner à un client le
    // nombre de contrats signés par les autres.
    const chezB = await post('/api/v1/contrats', jetonAdmin, {
      organisation: jeu.b,
      intitule: 'Support',
    });

    assert.equal(premier.json().reference, `CT-${annee}-01`);
    assert.equal(second.json().reference, `CT-${annee}-02`);
    assert.equal(chezB.json().reference, `CT-${annee}-01`);
  });

  test('un délai de rétablissement plus court que la prise en charge est refusé', async () => {

    const r = await post('/api/v1/contrats', jetonAdmin, {
      organisation: jeu.a,
      intitule: 'Engagement impossible',
      gtiHeures: 8,
      gtrHeures: 4,
    });

    assert.equal(r.statusCode, 400);
    assert.ok(r.json().champs.gtrHeures);
  });

  // ── Pièces financières ───────────────────────────────────────────────────

  test('le montant d’une pièce vient de ses lignes, jamais de l’appelant', async () => {

    const r = await post('/api/v1/finances', jetonAdmin, {
      organisation: jeu.a,
      type: 'devis',
      objet: 'Refonte du cœur de réseau',
      // Montant mensonger, délibérément : c'est le total des lignes qui doit
      // l'emporter. Deux sources pour un même total divergent, et le jour où
      // elles divergent c'est devant un client.
      montantFcfa: 1,
      lignes: [
        { libelle: 'Commutateur 48 ports', quantite: 2, prixUnitaireFcfa: 1_250_000 },
        { libelle: 'Mise en service', quantite: 1.5, prixUnitaireFcfa: 400_000 },
      ],
    });

    assert.equal(r.statusCode, 201, r.body);
    const piece = r.json();
    assert.equal(Number(piece.montant_fcfa), 2 * 1_250_000 + Math.round(1.5 * 400_000));
    assert.equal(piece.reference, `DEV-${new Date().getUTCFullYear()}-001`);
  });

  test('une quantité à trois décimales est refusée plutôt qu’arrondie', async () => {

    const r = await post('/api/v1/finances', jetonAdmin, {
      organisation: jeu.a,
      type: 'facture',
      objet: 'Prestation',
      lignes: [{ libelle: 'Heures', quantite: 1.005, prixUnitaireFcfa: 1000 }],
    });

    assert.equal(r.statusCode, 400);
    assert.ok(r.json().champs['lignes.0.quantite']);
  });

  test('un corps mal formé est une saisie invalide, pas une panne', async () => {

    // « lignes » n'est pas une liste. La route lit sa longueur pour décider si
    // le montant vient des lignes ou de l'appelant, et elle le fait avant de
    // regarder si la saisie est valide : ce chemin doit rendre 400, jamais 500.
    const r = await post('/api/v1/finances', jetonAdmin, {
      organisation: jeu.a,
      type: 'facture',
      objet: 'Corps douteux',
      lignes: 'pas une liste',
    });

    assert.equal(r.statusCode, 400, r.body);
    assert.ok(r.json().champs.lignes);
  });

  // ── Interventions ────────────────────────────────────────────────────────

  test('planifier une intervention, et compter les rapports en souffrance', async () => {

    const r = await post('/api/v1/interventions', jetonStaff, {
      organisation: jeu.a,
      objet: 'Remplacement onduleur',
      survenueLe: '2026-03-04',
      ticket: jeu.ticketA,
      contrat: jeu.contratA,
      minutes: 180,
    });

    assert.equal(r.statusCode, 201, r.body);
    assert.equal(r.json().reference, 'INT-2026-001');
    assert.equal(r.json().statut, 'planifiee');

    await getOwnerPool().query(
      "update interventions set statut = 'rapport_a_deposer' where id = $1",
      [r.json().id],
    );

    const indicateurs = await get(`/api/v1/interventions/indicateurs?organisation=${jeu.a}`, jetonStaff);
    assert.equal(indicateurs.statusCode, 200);
    assert.equal(indicateurs.json().rapportsADeposer, 1);
  });

  test('les interventions d’un client ne fuient pas vers l’autre', async () => {

    const chezB = await get(`/api/v1/interventions?organisation=${jeu.b}`, jetonStaff);
    assert.equal(chezB.statusCode, 200);
    assert.equal(chezB.json().interventions.length, 0);
  });

  // ── Le fil d'un ticket ───────────────────────────────────────────────────

  test('une note interne est invisible du client, et il ne peut pas en poser', async () => {
    const url = `/api/v1/tickets/${jeu.ticketA}/messages`;

    const publique = await post(`${url}?organisation=${jeu.a}`, jetonStaff, {
      corps: 'Nous intervenons demain matin.',
    });
    assert.equal(publique.statusCode, 201, publique.body);

    const note = await post(`${url}?organisation=${jeu.a}`, jetonStaff, {
      corps: 'Le client confond deux liaisons — à reprendre en douceur.',
      interne: true,
    });
    assert.equal(note.statusCode, 201, note.body);

    const vueClient = await get(url, jetonClient);
    assert.equal(vueClient.statusCode, 200);
    const filClient = vueClient.json().messages;
    assert.equal(filClient.length, 1, 'le client voit une note interne');
    // Le corps de la note ne doit pas transiter du tout : masquer à
    // l'affichage laisserait la phrase dans la réponse HTTP.
    assert.doesNotMatch(JSON.stringify(filClient), /en douceur/);

    const vueStaff = await get(`${url}?organisation=${jeu.a}`, jetonStaff);
    assert.equal(vueStaff.json().messages.length, 2);

    const tentative = await post(url, jetonClient, { corps: 'Note', interne: true });
    assert.equal(tentative.statusCode, 403);
  });

  test('répondre notifie le client ; une note interne ne notifie personne', async () => {
    const { messagesEnvoyes, viderMessages } = await import('../src/mail/transport.js');
    const url = `/api/v1/tickets/${jeu.ticketA}/messages?organisation=${jeu.a}`;

    viderMessages();
    await post(url, jetonStaff, { corps: 'Ligne rétablie.' });
    await post(url, jetonStaff, { corps: 'Facturation à revoir.', interne: true });
    // Les envois partent hors transaction et sans être attendus par la route :
    // on laisse la file se vider avant de compter.
    await new Promise((r) => setTimeout(r, 120));

    const envoyes = messagesEnvoyes();
    assert.equal(envoyes.length, 1, 'une note interne a été notifiée');
    // Les destinataires sont en copie cachée, et le corps de l'échange ne
    // quitte pas l'espace client : une réponse de support porte souvent une
    // adresse d'équipement ou une procédure de contournement.
    assert.ok(envoyes[0].bcc?.includes(jeu.emailA), 'le client n’est pas destinataire');
    assert.doesNotMatch(JSON.stringify(envoyes[0]), /Facturation|Ligne rétablie/);
  });

  // ── Changement d'état ────────────────────────────────────────────────────

  test('les horodatages se déduisent du statut, et ne se réécrivent pas', async () => {
    const url = `/api/v1/tickets/${jeu.ticketPriseEnCharge}?organisation=${jeu.a}`;

    const priseEnCharge = await patch(url, jetonStaff, { statut: 'en_cours' });
    assert.equal(priseEnCharge.statusCode, 200, priseEnCharge.body);
    const premierHorodatage = priseEnCharge.json().pris_en_charge_le;
    assert.ok(premierHorodatage, 'la prise en charge n’a pas été horodatée');

    // Un aller-retour par « votre_retour » ne remet pas la GTI à zéro : le
    // délai de prise en charge se mesure depuis l'ouverture, une fois.
    const retour = await patch(url, jetonStaff, { statut: 'votre_retour' });
    assert.equal(retour.json().pris_en_charge_le, premierHorodatage);

    const resolu = await patch(url, jetonStaff, { statut: 'resolu' });
    assert.ok(resolu.json().resolu_le);

    // Réouverture : un ticket rouvert n'est pas un ticket résolu. Laisser la
    // date fausserait le respect des SLA dans le sens flatteur.
    const rouvert = await patch(url, jetonStaff, { statut: 'en_cours' });
    assert.equal(rouvert.json().resolu_le, null);
    assert.equal(rouvert.json().pris_en_charge_le, premierHorodatage);
  });

  test('changer de statut ne détache pas le ticket de son contrat', async () => {
    const url = `/api/v1/tickets/${jeu.ticketA}?organisation=${jeu.a}`;

    const rattache = await patch(url, jetonStaff, { contrat: jeu.contratA });
    assert.equal(rattache.json().contrat_id, jeu.contratA);

    // « contrat » absent du corps veut dire « n'y touche pas ». Le confondre
    // avec null viderait l'assiette du calcul des SLA à chaque changement
    // d'état, sans que personne ne s'en aperçoive.
    const apres = await patch(url, jetonStaff, { statut: 'en_cours' });
    assert.equal(apres.json().contrat_id, jeu.contratA);

    const detache = await patch(url, jetonStaff, { contrat: null });
    assert.equal(detache.json().contrat_id, null);
  });

  test('un ticket ne peut pas être rattaché au contrat d’un autre client', async () => {

    const r = await patch(`/api/v1/tickets/${jeu.ticketA}?organisation=${jeu.a}`, jetonStaff, {
      contrat: jeu.contratB,
    });

    assert.equal(r.statusCode, 400, r.body);
    assert.match(r.json().champs.contrat, /inconnu/i);
  });

  test('une imputation d’heures hors bornes est refusée', async () => {

    for (const minutes of [0, -30, 24 * 60 + 1, 2.5]) {
      const r = await post(`/api/v1/contrats/${jeu.contratA}/heures`, jetonStaff, { minutes });
      assert.equal(r.statusCode, 400, `${minutes} minutes acceptées`);
    }
  });

  // ── Journal d'audit ──────────────────────────────────────────────────────

  test('le journal d’audit n’est lisible qu’en « admin »', async () => {

    assert.equal((await get('/api/v1/audit', jetonStaff)).statusCode, 403);
    assert.equal((await get('/api/v1/audit', jetonClient)).statusCode, 403);
    assert.equal((await get('/api/v1/audit')).statusCode, 401);
  });

  test('le journal a bien tracé ce que le back-office a créé', async () => {

    const r = await get(`/api/v1/audit?organisation=${jeu.a}&table=contrats&action=insert`, jetonAdmin);
    assert.equal(r.statusCode, 200, r.body);

    const lignes = r.json().audit;
    assert.ok(lignes.length > 0, 'aucune création de contrat tracée');
    assert.ok(lignes.every((l) => l.table_cible === 'contrats' && l.action === 'insert'));
    // L'auteur est repris du contexte de transaction, pas du corps de la
    // requête : c'est ce qui rend la trace difficile à falsifier depuis une
    // route.
    assert.ok(lignes.some((l) => l.acteur_id === jeu.admin));
  });

  test('le journal d’audit ne s’écrit pas par l’API', async () => {

    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const r = await appel(method, '/api/v1/audit', jetonAdmin, {});
      assert.equal(r.statusCode, 404, `${method} /api/v1/audit existe`);
    }
  });

  test('une table inconnue est refusée plutôt que balayée', async () => {
    const r = await get('/api/v1/audit?table=users', jetonAdmin);

    assert.equal(r.statusCode, 400);
    assert.ok(r.json().champs.table);
  });

  // ── Identifiants mal formés ──────────────────────────────────────────────

  test('un identifiant qui n’en est pas un répond 404, jamais 500', async () => {

    for (const url of [
      '/api/v1/tickets/pas-un-uuid',
      '/api/v1/tickets/pas-un-uuid/messages',
      '/api/v1/interventions/1',
      "/api/v1/contrats/'; drop table tickets; --",
    ]) {
      const r = await get(url, jetonStaff);
      assert.equal(r.statusCode, 404, `${url} → ${r.statusCode}`);
    }

    // Et la table est toujours là.
    const { rows } = await getOwnerPool().query('select count(*) from tickets');
    assert.ok(Number(rows[0].count) >= 0);
  });
});

/** Deux organisations étanches, un compte client, un « staff », un « admin ». */
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

  const a = await org('Back-office A');
  const b = await org('Back-office B');

  const compte = async (organisationId, role, email) =>
    (
      await pool.query(
        `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
         values ($1,$2,$3,$4,$5) returning id`,
        [organisationId, role, email, `Compte ${role}`, empreinte],
      )
    ).rows[0].id;

  const emailA = `bo-a-${suffixe}@test.sn`;
  const emailStaff = `bo-staff-${suffixe}@5sursync.com`;
  const emailAdmin = `bo-admin-${suffixe}@5sursync.com`;

  await compte(a, 'client_admin', emailA);
  const staff = await compte(null, 'staff', emailStaff);
  const admin = await compte(null, 'admin', emailAdmin);

  const ticket = async (organisationId, marque) =>
    (
      await pool.query(
        'insert into tickets (organisation_id, reference, objet) values ($1,$2,$3) returning id',
        [organisationId, `TCK-${marque}-${suffixe}`, `Ticket ${marque}`],
      )
    ).rows[0].id;

  const contrat = async (organisationId, marque) =>
    (
      await pool.query(
        `insert into contrats (organisation_id, reference, intitule, forfait_heures)
         values ($1,$2,$3,100) returning id`,
        [organisationId, `CT-${marque}-${suffixe}`, `Contrat ${marque}`],
      )
    ).rows[0].id;

  return {
    suffixe,
    a,
    b,
    staff,
    admin,
    emailA,
    emailStaff,
    emailAdmin,
    ticketA: await ticket(a, 'A'),
    ticketPriseEnCharge: await ticket(a, 'A2'),
    contratA: await contrat(a, 'A'),
    contratB: await contrat(b, 'B'),
  };
}
