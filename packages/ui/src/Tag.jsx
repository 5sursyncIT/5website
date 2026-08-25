import styles from './Tag.module.css';

/**
 * Étiquette de Classical. Utilisée pour les tags technologiques des expertises.
 * @param {{tone?: 'accent'|'accent-2'|'neutral'|'outline'}} props
 */
export function Tag({ tone = 'neutral', className = '', children, ...rest }) {
  return (
    <span className={['tag', `tag-${tone}`, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </span>
  );
}

/**
 * Pastille de statut des tableaux de portail. Ce n'est PAS le .tag de Classical :
 * la maquette lui donne sa propre forme — mono 10 px, filet de 1 px à la couleur
 * du texte, rayon 2 px. Deux tonalités seulement, reprises de la maquette :
 * « or » pour un état nominal, « sourd » pour un état qui appelle une action.
 *
 * @param {{tone?: 'gold'|'muted', onGround?: boolean}} props
 */
export function StatusTag({ tone = 'gold', onGround = false, children, ...rest }) {
  return (
    <span
      className={[styles.status, styles[tone], onGround ? styles.onGround : '']
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </span>
  );
}
