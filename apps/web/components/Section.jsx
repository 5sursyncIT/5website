import styles from './Section.module.css';

/**
 * Bande de section : conteneur à 1240 px, rythme vertical, filet supérieur
 * optionnel. Les six pages n'utilisent que ces variantes — c'est ce qui
 * garantit que le rythme reste celui de la maquette et non une suite de
 * marges décidées au coup par coup.
 *
 * @param {{fond?: 'clair'|'surface'|'sombre', taille?: 'normal'|'court'|'ample',
 *          filet?: boolean, id?: string}} props
 */
export function Section({
  fond = 'clair',
  taille = 'normal',
  filet = false,
  id,
  className = '',
  children,
}) {
  return (
    <section
      id={id}
      className={[styles.bande, styles[fond], styles[taille], filet ? styles.filet : '']
        .filter(Boolean)
        .join(' ')}
    >
      <div className={[styles.conteneur, className].filter(Boolean).join(' ')}>{children}</div>
    </section>
  );
}

/**
 * Grille « rail + texte » de la maquette : 320 px de sur-titre et titre à
 * gauche, contenu à droite, 72 px de gouttière.
 */
export function Rail({ tete, children }) {
  return (
    <div className={styles.rail}>
      <div className={styles.railTete}>{tete}</div>
      <div className={styles.railCorps}>{children}</div>
    </div>
  );
}
