/**
 * Dépôt des devis et factures.
 *
 * LES MONTANTS SONT EN FRANCS CFA ENTIERS. Le XOF n'a pas de sous-unité : il
 * n'existe pas de centime de franc CFA. Les stocker en entiers n'est donc pas
 * une précaution d'arrondi, c'est la représentation exacte de la monnaie — et
 * un flottant sur une facture de 18 200 000 FCFA finirait par se voir en
 * comptabilité.
 *
 * Devis et factures partagent une table typée : ce sont deux états d'une même
 * pièce, et un devis validé devient une facture sans changer de nature.
 */

export async function lister(client, { type = null, statut = null, limite = 100 } = {}) {
  const { rows } = await client.query(
    `select p.id, p.reference, p.type, p.objet, p.montant_fcfa,
            p.echeance, p.statut, p.reglee_le, pr.nom as projet
       from pieces p
       left join projets pr on pr.id = p.projet_id
      where ($1::app.type_piece is null or p.type = $1)
        and ($2::app.statut_piece is null or p.statut = $2)
      order by coalesce(p.echeance, p.cree_le::date) desc, p.reference
      limit $3`,
    [type, statut, limite],
  );
  return rows;
}

export async function parId(client, id) {
  const { rows } = await client.query('select * from pieces where id = $1', [id]);
  return rows[0] ?? null;
}

export async function lignes(client, pieceId) {
  const { rows } = await client.query(
    `select id, libelle, quantite, prix_unitaire_fcfa,
            round(quantite * prix_unitaire_fcfa)::bigint as total_fcfa, rang
       from piece_lignes where piece_id = $1 order by rang`,
    [pieceId],
  );
  return rows;
}

/**
 * Indicateurs de la vue « Factures & devis ».
 *
 * « En attente » et « en retard » sont deux choses différentes : une facture
 * dont l'échéance est passée n'est pas simplement en attente, elle est en
 * souffrance. La maquette n'affiche que la première ; la seconde est calculée
 * ici parce que c'est elle qui appelle une action.
 */
export async function indicateurs(client, { exercice = null } = {}) {
  const { rows } = await client.query(
    `select
       count(*) filter (where extract(year from cree_le) = $1)          as pieces_exercice,
       count(*) filter (where statut = 'en_attente')                    as en_attente,
       coalesce(sum(montant_fcfa) filter (where statut = 'en_attente'), 0) as en_attente_fcfa,
       count(*) filter (where statut = 'en_attente'
                          and echeance is not null
                          and echeance < current_date)                  as en_retard,
       count(*) filter (where type = 'devis' and statut = 'a_valider')  as devis_a_valider,
       (select min(echeance) from pieces
         where statut = 'en_attente' and echeance >= current_date)      as prochaine_echeance,
       (select max(reglee_le) from pieces where statut = 'reglee')      as dernier_reglement,
       (select reference from pieces where statut = 'reglee'
         order by reglee_le desc nulls last limit 1)                    as dernier_reglement_ref
     from pieces`,
    [exercice ?? new Date().getUTCFullYear()],
  );

  const r = rows[0];
  return {
    piecesExercice: Number(r.pieces_exercice),
    enAttente: Number(r.en_attente),
    enAttenteFcfa: Number(r.en_attente_fcfa),
    enRetard: Number(r.en_retard),
    devisAValider: Number(r.devis_a_valider),
    prochaineEcheance: r.prochaine_echeance,
    dernierReglement: r.dernier_reglement,
    dernierReglementRef: r.dernier_reglement_ref,
  };
}

/**
 * Marque une pièce réglée.
 *
 * Le passage par un statut plutôt que par une suppression : une facture réglée
 * reste une pièce comptable, et le journal d'audit conserve qui l'a soldée.
 */
export async function marquerReglee(client, { id, regleeLe = null }) {
  const { rows } = await client.query(
    `update pieces set statut = 'reglee', reglee_le = coalesce($2, current_date)
      where id = $1 and statut <> 'reglee'
      returning id, reference, reglee_le`,
    [id, regleeLe],
  );
  return rows[0] ?? null;
}
