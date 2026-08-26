import { connect } from 'node:net';

/**
 * Analyse antivirus des fichiers déposés, via clamd.
 *
 * POURQUOI CE N'EST PAS FACULTATIF
 * Le personnel dépose des rapports d'intervention ; les clients les
 * téléchargent. Si un poste d'intervenant est compromis, notre plateforme
 * devient le canal de distribution vers des administrations — avec notre nom
 * sur l'expéditeur. La vérification du type réel écarte l'exécutable déguisé,
 * elle ne dit rien d'un PDF piégé.
 *
 * PROTOCOLE
 * INSTREAM de clamd : on ouvre une socket, on pousse le contenu par blocs
 * préfixés de leur longueur, un bloc vide termine. Trente lignes, aucune
 * dépendance — et surtout aucun binaire à invoquer, donc aucune ligne de
 * commande où faire passer un nom de fichier.
 *
 * POSTURE EN CAS D'INDISPONIBILITÉ
 * En production, un antivirus configuré mais injoignable fait ÉCHOUER le dépôt.
 * Accepter « parce que le scanner est en panne » revient à n'avoir aucun
 * scanner les jours où ça compte. Hors production, on avertit et on laisse
 * passer, pour ne pas rendre le développement impossible.
 */

const HOTE = process.env.CLAMD_HOST ?? null;
const PORT = Number(process.env.CLAMD_PORT ?? 3310);
const DELAI_MS = Number(process.env.CLAMD_TIMEOUT_MS ?? 15_000);
const TAILLE_BLOC = 64 * 1024;

export const configure = Boolean(HOTE);

export class FichierInfecte extends Error {
  constructor(signature) {
    super(`Fichier refusé : ${signature}`);
    this.name = 'FichierInfecte';
    this.statusCode = 422;
    this.signature = signature;
  }
}

export class AntivirusIndisponible extends Error {
  constructor(cause) {
    super(`Antivirus injoignable : ${cause}`);
    this.name = 'AntivirusIndisponible';
    this.statusCode = 503;
  }
}

function interroger(contenu) {
  return new Promise((resoudre, rejeter) => {
    const socket = connect({ host: HOTE, port: PORT });
    let reponse = '';

    socket.setTimeout(DELAI_MS, () => {
      socket.destroy();
      rejeter(new AntivirusIndisponible('délai dépassé'));
    });

    socket.on('error', (erreur) => rejeter(new AntivirusIndisponible(erreur.message)));
    socket.on('data', (bloc) => {
      reponse += bloc.toString('utf8');
    });
    socket.on('end', () => resoudre(reponse.trim()));

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let i = 0; i < contenu.length; i += TAILLE_BLOC) {
        const morceau = contenu.subarray(i, i + TAILLE_BLOC);
        const taille = Buffer.alloc(4);
        taille.writeUInt32BE(morceau.length);
        socket.write(taille);
        socket.write(morceau);
      }
      // Bloc de longueur nulle : fin du flux.
      socket.write(Buffer.alloc(4));
    });
  });
}

/**
 * @param {Buffer} contenu
 * @param {{log?: object, env?: string}} options
 * @throws {FichierInfecte} si une signature est reconnue
 * @throws {AntivirusIndisponible} en production, si le scanner ne répond pas
 */
export async function analyser(contenu, { log, env = process.env.NODE_ENV } = {}) {
  if (!configure) {
    if (env === 'production') {
      // On ne bloque pas : un déploiement sans antivirus reste un choix
      // possible. Mais il doit être visible dans les journaux, à chaque dépôt.
      log?.warn?.('dépôt accepté sans analyse antivirus — CLAMD_HOST non configuré');
    }
    return { analyse: false };
  }

  let reponse;
  try {
    reponse = await interroger(contenu);
  } catch (erreur) {
    if (env === 'production') throw erreur;
    log?.warn?.(`antivirus injoignable (${erreur.message}) — dépôt accepté hors production`);
    return { analyse: false, erreur: erreur.message };
  }

  // clamd répond « stream: OK » ou « stream: <signature> FOUND ».
  if (/\bFOUND\b/.test(reponse)) {
    const signature = reponse.replace(/^stream:\s*/, '').replace(/\s*FOUND$/, '');
    throw new FichierInfecte(signature);
  }

  if (!/\bOK\b/.test(reponse)) {
    if (env === 'production') throw new AntivirusIndisponible(`réponse inattendue : ${reponse}`);
    log?.warn?.(`réponse antivirus inattendue : ${reponse}`);
    return { analyse: false };
  }

  return { analyse: true };
}
