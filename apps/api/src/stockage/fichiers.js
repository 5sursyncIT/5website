import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile, stat, unlink } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/**
 * Stockage des documents.
 *
 * TROIS RÈGLES, ET AUCUNE N'EST FACULTATIVE.
 *
 * 1. HORS DE TOUTE RACINE SERVIE. Les fichiers vivent sous RACINE, que ni
 *    Nginx ni Next ne servent. Aucune URL ne mène directement à un fichier :
 *    seule une route authentifiée les lit, ce qui fait qu'une révocation de
 *    compte prend effet au téléchargement suivant, sans lien à invalider.
 *
 * 2. LE TYPE EST LU DANS LE FICHIER, PAS DANS SON NOM. Une extension .pdf ne
 *    prouve rien ; les premiers octets, si. Un fichier dont la signature ne
 *    correspond à aucun type autorisé est refusé, quel que soit son nom.
 *
 * 3. LE CHEMIN EST FABRIQUÉ, JAMAIS REÇU. Le nom d'origine ne sert que
 *    d'étiquette en base ; le chemin sur disque est composé d'identifiants que
 *    nous générons. Un nom de fichier ne peut donc pas contenir de « ../ »
 *    utile — et une vérification de confinement le rattrape malgré tout.
 */

const RACINE = resolve(process.env.DOCUMENTS_DIR ?? '/srv/5sync/documents');

/** Signatures autorisées. Liste fermée : ce qui n'y est pas est refusé. */
const SIGNATURES = [
  { mime: 'application/pdf', octets: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/png', octets: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', octets: [0xff, 0xd8, 0xff] },
  // ZIP : conteneur des formats Office modernes (docx, xlsx, pptx) et d'ODF.
  { mime: 'application/zip', octets: [0x50, 0x4b, 0x03, 0x04] },
  { mime: 'application/zip', octets: [0x50, 0x4b, 0x05, 0x06] },
];

export const TAILLE_MAX = Number(process.env.DOCUMENTS_TAILLE_MAX ?? 25 * 1024 * 1024);

export class FichierRefuse extends Error {
  constructor(message) {
    super(message);
    this.name = 'FichierRefuse';
    this.statusCode = 415;
  }
}

/** Lit le type réel dans les premiers octets. */
export function typeReel(tampon) {
  for (const { mime, octets } of SIGNATURES) {
    if (octets.every((o, i) => tampon[i] === o)) return mime;
  }
  return null;
}

/**
 * Garantit qu'un chemin reste sous la racine. Le chemin est déjà fabriqué par
 * nous, donc cette vérification ne devrait jamais mordre — c'est précisément
 * pourquoi elle doit exister : le jour où quelqu'un fera passer un fragment
 * venu de l'extérieur, elle sera là.
 */
function confiner(chemin) {
  const absolu = resolve(RACINE, chemin);
  if (absolu !== RACINE && !absolu.startsWith(RACINE + sep)) {
    throw new FichierRefuse('Chemin de fichier hors du stockage documentaire.');
  }
  return absolu;
}

/**
 * Écrit une version de document.
 *
 * @param {{organisationId: string, documentId: string, contenu: Buffer, nomOrigine: string}} entree
 * @returns {Promise<{chemin: string, typeMime: string, tailleOctets: number, empreinte: Buffer}>}
 */
/**
 * Vérifie que le stockage est utilisable, au démarrage.
 *
 * Sans cela, une racine non inscriptible ne se manifeste qu'au premier dépôt,
 * sous la forme d'une erreur 500 opaque — c'est-à-dire devant un utilisateur
 * plutôt que devant l'exploitant.
 */
export async function verifierStockage() {
  try {
    await mkdir(RACINE, { recursive: true });
    const sonde = join(RACINE, '.ecriture-test');
    await writeFile(sonde, 'ok');
    await unlink(sonde);
    return { ok: true, racine: RACINE };
  } catch (erreur) {
    return { ok: false, racine: RACINE, message: erreur.message };
  }
}

export async function ecrire({ organisationId, documentId, contenu, nomOrigine }) {
  if (contenu.length === 0) throw new FichierRefuse('Fichier vide.');
  if (contenu.length > TAILLE_MAX) {
    throw new FichierRefuse(`Fichier trop volumineux (maximum ${Math.round(TAILLE_MAX / 1024 / 1024)} Mo).`);
  }

  const mime = typeReel(contenu);
  if (!mime) {
    throw new FichierRefuse(
      `Type de fichier non autorisé. Le contenu de « ${nomOrigine} » ne correspond à aucun ` +
        'format accepté (PDF, PNG, JPEG, documents bureautiques).',
    );
  }

  // Le chemin est entièrement composé d'identifiants que nous générons : le
  // nom fourni par le client n'y entre jamais.
  const relatif = join(organisationId, documentId, `${randomUUID()}.bin`);
  const absolu = confiner(relatif);

  await mkdir(join(RACINE, organisationId, documentId), { recursive: true });
  await writeFile(absolu, contenu, { mode: 0o640 });

  return {
    chemin: relatif,
    typeMime: mime,
    tailleOctets: contenu.length,
    empreinte: createHash('sha256').update(contenu).digest(),
  };
}

/** Ouvre un flux de lecture. Le chemin vient de la base, jamais de la requête. */
export function lire(chemin) {
  return createReadStream(confiner(chemin));
}

export async function existe(chemin) {
  try {
    await stat(confiner(chemin));
    return true;
  } catch {
    return false;
  }
}

export async function supprimer(chemin) {
  await unlink(confiner(chemin)).catch(() => {});
}

export { RACINE };
