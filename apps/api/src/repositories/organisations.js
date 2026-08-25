/**
 * Dépôt des organisations.
 *
 * Cette table n'a pas de politique RLS : elle DÉFINIT le périmètre au lieu
 * d'en dépendre. Le contrôle s'y fait donc par le rôle, et il est explicite
 * dans chaque fonction plutôt que délégué à la base.
 */
import { exiger } from '../auth/contexte.js';

export async function lister(client, session) {
  exiger(session, 'organisations:lire');
  const { rows } = await client.query(
    `select o.id, o.nom, o.pays, o.statut,
            (select count(*) from projets p where p.organisation_id = o.id) as projets,
            (select count(*) from tickets t
              where t.organisation_id = o.id and t.statut not in ('resolu','clos')) as tickets
       from organisations o
      where not o.est_demo or $1
      order by o.nom`,
    [process.env.NODE_ENV !== 'production'],
  );
  return rows;
}

export async function parId(client, session, id) {
  // Un compte client ne peut lire que sa propre organisation, quel que soit
  // l'identifiant qu'il présente.
  if (!session.estPersonnel && id !== session.organisationId) return null;
  const { rows } = await client.query('select id, nom, pays, statut from organisations where id = $1', [id]);
  return rows[0] ?? null;
}
