import styles from './Kicker.module.css';

/**
 * Sur-titre en capitales monospace. Le marqueur le plus répandu de la maquette :
 * il ouvre chaque section et chaque carte.
 *
 * @param {{size?: 'lg'|'md'|'sm', onGround?: boolean, as?: string}} props
 */
export function Kicker({ size = 'md', onGround = false, as: As = 'div', className = '', children, ...rest }) {
  return (
    <As
      className={[styles.kicker, styles[size], onGround ? styles.onGround : '', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </As>
  );
}
