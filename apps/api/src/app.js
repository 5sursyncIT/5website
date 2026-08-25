import Fastify from 'fastify';
import { config } from './config.js';
import sessionPlugin from './plugins/session.js';
import routesAuth from './routes/v1/auth.js';
import routesTickets from './routes/v1/tickets.js';

/**
 * Construit l'instance Fastify sans l'écouter — c'est ce qui permettra aux
 * tests d'utiliser app.inject() plutôt que d'ouvrir un vrai port.
 */
export function buildApp({ logger = true } = {}) {
  const app = Fastify({
    logger,
    // Les identifiants de requête viennent du client seulement si Nginx les a
    // posés : on ne fait pas confiance à un en-tête arbitraire.
    trustProxy: true,
    disableRequestLogging: false,
  });

  app.register(sessionPlugin);
  app.register(routesAuth);
  app.register(routesTickets);

  app.get('/api/v1/health', async () => ({
    status: 'ok',
    service: '5sync-api',
    env: config.env,
    // Le socle de données arrive au lot 2 ; on annonce l'état réel, pas « ok ».
    database: config.databaseUrl ? 'configurée' : 'non configurée',
    time: new Date().toISOString(),
  }));

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: 'not_found', path: request.url });
  });

  return app;
}
