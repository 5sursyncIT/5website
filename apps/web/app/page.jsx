import Link from 'next/link';
import { Kicker } from '@5sync/ui';

/**
 * Lot 0 — l'accueil public arrive au lot 1. Cette page tient lieu de sommaire
 * des fondations livrées, pour que `npm run dev` montre quelque chose d'utile.
 */
export default function Page() {
  return (
    <main id="contenu" style={{ maxWidth: '720px', margin: '0 auto', padding: '96px 32px' }}>
      <Kicker size="lg">5/Sync IT — Chantier</Kicker>
      <h1
        style={{
          fontFamily: 'var(--site-font-display)',
          fontWeight: 400,
          fontSize: 'var(--site-display-page)',
          lineHeight: 'var(--site-leading-title)',
          letterSpacing: 'var(--site-tracking-display)',
          margin: '18px 0 20px',
        }}
      >
        Lot 0 — Fondations
      </h1>
      <p style={{ fontSize: 'var(--site-body-lg)', lineHeight: 'var(--site-leading-prose)' }}>
        Le monorepo, les deux couches de tokens et la bibliothèque de composants sont en place.
        Le site public est construit au lot 1.
      </p>
      <p style={{ fontSize: 'var(--site-body-lg)' }}>
        <Link href="/atelier">Ouvrir l’atelier de composants →</Link>
      </p>
    </main>
  );
}
