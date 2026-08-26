/**
 * Dépôt des interventions terrain.
 *
 * Comme tous les dépôts : aucun filtre par organisation ici. Le cloisonnement
 * est posé par Row-Level Security depuis le contexte ouvert par withTenant.
 *
 * CE QUE CE MODULE REND REQUÊTABLE, ET POURQUOI
 * Le back-office affiche « 5 rapports à déposer ». C'est l'ABSENCE de rapport
 * qui porte l'information : un statut « rapport_a_deposer » n'a de valeur que
 * si l'on peut le compter, et le compter suppose que le rapport soit une
 * référence nullable vers un document plutôt qu'une case cochée à la main.
 */

export async function lister(client, { statut = null, contratId = null, limite = 100 } = {}) {
  const { rows } = await client.query(
    `select i.id, i.reference, i.objet, i.survenue_le, i.statut, i.minutes,
            s.nom as site, u.nom as intervenant,
            t.reference as ticket, c.reference as contrat,
            i.rapport_id is not null as rapport_depose
       from interventions i
       left join sites s     on s.id = i.site_id
       left join users u     on u.id = i.intervenant_id
       left join tickets t   on t.id = i.ticket_id
       left join contrats c  on c.id = i.contrat_id
      where ($1::app.statut_intervention is null or i.statut = $1)
        and ($2::uuid is null or i.contrat_id = $2)
      order by i.survenue_le desc, i.reference
      limit $3`,
    [statut, contratId, limite],
  );
  return rows;
}

export async function parId(client, id) {
  const { rows } = await client.query(
    `select i.*, s.nom as site, u.nom as intervenant,
            t.reference as ticket, c.reference as contrat
       from interventions i
       left join sites s     on s.id = i.site_id
       left join users u     on u.id = i.intervenant_id
       left join tickets t   on t.id = i.ticket_id
       left join contrats c  on c.id = i.contrat_id
      where i.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Indicateurs de la vue « Interventions ».
 *
 * « À planifier » et « rapport à déposer » sont les deux seuls chiffres qui
 * appellent une action : les autres décrivent, ceux-là commandent. Le retard
 * de rapport est compté sans borne de date — un rapport en souffrance depuis
 * trois mois ne doit pas sortir du décompte parce que le mois a changé.
 */
export async function indicateurs(client) {
  const { rows } = await client.query(`
    select
      count(*) filter (where statut = 'planifiee')                    as planifiees,
      count(*) filter (where statut = 'planifiee'
                         and survenue_le < current_date)              as en_retard,
      count(*) filter (where statut = 'rapport_a_deposer')            as rapports_a_deposer,
      count(*) filter (where statut in ('realisee','rapport_depose','cloturee')
                         and survenue_le >= date_trunc('month', current_date)) as realisees_ce_mois,
      coalesce(sum(minutes) filter (
        where survenue_le >= date_trunc('month', current_date)), 0)   as minutes_ce_mois
      from interventions
  `);

  const r = rows[0];
  return {
    planifiees: Number(r.planifiees),
    enRetard: Number(r.en_retard),
    rapportsADeposer: Number(r.rapports_a_deposer),
    realiseesCeMois: Number(r.realisees_ce_mois),
    minutesCeMois: Number(r.minutes_ce_mois),
  };
}

export async function planifier(
  client,
  { organisationId, reference, objet, survenueLe, siteId = null, ticketId = null,
    contratId = null, intervenantId = null, minutes = null },
) {
  const { rows } = await client.query(
    `insert into interventions
       (organisation_id, reference, objet, survenue_le, site_id, ticket_id,
        contrat_id, intervenant_id, minutes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning id, reference, objet, survenue_le, statut, minutes`,
    [organisationId, reference, objet, survenueLe, siteId, ticketId, contratId, intervenantId, minutes],
  );
  return rows[0];
}
