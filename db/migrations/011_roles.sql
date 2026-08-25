-- ═══════════════════════════════════════════════════════════════════════════
-- 011 — Rôle applicatif
--
-- SANS CE FICHIER, TOUT LE RLS DES MIGRATIONS PRÉCÉDENTES EST DÉCORATIF.
-- Un superutilisateur PostgreSQL ignore Row-Level Security en toutes
-- circonstances. Si l'application se connecte avec le compte qui a créé les
-- tables — le réflexe par défaut — les politiques ne s'appliquent jamais et
-- l'isolation n'existe pas.
--
-- On crée donc un rôle distinct, non superutilisateur, avec le strict
-- nécessaire. Les migrations continuent de tourner sous le propriétaire ;
-- l'API, elle, ne se connecte qu'avec celui-ci.
--
-- Le mot de passe n'est pas ici : il est posé par le lanceur de migrations
-- depuis DATABASE_APP_PASSWORD. Un secret dans un fichier versionné est un
-- secret publié.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_5sync') then
    create role app_5sync nologin;
  end if;
end
$$;

grant usage on schema public, app to app_5sync;

grant select, insert, update, delete on all tables in schema public to app_5sync;
grant usage, select on all sequences in schema public to app_5sync;
grant execute on all functions in schema app to app_5sync;

-- Le journal d'audit est en écriture seule. Pas de mise à jour, pas de
-- suppression — pour personne, y compris l'application. Un journal modifiable
-- ne prouve rien devant un client institutionnel.
revoke update, delete on audit_log from app_5sync;

-- Les migrations futures doivent hériter des mêmes droits, sinon une table
-- ajoutée dans six mois sera silencieusement inaccessible à l'API.
alter default privileges in schema public
  grant select, insert, update, delete on tables to app_5sync;
alter default privileges in schema public
  grant usage, select on sequences to app_5sync;
