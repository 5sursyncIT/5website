import { navigation } from '../content/fr.js';
import { LOCALES } from './[locale]/layout.jsx';

const BASE = process.env.SITE_URL ?? 'https://5sursync.com';

/**
 * Le plan de site se dérive de la navigation : ajouter une page à
 * content/fr.js suffit à l'y faire figurer. Une liste tenue à part finirait
 * par mentir — c'est toujours le plan de site qu'on oublie de mettre à jour.
 */
export default function sitemap() {
  return LOCALES.flatMap((locale) =>
    navigation.map((item) => ({
      url: `${BASE}/${locale}${item.slug ? `/${item.slug}` : ''}`,
      changeFrequency: 'monthly',
      priority: item.slug === '' ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l, `${BASE}/${l}${item.slug ? `/${item.slug}` : ''}`]),
        ),
      },
    })),
  );
}
