import { site } from '../content/fr.js';

const BASE = process.env.SITE_URL ?? 'https://5sursync.com';

/**
 * Données structurées de l'organisation, au format schema.org.
 *
 * Elles ne contiennent que ce que le site affirme par ailleurs — adresse,
 * téléphones, année de création, pays d'intervention. Rien qui ne soit
 * vérifiable : le balisage sert à rendre lisible ce qui est déjà écrit, pas à
 * déclarer davantage aux moteurs qu'aux visiteurs.
 */
export function DonneesStructurees() {
  const donnees = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.nom,
    url: BASE,
    logo: `${BASE}/logo-5syncit.png`,
    description: site.baseline,
    foundingDate: '2016',
    email: site.email,
    telephone: site.telephone.split('·').map((t) => t.trim()),
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Almadies 2, Résidence El Hadji Oumar Dieng, 4e étage A',
      addressLocality: 'Dakar',
      addressCountry: 'SN',
    },
    areaServed: [
      { '@type': 'Country', name: 'Sénégal' },
      { '@type': 'Country', name: 'Guinée' },
      { '@type': 'Country', name: 'République démocratique du Congo' },
      { '@type': 'Country', name: "Côte d'Ivoire" },
    ],
    knowsAbout: [
      "Ingénierie des systèmes d'information",
      'Réseaux et télécommunications',
      'Infrastructures et cloud',
      'Cybersécurité',
      'Applications métier et ERP',
      'Archives numériques et audiovisuel',
    ],
  };

  return (
    <script
      type="application/ld+json"
      // Contenu constant, issu de nos propres fichiers : aucune donnée
      // extérieure ne transite ici.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(donnees) }}
    />
  );
}
