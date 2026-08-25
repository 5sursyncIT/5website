/**
 * Dépôt du parc matériel installé.
 *
 * UNE LIGNE N'EST PAS UN ÉQUIPEMENT. La maquette annonce « 64 équipements
 * suivis » et affiche « Points d'accès UniFi (12 unités) » sur une seule
 * ligne : les indicateurs comptent des QUANTITÉS, pas des enregistrements.
 * Compter les lignes donnerait un parc trois fois plus petit qu'il n'est.
 */

export async function lister(client, { statut = null, siteId = null } = {}) {
  const { rows } = await client.query(
    `select e.id, e.designation, e.quantite, e.mise_en_service, e.fin_garantie,
            e.statut, s.nom as site,
            (e.fin_garantie is not null and e.fin_garantie < current_date) as garantie_expiree
       from equipements e
       left join sites s on s.id = e.site_id
      where ($1::app.statut_equipement is null or e.statut = $1)
        and ($2::uuid is null or e.site_id = $2)
      order by e.fin_garantie nulls last, e.designation`,
    [statut, siteId],
  );
  return rows;
}

export async function parId(client, id) {
  const { rows } = await client.query(
    `select e.*, s.nom as site from equipements e
       left join sites s on s.id = e.site_id where e.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Indicateurs de la vue « Parc matériel ».
 *
 * « Fin de garantie sous 6 mois » se dérive de dates, jamais d'un compteur
 * entretenu à la main : un compteur serait faux le lendemain de sa saisie.
 */
export async function indicateurs(client) {
  const { rows } = await client.query(`
    select
      coalesce(sum(quantite), 0)                                       as suivis,
      coalesce(sum(quantite) filter (
        where fin_garantie is not null and fin_garantie >= current_date), 0) as sous_garantie,
      coalesce(sum(quantite) filter (
        where fin_garantie is not null
          and fin_garantie >= current_date
          and fin_garantie < current_date + interval '6 months'), 0)   as garantie_bientot_echue,
      coalesce(sum(quantite) filter (where statut = 'a_renouveler'), 0) as a_renouveler,
      count(distinct site_id) filter (where site_id is not null)        as sites_couverts
    from equipements
  `);

  const r = rows[0];
  const suivis = Number(r.suivis);
  const sousGarantie = Number(r.sous_garantie);

  return {
    suivis,
    sousGarantie,
    // Pas de division par zéro déguisée en 0 % : un parc vide n'a pas de taux.
    sousGarantiePct: suivis === 0 ? null : Math.round((100 * sousGarantie) / suivis),
    garantieBientotEchue: Number(r.garantie_bientot_echue),
    aRenouveler: Number(r.a_renouveler),
    sitesCouverts: Number(r.sites_couverts),
  };
}
