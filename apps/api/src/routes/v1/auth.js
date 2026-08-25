import { connecter } from '../../auth/connexion.js';
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

    const r = await connecter({
      email,
      motDePasse,
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    if (!r.ok) {
      // Même réponse pour un e-mail inconnu et un mot de passe erroné.
      return reply.code(401).send({ error: 'identifiants_invalides' });
    }

    reply.setCookie(config.cookieName, r.jeton, optionsCookie(r.expire));
    return { utilisateur: r.utilisateur };
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
    };
  });
}
