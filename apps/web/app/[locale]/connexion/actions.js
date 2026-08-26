'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API } from '../../../lib/api.js';

/**
 * Connexion.
 *
 * Le navigateur poste vers Next, qui interroge l'API de serveur à serveur puis
 * REPOSE lui-même le cookie de session. Deux raisons : l'API n'est jamais
 * jointe directement depuis le navigateur, et le cookie reste first-party sans
 * qu'aucune configuration CORS n'entre en jeu.
 *
 * Comme le formulaire de contact, l'action est passée directement à
 * <form action> : elle fonctionne sans JavaScript.
 */
export async function seConnecter(donnees) {
  const locale = String(donnees.get('locale') ?? 'fr');
  const suite = String(donnees.get('suite') ?? '');
  const email = String(donnees.get('email') ?? '');
  const motDePasse = String(donnees.get('motDePasse') ?? '');

  const echec = (code) =>
    `/${locale}/connexion?etat=${code}${suite ? `&suite=${encodeURIComponent(suite)}` : ''}`;

  if (!email || !motDePasse) redirect(echec('champs_manquants'));

  let reponse;
  try {
    reponse = await fetch(`${API}/api/v1/auth/connexion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, motDePasse }),
      cache: 'no-store',
    });
  } catch {
    redirect(echec('indisponible'));
  }

  // Même réponse pour un compte inconnu et un mot de passe erroné : l'API ne
  // les distingue pas, et l'interface ne doit pas les distinguer non plus.
  if (!reponse.ok) redirect(echec('identifiants'));

  const entete = reponse.headers.get('set-cookie');
  if (!entete) redirect(echec('indisponible'));

  // On reprend le cookie tel que l'API l'a formé — nom, expiration, drapeaux —
  // plutôt que de le reconstruire : deux définitions du même cookie finiraient
  // par diverger, et c'est la sécurité qui en pâtirait.
  const [paire, ...attributs] = entete.split(';').map((p) => p.trim());
  const separateur = paire.indexOf('=');
  const nom = paire.slice(0, separateur);
  const valeur = paire.slice(separateur + 1);

  const options = { httpOnly: true, sameSite: 'lax', path: '/' };
  for (const attribut of attributs) {
    const [cle, v] = attribut.split('=');
    const k = cle.toLowerCase();
    if (k === 'expires') options.expires = new Date(v);
    if (k === 'max-age') options.maxAge = Number(v);
    if (k === 'secure') options.secure = true;
    if (k === 'samesite') options.sameSite = v?.toLowerCase() ?? 'lax';
    if (k === 'path') options.path = v;
  }

  (await cookies()).set(nom, valeur, options);

  redirect(suite && suite.startsWith(`/${locale}/`) ? suite : `/${locale}/espace-client`);
}

export async function seDeconnecter(donnees) {
  const locale = String(donnees.get('locale') ?? 'fr');
  const jar = await cookies();

  await fetch(`${API}/api/v1/auth/deconnexion`, {
    method: 'POST',
    headers: { cookie: jar.toString() },
    cache: 'no-store',
  }).catch(() => {});

  // On efface le cookie localement même si l'API n'a pas répondu : sinon un
  // incident réseau laisserait le visiteur connecté en apparence.
  jar.delete(process.env.SESSION_COOKIE ?? '5sync_session');
  redirect(`/${locale}`);
}
