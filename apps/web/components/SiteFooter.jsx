import Link from 'next/link';
import Image from 'next/image';
import { navigation, site } from '../content/fr.js';
import styles from './SiteFooter.module.css';

export function SiteFooter({ locale = 'fr' }) {
  return (
    <footer className={styles.pied}>
      <div className={styles.grille}>
        <div>
          <Image src="/logo-5syncit.png" alt="5/Sync IT" width={104} height={26} className={styles.logo} />
          <p className={styles.mentions}>
            {site.nom} — {site.formeJuridique}. {site.adresse}.
          </p>
        </div>

        <div className={styles.colonnes}>
          <nav className={styles.colonne} aria-label="Pages du site">
            <p className={styles.entete}>Site</p>
            {navigation.map((item) => (
              <Link key={item.slug} href={`/${locale}${item.slug ? `/${item.slug}` : ''}`} className={styles.lien}>
                {item.libelle}
              </Link>
            ))}
          </nav>

          <nav className={styles.colonne} aria-label="Plateformes">
            <p className={styles.entete}>Plateformes</p>
            <Link href={`/${locale}/espace-client`} className={styles.lien}>
              Espace client
            </Link>
            <Link href={`/${locale}/back-office`} className={styles.lien}>
              Back-office
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
