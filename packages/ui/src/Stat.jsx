import styles from './Stat.module.css';

/**
 * Grand chiffre + libellé. Cormorant Garamond en graisse 300 — la seule graisse
 * légère du système, réservée aux chiffres et jamais employée pour du texte.
 *
 * @param {{value: string, label: string, size?: 'xl'|'lg'|'md'|'sm', onGround?: boolean}} props
 */
export function Stat({ value, label, size = 'md', onGround = false }) {
  return (
    <div>
      <div className={[styles.value, styles[size], onGround ? styles.onGround : ''].filter(Boolean).join(' ')}>
        {value}
      </div>
      <div className={[styles.label, onGround ? styles.labelOnGround : ''].filter(Boolean).join(' ')}>
        {label}
      </div>
    </div>
  );
}
