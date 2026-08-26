'use server';

import { redirect } from 'next/navigation';

const API = process.env.API_INTERNAL_URL ?? 'http://localhost:4000';

/**
 * Action serveur du formulaire de contact.
 *
 * ELLE EST PASSÉE DIRECTEMENT À <form action>, PAS VIA useActionState — et
 * c'est ce qui la fait fonctionner SANS JAVASCRIPT. Avec useActionState, le
 * navigateur poste bien, mais l'état de retour n'est pas rejoué côté serveur :
 * mesuré, la demande n'atteignait jamais l'API. Une action directe suit le
 * schéma « poster, rediriger, afficher », qui est aussi vieux que le Web et ne
 * dépend d'aucun script.
 *
 * Ce n'est pas un raffinement théorique : ce site s'adresse à des agents
 * publics sur des connexions mobiles où un script peut échouer à se charger.
 *
 * LIMITE ASSUMÉE : après une erreur de validation sans JavaScript, les champs
 * sont vidés — la redirection perd le corps de la requête. Avec JavaScript,
 * Next intercepte et rien n'est perdu. Les remettre supposerait de faire
 * transiter les saisies par l'URL, ce qui les inscrirait dans les journaux du
 * serveur et l'historique du navigateur.
 */
export async function envoyerDemande(donnees) {
  const locale = String(donnees.get('locale') ?? 'fr');
  const retour = `/${locale}/contact`;

  const corps = {
    organisation: String(donnees.get('organisation') ?? ''),
    nom: String(donnees.get('nom') ?? ''),
    email: String(donnees.get('email') ?? ''),
    telephone: String(donnees.get('telephone') ?? ''),
    contexte: String(donnees.get('contexte') ?? ''),
    besoins: donnees.getAll('besoins').map(String).filter(Boolean),
    site: String(donnees.get('site') ?? ''),
  };

  let reponse;
  try {
    reponse = await fetch(`${API}/api/v1/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corps),
      cache: 'no-store',
    });
  } catch {
    // L'erreur technique ne dit rien d'utile au visiteur et décrit notre
    // infrastructure. On lui donne une porte de sortie, pas un code d'erreur.
    redirect(`${retour}?etat=indisponible`);
  }

  if (reponse.status === 429) redirect(`${retour}?etat=trop_de_demandes`);

  if (!reponse.ok) {
    const detail = await reponse.json().catch(() => ({}));
    const champs = Object.keys(detail.champs ?? {}).join(',');
    redirect(`${retour}?etat=invalide${champs ? `&champs=${encodeURIComponent(champs)}` : ''}`);
  }

  redirect(`${retour}?etat=recu`);
}
