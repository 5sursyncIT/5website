import { buildApp } from './app.js';
import { config, assertProductionConfig } from './config.js';

assertProductionConfig();

const app = buildApp();

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    app.log.info(`${signal} reçu — arrêt en cours`);
    await app.close();
    process.exit(0);
  });
}
