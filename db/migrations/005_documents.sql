-- 005 — Documents et livrables. La version est explicite (v1, v2, v3) parce
-- que la maquette l'affiche : un livrable validé contradictoirement n'est pas
-- le même objet que sa révision suivante.

create type app.type_document as enum (
  'rapport_intervention', 'livrable_projet', 'documentation_technique',
  'exploitation', 'recette', 'contractuel', 'autre'
);
create type app.statut_document as enum ('depose', 'valide', 'signe', 'obsolete');

create table documents (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  nom              text not null,
  type             app.type_document not null default 'autre',
  statut           app.statut_document not null default 'depose',
  projet_id        uuid references projets (id) on delete set null,
  cree_le          timestamptz not null default now()
);

create index on documents (organisation_id, cree_le desc);

create table document_versions (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations (id) on delete cascade,
  document_id      uuid not null references documents (id) on delete cascade,
  version          smallint not null check (version > 0),
  -- Chemin relatif hors racine web. Le fichier n'est jamais servi
  -- directement : une route authentifiée revalide les droits à chaque
  -- téléchargement.
  chemin           text not null,
  taille_octets    bigint not null check (taille_octets >= 0),
  type_mime        text not null,
  empreinte_sha256 bytea not null,
  depose_par       uuid references users (id) on delete set null,
  depose_le        timestamptz not null default now(),

  constraint document_versions_unique unique (document_id, version)
);

create index on document_versions (document_id, version desc);

select app.proteger('documents');
select app.proteger('document_versions');
