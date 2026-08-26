'use client';

import { usePathname } from 'next/navigation';
import { SideNav } from '@5sync/ui';

/**
 * Navigation du portail.
 *
 * Le module courant se déduit de l'URL. Un gabarit Next ne connaît pas la
 * route qu'il enveloppe : sans ce fragment client, aucun onglet ne serait
 * marqué courant — ni visuellement, ni pour un lecteur d'écran, qui perdrait
 * l'aria-current.
 *
 * Le coût est le même que pour l'en-tête du site : le routeur est déjà chargé.
 */
export function NavPortail({ items, label }) {
  const chemin = usePathname() ?? '';
  const actif = items.find((i) => chemin.startsWith(i.href))?.href ?? null;
  return <SideNav items={items} active={actif} label={label} />;
}
