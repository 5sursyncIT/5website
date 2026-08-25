import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { withoutTenant } from '../db/tenant.js';
import { config } from '../config.js';

/**
 * Sessions opaques, révocables, stockées en base.
 *
 * POURQUOI PAS DE JWT
 * Un back-office institutionnel doit pouvoir couper un accès dans la seconde.
 * Révoquer un JWT suppose une liste de révocation consultée à chaque requête —
 * c'est-à-dire exactement la table qu'il prétendait éviter, plus la complexité
 * de la signature.
 *
 * ON NE STOCKE JAMAIS LE JETON, seulement son empreinte SHA-256. Une copie de
 * la base ne donne aucune session utilisable. Le jeton n'existe en clair que
 * dans le cookie du navigateur.
 */

const OCTETS = 32;

function empreinte(jeton) {
  return createHash('sha256').update(jeton).digest();
}

export async function ouvrir({ userId, ip = null, userAgent = null }) {
  const jeton = randomBytes(OCTETS).toString('base64url');
  const expire = new Date(Date.now() + config.sessionTtlHours * 3600 * 1000);

  await withoutTenant((c) =>
    c.query(
      `insert into sessions (user_id, token_hash, expire_le, ip, user_agent)
       values ($1, $2, $3, $4, $5)`,
      [userId, empreinte(jeton), expire, ip, userAgent],
    ),
  );

  return { jeton, expire };
}

/**
 * Résout un jeton en contexte d'appel. Renvoie null pour tout échec — expirée,
 * révoquée, inconnue, compte désactivé — sans distinguer les cas.
 */
export async function resoudre(jeton) {
  if (typeof jeton !== 'string' || jeton.length < 20) return null;

  const rows = await withoutTenant(async (c) =>
    (
      await c.query(
        `select s.id as session_id, s.token_hash,
                u.id as user_id, u.role, u.organisation_id, u.nom, u.email
           from sessions s
           join users u on u.id = s.user_id
          where s.token_hash = $1
            and s.revoquee_le is null
            and s.expire_le > now()
            and u.actif`,
        [empreinte(jeton)],
      )
    ).rows,
  );

  if (rows.length !== 1) return null;

  // La recherche par index a déjà fait le travail ; cette comparaison à temps
  // constant est une ceinture en plus des bretelles, à coût nul.
  const attendu = empreinte(jeton);
  if (!timingSafeEqual(rows[0].token_hash, attendu)) return null;

  const { session_id, user_id, role, organisation_id, nom, email } = rows[0];
  return {
    sessionId: session_id,
    userId: user_id,
    role,
    organisationId: organisation_id,
    nom,
    email,
    estPersonnel: role === 'admin' || role === 'staff',
  };
}

export async function revoquer(jeton) {
  await withoutTenant((c) =>
    c.query('update sessions set revoquee_le = now() where token_hash = $1 and revoquee_le is null', [
      empreinte(jeton),
    ]),
  );
}

/** Coupe toutes les sessions d'un compte — désactivation, changement de mot de passe. */
export async function revoquerToutes(userId) {
  await withoutTenant((c) =>
    c.query('update sessions set revoquee_le = now() where user_id = $1 and revoquee_le is null', [
      userId,
    ]),
  );
}
