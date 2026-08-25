import { getAppPool } from './pool.js';

/**
 * LE SEUL CHEMIN VERS LES DONNÉES CLIENT.
 *
 * Ouvre une transaction, y pose le contexte d'isolation, exécute, valide ou
 * annule. Les politiques Row-Level Security lisent ce contexte : hors de
 * withTenant, app.organisation_id vaut NULL, et toute requête sur une table
 * cloisonnée renvoie zéro ligne.
 *
 * C'est volontaire. Le défaut est le refus : une requête qui oublie son
 * périmètre ne fuit pas, elle ne voit rien. Le bug se manifeste comme une
 * liste vide — visible immédiatement — et non comme une fuite silencieuse.
 *
 * set_config(..., true) rend le réglage LOCAL à la transaction : il disparaît
 * au commit, donc la connexion rendue au pool ne conserve aucun contexte. Sans
 * ce `true`, la requête suivante d'un autre client hériterait du périmètre du
 * précédent — exactement la fuite que tout ceci vise à rendre impossible.
 *
 * @template T
 * @param {object} contexte
 * @param {string|null} contexte.organisationId  périmètre client ; null pour le personnel
 * @param {boolean} [contexte.isStaff=false]     personnel 5/Sync : voit toutes les organisations
 * @param {string|null} [contexte.actorId=null]  auteur, repris par le journal d'audit
 * @param {(client: import('pg').PoolClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withTenant({ organisationId, isStaff = false, actorId = null }, fn) {
  if (!organisationId && !isStaff) {
    throw new Error(
      'withTenant appelé sans organisation et sans droit personnel : aucune donnée ne serait ' +
        'visible. Précisez organisationId, ou isStaff pour un accès transverse.',
    );
  }

  const client = await getAppPool().connect();
  try {
    await client.query('begin');
    await client.query('select set_config($1, $2, true)', [
      'app.organisation_id',
      organisationId ?? '',
    ]);
    await client.query('select set_config($1, $2, true)', ['app.is_staff', isStaff ? 'true' : 'false']);
    await client.query('select set_config($1, $2, true)', ['app.actor_id', actorId ?? '']);

    const résultat = await fn(client);
    await client.query('commit');
    return résultat;
  } catch (erreur) {
    await client.query('rollback');
    throw erreur;
  } finally {
    client.release();
  }
}

/**
 * Contexte sans organisation, réservé aux tables non cloisonnées :
 * organisations, users, sessions, leads. Ces tables n'ont pas de politique RLS
 * parce qu'elles définissent le périmètre au lieu d'en dépendre — le contrôle
 * s'y fait par le rôle, dans les dépôts.
 */
export async function withoutTenant(fn) {
  const client = await getAppPool().connect();
  try {
    await client.query('begin');
    const résultat = await fn(client);
    await client.query('commit');
    return résultat;
  } catch (erreur) {
    await client.query('rollback');
    throw erreur;
  } finally {
    client.release();
  }
}
