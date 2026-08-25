import pg from 'pg';
import { config } from '../config.js';

/**
 * Les montants en FCFA sont des bigint. Par défaut, le pilote pg rend les
 * bigint sous forme de chaîne — prudent, parce qu'un bigint dépasse Number.
 * Nos montants restent très en deçà de 2^53, on les convertit donc en nombre,
 * mais on le fait ici, explicitement, plutôt que de le découvrir dans un
 * calcul de totaux.
 */
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new Error(`Entier hors de portée sûre reçu de PostgreSQL : ${value}`);
  }
  return n;
});

/** Pool applicatif — rôle app_5sync, soumis à RLS. Le seul que l'API utilise. */
let appPool = null;

/** Pool propriétaire — migrations et amorçage uniquement. Contourne RLS. */
let ownerPool = null;

export function getAppPool() {
  if (!appPool) {
    if (!config.appUrl) throw new Error('DATABASE_APP_URL non configurée.');
    appPool = new pg.Pool({ connectionString: config.appUrl, max: 10 });
  }
  return appPool;
}

export function getOwnerPool() {
  if (!ownerPool) {
    if (!config.ownerUrl) throw new Error('DATABASE_URL non configurée.');
    ownerPool = new pg.Pool({ connectionString: config.ownerUrl, max: 4 });
  }
  return ownerPool;
}

export async function closePools() {
  await Promise.all([appPool?.end(), ownerPool?.end()]);
  appPool = null;
  ownerPool = null;
}
