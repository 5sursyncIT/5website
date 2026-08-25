-- 009 — Demandes entrantes du formulaire de contact.
--
-- SANS organisation_id, et SANS RLS : un prospect n'appartient par définition
-- à aucune organisation cliente. L'accès est réservé au personnel 5/Sync, ce
-- qui se contrôle par le rôle et non par le cloisonnement.

create table leads (
  id             uuid primary key default gen_random_uuid(),
  organisation   text not null,
  nom            text not null,
  email          citext not null,
  telephone      text,
  besoins        text[] not null default '{}',
  contexte       text,
  traite_le      timestamptz,
  traite_par     uuid references users (id) on delete set null,
  ip             inet,
  cree_le        timestamptz not null default now()
);

create index on leads (cree_le desc) where traite_le is null;

create trigger leads_audit
  after insert or update or delete on leads
  for each row execute function app.tracer();
