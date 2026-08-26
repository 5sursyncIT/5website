import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Second facteur, TOTP (RFC 6238).
 *
 * Implémenté ici plutôt qu'importé : l'algorithme tient en trente lignes —
 * un HMAC-SHA1 sur un compteur de trente secondes, puis une troncature — et
 * une dépendance de plus dans le chemin d'authentification est une surface
 * qu'il faudrait surveiller pour le reste de la vie du produit.
 *
 * OBLIGATOIRE POUR LE BACK-OFFICE. Un compte 5/Sync voit TOUTES les
 * organisations : c'est le seul rôle dont la compromission expose l'ensemble
 * des clients, et le mot de passe seul n'y suffit pas.
 */

const PAS_SECONDES = 30;
/** Une fenêtre de part et d'autre : les horloges de téléphone dérivent. */
const TOLERANCE = 1;
const CHIFFRES = 6;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function genererSecret() {
  const octets = randomBytes(20); // 160 bits, la taille recommandée par la RFC
  let bits = '';
  for (const o of octets) bits += o.toString(2).padStart(8, '0');

  let secret = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += ALPHABET[Number.parseInt(bits.slice(i, i + 5), 2)];
  }
  return secret;
}

function decoder(secret) {
  const propre = secret.toUpperCase().replaceAll(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const caractere of propre) {
    const index = ALPHABET.indexOf(caractere);
    if (index < 0) throw new Error('Secret TOTP invalide.');
    bits += index.toString(2).padStart(5, '0');
  }

  const octets = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    octets.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(octets);
}

function codePour(secret, compteur) {
  const compteurBuf = Buffer.alloc(8);
  compteurBuf.writeBigUInt64BE(BigInt(compteur));

  const empreinte = createHmac('sha1', decoder(secret)).update(compteurBuf).digest();
  const decalage = empreinte[empreinte.length - 1] & 0x0f;
  const binaire =
    ((empreinte[decalage] & 0x7f) << 24) |
    ((empreinte[decalage + 1] & 0xff) << 16) |
    ((empreinte[decalage + 2] & 0xff) << 8) |
    (empreinte[decalage + 3] & 0xff);

  return String(binaire % 10 ** CHIFFRES).padStart(CHIFFRES, '0');
}

/**
 * Vérifie un code.
 *
 * La comparaison est à temps constant. Sur six chiffres l'apport est mince,
 * mais une comparaison naïve dans un chemin d'authentification est le genre de
 * détail qu'on ne veut pas avoir à justifier lors d'un audit.
 */
export function verifier(secret, code) {
  const propose = String(code ?? '').replaceAll(/\s/g, '');
  if (!/^\d{6}$/.test(propose)) return false;

  const maintenant = Math.floor(Date.now() / 1000 / PAS_SECONDES);
  const attendu = Buffer.from(propose);

  for (let d = -TOLERANCE; d <= TOLERANCE; d += 1) {
    const candidat = Buffer.from(codePour(secret, maintenant + d));
    if (candidat.length === attendu.length && timingSafeEqual(candidat, attendu)) return true;
  }
  return false;
}

/**
 * URI d'enrôlement, à afficher en QR code.
 *
 * L'émetteur et le compte apparaissent dans l'application d'authentification :
 * « 5/Sync IT — nom@exemple.sn » plutôt qu'un secret orphelin que personne ne
 * saura rattacher dans six mois.
 */
export function uriEnrolement({ email, secret, emetteur = '5/Sync IT' }) {
  const libelle = encodeURIComponent(`${emetteur}:${email}`);
  const parametres = new URLSearchParams({
    secret,
    issuer: emetteur,
    algorithm: 'SHA1',
    digits: String(CHIFFRES),
    period: String(PAS_SECONDES),
  });
  return `otpauth://totp/${libelle}?${parametres}`;
}

export { PAS_SECONDES, CHIFFRES };
