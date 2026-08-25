import { getOwnerPool, closePools } from '../src/db/pool.js';
import { hacher } from '../src/auth/passwords.js';
import { config } from '../src/config.js';

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

  return {
    a,
    b,
    ticketA,
    ticketB,
    userA,
    userB,
    personnel,
    emailA: `a-${suffixe}@test.sn`,
    motDePasse: 'mot-de-passe-de-test',
    async nettoyer() {
      await pool.query('delete from organisations where id = any($1)', [[a, b]]);
      await pool.query('delete from users where id = $1', [personnel]);
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

export { closePools };
