import { Kicker } from './Kicker.jsx';
import styles from './SectionHeading.module.css';

/**
 * Sur-titre + titre de section. La maquette décline deux tailles : 42 px sur
 * l'accueil, 40 px sur les pages intérieures.
 *
 * @param {{kicker?: string, level?: 1|2, size?: 'hero'|'page'|'section'|'inner'|'app', onGround?: boolean}} props
 */
export function SectionHeading({
  kicker,
  level = 2,
  size = 'section',
  onGround = false,
  className = '',
  children,
}) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className={className}>
      {kicker ? (
        <Kicker size="lg" onGround={onGround} className={styles.kicker}>
          {kicker}
        </Kicker>
      ) : null}
      <Heading className={[styles.title, styles[size]].filter(Boolean).join(' ')}>{children}</Heading>
    </div>
  );
}
