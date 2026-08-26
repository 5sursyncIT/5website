import { notFound } from 'next/navigation';
import { SiteHeader } from '../../components/SiteHeader.jsx';
import { SiteFooter } from '../../components/SiteFooter.jsx';
import { DonneesStructurees } from '../../components/DonneesStructurees.jsx';

/**
 * Les routes sont localisées dès maintenant, alors qu'une seule langue existe.
 *
 * La structure /[locale]/ coûte presque rien à poser et une réécriture
 * complète du routage à rajouter après coup — tous les liens, toutes les
 * routes, tous les sitemaps. Le sélecteur FR/EN est dans la maquette : la
 * question n'est pas si, mais quand.
 */
export const LOCALES = ['fr'];

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;
  if (!LOCALES.includes(locale)) notFound();

  return (
    <>
      <DonneesStructurees />
      <SiteHeader locale={locale} />
      <main id="contenu">{children}</main>
      <SiteFooter locale={locale} />
    </>
  );
}
