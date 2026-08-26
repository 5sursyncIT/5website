import { obtenirTransport } from './transport.js';
import { site } from './identite.js';
import * as gabarits from './gabarits.js';
import { withoutTenant } from '../db/tenant.js';

/**
 * Envoi des notifications.
 *
 * Toutes les fonctions d'envoi sont appelées HORS transaction et sans être
 * attendues par la route : un serveur de courrier lent ou en panne ne doit
 * jamais faire échouer une opération qui a réussi. La conséquence est assumée —
 * une notification peut se perdre — et c'est le bon compromis : un ticket
 * ouvert dont l'accusé n'est pas parti vaut mieux qu'un ticket refusé parce
 * que le SMTP ne répondait pas.
 */

const DESACTIVE = process.env.MAIL_DESACTIVE === '1';

async function envoyer({ a, sujet, texte, html }) {
  if (DESACTIVE || !a) return null;
  const transport = obtenirTransport();
  return transport.sendMail({ from: site.expediteur, to: a, subject: sujet, text: texte, html });
}

export async function notifierOuvertureTicket({ ticket, auteur }) {
  if (!auteur?.email) return null;
  const message = gabarits.ouvertureTicket({ ticket, auteur });
  return envoyer({ a: auteur.email, ...message });
}

/**
 * Prévient les comptes d'une organisation qu'un document est disponible.
 *
 * La liste des destinataires est lue dans le périmètre de l'organisation
 * concernée — jamais fournie par l'appelant : sinon une erreur de code
 * enverrait le nom d'un livrable au mauvais client.
 */
export async function notifierDepotDocument({ document, version }) {
  const destinataires = await withoutTenant(async (client) =>
    (
      await client.query(
        `select email from users
          where organisation_id = $1 and actif and email is not null
            and role in ('client_admin', 'client_user')`,
        [document.organisation_id],
      )
    ).rows.map((r) => r.email),
  );

  if (destinataires.length === 0) return null;

  const message = gabarits.depotDocument({ document, version });
  // Destinataires en copie cachée : les adresses des agents d'une même
  // collectivité n'ont pas à circuler entre eux par nos soins.
  const transport = obtenirTransport();
  if (DESACTIVE) return null;

  return transport.sendMail({
    from: site.expediteur,
    to: site.expediteur,
    bcc: destinataires,
    subject: message.sujet,
    text: message.texte,
    html: message.html,
  });
}

/**
 * Prévient les comptes d'une organisation qu'un intervenant a répondu.
 *
 * Les notes internes n'appellent jamais cette fonction : la route ne
 * l'invoque que pour un message public. C'est le contrôle qui compte ici —
 * une note interne notifiée serait une note interne divulguée, et le libellé
 * du message ne suffirait pas à rattraper l'erreur.
 */
export async function notifierReponseTicket({ ticket }) {
  const destinataires = await withoutTenant(async (client) =>
    (
      await client.query(
        `select email from users
          where organisation_id = $1 and actif and email is not null
            and role in ('client_admin', 'client_user')`,
        [ticket.organisation_id],
      )
    ).rows.map((r) => r.email),
  );

  if (destinataires.length === 0 || DESACTIVE) return null;

  const message = gabarits.reponseTicket({ ticket });
  return obtenirTransport().sendMail({
    from: site.expediteur,
    to: site.expediteur,
    bcc: destinataires,
    subject: message.sujet,
    text: message.texte,
    html: message.html,
  });
}
