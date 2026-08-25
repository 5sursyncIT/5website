import styles from './SideNav.module.css';

/**
 * Navigation latérale des portails : libellé à gauche, compteur à droite,
 * filet d'accent sur l'entrée active.
 *
 * @param {object} props
 * @param {Array<{href: string, label: string, count?: string|number}>} props.items
 * @param {string} props.active  href de l'entrée courante
 * @param {string} props.label   intitulé accessible de la navigation
 * @param {boolean} [props.onGround=false]
 */
export function SideNav({ items, active, label, onGround = false }) {
  return (
    <nav aria-label={label} className={onGround ? styles.onGround : undefined}>
      <ul className={styles.list}>
        {items.map((item) => {
          const current = item.href === active;
          return (
            <li key={item.href}>
              <a
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={[styles.item, current ? styles.current : ''].filter(Boolean).join(' ')}
              >
                <span>{item.label}</span>
                {item.count !== undefined ? <span className={styles.count}>{item.count}</span> : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
