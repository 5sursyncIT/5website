import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { getAppPool } from '../db/pool.js';
import { withTenant, withoutTenant } from '../db/tenant.js';
import { config } from '../config.js';
import { SEUILS } from '../auth/limitation.js';

/**
 * Relevé de supervision.
 *
 * CE QUI EST MESURÉ ICI EST CE QUI RÉVEILLERAIT QUELQU'UN LA NUIT, et rien
 * d'autre. Une métrique qu'on ne regarderait pas est un coût sans contrepartie :
 * elle occupe de la place dans le collecteur, elle allonge le tableau de bord,
 * et elle dilue les trois chiffres qui comptent.
 *
 * Les trois qui comptent, justement :
 *
 *   1. La base répond-elle ? Tout le reste en découle.
 *   2. Quand date la dernière sauvegarde ? Une sauvegarde qui a cessé de
 *      tourner ne fait aucun bruit — c'est sa propriété la plus dangereuse.
 *   3. Quand date le dernier exercice de restauration RÉUSSI ? Une sauvegarde
 *      qu'on n'a pas restaurée depuis six mois est redevenue une hypothèse.
 *
 * Le troisième est celui qu'on trouve le moins souvent supervisé, et c'est
 * pourtant le seul qui distingue « nous sauvegardons » de « nous savons
 * restaurer ».
 */

/** Répertoire des sauvegardes, tel que le voient les scripts d'infrastructure. */
function repertoireSauvegardes() {
  return process.env.SAUVEGARDE_DIR ?? join(process.cwd(), '.sauvegardes');
}

/** Âge en secondes du fichier, ou null s'il n'existe pas. */
async function ageFichier(chemin) {
  try {
    const infos = await stat(chemin);
    return Math.max(0, Math.round((Date.now() - infos.mtimeMs) / 1000));
  } catch {
    return null;
  }
}

/**
 * Lit le manifeste de la dernière sauvegarde.
 *
 * L'âge vient de l'HORODATAGE inscrit dedans, pas de la date du fichier : une
 * copie, un rsync ou une restauration de volume remettraient la date du
 * fichier à aujourd'hui et feraient passer pour fraîche une sauvegarde de la
 * semaine dernière.
 */
async function derniereSauvegarde() {
  const chemin = join(repertoireSauvegardes(), 'dernier.manifeste');
  let contenu;
  try {
    contenu = await readFile(chemin, 'utf8');
  } catch {
    return { presente: false, ageSecondes: null, authentifiee: false };
  }

  const champs = Object.fromEntries(
    contenu
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1)];
      }),
  );

  // Format 20260826T173025Z — non reconnu par Date.parse tel quel.
  const h = champs.horodatage ?? '';
  const iso = /^\d{8}T\d{6}Z$/.test(h)
    ? `${h.slice(0, 4)}-${h.slice(4, 6)}-${h.slice(6, 8)}T${h.slice(9, 11)}:${h.slice(11, 13)}:${h.slice(13, 15)}Z`
    : null;
  const instant = iso ? Date.parse(iso) : NaN;

  return {
    presente: true,
    ageSecondes: Number.isNaN(instant) ? null : Math.max(0, Math.round((Date.now() - instant) / 1000)),
    // « authentifiée » veut dire : une altération se verrait au déchiffrement.
    // openssl enc chiffre sans authentifier — voir infra/lib-sauvegarde.sh.
    authentifiee: champs.methode === 'age' || champs.methode === 'gpg',
    methode: champs.methode ?? 'inconnue',
  };
}

/** Compteurs métier, lus dans le périmètre transverse du personnel. */
async function chiffresBase() {
  const [transverses, cloisonnes] = await Promise.all([
    withoutTenant(async (c) => {
      const { rows } = await c.query(`
        select
          (select count(*) from organisations where statut <> 'clos')          as organisations,
          (select count(*) from users where actif)                             as comptes,
          (select count(*) from sessions
            where revoquee_le is null and expire_le > now())                   as sessions,
          (select count(*) from tentatives_connexion
            where not reussie and survenue_le > now() - ($1 || ' minutes')::interval)
                                                                               as echecs_connexion,
          (select count(*) from leads where traite_le is null)                 as leads_en_attente
      `, [SEUILS.fenetreMinutes]);
      return rows[0];
    }),
    withTenant({ organisationId: null, isStaff: true }, async (c) => {
      const { rows } = await c.query(`
        select
          (select count(*) from tickets where statut not in ('resolu','clos'))          as tickets_ouverts,
          (select count(*) from tickets
            where statut not in ('resolu','clos') and priorite_haute)                   as tickets_prioritaires,
          (select count(*) from interventions where statut = 'rapport_a_deposer')       as rapports_a_deposer
      `);
      return rows[0];
    }),
  ]);

  return {
    organisations: Number(transverses.organisations),
    comptes: Number(transverses.comptes),
    sessions: Number(transverses.sessions),
    echecsConnexion: Number(transverses.echecs_connexion),
    leadsEnAttente: Number(transverses.leads_en_attente),
    ticketsOuverts: Number(cloisonnes.tickets_ouverts),
    ticketsPrioritaires: Number(cloisonnes.tickets_prioritaires),
    rapportsADeposer: Number(cloisonnes.rapports_a_deposer),
  };
}

export async function relever() {
  const repertoire = repertoireSauvegardes();

  let baseDisponible = 0;
  let base = null;
  try {
    await getAppPool().query('select 1');
    baseDisponible = 1;
    base = await chiffresBase();
  } catch {
    // Une base injoignable n'interrompt pas le relevé : c'est justement le
    // moment où l'on a le plus besoin qu'il réponde. Les métriques métier
    // manqueront, « base_disponible 0 » sera là — et c'est celle-là qui alerte.
    baseDisponible = 0;
  }

  const [sauvegarde, ageExercice, ageHorsSite] = await Promise.all([
    derniereSauvegarde(),
    ageFichier(join(repertoire, 'dernier-exercice')),
    ageFichier(join(repertoire, 'dernier-hors-site')),
  ]);

  return { env: config.env, baseDisponible, base, sauvegarde, ageExercice, ageHorsSite };
}
