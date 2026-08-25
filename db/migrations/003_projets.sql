-- 003 — Projets et jalons.
-- « 11/17 jalons validés » exige des jalons en table : un pourcentage stocké
-- ne se recalcule pas et diverge du réel.

create type app.phase_projet as enum ('cadrage', 'conception', 'deploiement', 'recette', 'clos');
create type app.statut_projet as enum ('cadrage', 'en_cours', 'recette', 'suspendu', 'clos');

create table projets (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  nom              text not null,
  phase            app.phase_projet not null default 'cadrage',
  statut           app.statut_projet not null default 'cadrage',
  echeance         date,
  cree_le          timestamptz not null default now()
);

create index on projets (organisation_id, statut);

create table jalons (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  projet_id        uuid not null references projets (id) on delete cascade,
  libelle          text not null,
  echeance         date,
  valide_le        timestamptz,
  poids            smallint not null default 1 check (poids > 0),
  rang             smallint not null default 0
);

create index on jalons (projet_id, rang);

-- L'avancement se calcule, il ne se saisit pas.
create view projets_avancement as
  select p.id as projet_id,
         p.organisation_id,
         count(j.id) filter (where j.valide_le is not null) as jalons_valides,
         count(j.id)                                        as jalons_total,
         coalesce(
           round(100.0 * sum(j.poids) filter (where j.valide_le is not null)
                       / nullif(sum(j.poids), 0)),
           0)::int as avancement_pct
    from projets p
    left join jalons j on j.projet_id = p.id
   group by p.id, p.organisation_id;

select app.proteger('projets');
select app.proteger('jalons');
