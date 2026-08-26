import Fastify from 'fastify';
import { config } from './config.js';
import { getAppPool } from './db/pool.js';
import sessionPlugin from './plugins/session.js';
import routesAuth from './routes/v1/auth.js';
import routesTotp from './routes/v1/totp.js';
import routesTickets from './routes/v1/tickets.js';
import routesLeads from './routes/v1/leads.js';
import routesModules from './routes/v1/modules.js';
import routesOrganisations from './routes/v1/organisations.js';
import routesDocumentsFichiers from './routes/v1/documents-fichiers.js';
import routesTicketsEcriture from './routes/v1/tickets-ecriture.js';
import routesTicketsAdministration from './routes/v1/tickets-administration.js';
import routesBackOffice from './routes/v1/back-office.js';
import routesAudit from './routes/v1/audit.js';
import routesMetrics from './routes/v1/metrics.js';
import { brancherComptage } from './supervision/compteurs.js';
import multipart from '@fastify/multipart';

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

  // Le comptage est branché AVANT les routes : un crochet posé après ne
  // verrait pas les requêtes servies par ce qui a été enregistré avant lui.
  brancherComptage(app);

  app.register(sessionPlugin);
  app.register(routesAuth);
  app.register(routesTotp);
  app.register(routesTickets);
  app.register(multipart);
  app.register(routesLeads);
  app.register(routesModules);
  app.register(routesOrganisations);
  app.register(routesDocumentsFichiers);
  app.register(routesTicketsEcriture);
  app.register(routesTicketsAdministration);
  app.register(routesBackOffice);
  app.register(routesAudit);
  app.register(routesMetrics);

  /**
   * Sonde de santé.
   *
   * Elle INTERROGE la base au lieu de vérifier qu'une variable est renseignée.
   * Une sonde qui lit sa propre configuration répond « en bonne santé » quand
   * PostgreSQL est à terre — c'est-à-dire exactement au moment où elle devrait
   * alerter. Elle répond 503 tant que la base ne répond pas.
   */
  app.get('/api/v1/health', async (request, reply) => {
    let base = 'indisponible';
    try {
      await getAppPool().query('select 1');
      base = 'disponible';
    } catch (erreur) {
      request.log.error({ err: erreur }, 'sonde de santé : base injoignable');
    }

    if (base !== 'disponible') reply.code(503);

    return {
      status: base === 'disponible' ? 'ok' : 'degrade',
      service: '5sync-api',
      env: config.env,
      database: base,
      time: new Date().toISOString(),
    };
  });

  app.setNotFoundHandler((request, reply) => {
    reply.code(404).send({ error: 'not_found', path: request.url });
  });

  return app;
}
