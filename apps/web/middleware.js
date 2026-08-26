import { NextResponse } from 'next/server';

/**
 * Politique de sécurité du contenu.
 *
 * L'ARBITRAGE, ET IL FAUT LE DIRE PLUTÔT QUE LE MASQUER
 *
 * Une CSP réellement stricte sur les scripts suppose un nonce par requête.
 * Next injecte des scripts en ligne — les fragments de données du rendu
 * serveur — qui ne passent qu'avec un nonce ou avec 'unsafe-inline'. Or lire
 * un nonce rend la page DYNAMIQUE : les six pages publiques perdraient leur
 * pré-génération, donc le budget de performance qui est un argument commercial
 * de ce site.
 *
 * On sépare donc selon l'enjeu réel :
 *
 *   ESPACE CLIENT ET CONNEXION — déjà dynamiques, puisqu'ils lisent le cookie
 *   de session. Le nonce n'y coûte rien, et c'est là que tout se joue : cookie
 *   de session, données d'un client, dépôt de fichiers. CSP stricte, sans
 *   'unsafe-inline'.
 *
 *   PAGES PUBLIQUES — contenu statique, pré-généré, qui n'affiche AUCUNE saisie
 *   d'utilisateur. Le formulaire de contact ne réaffiche pas les valeurs
 *   reçues : il n'y a pas de contenu réfléchi, donc pas de vecteur XSS à
 *   couvrir. 'unsafe-inline' y est toléré pour les scripts, et pour eux seuls.
 *
 * Dans les deux cas, tout le reste est fermé : ni objet, ni cadre, ni base,
 * ni formulaire vers un tiers, et les styles restent externes grâce aux
 * CSS Modules.
 */

/** Routes où la CSP stricte s'applique — celles qui manipulent une session. */
const STRICTES = [/^\/[a-z]{2}\/espace-client(\/|$)/, /^\/[a-z]{2}\/back-office(\/|$)/, /^\/[a-z]{2}\/connexion(\/|$)/];

function politique({ nonce, strict }) {
  const scripts = strict
    ? // strict-dynamic : les scripts chargés PAR un script autorisé le sont à
      // leur tour, ce qui évite d'énumérer les fragments produits par le build.
      `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : "'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    `script-src ${scripts}`,
    // Les CSS Modules produisent des feuilles externes : aucun style en ligne
    // n'est nécessaire pour le rendu. Les rares attributs style="" restants
    // sont couverts par style-src-attr.
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    // Polices auto-hébergées : aucune origine tierce n'a à être autorisée.
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    // Le formulaire de contact et la connexion postent vers notre propre
    // origine : rien ne doit pouvoir en détourner la destination.
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function middleware(request) {
  const chemin = request.nextUrl.pathname;
  const strict = STRICTES.some((motif) => motif.test(chemin));
  const nonce = strict ? Buffer.from(crypto.randomUUID()).toString('base64') : null;

  const entetes = new Headers(request.headers);
  if (nonce) entetes.set('x-nonce', nonce);

  const reponse = NextResponse.next({ request: { headers: entetes } });
  reponse.headers.set('content-security-policy', politique({ nonce, strict }));

  return reponse;
}

export const config = {
  /**
   * On exclut les ressources produites par le build et les fichiers statiques :
   * leur faire traverser le middleware coûterait un aller-retour par ressource
   * sans rien protéger — ce sont nos propres fichiers, servis depuis notre
   * origine.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
