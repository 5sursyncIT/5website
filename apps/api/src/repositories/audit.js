/**
 * Lecture du journal d'audit.
 *
 * CE MODULE NE SAIT QUE LIRE. Le journal est alimenté par le déclencheur
 * `app.tracer()`, en `security definer`, sur chaque table cloisonnée : aucun
 * code applicatif n'y écrit, et aucun ne doit pouvoir y écrire. Un journal
 * qu'une route peut modifier ne prouve rien — c'est précisément la propriété
 * qu'on lui demande.
 *
 * La table n'a pas de politique d'isolation, et l'exemption est motivée en
 * commentaire de table (migration 012) : elle doit pouvoir enregistrer un
 * événement quel que soit le périmètre de la transaction, y compris hors de
 * tout périmètre. Le contrôle d'accès se fait donc ici, par le rôle — la
 * capacité « audit:lire » n'est accordée qu'à « admin ».
 *
 * `users` ne porte pas de déclencheur d'audit, et c'est délibéré : le dump de
 * ligne qu'écrit `app.tracer()` y ferait entrer les empreintes de mots de
 * passe et les secrets TOTP dans une table en écriture seule, où un secret
 * révoqué resterait lisible pour toujours.
 */
import { exiger } from '../auth/contexte.js';

const LIMITE_MAX = 200;

export async function lister(
  client,
  session,
  { organisationId = null, table = null, acteurId = null, action = null,
    depuis = null, avant = null, limite = 50 } = {},
) {
  exiger(session, 'audit:lire');

  const { rows } = await client.query(
    `select a.id, a.survenu_le, a.action, a.table_cible, a.cible_id,
            a.acteur_id, u.nom as acteur, a.organisation_id, o.nom as organisation,
            a.details
       from audit_log a
       left join users u         on u.id = a.acteur_id
       left join organisations o on o.id = a.organisation_id
      where ($1::uuid is null or a.organisation_id = $1)
        and ($2::text is null or a.table_cible = $2)
        and ($3::uuid is null or a.acteur_id = $3)
        and ($4::text is null or a.action = $4)
        and ($5::timestamptz is null or a.survenu_le >= $5)
        -- Pagination par identifiant décroissant, et non par décalage : un
        -- « offset » sur un journal qui grossit pendant la lecture saute des
        -- lignes et en répète d'autres. L'identifiant est monotone, donc stable.
        and ($6::bigint is null or a.id < $6)
      order by a.id desc
      limit $7`,
    [organisationId, table, acteurId, action, depuis, avant, Math.min(limite, LIMITE_MAX)],
  );

  return rows;
}

export { LIMITE_MAX };
