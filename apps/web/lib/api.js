import { cookies } from 'next/headers';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * Accès à l'API depuis les composants serveur.
 *
 * Le cookie de session du visiteur est RELAYÉ à l'API, qui reste seule à le
 * comprendre : le navigateur ne parle jamais directement à l'API, et l'URL
 * interne de celle-ci n'apparaît nulle part côté client.
 *
 * Toutes les lectures sont en `no-store`. Mettre en cache une réponse de
 * l'espace client servirait les données d'un client à un autre — c'est la
 * seule optimisation qu'il ne faut jamais faire ici.
 */
export async function apiGet(chemin) {
  const jar = await cookies();

  const reponse = await fetch(`${API}${chemin}`, {
    headers: { cookie: jar.toString() },
    cache: 'no-store',
  });

  if (reponse.status === 401) return { statut: 401, donnees: null };
  if (reponse.status === 403) return { statut: 403, donnees: null };
  if (reponse.status === 404) return { statut: 404, donnees: null };

  if (!reponse.ok) {
    throw new Error(`API ${chemin} a répondu ${reponse.status}`);
  }

  return { statut: 200, donnees: await reponse.json() };
}

/**
 * Charge plusieurs ressources en parallèle.
 *
 * Séquentiellement, six appels à 300 ms de latence font près de deux secondes
 * d'attente pour rien : ils ne dépendent pas les uns des autres.
 */
export async function apiGetTout(chemins) {
  const resultats = await Promise.all(Object.values(chemins).map((c) => apiGet(c)));
  return Object.fromEntries(Object.keys(chemins).map((cle, i) => [cle, resultats[i]]));
}

export { API };
