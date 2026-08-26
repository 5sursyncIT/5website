/**
 * Compteurs en mémoire, exposés au format Prometheus.
 *
 * POURQUOI EN MÉMOIRE ET NON EN BASE
 * Ces chiffres décrivent CE PROCESSUS : combien de requêtes il a servies,
 * combien ont échoué, combien de temps elles ont pris. Les écrire en base
 * ajouterait une écriture à chaque requête servie — c'est-à-dire ferait payer
 * à la production le coût de sa propre observation. Un redémarrage les remet à
 * zéro, et c'est le comportement attendu d'un compteur Prometheus : le
 * collecteur détecte la remise à zéro et en tient compte.
 *
 * Les chiffres qui doivent survivre au redémarrage — l'âge de la dernière
 * sauvegarde, celui du dernier exercice de restauration — ne sont pas ici :
 * ils sont lus sur le disque au moment du relevé.
 */

/** @type {Map<string, number>} */
const compteurs = new Map();

/**
 * Cumuls de durée par route. On garde somme et nombre plutôt qu'un histogramme
 * complet : une moyenne suffit à voir une route qui se dégrade, et les seaux
 * d'un histogramme multiplieraient par dix le nombre de séries pour une
 * précision dont personne n'a l'usage ici.
 */
const durees = new Map();

const cle = (nom, etiquettes) => {
  const paires = Object.entries(etiquettes ?? {})
    .filter(([, v]) => v !== null && v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${String(v).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`);
  return paires.length ? `${nom}{${paires.join(',')}}` : nom;
};

export function incrementer(nom, etiquettes, pas = 1) {
  const k = cle(nom, etiquettes);
  compteurs.set(k, (compteurs.get(k) ?? 0) + pas);
}

export function observerDuree(nom, etiquettes, secondes) {
  const k = cle(nom, etiquettes);
  const actuel = durees.get(k) ?? { somme: 0, nombre: 0 };
  actuel.somme += secondes;
  actuel.nombre += 1;
  durees.set(k, actuel);
}

export function releve() {
  return {
    compteurs: new Map(compteurs),
    durees: new Map(durees),
  };
}

/** Réservé aux tests : un compteur qui traîne d'un test à l'autre ment. */
export function reinitialiser() {
  compteurs.clear();
  durees.clear();
}

/**
 * Branche le comptage des requêtes.
 *
 * LA CARDINALITÉ EST LE PIÈGE DE CE GENRE DE MÉTRIQUE, et il est facile d'y
 * tomber : étiqueter par `request.url` produirait une série par identifiant de
 * ticket rencontré. Quelques milliers de tickets, et le collecteur garde des
 * centaines de milliers de séries pour une information qui n'en est pas une.
 * On étiquette donc par le GABARIT de route — « /api/v1/tickets/:id » — dont
 * le nombre est borné par le code.
 */
export function brancherComptage(app) {
  app.addHook('onRequest', async (request) => {
    request.debutMesure = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (request, reply) => {
    // Une route inconnue n'a pas de gabarit : tout regrouper sous « inconnue »
    // évite qu'un balayage d'URL par un robot ne crée une série par tentative.
    const route = request.routeOptions?.url ?? 'inconnue';
    const code = reply.statusCode;

    incrementer('cinqsync_requetes_total', { route, code });
    if (code >= 500) incrementer('cinqsync_requetes_erreurs_total', { route });

    if (request.debutMesure) {
      const secondes = Number(process.hrtime.bigint() - request.debutMesure) / 1e9;
      observerDuree('cinqsync_requete_duree_secondes', { route }, secondes);
    }
  });
}
