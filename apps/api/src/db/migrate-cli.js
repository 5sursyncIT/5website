#!/usr/bin/env node
import { migrate } from './migrate.js';
import { closePools } from './pool.js';

try {
  const posees = await migrate();
  console.log(posees === 0 ? 'Base à jour, aucune migration à poser.' : `${posees} migration(s) posée(s).`);
} catch (erreur) {
  console.error(`Échec : ${erreur.message}`);
  process.exitCode = 1;
} finally {
  await closePools();
}
