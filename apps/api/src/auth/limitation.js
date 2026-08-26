import { withoutTenant } from '../db/tenant.js';

/**
 * Limitation des tentatives de connexion.
 *
 * Deux seuils, sur deux axes, parce qu'aucun des deux ne suffit seul :
 *
 *   par ADRESSE — arrête mille mots de passe sur un compte.
 *   par COMPTE  — arrête un mot de passe sur mille comptes depuis mille
 *                 adresses, cas contre lequel la limite par adresse ne peut
 *                 rien.
 *
 * Le verrouillage est BORNÉ DANS LE TEMPS. Un verrouillage définitif
 * transformerait la protection en déni de service : il suffirait d'échouer
 * volontairement pour fermer l'accès d'un agent.
 */

export const SEUILS = {
  /** Échecs tolérés depuis une même adresse avant blocage. */
  parIp: 10,
  /** Échecs tolérés sur un même compte, tous points d'origine confondus. */
  parCompte: 5,
  /** Fenêtre d'observation et durée du blocage. */
  fenetreMinutes: 15,
};

/**
 * @returns {Promise<{bloque: boolean, motif?: 'ip'|'compte', secondes?: number}>}
 */
export async function verifier({ ip, email }) {
  const { rows } = await withoutTenant((client) =>
    client.query(
      `select
         count(*) filter (where ip = $1)                         as par_ip,
         count(*) filter (where email = $2)                      as par_compte,
         max(survenue_le) filter (where ip = $1 or email = $2)    as derniere
       from tentatives_connexion
      where not reussie
        and survenue_le > now() - ($3 || ' minutes')::interval`,
      [ip, email, SEUILS.fenetreMinutes],
    ),
  );

  const r = rows[0];
  const parIp = Number(r.par_ip);
  const parCompte = Number(r.par_compte);

  if (parIp < SEUILS.parIp && parCompte < SEUILS.parCompte) return { bloque: false };

  // Le compte à rebours part de la DERNIÈRE tentative, pas de la première :
  // continuer d'essayer pendant le blocage le prolonge, ce qui rend l'attaque
  // par épuisement inopérante.
  const derniere = r.derniere ? new Date(r.derniere) : new Date();
  const finBlocage = derniere.getTime() + SEUILS.fenetreMinutes * 60_000;
  const secondes = Math.max(1, Math.ceil((finBlocage - Date.now()) / 1000));

  return { bloque: true, motif: parCompte >= SEUILS.parCompte ? 'compte' : 'ip', secondes };
}

export async function enregistrer({ ip, email, reussie }) {
  await withoutTenant((client) =>
    client.query(
      'insert into tentatives_connexion (ip, email, reussie) values ($1, $2, $3)',
      [ip, email, reussie],
    ),
  );
}

/**
 * Efface l'ardoise d'un compte après une connexion réussie.
 *
 * Sans cela, quatre échecs suivis d'une réussite laisseraient le compte à une
 * tentative du verrouillage — un agent qui se trompe de mot de passe puis se
 * connecte se retrouverait bloqué au prochain lapsus.
 */
export async function reinitialiser({ email }) {
  await withoutTenant((client) =>
    client.query('delete from tentatives_connexion where email = $1 and not reussie', [email]),
  );
}
