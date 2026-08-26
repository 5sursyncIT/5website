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

  /**
   * Routes qu'une session non vérifiée peut atteindre.
   *
   * Sans cette exception, un compte 5/Sync nouvellement créé ne pourrait
   * jamais s'enrôler : il lui faudrait un second facteur pour poser son
   * second facteur.
   */
  const SANS_SECOND_FACTEUR = new Set([
    '/api/v1/auth/moi',
    '/api/v1/auth/deconnexion',
    '/api/v1/auth/totp/enrolement',
    '/api/v1/auth/totp/verifier',
  ]);

  app.decorateRequest('exigerSession', function exigerSession() {
    if (!this.session) {
      const erreur = new ErreurAcces('Authentification requise.');
      erreur.statusCode = 401;
      throw erreur;
    }

    // LE VERROU. Une session de compte 5/Sync qui n'a pas franchi le second
    // facteur n'ouvre rien d'autre que son propre enrôlement. Le contrôle est
    // ici, dans le passage obligé, et non répété route par route : une route
    // ajoutée demain en hérite sans que personne n'ait à y penser.
    if (this.session.secondFacteurRequis && !SANS_SECOND_FACTEUR.has(this.routeOptions?.url ?? this.url.split('?')[0])) {
      const erreur = new ErreurAcces('Second facteur requis.');
      erreur.statusCode = 403;
      erreur.code = 'second_facteur_requis';
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

  /**
   * Un identifiant de route mal formé n'atteint pas PostgreSQL.
   *
   * Sans ce contrôle, « /api/v1/tickets/pas-un-uuid » descend jusqu'à la
   * base, qui refuse la conversion et fait remonter une erreur 500 : le refus
   * arrive bien, mais il se présente comme une panne du service alors que
   * c'est une URL invalide — et il réveille quelqu'un la nuit pour rien.
   *
   * La réponse est 404 et non 400 : un identifiant qui n'a pas la forme d'un
   * identifiant ne peut désigner aucune ressource, et c'est exactement la
   * même réponse que pour une ressource hors périmètre. Deux réponses
   * différentes ici apprendraient à distinguer « mal formé » de « pas à
   * vous », ce qui est déjà une information.
   */
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  app.addHook('preHandler', async (request, reply) => {
    for (const [nom, valeur] of Object.entries(request.params ?? {})) {
      if ((nom === 'id' || nom.endsWith('Id')) && !UUID.test(String(valeur))) {
        return reply.code(404).send({ error: 'not_found', path: request.url });
      }
    }
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
