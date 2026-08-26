import { Kicker, SectionHeading, Tag } from '@5sync/ui';
import { Section } from '../../../components/Section.jsx';
import { expertises } from '../../../content/fr.js';
import styles from '../interieur.module.css';

export const metadata = {
  title: 'Expertises',
  description:
    "Six pôles d'ingénierie : conseil et audit, réseaux et télécoms, infrastructures et continuité, cybersécurité, applications métier, archives numériques et audiovisuel.",
  alternates: { canonical: '/fr/expertises' },
};

export default function Expertises() {
  return (
    <>
      <header className={styles.entete}>
        <div className={styles.enteteCorps}>
          <Kicker size="lg">Expertises</Kicker>
          <h1 className={styles.titre}>{expertises.titre}</h1>
        </div>
      </header>

      <Section taille="normal">
        <ol className={styles.poles}>
          {expertises.poles.map((p) => (
            <li key={p.n} className={styles.pole}>
              <p className={styles.numero}>{p.n}</p>
              <h2 className={styles.poleTitre}>{p.t}</h2>
              <div>
                <p className={styles.texte}>{p.d}</p>
                <ul className={styles.tags}>
                  {p.tags.map((t) => (
                    <li key={t}>
                      <Tag tone="neutral">{t}</Tag>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section fond="surface" filet taille="normal">
        <SectionHeading kicker={expertises.contraintes.surTitre} size="inner" className={styles.tete}>
          {expertises.contraintes.titre}
        </SectionHeading>

        <p className={styles.texteLong}>{expertises.contraintes.chapo}</p>

        <ul className={styles.cartes}>
          {expertises.contraintes.items.map((c) => (
            <li key={c.t} className={styles.carte}>
              <h3 className={styles.carteTitre}>{c.t}</h3>
              <p className={styles.texte}>{c.d}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section filet taille="normal">
        <SectionHeading kicker={expertises.stack.surTitre} size="inner" className={styles.tete}>
          {expertises.stack.titre}
        </SectionHeading>

        <p className={styles.texteLong}>{expertises.stack.chapo}</p>

        <ul className={styles.familles}>
          {expertises.stack.familles.map((f) => (
            <li key={f.t} className={styles.famille}>
              <h3 className={styles.familleTitre}>{f.t}</h3>
              <ul className={styles.familleItems}>
                {f.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
