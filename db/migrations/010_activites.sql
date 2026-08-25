-- 010 — Fil d'activité du portail client.
--
-- À ne pas confondre avec audit_log : celui-ci est technique, exhaustif et
-- inaltérable ; celui-là est éditorial, choisi, et destiné à être lu par le
-- client. Les fondre produirait un fil illisible et un audit incomplet.

create table activites (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  libelle          text not null,
  survenu_le       timestamptz not null default now(),
  table_source     text,
  source_id        uuid
);

create index on activites (organisation_id, survenu_le desc);

select app.proteger('activites');
