import { withoutTenant } from '../db/tenant.js';
import { verifier, hacher } from './passwords.js';
import { ouvrir } from './sessions.js';

/**
 * Empreinte d'un mot de passe qui n'existe pas, calculée une fois au
 * chargement. On la vérifie quand l'e-mail est inconnu, pour que la réponse
 * prenne le même temps que pour un compte réel — sans quoi le temps de réponse
 * révèle quels e-mails existent en base.
 */
const LEURRE = await hacher(`leurre-${Math.random()}`);

export async function connecter({ email, motDePasse, ip = null, userAgent = null }) {
  const rows = await withoutTenant(async (c) =>
    (
      await c.query(
        `select id, role, organisation_id, nom, mot_de_passe_hash, actif, totp_secret
           from users where email = $1`,
        [email],
      )
    ).rows,
  );

  const compte = rows[0];
  const empreinte = compte?.mot_de_passe_hash ?? LEURRE;
  const correct = await verifier(motDePasse, empreinte);

  if (!compte || !compte.actif || !correct) {
    return { ok: false };
  }

  const estPersonnel = compte.role === 'admin' || compte.role === 'staff';

  /**
   * Le second facteur ne se présente PAS au même moment que le mot de passe.
   *
   * On ouvre une session, mais marquée non vérifiée : elle ne donne accès
   * qu'aux routes d'enrôlement et de vérification. Demander les deux d'un coup
   * obligerait à garder le mot de passe en attente côté client, ou à inventer
   * un jeton intermédiaire — deux façons d'ajouter une surface pour rien.
   */
  const totpValide = !estPersonnel;

  const { jeton, expire } = await ouvrir({ userId: compte.id, ip, userAgent, totpValide });

  await withoutTenant((c) =>
    c.query('update users set derniere_connexion = now() where id = $1', [compte.id]),
  );

  return {
    ok: true,
    jeton,
    expire,
    secondFacteurRequis: estPersonnel,
    secondFacteurEnrole: Boolean(compte.totp_secret),
    utilisateur: {
      id: compte.id,
      nom: compte.nom,
      role: compte.role,
      organisationId: compte.organisation_id,
    },
  };
}
