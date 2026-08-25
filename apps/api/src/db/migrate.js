import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOwnerPool } from './pool.js';
import { config } from '../config.js';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '../../../../db/migrations');

/**
 * Lanceur de migrations. Trois propriétés voulues :
 *
 *  · Chaque fichier tourne dans SA propre transaction. Une migration qui
 *    échoue laisse la base dans l'état de la précédente, jamais à moitié.
 *  · Un verrou consultatif empêche deux instances de migrer en même temps —
 *    le cas au redémarrage d'un service répliqué.
 *  · L'empreinte de chaque fichier appliqué est conservée. Modifier une
 *    migration déjà passée en production est une erreur silencieuse classique ;
 *    ici elle est détectée et refusée.
 */
export async function migrate({ log = console } = {}) {
  const pool = getOwnerPool();
  const client = await pool.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        nom         text primary key,
        empreinte   text not null,
        applique_le timestamptz not null default now()
      )
    `);

    // 5sync = clé arbitraire mais stable du verrou consultatif.
    await client.query('select pg_advisory_lock(hashtext($1))', ['5sync_migrations']);

    const { rows } = await client.query('select nom, empreinte from schema_migrations');
    const appliquees = new Map(rows.map((r) => [r.nom, r.empreinte]));

    const fichiers = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let posees = 0;
    for (const nom of fichiers) {
      const sql = readFileSync(join(MIGRATIONS, nom), 'utf8');
      const empreinte = await empreinteDe(sql);

      if (appliquees.has(nom)) {
        if (appliquees.get(nom) !== empreinte) {
          throw new Error(
            `La migration ${nom} a été modifiée après avoir été appliquée. ` +
              'Une migration passée est immuable : créez-en une nouvelle.',
          );
        }
        continue;
      }

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (nom, empreinte) values ($1, $2)', [
          nom,
          empreinte,
        ]);
        await client.query('commit');
        log.info?.(`  + ${nom}`);
        posees += 1;
      } catch (erreur) {
        await client.query('rollback');
        throw new Error(`Migration ${nom} : ${erreur.message}`, { cause: erreur });
      }
    }

    // Le mot de passe du rôle applicatif vit dans l'environnement, jamais dans
    // un fichier SQL versionné. La migration 011 crée le rôle sans droit de
    // connexion ; c'est ici qu'il le reçoit.
    if (config.appPassword) {
      await client.query(
        `alter role app_5sync login password ${literal(config.appPassword)}`,
      );
    }

    return posees;
  } finally {
    await client.query('select pg_advisory_unlock(hashtext($1))', ['5sync_migrations']).catch(() => {});
    client.release();
  }
}

async function empreinteDe(sql) {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(sql).digest('hex');
}

/**
 * ALTER ROLE n'accepte pas de paramètre lié : le mot de passe doit être
 * interpolé. On l'échappe donc explicitement plutôt que de concaténer.
 */
function literal(valeur) {
  return `'${String(valeur).replaceAll("'", "''")}'`;
}
