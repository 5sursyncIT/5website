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

/**
 * Crée un client : l'organisation, ses sites, et son premier compte référent.
 *
 * TOUT OU RIEN, DANS UNE SEULE TRANSACTION. Une organisation créée sans
 * référent est une coquille que personne ne peut ouvrir ; un référent créé
 * sans son organisation ne peut pas exister — la contrainte
 * `users_org_selon_role` l'interdit. Les créer séparément produirait, au
 * premier échec réseau, un état que l'opérateur ne peut ni utiliser ni
 * reprendre : le nom serait pris, et « Nouveau client » échouerait ensuite sur
 * un doublon sans dire pourquoi.
 *
 * LE MOT DE PASSE PROVISOIRE EST RENVOYÉ UNE FOIS, ET UNE SEULE.
 * Il n'existe pas encore de parcours de réinitialisation dans ce projet : un
 * compte créé avec un secret que personne ne connaît serait inutilisable. On
 * le rend donc à l'opérateur qui vient de créer le compte — jamais stocké en
 * clair, jamais relisible ensuite. À remplacer par un lien d'invitation à
 * usage unique dès qu'un parcours de réinitialisation existera.
 */
export async function creer(client, session, { nom, pays, statut = 'actif', sites = [], referent }) {
  exiger(session, 'organisations:ecrire');

  const { rows } = await client.query(
    'insert into organisations (nom, pays, statut) values ($1,$2,$3) returning id, nom, pays, statut, cree_le',
    [nom, pays, statut],
  );
  const organisation = rows[0];

  const identifiantsSites = [];
  for (const siteNom of sites) {
    const { rows: r } = await client.query(
      'insert into sites (organisation_id, nom) values ($1,$2) returning id, nom',
      [organisation.id, siteNom],
    );
    identifiantsSites.push(r[0]);
  }

  const { rows: r } = await client.query(
    `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
     values ($1,'client_admin',$2,$3,$4)
     returning id, email, nom, role`,
    [organisation.id, referent.email, referent.nom, referent.empreinte],
  );

  return { ...organisation, sites: identifiantsSites, referent: r[0] };
}
