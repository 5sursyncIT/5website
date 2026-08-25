/**
 * Dépôt des documents et de leurs versions.
 *
 * Un document est un objet stable ; ses versions sont des faits datés. La
 * maquette affiche « v3 » pour le schéma directeur réseau : c'est la version
 * courante, pas la seule qui existe. Écraser les précédentes rendrait
 * impossible de dire ce qui avait été validé contradictoirement en juillet.
 */

/**
 * Liste les documents avec leur version courante.
 *
 * `distinct on` de PostgreSQL, plutôt qu'une fenêtre : il prend la première
 * ligne de chaque groupe selon l'ordre donné, ce qui est exactement « la
 * version la plus haute de chaque document », en un seul balayage.
 */
export async function lister(client, { type = null, limite = 100 } = {}) {
  const { rows } = await client.query(
    `select distinct on (d.id)
            d.id, d.nom, d.type, d.statut, d.cree_le,
            v.version, v.depose_le, v.taille_octets, v.type_mime
       from documents d
       left join document_versions v on v.document_id = d.id
      where ($1::app.type_document is null or d.type = $1)
      order by d.id, v.version desc
      limit $2`,
    [type, limite],
  );

  return rows.sort((a, b) => (b.depose_le ?? b.cree_le) - (a.depose_le ?? a.cree_le));
}

export async function parId(client, id) {
  const { rows } = await client.query('select * from documents where id = $1', [id]);
  return rows[0] ?? null;
}

export async function versions(client, documentId) {
  const { rows } = await client.query(
    `select id, version, taille_octets, type_mime, encode(empreinte_sha256,'hex') as empreinte,
            depose_le, depose_par
       from document_versions where document_id = $1 order by version desc`,
    [documentId],
  );
  return rows;
}

/**
 * Résout une version pour téléchargement.
 *
 * Renvoie le chemin sur disque, qui est HORS de toute racine servie par le
 * serveur web. Le fichier n'est jamais accessible par URL directe : c'est une
 * route authentifiée qui revalide les droits, puis lit le fichier. Un
 * changement de rôle ou une révocation prend donc effet au téléchargement
 * suivant, sans qu'aucun lien n'ait à être invalidé.
 */
export async function versionPourTelechargement(client, { documentId, version = null }) {
  const { rows } = await client.query(
    `select v.id, v.chemin, v.type_mime, v.taille_octets, v.version, d.nom
       from document_versions v
       join documents d on d.id = v.document_id
      where v.document_id = $1
        and ($2::smallint is null or v.version = $2)
      order by v.version desc limit 1`,
    [documentId, version],
  );
  return rows[0] ?? null;
}

export async function deposer(
  client,
  { organisationId, documentId, chemin, tailleOctets, typeMime, empreinteSha256, deposePar },
) {
  const { rows } = await client.query(
    `insert into document_versions
       (organisation_id, document_id, version, chemin, taille_octets, type_mime,
        empreinte_sha256, depose_par)
     values ($1, $2,
             coalesce((select max(version) from document_versions where document_id = $2), 0) + 1,
             $3, $4, $5, $6, $7)
     returning id, version, depose_le`,
    [organisationId, documentId, chemin, tailleOctets, typeMime, empreinteSha256, deposePar],
  );
  return rows[0];
}

/** Indicateurs de la vue « Documents & livrables ». */
export async function indicateurs(client) {
  const { rows } = await client.query(`
    select
      count(*)                                                        as total,
      count(*) filter (where type = 'rapport_intervention')            as rapports,
      count(*) filter (where type = 'livrable_projet' and statut in ('valide','signe')) as livrables_valides,
      (select max(v.depose_le) from document_versions v)               as dernier_depot,
      (select d.nom from documents d
         join document_versions v on v.document_id = d.id
        order by v.depose_le desc limit 1)                             as dernier_depot_nom
    from documents
  `);

  const r = rows[0];
  return {
    total: Number(r.total),
    rapports: Number(r.rapports),
    livrablesValides: Number(r.livrables_valides),
    dernierDepot: r.dernier_depot,
    dernierDepotNom: r.dernier_depot_nom,
  };
}
