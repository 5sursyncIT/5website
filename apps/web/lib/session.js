import { redirect } from 'next/navigation';
import { apiGet } from './api.js';

/**
 * Résout la session côté serveur, ou renvoie vers la connexion.
 *
 * Le contrôle se fait à CHAQUE rendu de page, pas une fois au montage : une
 * session révoquée cesse donc d'ouvrir des pages immédiatement, sans qu'il
 * faille invalider quoi que ce soit côté client.
 */
export async function exigerSession(locale = 'fr', retour = null) {
  const { statut, donnees } = await apiGet('/api/v1/auth/moi');

  if (statut === 401 || !donnees) {
    const suite = retour ? `?suite=${encodeURIComponent(retour)}` : '';
    redirect(`/${locale}/connexion${suite}`);
  }

  return donnees;
}

export async function sessionEventuelle() {
  const { statut, donnees } = await apiGet('/api/v1/auth/moi');
  return statut === 200 ? donnees : null;
}
