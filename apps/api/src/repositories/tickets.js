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

/**
 * Le fil d'un ticket.
 *
 * LES NOTES INTERNES SONT FILTRÉES EN SQL, PAS DANS LA VUE. Une note écrite
 * entre intervenants — « le client se trompe de liaison, à reprendre en
 * douceur » — ne doit pas transiter jusqu'au navigateur du client pour y être
 * masquée en CSS : ce qui n'est pas envoyé ne peut pas fuir.
 */
export async function messages(client, ticketId, { avecInternes = false } = {}) {
  const { rows } = await client.query(
    `select m.id, m.corps, m.interne, m.cree_le, u.nom as auteur,
            u.organisation_id is null as auteur_5sync
       from ticket_messages m
       left join users u on u.id = m.auteur_id
      where m.ticket_id = $1 and ($2 or not m.interne)
      order by m.cree_le`,
    [ticketId, avecInternes],
  );
  return rows;
}

export async function repondre(client, { organisationId, ticketId, auteurId, corps, interne = false }) {
  const { rows } = await client.query(
    `insert into ticket_messages (organisation_id, ticket_id, auteur_id, corps, interne)
     values ($1,$2,$3,$4,$5)
     returning id, corps, interne, cree_le`,
    [organisationId, ticketId, auteurId, corps, interne],
  );
  return rows[0];
}

/**
 * Change l'état d'un ticket, côté opérateur.
 *
 * LES DEUX HORODATAGES NE SONT JAMAIS SAISIS, ILS SE DÉDUISENT.
 * `pris_en_charge_le` se pose au premier départ de « ouvert », et une fois
 * posé ne bouge plus — un aller-retour par « votre_retour » ne doit pas
 * remettre le compteur de GTI à zéro. `resolu_le` se pose à l'entrée dans
 * « resolu » ou « clos », et s'efface à la réouverture : un ticket rouvert
 * n'est pas un ticket résolu, et le laisser daté fausserait le respect des
 * SLA dans le sens flatteur.
 *
 * `undefined` signifie « ne touche pas à ce champ » ; `null` signifie « vide
 * ce champ ». Les confondre reviendrait à détacher un ticket de son contrat
 * chaque fois qu'on en change le statut — et à vider l'assiette du calcul des
 * SLA sans que personne ne s'en aperçoive.
 */
export async function mettreAJour(client, id, { statut, niveau, prioriteHaute, contratId } = {}) {
  const { rows } = await client.query(
    `update tickets set
       statut         = coalesce($2::app.statut_ticket, statut),
       niveau         = coalesce($3::app.niveau_ticket, niveau),
       priorite_haute = coalesce($4::boolean, priorite_haute),
       contrat_id     = case when $5::boolean then $6::uuid else contrat_id end,
       pris_en_charge_le = case
         when pris_en_charge_le is not null then pris_en_charge_le
         when coalesce($2::app.statut_ticket, statut) <> 'ouvert' then now()
         else null end,
       resolu_le = case
         when coalesce($2::app.statut_ticket, statut) in ('resolu','clos')
           then coalesce(resolu_le, now())
         else null end
     where id = $1
     returning id, reference, statut, niveau, priorite_haute, contrat_id,
               pris_en_charge_le, resolu_le`,
    [
      id,
      statut ?? null,
      niveau ?? null,
      prioriteHaute ?? null,
      contratId !== undefined,
      contratId ?? null,
    ],
  );
  return rows[0] ?? null;
}
