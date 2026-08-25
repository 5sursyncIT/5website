import styles from './Meter.module.css';

/**
 * Jauge de consommation — les heures d'intervention du panneau « contrat de
 * service ». Rendue avec <progress> pour rester lisible par les lecteurs
 * d'écran ; l'apparence native est neutralisée.
 *
 * @param {{label: string, value: number, max: number, caption?: string}} props
 */
export function Meter({ label, value, max, caption }) {
  return (
    <div>
      <div className={styles.label}>{label}</div>
      <progress className={styles.meter} value={value} max={max} />
      <div className={styles.caption}>{caption ?? `${value} / ${max}`}</div>
    </div>
  );
}
