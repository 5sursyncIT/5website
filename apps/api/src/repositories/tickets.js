/**
 * Dépôt des tickets.
 *
 * Aucune de ces fonctions ne filtre par organisation, et c'est voulu : le
 * filtre est posé par Row-Level Security à partir du contexte de transaction
 * ouvert par withTenant. Écrire « where organisation_id = $1 » ici donnerait
 * l'illusion que c'est cette ligne qui protège — et le jour où quelqu'un
 * l'oublie, rien ne se casserait visiblement.
 *
 * Chaque fonction reçoit le client PostgreSQL de la transaction en cours.
 */

export async function lister(client, { statut = null, limite = 50 } = {}) {
  const { rows } = await client.query(
    `select t.id, t.reference, t.objet, t.niveau, t.statut, t.priorite_haute,
            t.ouvert_le, s.nom as site
       from tickets t
       left join sites s on s.id = t.site_id
      where ($1::app.statut_ticket is null or t.statut = $1)
      order by t.ouvert_le desc
      limit $2`,
    [statut, limite],
  );
  return rows;
}

export async function parId(client, id) {
  const { rows } = await client.query(
    `select t.*, s.nom as site from tickets t
       left join sites s on s.id = t.site_id
      where t.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export async function ouvrir(client, { organisationId, reference, objet, siteId = null, niveau = 'n1', creePar = null }) {
  const { rows } = await client.query(
    `insert into tickets (organisation_id, reference, objet, site_id, niveau, cree_par)
     values ($1, $2, $3, $4, $5, $6)
     returning id, reference, objet, statut, ouvert_le`,
    [organisationId, reference, objet, siteId, niveau, creePar],
  );
  return rows[0];
}

/**
 * Indicateurs de l'espace client. Tous calculés, aucun stocké.
 *
 * Le délai de prise en charge se dérive de deux horodatages ; le figer en
 * colonne produirait un chiffre faux dès la première semaine d'exploitation.
 */
export async function indicateurs(client) {
  const { rows } = await client.query(`
    select
      count(*) filter (where statut not in ('resolu', 'clos'))                as ouverts,
      count(*) filter (where statut not in ('resolu','clos') and priorite_haute) as prioritaires,
      count(*) filter (where statut = 'votre_retour')                          as attente_client,
      count(*) filter (where resolu_le >= date_trunc('month', now()))          as resolus_ce_mois,
      avg(extract(epoch from (pris_en_charge_le - ouvert_le)))
        filter (where pris_en_charge_le is not null)                           as prise_en_charge_s
    from tickets
  `);

  const r = rows[0];
  return {
    ouverts: Number(r.ouverts),
    prioritaires: Number(r.prioritaires),
    attenteClient: Number(r.attente_client),
    resolusCeMois: Number(r.resolus_ce_mois),
    priseEnChargeMinutes:
      r.prise_en_charge_s === null ? null : Math.round(Number(r.prise_en_charge_s) / 60),
  };
}
