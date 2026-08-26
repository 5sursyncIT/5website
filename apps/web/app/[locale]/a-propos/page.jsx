import { Kicker, SectionHeading, Stat } from '@5sync/ui';
import { Section } from '../../../components/Section.jsx';
import { aPropos } from '../../../content/fr.js';
import styles from '../interieur.module.css';

export const metadata = {
  title: 'À propos',
  description:
    "5/Sync IT, société d'ingénierie de droit sénégalais basée à Dakar, active depuis 2016 auprès d'administrations, d'agences publiques et de médias.",
  alternates: { canonical: '/fr/a-propos' },
};

export default function APropos() {
  return (
    <>
      <header className={styles.entete}>
        <div className={styles.enteteCorps}>
          <Kicker size="lg">À propos</Kicker>
          <h1 className={`${styles.titre} ${styles.titreLarge}`}>{aPropos.titre}</h1>
        </div>
      </header>

      <Section taille="normal">
        {aPropos.paragraphes.map((p) => (
          <p key={p.slice(0, 24)} className={styles.texteLong}>
            {p}
          </p>
        ))}

        <div className={styles.stats}>
          {aPropos.stats.map((s) => (
            <Stat key={s.l} value={s.n} label={s.l} size="md" />
          ))}
        </div>

        {/* Cette réserve explique une absence : ni chiffre d'affaires, ni taux
            de satisfaction sur ce site. C'est une position, pas un oubli. */}
        <p className={styles.reserve}>{aPropos.reserve}</p>
      </Section>

      <Section fond="surface" filet taille="normal">
        <SectionHeading kicker={aPropos.pourquoi.surTitre} size="inner" className={styles.tete}>
          {aPropos.pourquoi.titre}
        </SectionHeading>

        <ol className={styles.cartes}>
          {aPropos.pourquoi.items.map((p) => (
            <li key={p.n} className={styles.carte}>
              <p className={styles.numero}>{p.n}</p>
              <h3 className={styles.carteTitre}>{p.t}</h3>
              <p className={styles.texte}>{p.d}</p>
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}
