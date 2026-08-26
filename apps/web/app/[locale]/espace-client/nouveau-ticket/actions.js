'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API } from '../../../../lib/api.js';

/**
 * Ouverture d'un ticket.
 *
 * Comme partout ailleurs : action serveur passée directement à <form action>,
 * donc opérante sans JavaScript. Un agent qui signale une panne depuis un
 * poste où le script n'a pas chargé doit pouvoir le faire — c'est précisément
 * le moment où l'on a besoin du support.
 */
export async function ouvrirTicket(donnees) {
  const locale = String(donnees.get('locale') ?? 'fr');
  const retour = `/${locale}/espace-client/nouveau-ticket`;

  const objet = String(donnees.get('objet') ?? '').trim();
  const niveau = String(donnees.get('niveau') ?? 'n1');

  if (!objet) redirect(`${retour}?etat=objet_requis`);

  const jar = await cookies();
  let reponse;
  try {
    reponse = await fetch(`${API}/api/v1/tickets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: jar.toString() },
      body: JSON.stringify({ objet, niveau }),
      cache: 'no-store',
    });
  } catch {
    redirect(`${retour}?etat=indisponible`);
  }

  if (reponse.status === 401) redirect(`/${locale}/connexion?etat=expiree`);
  if (!reponse.ok) redirect(`${retour}?etat=refuse`);

  const ticket = await reponse.json();
  redirect(`/${locale}/espace-client/tickets?ouvert=${encodeURIComponent(ticket.reference)}`);
}
