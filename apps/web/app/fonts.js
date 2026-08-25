import { Cormorant_Garamond, Lora, IBM_Plex_Mono } from 'next/font/google';

/**
 * Les trois familles de la maquette.
 *
 * next/font/google TÉLÉCHARGE les fichiers au build et les sert depuis notre
 * propre origine : aucune requête vers Google au moment de la visite, et donc
 * aucune adresse IP de visiteur transmise à un tiers. C'est ce qui justifie
 * d'avoir retiré la règle @import de classical.css.
 *
 * Graisses retenues, et pourquoi :
 *  · Cormorant 300 — réservée aux grands chiffres (--site-figure-*)
 *  · Cormorant 400 — titres éditoriaux du site public
 *  · Cormorant 600 — titres d'interface, valeur de --font-heading-weight
 *  · Cormorant 400 italique — le « Faire évoluer. » du héro
 */
export const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-cormorant',
});

export const lora = Lora({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-lora',
});

export const plexMono = IBM_Plex_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-plex-mono',
});

export const fontClassNames = [cormorant.variable, lora.variable, plexMono.variable].join(' ');
