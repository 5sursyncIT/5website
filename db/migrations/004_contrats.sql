-- 004 — Contrats et SLA. GTI et GTR sont deux engagements distincts : les
-- fondre dans une colonne unique interdirait de mesurer le respect de l'un
-- sans l'autre.

create type app.statut_contrat as enum ('actif', 'a_renouveler', 'suspendu', 'clos');

create table contrats (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references organisations (id) on delete cascade,
  reference         text not null,
  intitule          text not null,
  perimetre         text,
  gti_heures        smallint,
  gtr_heures        smallint,
  forfait_heures    smallint,
  echeance          date,
  statut            app.statut_contrat not null default 'actif',
  cree_le           timestamptz not null default now(),

  constraint contrats_reference_unique unique (organisation_id, reference)
);

create index on contrats (organisation_id, statut);

create table contrat_heures (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  contrat_id       uuid not null references contrats (id) on delete cascade,
  minutes          integer not null check (minutes > 0),
  motif            text,
  survenu_le       date not null default current_date
);

create index on contrat_heures (contrat_id);

-- « 74 / 120 h » se dérive de la somme des écritures.
create view contrats_consommation as
  select c.id as contrat_id,
         c.organisation_id,
         c.forfait_heures,
         coalesce(round(sum(h.minutes) / 60.0), 0)::int as heures_consommees
    from contrats c
    left join contrat_heures h on h.contrat_id = c.id
   group by c.id, c.organisation_id, c.forfait_heures;

select app.proteger('contrats');
select app.proteger('contrat_heures');
