/**
 * Dépôt des projets.
 *
 * Comme tous les dépôts : aucun filtre par organisation ici. Le cloisonnement
 * est posé par Row-Level Security depuis le contexte ouvert par withTenant.
 * Écrire « where organisation_id = $1 » donnerait l'illusion que c'est cette
 * ligne qui protège.
 */

export async function lister(client, { statut = null, limite = 50 } = {}) {
  const { rows } = await client.query(
    `select p.id, p.nom, p.phase, p.statut, p.echeance,
            a.avancement_pct, a.jalons_valides, a.jalons_total
       from projets p
       join projets_avancement a on a.projet_id = p.id
      where ($1::app.statut_projet is null or p.statut = $1)
      order by p.echeance nulls last, p.nom
      limit $2`,
    [statut, limite],
  );
  return rows;
}

export async function parId(client, id) {
  const { rows } = await client.query(
    `select p.*, a.avancement_pct, a.jalons_valides, a.jalons_total
       from projets p
       join projets_avancement a on a.projet_id = p.id
      where p.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function jalons(client, projetId) {
  const { rows } = await client.query(
    `select id, libelle, echeance, valide_le, poids, rang
       from jalons where projet_id = $1 order by rang, echeance nulls last`,
    [projetId],
  );
  return rows;
}

/**
 * Indicateurs de la vue « Projets & jalons ».
 *
 * L'avancement moyen est pondéré par le poids des jalons, pas par le nombre de
 * projets : un projet à un seul lot ne pèse pas autant qu'un projet à six.
 * C'est ce que la maquette annonce — « pondéré par lot ».
 */
export async function indicateurs(client) {
  const { rows } = await client.query(`
    with actifs as (
      select p.id, p.statut from projets p where p.statut not in ('clos')
    )
    select
      (select count(*) from actifs)                                          as actifs,
      (select count(*) from actifs where statut = 'recette')                 as en_recette,
      (select count(*) from jalons j
        join projets p on p.id = j.projet_id
       where p.statut <> 'clos' and j.valide_le is not null)                 as jalons_valides,
      (select count(*) from jalons j
        join projets p on p.id = j.projet_id
       where p.statut <> 'clos')                                             as jalons_total,
      (select min(j.echeance) from jalons j
        join projets p on p.id = j.projet_id
       where p.statut <> 'clos' and j.valide_le is null
         and j.echeance >= current_date)                                     as prochain_jalon,
      (select j.libelle from jalons j
        join projets p on p.id = j.projet_id
       where p.statut <> 'clos' and j.valide_le is null
         and j.echeance >= current_date
       order by j.echeance limit 1)                                          as prochain_jalon_libelle,
      (select coalesce(round(100.0
                * sum(j.poids) filter (where j.valide_le is not null)
                / nullif(sum(j.poids), 0)), 0)
         from jalons j join projets p on p.id = j.projet_id
        where p.statut <> 'clos')                                            as avancement_moyen_pct
  `);

  const r = rows[0];
  return {
    actifs: Number(r.actifs),
    enRecette: Number(r.en_recette),
    jalonsValides: Number(r.jalons_valides),
    jalonsTotal: Number(r.jalons_total),
    prochainJalon: r.prochain_jalon,
    prochainJalonLibelle: r.prochain_jalon_libelle,
    avancementMoyenPct: Number(r.avancement_moyen_pct),
  };
}

/**
 * Crée un projet et ses jalons dans le même mouvement.
 *
 * LES JALONS NE SONT PAS UN DÉTAIL QU'ON AJOUTERA APRÈS. L'avancement est
 * pondéré par leur poids : un projet créé sans jalon affiche 0 % et pèse zéro
 * dans la moyenne du portefeuille. Les accepter à la création — dans la même
 * transaction, donc tout ou rien — évite l'état intermédiaire où un projet
 * existe sans que personne ne sache ce qu'il contient.
 */
export async function creer(client, { organisationId, nom, phase = 'cadrage', statut = 'cadrage', echeance = null, jalons: lignes = [] }) {
  const { rows } = await client.query(
    `insert into projets (organisation_id, nom, phase, statut, echeance)
     values ($1,$2,$3,$4,$5)
     returning id, nom, phase, statut, echeance, cree_le`,
    [organisationId, nom, phase, statut, echeance],
  );
  const projet = rows[0];

  for (const [rang, jalon] of lignes.entries()) {
    await client.query(
      `insert into jalons (organisation_id, projet_id, libelle, echeance, poids, rang)
       values ($1,$2,$3,$4,$5,$6)`,
      [organisationId, projet.id, jalon.libelle, jalon.echeance ?? null, jalon.poids ?? 1, rang],
    );
  }

  return { ...projet, jalons: lignes.length };
}
