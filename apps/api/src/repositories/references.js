/**
 * Attribution des références lisibles — CT-2026-03, DEV-2026-019, INT-2026-004.
 *
 * POURQUOI DANS LA TRANSACTION, ET NON DANS UNE SÉQUENCE POSTGRESQL
 * Une séquence ne se rembobine pas : une insertion annulée consomme quand même
 * son numéro, et une référence contractuelle trouée est une question posée à
 * la comptabilité six mois plus tard. Le compteur est donc calculé ici, dans
 * la même transaction que l'insertion, sous la protection de la contrainte
 * d'unicité — deux créations simultanées ne peuvent pas produire la même
 * référence : la seconde échoue, ce qui est le comportement voulu plutôt
 * qu'un doublon silencieux.
 *
 * POURQUOI « where organisation_id = $1 » ICI, ALORS QUE LES DÉPÔTS S'EN
 * INTERDISENT
 * Ailleurs, ce filtre donnerait l'illusion de protéger là où c'est Row-Level
 * Security qui protège. Ici il ne protège rien : il DÉSIGNE l'espace de noms
 * dans lequel la référence doit être unique, celui que déclare la contrainte
 * `unique (organisation_id, reference)`. Sans lui, un compte 5/Sync — qui voit
 * toutes les organisations — numéroterait la Ville de Dakar à la suite de
 * l'Institut National de l'Audiovisuel.
 */

/** Tables dont ce module sait numéroter les lignes, et le préfixe de chacune. */
const FORMES = {
  contrats: { prefixe: 'CT', rang: 2 },
  interventions: { prefixe: 'INT', rang: 3 },
  devis: { table: 'pieces', prefixe: 'DEV', rang: 3 },
  facture: { table: 'pieces', prefixe: 'FAC', rang: 3 },
  avoir: { table: 'pieces', prefixe: 'AV', rang: 3 },
};

/**
 * @param {import('pg').PoolClient} client transaction en cours
 * @param {string} forme          clé de FORMES
 * @param {string} organisationId espace de noms de la référence
 * @param {number} annee          millésime porté par la référence
 * @returns {Promise<string>} par exemple « INT-2026-004 »
 */
export async function allouer(client, { forme, organisationId, annee }) {
  const definition = FORMES[forme];
  if (!definition) throw new Error(`Forme de référence inconnue : ${forme}`);

  const { table = forme, prefixe, rang } = definition;
  const motif = `^${prefixe}-${annee}-([0-9]+)$`;

  const { rows } = await client.query(
    // La table est interpolée, jamais une saisie : elle vient de FORMES, dont
    // les clés sont écrites dans ce fichier. Aucune valeur de requête ne peut
    // l'atteindre.
    `select coalesce(max(substring(reference from $1)::int), 0) + 1 as suivant
       from ${table}
      where organisation_id = $2 and reference ~ $1`,
    [motif, organisationId],
  );

  return `${prefixe}-${annee}-${String(rows[0].suivant).padStart(rang, '0')}`;
}
