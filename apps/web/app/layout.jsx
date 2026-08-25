import './globals.css';
import { fontClassNames } from './fonts.js';

export const metadata = {
  metadataBase: new URL('https://5sursync.com'),
  title: {
    default: '5/Sync IT',
    template: '%s — 5/Sync IT',
  },
  description:
    "Ingénierie des systèmes d'information, transformation numérique et des infrastructures. Dakar, Sénégal — depuis 2016.",
};

export const viewport = {
  themeColor: '#f3f2f2',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={fontClassNames}>
      <body>
        <a className="skip-link" href="#contenu">
          Aller au contenu
        </a>
        {children}
      </body>
    </html>
  );
}
