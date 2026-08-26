import { getOwnerPool, closePools } from '../src/db/pool.js';
import { hacher } from '../src/auth/passwords.js';
import { config } from '../src/config.js';
import { createHmac } from 'node:crypto';

/**
 * Les tests d'isolation ont besoin d'une vraie base PostgreSQL : ils vérifient
 * un comportement du moteur, pas du code. Les simuler n'aurait aucun sens —
 * un faux qui répond « accès refusé » ne prouve rien sur Row-Level Security.
 *
 * Quand aucune base n'est configurée, les tests se déclarent SAUTÉS plutôt que
 * de passer à vide. Un test d'isolation qui passe sans base est pire qu'absent.
 */
export const baseDisponible = Boolean(config.appUrl && config.ownerUrl);

/**
 * En intégration continue, sauter n'est pas une option.
 *
 * Sans ce garde-fou, un service PostgreSQL qui ne démarre pas ferait passer la
 * CI au vert avec toutes les suites d'isolation sautées — c'est-à-dire une
 * validation qui ne valide rien. REQUIRE_DB=1 transforme le saut en échec.
 */
if (process.env.REQUIRE_DB === '1' && !baseDisponible) {
  throw new Error(
    'REQUIRE_DB=1 mais aucune base configurée. Les tests d’isolation auraient été sautés ' +
      'et la vérification serait passée au vert sans rien vérifier.',
  );
}

export const RAISON_SAUT =
  'DATABASE_APP_URL non configurée — voir .env.example et docs/lot-2.md pour lancer une base de test.';

let compteur = 0;

/**
 * Crée un jeu minimal : deux organisations étanches, chacune avec un ticket et
 * un compte client, plus un compte du personnel 5/Sync.
 */
export async function jeuDeuxOrganisations() {
  const pool = getOwnerPool();
  const suffixe = `${process.pid}-${(compteur += 1)}`;
  const empreinte = await hacher('mot-de-passe-de-test');

  const org = async (nom, pays) =>
    (
      await pool.query(
        'insert into organisations (nom, pays, est_demo) values ($1,$2,true) returning id',
        [`${nom} ${suffixe}`, pays],
      )
    ).rows[0].id;

  const a = await org('Organisation A', 'Sénégal');
  const b = await org('Organisation B', 'Guinée');

  const ticket = async (organisationId, reference, objet) =>
    (
      await pool.query(
        'insert into tickets (organisation_id, reference, objet) values ($1,$2,$3) returning id',
        [organisationId, reference, objet],
      )
    ).rows[0].id;

  const ticketA = await ticket(a, `TCK-A-${suffixe}`, 'Dossier confidentiel de A');
  const ticketB = await ticket(b, `TCK-B-${suffixe}`, 'Dossier confidentiel de B');

  const compte = async (organisationId, role, email) =>
    (
      await pool.query(
        `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
         values ($1,$2,$3,$4,$5) returning id`,
        [organisationId, role, email, `Compte ${role}`, empreinte],
      )
    ).rows[0].id;

  const userA = await compte(a, 'client_admin', `a-${suffixe}@test.sn`);
  const userB = await compte(b, 'client_admin', `b-${suffixe}@test.gn`);
  const personnel = await compte(null, 'staff', `staff-${suffixe}@5sursync.com`);

  const emails = [`a-${suffixe}@test.sn`, `b-${suffixe}@test.gn`, `staff-${suffixe}@5sursync.com`];

  return {
    a,
    b,
    ticketA,
    ticketB,
    userA,
    userB,
    personnel,
    emails,
    emailA: emails[0],
    motDePasse: 'mot-de-passe-de-test',
    async nettoyer() {
      await pool.query('delete from organisations where id = any($1)', [[a, b]]);
      await pool.query('delete from users where id = $1', [personnel]);
      // LES ÉCHECS VOLONTAIRES S'EFFACENT AUSSI.
      // Plusieurs suites se trompent de mot de passe exprès, depuis 127.0.0.1
      // — c'est ainsi qu'on vérifie qu'un refus ne dit pas pourquoi. Chaque
      // exécution en laisse deux, et la limitation par adresse bloque à dix
      // sur quinze minutes : au cinquième `npm test` d'affilée, toute la
      // suite se met à répondre 429 sans qu'aucun code n'ait changé. Le
      // symptôme désigne alors le mauvais coupable, ce qui coûte plus cher
      // que la panne.
      await pool.query('delete from tentatives_connexion where email = any($1)', [emails]);
    },
  };
}

/** Session synthétique, telle que sessions.resoudre() la renverrait. */
export function sessionDe({ userId, role, organisationId }) {
  return {
    sessionId: 'test',
    userId,
    role,
    organisationId,
    nom: 'Test',
    email: null,
    estPersonnel: role === 'admin' || role === 'staff',
  };
}

/**
 * Ouvre une session de PERSONNEL 5/Sync, second facteur compris.
 *
 * Depuis le lot 5, un compte admin ou staff n'ouvre rien tant qu'il n'a pas
 * franchi le second facteur : une session obtenue avec le seul mot de passe
 * ne donne accès qu'à son propre enrôlement. Cette aide reproduit le parcours
 * réel — connexion, enrôlement si besoin, code — plutôt que de contourner le
 * verrou, ce qui reviendrait à ne pas le tester.
 *
 * @returns {Promise<string>} le jeton de session, second facteur franchi
 */
export async function connecterPersonnel(app, email, motDePasse = 'mot-de-passe-de-test') {
  const connexion = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/connexion',
    payload: { email, motDePasse },
  });

  if (connexion.statusCode !== 200) {
    throw new Error(`connexion refusée pour ${email} : ${connexion.statusCode}`);
  }

  const jeton = connexion.cookies.find((c) => c.name === '5sync_session').value;
  const cookies = { '5sync_session': jeton };

  if (!connexion.json().secondFacteurRequis) return jeton;

  let secret;
  const enrolement = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/totp/enrolement',
    cookies,
  });

  if (enrolement.statusCode === 200) {
    secret = enrolement.json().secret;
  } else {
    // Déjà enrôlé : le secret n'est jamais renvoyé deux fois, on le relit en
    // base — ce qu'un test peut faire et qu'une application ne pourrait pas.
    const { rows } = await getOwnerPool().query('select totp_secret from users where email = $1', [
      email,
    ]);
    secret = rows[0].totp_secret;
  }

  const verification = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/totp/verifier',
    cookies,
    payload: { code: codeTotp(secret) },
  });

  if (verification.statusCode !== 200) {
    throw new Error(`second facteur refusé pour ${email} : ${verification.statusCode}`);
  }

  return jeton;
}

/** Calcule le code TOTP courant, comme le ferait l'application du téléphone. */
export function codeTotp(secret) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret) bits += ALPHABET.indexOf(c).toString(2).padStart(5, '0');

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

export { closePools };
