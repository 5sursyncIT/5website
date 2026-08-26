/**
 * Dépôt des contrats et de leurs engagements de service.
 *
 * GTI et GTR restent deux colonnes distinctes : ce sont deux engagements
 * différents — délai de prise en charge, délai de rétablissement — et les
 * fondre interdirait de mesurer le respect de l'un sans l'autre.
 */

export async function lister(client, { statut = null } = {}) {
  const { rows } = await client.query(
    `select c.id, c.reference, c.intitule, c.perimetre,
            c.gti_heures, c.gtr_heures, c.forfait_heures, c.echeance, c.statut,
            k.heures_consommees
       from contrats c
       join contrats_consommation k on k.contrat_id = c.id
      where ($1::app.statut_contrat is null or c.statut = $1)
      order by c.echeance nulls last, c.reference`,
    [statut],
  );
  return rows;
}

export async function parId(client, id) {
  const { rows } = await client.query(
    `select c.*, k.heures_consommees
       from contrats c join contrats_consommation k on k.contrat_id = c.id
      where c.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Indicateurs de la vue « Contrats & SLA ».
 *
 * LE RESPECT DES SLA EST CALCULÉ, ET IL DIT SUR QUOI IL PORTE.
 *
 * Un ticket n'est mesurable que s'il est rattaché à un contrat — la Ville de
 * Dakar en a deux, l'un à 2 h / 8 h, l'autre à 4 h / 24 h, et les confondre
 * donnerait un taux faux. Les tickets non rattachés sont donc exclus, et leur
 * nombre est renvoyé : un pourcentage calculé sur un échantillon partiel doit
 * annoncer son assiette, sans quoi « 100 % » ne veut rien dire.
 */
export async function indicateurs(client) {
  const { rows } = await client.query(`
    with mesurables as (
      select t.id,
             c.gti_heures,
             c.gtr_heures,
             extract(epoch from (t.pris_en_charge_le - t.ouvert_le)) / 3600 as gti_reel,
             extract(epoch from (t.resolu_le - t.ouvert_le)) / 3600         as gtr_reel
        from tickets t
        join contrats c on c.id = t.contrat_id
       where t.pris_en_charge_le is not null
    )
    select
      (select count(*) from contrats where statut = 'actif')             as actifs,
      (select count(*) from contrats where statut = 'a_renouveler')      as a_renouveler,
      (select min(echeance) from contrats
        where statut in ('actif','a_renouveler') and echeance >= current_date) as prochaine_echeance,
      (select coalesce(sum(k.heures_consommees), 0) from contrats_consommation k
        join contrats c on c.id = k.contrat_id where c.statut = 'actif')  as heures_consommees,
      (select coalesce(sum(forfait_heures), 0) from contrats
        where statut = 'actif')                                          as forfait_heures,
      (select count(*) from mesurables)                                  as sla_mesures,
      (select count(*) from tickets where contrat_id is null
         and pris_en_charge_le is not null)                              as sla_hors_perimetre,
      (select count(*) from mesurables
        where gti_reel > gti_heures
           or (gtr_reel is not null and gtr_reel > gtr_heures))          as sla_depassements
  `);

  const r = rows[0];
  const mesures = Number(r.sla_mesures);
  const depassements = Number(r.sla_depassements);

  return {
    actifs: Number(r.actifs),
    aRenouveler: Number(r.a_renouveler),
    prochaineEcheance: r.prochaine_echeance,
    heuresConsommees: Number(r.heures_consommees),
    forfaitHeures: Number(r.forfait_heures),
    sla: {
      // null, et non 100 : sans mesure, il n'y a pas de taux. Afficher « 100 % »
      // parce qu'on n'a rien mesuré serait un chiffre inventé.
      respectPct: mesures === 0 ? null : Math.round((100 * (mesures - depassements)) / mesures),
      mesures,
      depassements,
      horsPerimetre: Number(r.sla_hors_perimetre),
    },
  };
}

/** Écriture d'heures consommées sur un forfait. */
export async function consommer(client, { organisationId, contratId, minutes, motif = null }) {
  const { rows } = await client.query(
    `insert into contrat_heures (organisation_id, contrat_id, minutes, motif)
     values ($1,$2,$3,$4) returning id, minutes, survenu_le`,
    [organisationId, contratId, minutes, motif],
  );
  return rows[0];
}

/**
 * Crée un contrat.
 *
 * GTI et GTR sont facultatives ici : tout contrat ne porte pas d'engagement de
 * délai. Mais un contrat sans GTR ne peut pas être dépassé, donc ses tickets
 * ne comptent pas dans le respect des SLA — c'est exact, et c'est la raison
 * pour laquelle l'indicateur renvoie son assiette au lieu d'un simple
 * pourcentage.
 */
export async function creer(
  client,
  { organisationId, reference, intitule, perimetre = null, gtiHeures = null,
    gtrHeures = null, forfaitHeures = null, echeance = null },
) {
  const { rows } = await client.query(
    `insert into contrats
       (organisation_id, reference, intitule, perimetre, gti_heures, gtr_heures,
        forfait_heures, echeance)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     returning id, reference, intitule, gti_heures, gtr_heures, forfait_heures,
               echeance, statut, cree_le`,
    [organisationId, reference, intitule, perimetre, gtiHeures, gtrHeures, forfaitHeures, echeance],
  );
  return rows[0];
}
