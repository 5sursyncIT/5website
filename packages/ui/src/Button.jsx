import styles from './Button.module.css';

/**
 * Bouton. S'appuie sur les classes .btn de Classical et n'ajoute que les
 * gabarits de taille relevés dans la maquette, que Classical ne porte pas.
 *
 * @param {object} props
 * @param {'primary'|'secondary'|'ghost'} [props.variant='primary']
 * @param {'sm'|'md'|'lg'} [props.size='md'] sm = en-tête, md = portails, lg = héro
 * @param {boolean} [props.onGround=false] posé sur le sol sombre (#1a1917)
 * @param {string} [props.href] rend un <a> plutôt qu'un <button>
 */
export function Button({
  variant = 'primary',
  size = 'md',
  onGround = false,
  href,
  className = '',
  children,
  ...rest
}) {
  const classes = [
    'btn',
    `btn-${variant}`,
    styles.btn,
    styles[size],
    onGround ? styles.onGround : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (href) {
    return (
      <a href={href} className={classes} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
