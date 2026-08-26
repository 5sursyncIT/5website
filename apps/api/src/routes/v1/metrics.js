import { timingSafeEqual } from 'node:crypto';

import { config } from '../../config.js';
import { relever } from '../../supervision/releve.js';
import { formater } from '../../supervision/format.js';

/**
 * Exposition des métriques, pour un collecteur.
 *
 * PAS DE COOKIE, UN JETON. Un collecteur Prometheus n'ouvre pas de session :
 * il gratte une URL toutes les quinze secondes, sans état. Le reste de l'API
 * s'authentifie par cookie de session ; ici ce serait impraticable, et
 * bricoler une session de service serait pire — un compte de plus à gérer,
 * révoquer et faire expirer, pour un porteur qui ne sait pas se reconnecter.
 *
 * SANS JETON CONFIGURÉ, LA ROUTE N'EXISTE PAS. 404 et non 403 : répondre
 * « interdit » confirmerait qu'il y a des métriques à cette adresse, ce qui
 * est déjà une information sur ce que nous exploitons. Le silence qui en
 * résulte n'est pas un angle mort : il est lui-même supervisé, par la règle
 * d'alerte sur l'absence de la série (voir infra/supervision/alertes.yml).
 */

/**
 * Comparaison à durée constante.
 *
 * Un `===` sur un jeton s'arrête au premier caractère qui diffère. L'écart de
 * temps est minuscule, mais un attaquant qui peut répéter la mesure des
 * milliers de fois reconstitue le jeton caractère par caractère. Le coût de
 * s'en prémunir étant nul, il n'y a pas d'arbitrage à faire.
 *
 * Les deux chaînes sont d'abord ramenées à la même longueur : timingSafeEqual
 * lève sur des longueurs différentes, et cette levée trahirait à elle seule la
 * longueur du jeton.
 */
function jetonValide(presente, attendu) {
  const a = Buffer.from(String(presente ?? ''), 'utf8');
  const b = Buffer.from(attendu, 'utf8');
  const taille = Math.max(a.length, b.length, 1);
  const ax = Buffer.alloc(taille);
  const bx = Buffer.alloc(taille);
  a.copy(ax);
  b.copy(bx);
  return timingSafeEqual(ax, bx) && a.length === b.length;
}

export default async function routesMetrics(app) {
  app.get('/api/v1/metrics', async (request, reply) => {
    if (!config.metricsToken) {
      return reply.code(404).send({ error: 'not_found', path: request.url });
    }

    const entete = request.headers.authorization ?? '';
    const porteur = entete.startsWith('Bearer ') ? entete.slice(7) : null;

    if (!jetonValide(porteur, config.metricsToken)) {
      request.log.warn({ ip: request.ip }, 'relevé de métriques refusé');
      return reply.code(401).send({ error: 'non_authentifie' });
    }

    const donnees = await relever();

    // text/plain, et surtout pas de mise en cache : une métrique servie depuis
    // un cache décrit un instant qui n'est plus, et c'est précisément quand
    // tout va mal qu'un intermédiaire zélé rendrait la dernière valeur connue
    // — c'est-à-dire la dernière valeur rassurante.
    reply
      .header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
      .header('cache-control', 'no-store');

    return formater(donnees);
  });
}
