import { Kicker } from '@5sync/ui';
import { contact, site } from '../../../content/fr.js';
import { FormulaireContact } from './FormulaireContact.jsx';
import styles from './contact.module.css';

export const metadata = {
  title: 'Contact',
  description:
    'Audit, schéma directeur, architecture, déploiement, sécurisation, support. Réponse sous 48 heures ouvrées.',
  alternates: { canonical: '/fr/contact' },
};

export default async function Contact({ params, searchParams }) {
  const { locale } = await params;
  const { etat, champs } = await searchParams;

  return (
    <section className={styles.page}>
      <div className={styles.grille}>
        <div>
          <Kicker size="lg">{contact.surTitre}</Kicker>
          <h1 className={styles.titre}>{contact.titre}</h1>
          <p className={styles.chapo}>{contact.chapo}</p>

          <dl className={styles.coordonnees}>
            {site.coordonnees.map((c) => (
              <div key={c.k} className={styles.coordonnee}>
                <dt className={styles.coordonneeCle}>{c.k}</dt>
                <dd className={styles.coordonneeValeur}>{c.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.encadre}>
          <FormulaireContact locale={locale} etat={etat} champs={champs} />
        </div>
      </div>
    </section>
  );
}
