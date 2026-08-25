import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import { resoudre } from '../auth/sessions.js';
import { contexteDe, exiger, ErreurAcces } from '../auth/contexte.js';
import { withTenant } from '../db/tenant.js';
import { config } from '../config.js';

/**
 * Rattache la session à la requête, et fournit le seul accès aux données
 * client.
 *
 * `request.dansPerimetre(fn)` ouvre une transaction avec le contexte
 * d'isolation dérivé de la session. Aucune route n'a de raison d'appeler
 * withTenant directement : passer par ici garantit que le périmètre vient de
 * la session et pas d'un paramètre de requête.
 */
async function sessionPlugin(app) {
  await app.register(cookie);

  app.decorateRequest('session', null);

  app.addHook('onRequest', async (request) => {
    const jeton = request.cookies?.[config.cookieName];
    request.session = jeton ? await resoudre(jeton) : null;
  });

  app.decorateRequest('exigerSession', function exigerSession() {
    if (!this.session) {
      const erreur = new ErreurAcces('Authentification requise.');
      erreur.statusCode = 401;
      throw erreur;
    }
    return this.session;
  });

  app.decorateRequest('exigerCapacite', function exigerCapacite(capacite) {
    exiger(this.exigerSession(), capacite);
  });

  app.decorateRequest('dansPerimetre', function dansPerimetre(fn, options = {}) {
    const session = this.exigerSession();
    const contexte = contexteDe(session, options);
    return withTenant(contexte, fn);
  });

  app.setErrorHandler((erreur, request, reply) => {
    const status = erreur.statusCode ?? 500;

    if (status >= 500) {
      request.log.error({ err: erreur }, 'erreur non gérée');
      return reply.code(500).send({ error: 'erreur_interne' });
    }

    // Une tentative d'accès croisé n'est pas un incident anodin : on la trace
    // avec l'auteur, même si la réponse reste laconique.
    if (erreur.name === 'ErreurAcces') {
      request.log.warn(
        { userId: request.session?.userId, url: request.url },
        `accès refusé : ${erreur.message}`,
      );
    }

    return reply.code(status).send({ error: erreur.code ?? 'refuse', message: erreur.message });
  });
}

export default fp(sessionPlugin, { name: 'session' });
