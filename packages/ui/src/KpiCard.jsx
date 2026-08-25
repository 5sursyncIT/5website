import styles from './KpiCard.module.css';

/**
 * Vignette d'indicateur des portails. Quatre par ligne côté client, cinq côté
 * back-office. La valeur est en Cormorant 400 tabulaire — pas en graisse 300,
 * contrairement aux chiffres éditoriaux du site public.
 *
 * @param {{label: string, value: string, detail?: string, onGround?: boolean}} props
 */
export function KpiCard({ label, value, detail, onGround = false }) {
  return (
    <div className={[styles.card, onGround ? styles.onGround : ''].filter(Boolean).join(' ')}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {detail ? <div className={styles.detail}>{detail}</div> : null}
    </div>
  );
}
