import { withoutTenant } from '../../db/tenant.js';
import * as totp from '../../auth/totp.js';
import { validerSecondFacteur, revoquerToutes } from '../../auth/sessions.js';
import * as limitation from '../../auth/limitation.js';

/**
 * Enrôlement et vérification du second facteur.
 *
 * Ces trois routes sont les SEULES qu'une session non vérifiée peut atteindre
 * — le verrou est posé dans plugins/session.js. Sans cette exception, un compte
 * 5/Sync qui vient d'être créé ne pourrait jamais s'enrôler : il lui faudrait
 * un second facteur pour poser son second facteur.
 */
export default async function routesTotp(app) {
  app.post('/api/v1/auth/totp/enrolement', async (request, reply) => {
    const session = request.exigerSession();

    if (!session.estPersonnel) {
      return reply.code(403).send({
        error: 'refuse',
        message: 'Le second facteur est réservé aux comptes 5/Sync.',
      });
    }

    // Un secret déjà posé ne se remplace pas sur simple demande : ce serait le
    // moyen le plus simple de contourner le second facteur depuis une session
    // volée. Le retrait passe par un administrateur.
    if (session.totpEnrole) {
      return reply.code(409).send({
        error: 'deja_enrole',
        message: 'Un second facteur est déjà configuré pour ce compte.',
      });
    }

    const secret = totp.genererSecret();

    // Le secret est écrit tout de suite mais totp_active_le reste nul : le
    // compte n'est considéré comme protégé qu'après avoir prouvé qu'il sait
    // produire un code. Sans cela, un enrôlement interrompu laisserait un
    // compte verrouillé hors de son propre outil.
    await withoutTenant((c) =>
      c.query('update users set totp_secret = $1, totp_active_le = null where id = $2', [
        secret,
        session.userId,
      ]),
    );

    request.log.info({ userId: session.userId }, 'enrôlement du second facteur commencé');

    return {
      secret,
      uri: totp.uriEnrolement({ email: session.email, secret }),
      chiffres: totp.CHIFFRES,
      periodeSecondes: totp.PAS_SECONDES,
    };
  });

  app.post('/api/v1/auth/totp/verifier', async (request, reply) => {
    const session = request.exigerSession();

    if (!session.estPersonnel) return reply.code(403).send({ error: 'refuse' });

    // La limite de tentatives s'applique aussi ici : un code à six chiffres
    // n'offre qu'un million de possibilités, ce qui tombe en quelques heures
    // sans limitation.
    const limite = await limitation.verifier({ ip: request.ip, email: session.email });
    if (limite.bloque) {
      return reply
        .code(429)
        .header('retry-after', String(limite.secondes))
        .send({ error: 'trop_de_tentatives', reprendreDans: limite.secondes });
    }

    const { rows } = await withoutTenant((c) =>
      c.query('select totp_secret from users where id = $1', [session.userId]),
    );
    const secret = rows[0]?.totp_secret;
    if (!secret) return reply.code(409).send({ error: 'non_enrole' });

    const correct = totp.verifier(secret, request.body?.code);
    await limitation.enregistrer({ ip: request.ip, email: session.email, reussie: correct });

    if (!correct) {
      request.log.warn({ userId: session.userId }, 'second facteur refusé');
      return reply.code(401).send({ error: 'code_invalide' });
    }

    await limitation.reinitialiser({ email: session.email });
    await validerSecondFacteur(session.sessionId);

    // Premier code accepté : l'enrôlement est confirmé.
    await withoutTenant((c) =>
      c.query('update users set totp_active_le = coalesce(totp_active_le, now()) where id = $1', [
        session.userId,
      ]),
    );

    request.log.info({ userId: session.userId }, 'second facteur validé');
    return { ok: true };
  });

  /**
   * Retrait du second facteur d'un compte, par un administrateur.
   *
   * Le cas réel est le téléphone perdu. Toutes les sessions du compte sont
   * révoquées : sinon une session encore ouverte survivrait au retrait, et le
   * compte se retrouverait accessible sans facteur ET sans mot de passe
   * redemandé.
   */
  app.delete('/api/v1/auth/totp/:userId', async (request, reply) => {
    request.exigerCapacite('comptes:gerer');
    const session = request.exigerSession();

    if (!session.estPersonnel) return reply.code(403).send({ error: 'refuse' });

    await withoutTenant((c) =>
      c.query('update users set totp_secret = null, totp_active_le = null where id = $1', [
        request.params.userId,
      ]),
    );
    await revoquerToutes(request.params.userId);

    request.log.warn(
      { par: session.userId, cible: request.params.userId },
      'second facteur retiré par un administrateur',
    );
    return { ok: true };
  });
}
