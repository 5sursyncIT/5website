import { buildApp } from './app.js';
import { config, assertProductionConfig } from './config.js';
import { verifierStockage } from './stockage/fichiers.js';

assertProductionConfig();

const app = buildApp();

const stockage = await verifierStockage();
if (!stockage.ok) {
  if (config.env === 'production') {
    app.log.error(`Stockage documentaire inutilisable (${stockage.racine}) : ${stockage.message}`);
    process.exit(1);
  }
  app.log.warn(
    `Stockage documentaire inutilisable (${stockage.racine}) : ${stockage.message}. ` +
      'Les dépôts de documents échoueront. Posez DOCUMENTS_DIR sur un chemin inscriptible.',
  );
}

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
