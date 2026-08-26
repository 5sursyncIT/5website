import { Kicker, SectionHeading, Tag } from '@5sync/ui';
import { Section, Rail } from '../../../components/Section.jsx';
import { solutions } from '../../../content/fr.js';
import styles from '../interieur.module.css';

export const metadata = {
  title: 'Solutions',
  description:
    "SmartQueue, gestion numérique de l'accueil, et C-GIM, plateforme ERP intégrée pour le BTP — deux solutions développées par 5/Sync IT.",
  alternates: { canonical: '/fr/solutions' },
};

export default function Solutions() {
  return (
    <>
      <header className={styles.entete}>
        <div className={styles.enteteCorps}>
          <Kicker size="lg">Solutions</Kicker>
          <h1 className={`${styles.titre} ${styles.titreLarge}`}>{solutions.titre}</h1>
        </div>
      </header>

      <Section taille="normal" id="smartqueue">
        <Rail
          tete={
            <SectionHeading kicker={solutions.smartqueue.surTitre} size="inner">
              {solutions.smartqueue.titre}
            </SectionHeading>
          }
        >
          <p className={styles.texteLong}>{solutions.smartqueue.chapo}</p>

          <ul className={styles.cartes}>
            {solutions.smartqueue.volets.map((v) => (
              <li key={v.t} className={styles.carte}>
                <h3 className={styles.carteTitre}>{v.t}</h3>
                <p className={styles.texte}>{v.d}</p>
              </li>
            ))}
          </ul>
        </Rail>
      </Section>

      <Section fond="surface" filet taille="normal" id="c-gim">
        <Rail
          tete={
            <SectionHeading kicker={solutions.cgim.surTitre} size="inner">
              {solutions.cgim.titre}
            </SectionHeading>
          }
        >
          <p className={styles.texteLong}>{solutions.cgim.chapo}</p>

          <ul className={styles.modules}>
            {solutions.cgim.modules.map((m) => (
              <li key={m}>
                <Tag tone="outline">{m}</Tag>
              </li>
            ))}
          </ul>

          <ul className={styles.cartes} style={{ marginTop: '44px' }}>
            {solutions.cgim.capacites.map((c) => (
              <li key={c.t} className={styles.carte}>
                <h3 className={styles.carteTitre}>{c.t}</h3>
                <p className={styles.texte}>{c.d}</p>
              </li>
            ))}
          </ul>
        </Rail>
      </Section>
    </>
  );
}
