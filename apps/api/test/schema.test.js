import { test, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { getOwnerPool, closePools } from '../src/db/pool.js';
import { baseDisponible, RAISON_SAUT } from './helpers.js';

/**
 * Garde-fou structurel.
 *
 * Le vrai risque n'est pas que les politiques d'aujourd'hui soient fausses —
 * elles sont testées. C'est qu'une migration écrite dans six mois ajoute une
 * table porteuse de données client en oubliant app.proteger(). Cette table
 * serait alors lisible par n'importe quelle organisation, et rien ne le dirait.
 *
 * Ce test lit le catalogue de PostgreSQL : toute table possédant une colonne
 * organisation_id doit avoir RLS activé, forcé, et une politique.
 */
describe('Schéma', { skip: baseDisponible ? false : RAISON_SAUT }, () => {
  after(async () => {
    await closePools();
  });

  test('toute table portant organisation_id est cloisonnée', async () => {
    const { rows } = await getOwnerPool().query(`
      select c.relname                as table_nom,
             c.relrowsecurity         as rls_active,
             c.relforcerowsecurity    as rls_forcee,
             (select count(*) from pg_policy p where p.polrelid = c.oid) as politiques
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and exists (
           select 1 from pg_attribute a
            where a.attrelid = c.oid
              and a.attname = 'organisation_id'
              and not a.attisdropped
         )
         -- Une exemption doit être déclarée en commentaire de table, avec sa
         -- raison. Sans marqueur, la table est considérée comme à protéger.
         and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'app:hors-cloisonnement%'
       order by c.relname
    `);

    assert.ok(rows.length >= 10, `attendu au moins 10 tables cloisonnées, trouvé ${rows.length}`);

    const nues = rows.filter((r) => !r.rls_active || !r.rls_forcee || r.politiques === 0);

    assert.deepEqual(
      nues.map((r) => r.table_nom),
      [],
      'ces tables portent des données client sans cloisonnement — appeler app.proteger()',
    );
  });

  test('toute table cloisonnée est aussi tracée par le journal d’audit', async () => {
    const { rows } = await getOwnerPool().query(`
      select c.relname as table_nom
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and exists (select 1 from pg_attribute a
                      where a.attrelid = c.oid and a.attname = 'organisation_id'
                        and not a.attisdropped)
         and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'app:hors-cloisonnement%'
         and not exists (select 1 from pg_trigger t
                          where t.tgrelid = c.oid and not t.tgisinternal)
    `);

    assert.deepEqual(rows.map((r) => r.table_nom), []);
  });

  test('toute exemption de cloisonnement est motivée par écrit', async () => {
    const { rows } = await getOwnerPool().query(`
      select c.relname as table_nom, obj_description(c.oid, 'pg_class') as motif
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
         and coalesce(obj_description(c.oid, 'pg_class'), '') like 'app:hors-cloisonnement%'
    `);

    // Le marqueur seul ne suffit pas : il faut une raison lisible derrière.
    for (const { table_nom, motif } of rows) {
      assert.ok(
        motif.length > 80,
        `l'exemption de ${table_nom} n'est pas motivée — écrire pourquoi, pas seulement que`,
      );
    }
    assert.ok(rows.length >= 2);
  });

  test('toute vue s’exécute avec les droits de l’appelant', async () => {
    // Le contournement le plus discret du dispositif. Une vue s'exécute par
    // défaut avec les privilèges de son PROPRIÉTAIRE : créée par le
    // propriétaire des tables, elle ignore Row-Level Security et renvoie les
    // lignes de toutes les organisations. Les politiques restent en place, les
    // tables restent protégées, et le cloisonnement ne tient plus.
    const { rows } = await getOwnerPool().query(`
      select c.relname as vue
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind in ('v', 'm')
         and coalesce(
               (select option_value from pg_options_to_table(c.reloptions)
                 where option_name = 'security_invoker'),
               'false') <> 'true'
    `);

    assert.deepEqual(
      rows.map((r) => r.vue),
      [],
      'ces vues contournent le cloisonnement — ajouter set (security_invoker = true)',
    );
  });

  test('le journal d’audit est en écriture seule pour le rôle applicatif', async () => {
    const { rows } = await getOwnerPool().query(`
      select has_table_privilege('app_5sync', 'audit_log', 'insert') as peut_inserer,
             has_table_privilege('app_5sync', 'audit_log', 'update') as peut_modifier,
             has_table_privilege('app_5sync', 'audit_log', 'delete') as peut_supprimer
    `);

    assert.equal(rows[0].peut_inserer, true);
    assert.equal(rows[0].peut_modifier, false, 'un journal modifiable ne prouve rien');
    assert.equal(rows[0].peut_supprimer, false);
  });

  test('le rôle applicatif n’est pas superutilisateur', async () => {
    // Un superutilisateur ignore Row-Level Security en toutes circonstances.
    // Si celui-ci le devenait, toutes les politiques deviendraient décoratives.
    const { rows } = await getOwnerPool().query(
      "select rolsuper from pg_roles where rolname = 'app_5sync'",
    );

    assert.equal(rows[0].rolsuper, false);
  });

  test('un compte du personnel ne peut pas être rattaché à une organisation', async (t) => {
    // Le test crée SON organisation.
    //
    // Il lisait auparavant « (select id from organisations limit 1) », une
    // donnée qu'il ne produisait pas. Sur une base vide — celle de
    // l'intégration continue — le sous-select rend NULL, et un compte de
    // personnel SANS organisation satisfait justement la contrainte : le test
    // passait donc pour la mauvaise raison partout où la base était amorcée,
    // et échouait ailleurs. Un test qui dépend de données qu'il ne crée pas
    // ne teste pas ce qu'il annonce.
    const pool = getOwnerPool();
    const { rows: [org] } = await pool.query(
      `insert into organisations (nom, pays, est_demo)
       values ($1, 'Sénégal', true) returning id`,
      [`Contrainte ${process.pid}-${Date.now()}`],
    );
    t.after(() => pool.query('delete from organisations where id = $1', [org.id]));

    // La contrainte de la table, pas une validation applicative : elle tient
    // même pour une écriture faite à la main en console.
    await assert.rejects(
      () =>
        pool.query(
          `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
           values ($1, 'staff', 'incoherent@test.sn', 'X', 'x')`,
          [org.id],
        ),
      /users_org_selon_role/,
    );

    // Le miroir : le même compte SANS organisation doit passer, sinon la
    // contrainte interdirait aussi ce qu'elle doit permettre.
    const { rows: [ok] } = await pool.query(
      `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
       values (null, 'staff', $1, 'X', 'x') returning id`,
      [`coherent-${Date.now()}@test.sn`],
    );
    await pool.query('delete from users where id = $1', [ok.id]);
  });
});
