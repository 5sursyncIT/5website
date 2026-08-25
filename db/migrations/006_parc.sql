-- 006 — Parc matériel installé.
-- « 5 fins de garantie sous 6 mois » se dérive de dates, jamais d'un compteur.

create type app.statut_equipement as enum ('en_service', 'a_renouveler', 'retire', 'en_panne');

create table equipements (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references organisations (id) on delete cascade,
  designation       text not null,
  site_id           uuid references sites (id) on delete set null,
  quantite          smallint not null default 1 check (quantite > 0),
  mise_en_service   date,
  fin_garantie      date,
  statut            app.statut_equipement not null default 'en_service',
  cree_le           timestamptz not null default now()
);

create index on equipements (organisation_id, statut);
create index on equipements (organisation_id, fin_garantie);

select app.proteger('equipements');
