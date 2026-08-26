/**
 * Dépôt des demandes entrantes.
 *
 * `leads` n'a pas de colonne organisation_id et pas de politique RLS : un
 * prospect n'appartient par définition à aucune organisation cliente. L'accès
 * en lecture est donc contrôlé par le rôle, dans les routes, et non par le
 * cloisonnement.
 */

export async function deposer(client, { organisation, nom, email, telephone, besoins, contexte, ip }) {
  const { rows } = await client.query(
    `insert into leads (organisation, nom, email, telephone, besoins, contexte, ip)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning id, cree_le`,
    [organisation, nom, email, telephone, besoins, contexte, ip],
  );
  return rows[0];
}

export async function lister(client, { traites = false, limite = 100 } = {}) {
  const { rows } = await client.query(
    `select id, organisation, nom, email, telephone, besoins, contexte, cree_le, traite_le
       from leads
      where ($1 or traite_le is null)
      order by cree_le desc
      limit $2`,
    [traites, limite],
  );
  return rows;
}
