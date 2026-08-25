-- ═══════════════════════════════════════════════════════════════════════════
-- 001 — Socle : identité, sessions, isolation multi-client, journal d'audit
--
-- LA DÉCISION STRUCTURANTE DE CE FICHIER
-- L'isolation entre organisations est tenue par PostgreSQL, pas par le code
-- applicatif. Chaque table porteuse de données client active Row-Level
-- Security ; une requête qui « oublie » son filtre ne renvoie pas les données
-- d'un autre client, elle ne renvoie rien du tout.
--
-- Le défaut est le refus : sans app.organisation_id posé dans la transaction,
-- current_organisation() vaut NULL, la comparaison vaut NULL, et la politique
-- rejette. Une fuite exigerait donc une erreur active, pas un oubli.
--
-- DEUX PIÈGES QUE CE FICHIER ÉVITE EXPLICITEMENT
--   1. FORCE ROW LEVEL SECURITY. Sans ce mot, le propriétaire de la table
--      contourne ses propres politiques — et le propriétaire, c'est nous.
--   2. Un rôle applicatif non superutilisateur. Un superutilisateur ignore
--      RLS en toutes circonstances : l'application ne doit jamais s'y
--      connecter, sans quoi tout ce fichier n'est que décor.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists app;

-- ── Contexte de transaction ────────────────────────────────────────────────
-- Posé par withTenant() dans apps/api/src/db/tenant.js, à chaque transaction.

create or replace function app.current_organisation() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.organisation_id', true), '')::uuid $$;

create or replace function app.is_staff() returns boolean
  language sql stable
  as $$ select coalesce(nullif(current_setting('app.is_staff', true), ''), 'false')::boolean $$;

create or replace function app.current_actor() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.actor_id', true), '')::uuid $$;

-- ── Rôles ──────────────────────────────────────────────────────────────────

create type app.role as enum (
  'admin',        -- 5/Sync : administration complète, gestion des comptes
  'staff',        -- 5/Sync : intervenant, accès à toutes les organisations
  'client_admin', -- client : référent, gère les comptes de son organisation
  'client_user'   -- client : agent, lecture et ouverture de tickets
);

create type app.statut_organisation as enum ('actif', 'audit', 'projet', 'clos');

-- ── Organisations ──────────────────────────────────────────────────────────
-- La table pivot. Volontairement SANS RLS : c'est elle qui définit le
-- périmètre, et le back-office doit pouvoir la lister. L'accès y est filtré
-- par le rôle, dans les dépôts.

create table organisations (
  id              uuid primary key default gen_random_uuid(),
  nom             text not null,
  pays            text not null,
  statut          app.statut_organisation not null default 'actif',
  est_demo        boolean not null default false,
  cree_le         timestamptz not null default now(),
  modifie_le      timestamptz not null default now()
);

create index on organisations (statut);

-- ── Sites ──────────────────────────────────────────────────────────────────

create table sites (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  nom              text not null,
  cree_le          timestamptz not null default now()
);

create index on sites (organisation_id);

-- ── Comptes ────────────────────────────────────────────────────────────────
-- organisation_id est NULL pour les comptes 5/Sync (admin, staff) : ils
-- n'appartiennent à aucun client. La contrainte l'impose plutôt que de
-- l'espérer.

create table users (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid references organisations (id) on delete cascade,
  role               app.role not null,
  email              citext,
  nom                text not null,
  mot_de_passe_hash  text not null,
  totp_secret        text,
  actif              boolean not null default true,
  derniere_connexion timestamptz,
  cree_le            timestamptz not null default now(),

  constraint users_org_selon_role check (
    (role in ('admin', 'staff') and organisation_id is null)
    or (role in ('client_admin', 'client_user') and organisation_id is not null)
  )
);

create unique index on users (email) where email is not null;
create index on users (organisation_id);

-- ── Sessions ───────────────────────────────────────────────────────────────
-- Sessions opaques, révocables. On ne stocke jamais le jeton : seulement son
-- empreinte. Une fuite de la base ne donne aucune session utilisable.

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  token_hash    bytea not null unique,
  expire_le     timestamptz not null,
  revoquee_le   timestamptz,
  ip            inet,
  user_agent    text,
  cree_le       timestamptz not null default now()
);

create index on sessions (user_id);
create index on sessions (expire_le) where revoquee_le is null;

-- ── Journal d'audit ────────────────────────────────────────────────────────
-- En écriture seule : les privilèges de mise à jour et de suppression ne sont
-- accordés à personne, pas même au rôle applicatif. Un journal modifiable ne
-- prouve rien devant un client institutionnel.

create table audit_log (
  id               bigserial primary key,
  survenu_le       timestamptz not null default now(),
  acteur_id        uuid,
  organisation_id  uuid,
  action           text not null,
  table_cible      text not null,
  cible_id         text,
  details          jsonb
);

create index on audit_log (organisation_id, survenu_le desc);
create index on audit_log (table_cible, cible_id);

create or replace function app.tracer() returns trigger
  language plpgsql security definer
  as $$
declare
  ligne record;
begin
  ligne := coalesce(new, old);
  insert into audit_log (acteur_id, organisation_id, action, table_cible, cible_id, details)
  values (
    app.current_actor(),
    case when to_jsonb(ligne) ? 'organisation_id'
         then (to_jsonb(ligne) ->> 'organisation_id')::uuid
         else app.current_organisation() end,
    lower(tg_op),
    tg_table_name,
    (to_jsonb(ligne) ->> 'id'),
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end
  );
  return ligne;
end;
$$;

-- ── Fabrique de politiques ─────────────────────────────────────────────────
-- Appliquée à chaque table client par les migrations suivantes. La centraliser
-- garantit que toutes les tables reçoivent exactement la même règle : c'est
-- le genre de chose qu'on écrit une fois, pas onze.

create or replace function app.proteger(nom_table text) returns void
  language plpgsql
  as $$
begin
  execute format('alter table %I enable row level security', nom_table);
  -- Sans FORCE, le propriétaire de la table contourne ses propres politiques.
  execute format('alter table %I force row level security', nom_table);
  execute format($p$
    create policy %1$I_cloisonnement on %1$I
      using (organisation_id = app.current_organisation() or app.is_staff())
      with check (organisation_id = app.current_organisation() or app.is_staff())
  $p$, nom_table);
  execute format($t$
    create trigger %1$I_audit
      after insert or update or delete on %1$I
      for each row execute function app.tracer()
  $t$, nom_table);
end;
$$;

select app.proteger('sites');
