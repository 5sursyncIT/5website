import { connecter } from '../../auth/connexion.js';
import * as limitation from '../../auth/limitation.js';
import { revoquer } from '../../auth/sessions.js';
import { config } from '../../config.js';

/**
 * Le cookie de session.
 *
 * httpOnly    inaccessible au JavaScript de la page : un XSS ne l'emporte pas.
 * sameSite    lax : le cookie ne part pas sur une requête déclenchée par un
 *             autre site, ce qui couvre l'essentiel du CSRF sur les écritures.
 * secure      en production seulement, sinon le développement local en HTTP
 *             ne recevrait jamais le cookie.
 * path        l'ensemble du site : Nginx sert l'API et le front sur le même
 *             domaine, donc le cookie reste first-party.
 */
function optionsCookie(expire) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    path: '/',
    expires: expire,
  };
}

export default async function routesAuth(app) {
  app.post('/api/v1/auth/connexion', async (request, reply) => {
    const { email, motDePasse } = request.body ?? {};

    if (typeof email !== 'string' || typeof motDePasse !== 'string') {
      return reply.code(400).send({ error: 'requete_invalide' });
    }

    // La limite est vérifiée AVANT de hacher : sans cela, un attaquant fait
    // consommer 19 Mio et deux passes d'Argon2 à chaque essai, et la
    // protection devient elle-même le vecteur d'épuisement.
    const limite = await limitation.verifier({ ip: request.ip, email });
    if (limite.bloque) {
      request.log.warn(
        { ip: request.ip, motif: limite.motif },
        'connexion bloquée : trop de tentatives',
      );
      return reply
        .code(429)
        .header('retry-after', String(limite.secondes))
        .send({
          error: 'trop_de_tentatives',
          message:
            limite.motif === 'compte'
              ? 'Ce compte est temporairement verrouillé après plusieurs échecs. Réessayez dans quelques minutes.'
              : 'Trop de tentatives depuis cette adresse. Réessayez dans quelques minutes.',
          reprendreDans: limite.secondes,
        });
    }

    const r = await connecter({
      email,
      motDePasse,
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    await limitation.enregistrer({ ip: request.ip, email, reussie: r.ok });

    if (!r.ok) {
      // Même réponse pour un e-mail inconnu et un mot de passe erroné.
      return reply.code(401).send({ error: 'identifiants_invalides' });
    }

    // L'ardoise est effacée : quatre échecs suivis d'une réussite ne doivent
    // pas laisser le compte à une tentative du verrouillage.
    await limitation.reinitialiser({ email });

    reply.setCookie(config.cookieName, r.jeton, optionsCookie(r.expire));

    // Le second facteur est annoncé ici, sinon l'interface n'a aucun moyen de
    // savoir qu'elle doit demander un code : la session existe, mais elle
    // n'ouvre rien tant qu'il n'est pas franchi.
    return {
      utilisateur: r.utilisateur,
      secondFacteurRequis: r.secondFacteurRequis,
      secondFacteurEnrole: r.secondFacteurEnrole,
    };
  });

  app.post('/api/v1/auth/deconnexion', async (request, reply) => {
    const jeton = request.cookies?.[config.cookieName];
    if (jeton) await revoquer(jeton);

    reply.clearCookie(config.cookieName, { path: '/' });
    return { ok: true };
  });

  app.get('/api/v1/auth/moi', async (request) => {
    const session = request.exigerSession();
    return {
      id: session.userId,
      nom: session.nom,
      role: session.role,
      organisationId: session.organisationId,
      estPersonnel: session.estPersonnel,
      secondFacteurRequis: session.secondFacteurRequis,
      secondFacteurEnrole: session.totpEnrole,
    };
  });
}
