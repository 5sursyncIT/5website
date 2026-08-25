import { hash, verify, Algorithm } from '@node-rs/argon2';

/**
 * Argon2id. Paramètres alignés sur la recommandation OWASP de 2024 :
 * 19 MiB de mémoire, 2 passes, parallélisme 1.
 *
 * Le coût mémoire est ce qui compte : il rend une attaque par GPU coûteuse
 * là où un simple durcissement du nombre d'itérations ne la ralentit que
 * linéairement.
 */
const PARAMS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function hacher(motDePasse) {
  return hash(motDePasse, PARAMS);
}

/**
 * Vérifie sans jamais laisser filtrer la raison de l'échec : un hachage
 * malformé et un mot de passe erroné renvoient tous deux false.
 */
export async function verifier(motDePasse, empreinte) {
  try {
    return await verify(empreinte, motDePasse, PARAMS);
  } catch {
    return false;
  }
}
