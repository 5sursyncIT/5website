import styles from './RecordList.module.css';

/**
 * Rangée-fiche — la forme arrêtée par Claude Design pour les tableaux de
 * portail (Artboards - Espace client.dc.html, 25.08.2026).
 *
 * POURQUOI CE COMPOSANT REMPLACE UN TABLEAU
 * Cinq colonnes fixes autour d'une colonne libre est une forme fausse à toutes
 * les largeurs : à 1920 px elle tient par chance, à 1366 px elle tronque le
 * seul champ que l'agent lit vraiment. Ici l'objet reçoit toute la mesure et,
 * surtout, il peut passer à la ligne — ce qu'une cellule ne pouvait que
 * tronquer. Aucun champ n'est masqué à aucune largeur.
 *
 * QUATRE RÔLES, pas cinq colonnes :
 *   référence  identifiant court et tabulaire, en tête de ligne
 *   objet      le champ que l'on lit ; toute la mesure lui revient
 *   attributs  en filet sous l'objet, dans l'ordre donné
 *   statut     pastille, à droite (au-dessus à 390 px)
 *
 * ORDRE DU DOM ET ORDRE VISUEL
 * Le DOM suit l'ordre de lecture — référence, objet, attributs, statut — et la
 * grille remonte la pastille en haut à droite sous 480 px. Le décalage est
 * assumé : à l'oreille, « TCK-4471, coupure liaison radio, mairie annexe,
 * niveau 3, escaladé » se tient ; la position visuelle de la pastille est une
 * aide au balayage, pas une affirmation d'ordre de lecture.
 *
 * @param {object} props
 * @param {string} props.label            intitulé accessible de la liste
 * @param {string} [props.summary]        bandeau de tête, ex. « RÉFÉRENCE · OBJET · SITE · NIVEAU »
 * @param {string} [props.summaryRight]   ex. « STATUT »
 * @param {Array<{id: string, href?: string, reference?: string, objet: string,
 *   attributs?: string[], figure?: string, statut?: string,
 *   ton?: 'gold'|'muted'}>} props.records
 * @param {'confort'|'compact'} [props.density='confort']
 * @param {boolean} [props.onGround=false]
 */
export function RecordList({
  label,
  summary,
  summaryRight,
  records,
  density = 'confort',
  onGround = false,
}) {
  return (
    <div className={[styles.frame, onGround ? styles.onGround : ''].filter(Boolean).join(' ')}>
      {summary ? (
        <div className={styles.head} aria-hidden="true">
          <span>{summary}</span>
          {summaryRight ? <span>{summaryRight}</span> : null}
        </div>
      ) : null}

      <ul className={styles.list} aria-label={label}>
        {records.map((record) => {
          const Row = record.href ? 'a' : 'div';
          return (
            <li key={record.id}>
              <Row
                {...(record.href ? { href: record.href } : {})}
                className={[styles.row, styles[density]].filter(Boolean).join(' ')}
              >
                {record.reference ? <span className={styles.reference}>{record.reference}</span> : null}

                <span className={styles.objet}>{record.objet}</span>

                {record.attributs?.length ? (
                  <span className={styles.attributs}>
                    {record.attributs.map((attribut) => (
                      <span key={attribut} className={styles.attribut}>
                        {attribut}
                      </span>
                    ))}
                  </span>
                ) : null}

                {record.figure ? <span className={styles.figure}>{record.figure}</span> : null}

                {record.statut ? (
                  <span className={[styles.statut, styles[record.ton ?? 'gold']].join(' ')}>
                    {record.statut}
                  </span>
                ) : null}
              </Row>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
