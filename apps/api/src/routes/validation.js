/**
 * Lecture validée d'un corps de requête.
 *
 * POURQUOI PAS LE SCHÉMA JSON DE FASTIFY
 * Fastify sait valider, mais il répond par un message anglais généré, d'une
 * forme différente de celle que le reste de cette API emploie déjà —
 * `{ error: 'validation', champs: { … } }`, que le formulaire de contact rend
 * champ par champ. Deux formes d'erreur pour un même besoin obligeraient
 * chaque écran à en traiter deux.
 *
 * POURQUOI VALIDER LES UUID
 * Sans contrôle, un identifiant mal formé descend jusqu'à PostgreSQL, qui
 * refuse la conversion et fait remonter une erreur 500. Le refus est bien là,
 * mais il se présente comme une panne du service alors que c'est une saisie
 * invalide — et il réveille quelqu'un la nuit pour rien.
 *
 * Chaque lecteur renvoie la valeur nettoyée et l'inscrit dans `valeurs` ;
 * les champs absents et facultatifs valent `null`, jamais `undefined` : c'est
 * la valeur que les dépôts passent à PostgreSQL.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class Saisie {
  constructor(corps) {
    this.corps = corps ?? {};
    this.erreurs = {};
    this.valeurs = {};
  }

  #poser(champ, valeur) {
    this.valeurs[champ] = valeur;
    return valeur;
  }

  #refuser(champ, message) {
    this.erreurs[champ] = message;
    return this.#poser(champ, null);
  }

  #absent(champ, requis) {
    if (requis) return this.#refuser(champ, 'Ce champ est requis.');
    return this.#poser(champ, null);
  }

  texte(champ, { requis = false, max = 300 } = {}) {
    const brut = this.corps[champ];
    const valeur = brut === null || brut === undefined ? '' : String(brut).trim();
    if (!valeur) return this.#absent(champ, requis);
    if (valeur.length > max) return this.#refuser(champ, `Maximum ${max} caractères.`);
    return this.#poser(champ, valeur);
  }

  entier(champ, { requis = false, min = null, max = null } = {}) {
    const brut = this.corps[champ];
    if (brut === null || brut === undefined || brut === '') return this.#absent(champ, requis);

    const valeur = Number(brut);
    if (!Number.isInteger(valeur)) return this.#refuser(champ, 'Nombre entier attendu.');
    if (min !== null && valeur < min) return this.#refuser(champ, `Minimum ${min}.`);
    if (max !== null && valeur > max) return this.#refuser(champ, `Maximum ${max}.`);
    return this.#poser(champ, valeur);
  }

  /**
   * Nombre à décimales bornées — les quantités de lignes de facture.
   *
   * `piece_lignes.quantite` est un `numeric(12,2)` : une demi-journée
   * d'intervention se facture, et l'imposer entier obligerait à ventiler en
   * deux lignes ce qui n'en fait qu'une. Au-delà de deux décimales, en
   * revanche, PostgreSQL arrondirait en silence — mieux vaut refuser.
   */
  decimal(champ, { requis = false, min = null, max = null, decimales = 2 } = {}) {
    const brut = this.corps[champ];
    if (brut === null || brut === undefined || brut === '') return this.#absent(champ, requis);

    const valeur = Number(brut);
    if (!Number.isFinite(valeur)) return this.#refuser(champ, 'Nombre attendu.');
    if (min !== null && valeur < min) return this.#refuser(champ, `Minimum ${min}.`);
    if (max !== null && valeur > max) return this.#refuser(champ, `Maximum ${max}.`);
    if (Number(valeur.toFixed(decimales)) !== valeur) {
      return this.#refuser(champ, `Maximum ${decimales} décimales.`);
    }
    return this.#poser(champ, valeur);
  }

  date(champ, { requis = false } = {}) {
    const brut = this.corps[champ];
    if (!brut) return this.#absent(champ, requis);

    const valeur = String(brut).trim();
    // Le format est contrôlé AVANT la validité : « 2026-13-01 » a la bonne
    // forme et n'existe pas, et Date.parse accepterait « demain » sans rien
    // dire d'utile.
    if (!DATE_ISO.test(valeur)) return this.#refuser(champ, 'Date attendue au format AAAA-MM-JJ.');
    if (Number.isNaN(Date.parse(`${valeur}T00:00:00Z`))) {
      return this.#refuser(champ, 'Cette date n’existe pas.');
    }
    return this.#poser(champ, valeur);
  }

  uuid(champ, { requis = false } = {}) {
    const brut = this.corps[champ];
    if (!brut) return this.#absent(champ, requis);

    const valeur = String(brut).trim();
    if (!UUID.test(valeur)) return this.#refuser(champ, 'Identifiant invalide.');
    return this.#poser(champ, valeur);
  }

  parmi(champ, liste, { requis = false, defaut = null } = {}) {
    const brut = this.corps[champ];
    if (brut === null || brut === undefined || brut === '') {
      if (requis) return this.#refuser(champ, 'Ce champ est requis.');
      return this.#poser(champ, defaut);
    }

    const valeur = String(brut).trim();
    if (!liste.includes(valeur)) {
      return this.#refuser(champ, `Valeur inconnue. Attendu : ${liste.join(', ')}.`);
    }
    return this.#poser(champ, valeur);
  }

  booleen(champ, { defaut = null } = {}) {
    const brut = this.corps[champ];
    if (brut === null || brut === undefined) return this.#poser(champ, defaut);
    if (typeof brut !== 'boolean') return this.#refuser(champ, 'Vrai ou faux attendu.');
    return this.#poser(champ, brut);
  }

  /**
   * Liste d'objets, chacun validé par une Saisie fille.
   *
   * Les erreurs des lignes sont reportées sous « champ.rang.sous-champ » —
   * « jalons.2.libelle ». Un écran qui doit signaler la ligne fautive ne peut
   * pas se contenter de « une des lignes est invalide » : l'opérateur ne
   * saurait pas laquelle corriger.
   */
  lignes(champ, lecteur, { max = 200 } = {}) {
    const brut = this.corps[champ];
    if (brut === null || brut === undefined) return this.#poser(champ, []);

    // Un refus renvoie une liste VIDE, jamais null : l'appelant lit
    // régulièrement `.length` pour décider d'autre chose — le montant d'une
    // pièce vient de ses lignes quand il y en a — et il le fait avant de
    // regarder si la saisie est valide. Rendre null ferait tomber la route en
    // 500 sur une saisie invalide, c'est-à-dire présenter une faute de frappe
    // comme une panne du service.
    if (!Array.isArray(brut)) {
      this.erreurs[champ] = 'Liste attendue.';
      return this.#poser(champ, []);
    }
    if (brut.length > max) {
      this.erreurs[champ] = `Maximum ${max} lignes.`;
      return this.#poser(champ, []);
    }

    const resultat = [];
    for (const [rang, ligne] of brut.entries()) {
      const fille = new Saisie(ligne);
      const valeur = lecteur(fille);
      for (const [sousChamp, message] of Object.entries(fille.erreurs)) {
        this.erreurs[`${champ}.${rang}.${sousChamp}`] = message;
      }
      resultat.push(valeur);
    }
    return this.#poser(champ, resultat);
  }

  get valide() {
    return Object.keys(this.erreurs).length === 0;
  }

  /** Réponse 400 à la forme employée partout ailleurs dans cette API. */
  refus(reply) {
    return reply.code(400).send({ error: 'validation', champs: this.erreurs });
  }
}
