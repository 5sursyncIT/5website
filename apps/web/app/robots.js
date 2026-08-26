const BASE = process.env.SITE_URL ?? 'https://5sursync.com';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // L'atelier de composants et les portails n'ont rien à faire dans un
        // index : le premier expose la grammaire interne du produit, les
        // seconds n'ont aucun contenu public.
        disallow: ['/atelier', '/api/', '/fr/espace-client', '/fr/back-office'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
