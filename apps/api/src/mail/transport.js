import nodemailer from 'nodemailer';

/**
 * Transport de courrier.
 *
 * En développement et en test, on N'ENVOIE RIEN : les messages sont journalisés
 * et conservés en mémoire, ce qui permet aux tests de vérifier leur contenu
 * sans serveur SMTP ni risque d'écrire à une vraie adresse depuis un jeu de
 * démonstration peuplé de clients réels.
 *
 * En production, un échec de configuration SMTP doit se voir au démarrage et
 * non à la première notification.
 */

const ENVOYES = [];

function transportDeTest() {
  return {
    async sendMail(message) {
      ENVOYES.push(message);
      return { messageId: `test-${ENVOYES.length}` };
    },
  };
}

let transport = null;

export function obtenirTransport({ log } = {}) {
  if (transport) return transport;

  const hote = process.env.SMTP_HOST;

  if (!hote) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'SMTP_HOST non configuré. En production, les notifications doivent partir : ' +
          'configurez le serveur ou désactivez-les explicitement avec MAIL_DESACTIVE=1.',
      );
    }
    log?.info?.('courrier : transport de test (aucun envoi réel)');
    transport = transportDeTest();
    return transport;
  }

  transport = nodemailer.createTransport({
    host: hote,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === '1',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });

  return transport;
}

/** Messages capturés par le transport de test — lus par les tests seulement. */
export function messagesEnvoyes() {
  return ENVOYES;
}

export function viderMessages() {
  ENVOYES.length = 0;
}
