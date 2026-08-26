import { Kicker } from '@5sync/ui';
import styles from '../interieur.module.css';

/**
 * Page d'attente. Sans elle, les deux boutons de plateforme de l'en-tête
 * pointent vers des 404 — et Next les précharge, ce qui produit deux requêtes
 * en échec sur chaque page du site. Un lien mort dans un en-tête permanent est
 * plus visible qu'une page manquante.
 */
export const metadata = {
  title: 'Espace client',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <header className={styles.entete}>
      <div className={styles.enteteCorps}>
        <Kicker size="lg">Espace client</Kicker>
        <h1 className={styles.titre}>Bientôt accessible</h1>
        <p className={styles.chapo}>
          Cet espace est en cours de construction (lot 3). En attendant, votre
          interlocuteur habituel reste joignable à contact@5sursync.com.
        </p>
      </div>
    </header>
  );
}
