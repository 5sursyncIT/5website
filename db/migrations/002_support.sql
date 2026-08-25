-- 002 — Support : tickets, échanges, événements.
-- Les statuts viennent de la maquette, sans réinterprétation.

create type app.statut_ticket as enum (
  'ouvert', 'en_cours', 'escalade', 'votre_retour', 'planifie', 'resolu', 'clos'
);
create type app.niveau_ticket as enum ('n1', 'n2', 'n3');

create table tickets (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  reference        text not null,
  objet            text not null,
  site_id          uuid references sites (id) on delete set null,
  niveau           app.niveau_ticket not null default 'n1',
  statut           app.statut_ticket not null default 'ouvert',
  priorite_haute   boolean not null default false,
  ouvert_le        timestamptz not null default now(),
  -- Horodaté, jamais saisi : c'est lui qui produit le KPI « délai moyen de
  -- prise en charge ». Un délai stocké en colonne mentirait dès la première
  -- semaine d'exploitation.
  pris_en_charge_le timestamptz,
  resolu_le        timestamptz,
  cree_par         uuid references users (id) on delete set null,

  constraint tickets_reference_unique unique (organisation_id, reference)
);

create index on tickets (organisation_id, statut);
create index on tickets (organisation_id, ouvert_le desc);

create table ticket_messages (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  ticket_id        uuid not null references tickets (id) on delete cascade,
  auteur_id        uuid references users (id) on delete set null,
  corps            text not null,
  interne          boolean not null default false,  -- visible du seul personnel 5/Sync
  cree_le          timestamptz not null default now()
);

create index on ticket_messages (ticket_id, cree_le);

select app.proteger('tickets');
select app.proteger('ticket_messages');
