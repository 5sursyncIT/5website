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

/**
 * Session si elle existe, null sinon — y compris quand l'API ne répond pas.
 *
 * Ne pas pouvoir CONFIRMER une session n'est pas la même chose qu'en avoir
 * une : on retombe sur l'anonyme. C'est ce qui garde la page de connexion
 * affichable pendant une panne d'API — sans quoi elle renverrait 500, et
 * personne ne pourrait se connecter à la reprise du service.
 */
export async function sessionEventuelle() {
  const { statut, donnees } = await apiGet('/api/v1/auth/moi');
  return statut === 200 ? donnees : null;
}
