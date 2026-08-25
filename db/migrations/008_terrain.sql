-- 008 — Interventions. Le back-office pilote « 5 rapports à déposer » : c'est
-- l'absence de rapport qui est l'information, donc elle doit être requêtable.

create type app.statut_intervention as enum (
  'planifiee', 'realisee', 'rapport_a_deposer', 'rapport_depose', 'cloturee'
);

create table interventions (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  reference        text not null,
  objet            text not null,
  site_id          uuid references sites (id) on delete set null,
  ticket_id        uuid references tickets (id) on delete set null,
  intervenant_id   uuid references users (id) on delete set null,
  survenue_le      date not null,
  statut           app.statut_intervention not null default 'planifiee',
  rapport_id       uuid references documents (id) on delete set null,
  minutes          integer check (minutes > 0),
  cree_le          timestamptz not null default now(),

  constraint interventions_reference_unique unique (organisation_id, reference)
);

create index on interventions (organisation_id, survenue_le desc);
create index on interventions (organisation_id, statut);

select app.proteger('interventions');
