import { site } from './identite.js';

/**
 * Gabarits de courrier, en texte brut ET en HTML.
 *
 * Le texte brut n'est pas une politesse : les messageries d'administration
 * filtrent souvent le HTML, et un message qui n'a qu'une version HTML arrive
 * vide. Les deux versions portent la même information — jamais un lien utile
 * seulement dans l'une.
 *
 * Aucune donnée client dans l'objet du message : « TCK-4471 » n'apprend rien à
 * qui lit par-dessus l'épaule, « Coupure liaison radio Mairie annexe » si.
 */

function envelopper(titre, corps) {
  return {
    texte: `${titre}\n\n${corps.texte}\n\n—\n${site.nom}\n${site.url}`,
    html: `<!doctype html><html lang="fr"><body style="margin:0;background:#f3f2f2;padding:32px 16px;font-family:Georgia,serif;color:#201f1d">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid rgba(32,31,29,.16);border-radius:4px;padding:32px 30px">
<p style="margin:0 0 22px;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.14em;color:#b68235;text-transform:uppercase">${site.nom}</p>
<h1 style="margin:0 0 18px;font-size:22px;font-weight:600;line-height:1.2">${titre}</h1>
${corps.html}
<p style="margin:28px 0 0;padding-top:18px;border-top:1px solid rgba(32,31,29,.12);font-size:12px;color:#7d7979">
${site.nom} — <a href="${site.url}" style="color:#7d5411">${site.url}</a></p>
</div></body></html>`,
  };
}

export function ouvertureTicket({ ticket, auteur }) {
  const titre = 'Votre demande a bien été enregistrée';
  const corps = {
    texte:
      `Référence : ${ticket.reference}\n` +
      `Objet : ${ticket.objet}\n\n` +
      "Votre demande est prise en charge selon les délais de votre contrat de service. " +
      "Vous pouvez suivre son avancement depuis votre espace client.",
    html:
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Bonjour ${escaper(auteur.nom)},</p>` +
      `<p style="margin:0 0 18px;font-size:15px;line-height:1.6">Votre demande est enregistrée sous la référence <strong>${escaper(ticket.reference)}</strong>.</p>` +
      `<p style="margin:0 0 18px;padding:14px 16px;background:rgba(182,130,53,.09);border-left:2px solid #b68235;font-size:14px;line-height:1.6">${escaper(ticket.objet)}</p>` +
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#605d5d">Elle est prise en charge selon les délais de votre contrat de service. Vous pouvez suivre son avancement depuis votre espace client.</p>`,
  };
  return { sujet: `${site.nom} — demande ${ticket.reference} enregistrée`, ...envelopper(titre, corps) };
}

export function depotDocument({ document, version }) {
  const titre = 'Un document a été déposé';
  const corps = {
    texte:
      `Document : ${document.nom}\n` +
      `Version : v${version.version}\n\n` +
      'Il est consultable depuis votre espace client.',
    html:
      `<p style="margin:0 0 18px;font-size:15px;line-height:1.6">Un nouveau document est disponible dans votre espace client.</p>` +
      `<p style="margin:0 0 18px;padding:14px 16px;background:rgba(182,130,53,.09);border-left:2px solid #b68235;font-size:14px;line-height:1.6"><strong>${escaper(document.nom)}</strong><br>version ${version.version}</p>`,
  };
  return { sujet: `${site.nom} — nouveau document disponible`, ...envelopper(titre, corps) };
}

/**
 * Réponse d'un intervenant sur un ticket.
 *
 * LE CORPS DE LA RÉPONSE N'EST PAS REPRIS DANS LE MESSAGE, DÉLIBÉRÉMENT.
 * Un échange de support porte régulièrement une adresse d'équipement, un port
 * ouvert, une procédure de contournement — des choses qui ont leur place
 * derrière une session authentifiée, pas recopiées dans une boîte aux lettres
 * qui sera relevée en clair, transférée et archivée sans notre contrôle. La
 * notification dit qu'il y a du nouveau ; l'espace client dit quoi.
 */
export function reponseTicket({ ticket }) {
  const titre = 'Nouvelle réponse sur votre demande';
  const corps = {
    texte:
      `Référence : ${ticket.reference}\n\n` +
      'Un intervenant 5/Sync a répondu à votre demande. ' +
      'La réponse est consultable depuis votre espace client.',
    html:
      `<p style="margin:0 0 18px;font-size:15px;line-height:1.6">Un intervenant ${site.nom} a répondu à votre demande <strong>${escaper(ticket.reference)}</strong>.</p>` +
      `<p style="margin:0;font-size:14px;line-height:1.6;color:#605d5d">La réponse est consultable depuis votre espace client.</p>`,
  };
  return { sujet: `${site.nom} — réponse sur ${ticket.reference}`, ...envelopper(titre, corps) };
}

/** Les noms de documents et les objets de tickets sont saisis par des humains. */
function escaper(texte) {
  return String(texte)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
