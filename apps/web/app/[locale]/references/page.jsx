import { Kicker, SectionHeading } from '@5sync/ui';
import { Section } from '../../../components/Section.jsx';
import { references } from '../../../content/fr.js';
import styles from '../interieur.module.css';

export const metadata = {
  title: 'Références',
  description:
    'Missions documentées au Sénégal, en Guinée, en R.D. Congo et en Côte d’Ivoire — chacune présentée avec son statut réel.',
  alternates: { canonical: '/fr/references' },
};

export default function References() {
  return (
    <>
      <header className={styles.entete}>
        <div className={styles.enteteCorps}>
          <Kicker size="lg">Références</Kicker>
          <h1 className={`${styles.titre} ${styles.titreLarge}`}>{references.titre}</h1>
          <p className={styles.chapo}>{references.chapo}</p>
        </div>
      </header>

      {references.cas.map((c, i) => (
        <Section key={c.pays} fond={i % 2 === 1 ? 'surface' : 'clair'} taille="court">
          <article className={styles.cas} style={{ borderTop: 0, paddingBlock: 0 }}>
            <p className={styles.casPays}>{c.pays}</p>
            <h2 className={styles.casTitre}>{c.titre}</h2>

            <div className={styles.casGrille}>
              <div>
                <p className={styles.texteLong}>{c.contexte}</p>

                <Kicker size="sm">{references.etiquettes.intervention}</Kicker>
                <ol className={styles.lots} style={{ marginTop: '12px' }}>
                  {c.lots.map((l) => (
                    <li key={l.n} className={styles.lot}>
                      <span className={styles.lotNumero}>{l.n}</span>
                      <span>{l.t}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                {/* Emplacement photographique. Les images réelles supposent
                    l'accord écrit des institutions concernées — ce sont des
                    salles techniques et des régies. Voir docs/lot-0.md. */}
                <p className={styles.photo}>{c.photo}</p>

                <div className={styles.valeur} style={{ marginTop: '20px' }}>
                  <p className={styles.valeurKicker}>{references.etiquettes.valeur}</p>
                  <p className={styles.texte}>{c.valeur}</p>
                </div>

                <p className={styles.statut}>{c.statut}</p>
              </div>
            </div>
          </article>
        </Section>
      ))}

      <Section filet taille="normal">
        <SectionHeading kicker={references.reseaux.surTitre} size="inner" className={styles.tete}>
          {references.reseaux.titre}
        </SectionHeading>

        <p className={styles.texteLong}>{references.reseaux.chapo}</p>

        <ul className={styles.cartes}>
          {references.reseaux.items.map((r) => (
            <li key={r.nom} className={styles.carte}>
              <p className={styles.numero}>{r.pays}</p>
              <h3 className={styles.carteTitre}>{r.nom}</h3>
              <p className={styles.texte}>{r.d}</p>
              <p className={styles.statut}>{r.enjeu}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section fond="surface" filet taille="normal">
        <SectionHeading kicker={references.metier.surTitre} size="inner" className={styles.tete}>
          {references.metier.titre}
        </SectionHeading>

        <ul className={styles.cartes}>
          {references.metier.items.map((m) => (
            <li key={m.nom} className={styles.carte}>
              <h3 className={styles.carteTitre}>{m.nom}</h3>
              <p className={styles.texte}>{m.resume}</p>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
