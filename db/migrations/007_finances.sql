-- 007 — Devis et factures dans une même table typée : ce sont deux états d'une
-- même pièce, et un devis validé devient une facture sans changer de nature.
--
-- Les montants sont en FRANCS CFA ENTIERS. Le XOF n'a pas de sous-unité, et
-- un flottant sur une facture de 18 200 000 FCFA est une erreur qui finit par
-- se voir en comptabilité.

create type app.type_piece as enum ('devis', 'facture', 'avoir');
create type app.statut_piece as enum ('brouillon', 'a_valider', 'en_attente', 'reglee', 'annulee');

create table pieces (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  reference        text not null,
  type             app.type_piece not null,
  objet            text not null,
  montant_fcfa     bigint not null check (montant_fcfa >= 0),
  echeance         date,
  statut           app.statut_piece not null default 'brouillon',
  reglee_le        date,
  projet_id        uuid references projets (id) on delete set null,
  cree_le          timestamptz not null default now(),

  constraint pieces_reference_unique unique (organisation_id, reference)
);

create index on pieces (organisation_id, statut);
create index on pieces (organisation_id, echeance);

create table piece_lignes (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  piece_id         uuid not null references pieces (id) on delete cascade,
  libelle          text not null,
  quantite         numeric(12, 2) not null default 1,
  prix_unitaire_fcfa bigint not null check (prix_unitaire_fcfa >= 0),
  rang             smallint not null default 0
);

create index on piece_lignes (piece_id, rang);

select app.proteger('pieces');
select app.proteger('piece_lignes');
