'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { navigation } from '../content/fr.js';
import styles from './SiteHeader.module.css';

/**
 * En-tête collant du site public.
 *
 * ⚠  RESPONSIVE PROVISOIRE. La maquette n'existe qu'à 1240 px et l'artboard
 * des pages publiques n'est pas encore livré. Sous 900 px, la navigation
 * bascule en défilement horizontal — repli mécanique et réversible, pas une
 * décision de design. Claude Design a tranché pour l'espace client (onglets
 * défilants, jamais un tiroir) ; on applique ici le même principe en attendant
 * son arbitrage. Voir docs/responsive.md.
 */
export function SiteHeader({ locale = 'fr' }) {
  // Déduit de l'URL plutôt que passé en propriété : sinon l'en-tête devrait
  // être rendu par chacune des six pages au lieu du gabarit partagé, et
  // l'oubli d'une propriété passerait inaperçu.
  const chemin = usePathname() ?? '';
  const actif = chemin.replace(`/${locale}`, '').replace(/^\//, '').split('/')[0] ?? '';

  return (
    <header className={styles.entete}>
      <div className={styles.barre}>
        <Link href={`/${locale}`} className={styles.marque} aria-label="5/Sync IT — accueil">
          <Image src="/logo-5syncit.png" alt="5/Sync IT" width={120} height={30} priority />
        </Link>

        <nav className={styles.nav} aria-label="Navigation principale">
          {navigation.map((item) => {
            const courant = item.slug === actif;
            return (
              <Link
                key={item.slug}
                href={`/${locale}${item.slug ? `/${item.slug}` : ''}`}
                aria-current={courant ? 'page' : undefined}
                className={[styles.lien, courant ? styles.courant : ''].filter(Boolean).join(' ')}
              >
                {item.libelle}
              </Link>
            );
          })}
        </nav>

        <div className={styles.droite}>
          {/* La version anglaise n'existe pas encore : on montre l'intention
              sans proposer un lien mort. */}
          <p className={styles.langues}>
            <span className={styles.langueActive}>FR</span>
            <span aria-hidden="true">/</span>
            <span className={styles.langueInactive}>EN</span>
          </p>

          <Link href={`/${locale}/espace-client`} className={`btn btn-primary ${styles.plateforme}`}>
            Espace client
          </Link>
          <Link href={`/${locale}/back-office`} className={`btn btn-secondary ${styles.plateforme}`}>
            Back-office
          </Link>
        </div>
      </div>
    </header>
  );
}
