import { withoutTenant } from '../../db/tenant.js';
import * as leads from '../../repositories/leads.js';
import { exiger } from '../../auth/contexte.js';

/**
 * Formulaire de contact.
 *
 * SEULE ROUTE D'ÉCRITURE OUVERTE SANS AUTHENTIFICATION du service. Elle est
 * donc traitée comme une surface d'attaque : limitation de débit par adresse,
 * bornes de longueur sur chaque champ, liste fermée pour les natures de
 * besoin, et un champ-piège.
 */

/** Doit correspondre à content/fr.js — une valeur hors liste est rejetée. */
const BESOINS = [
  'Audit / schéma directeur',
  'Réseau & connectivité',
  'Infrastructure & cloud',
  'Cybersécurité',
  'Application métier / ERP',
  'Archives & audiovisuel',
];

const BORNES = {
  organisation: 200,
  nom: 120,
  email: 320,
  telephone: 40,
  contexte: 5000,
};

/**
 * Limitation de débit en mémoire, par adresse.
 *
 * Suffisant pour une instance unique, ce qui est le cas aujourd'hui. Au moment
 * où l'API sera répliquée, ce compteur devra passer en base ou en cache
 * partagé — sinon la limite se multiplie par le nombre d'instances. C'est écrit
 * ici pour que la limite ne soit pas silencieusement contournée le jour du
 * passage à l'échelle.
 */
const FENETRE_MS = 60 * 60 * 1000;
const MAX_PAR_FENETRE = 5;
const compteurs = new Map();

function tropDeDemandes(ip, maintenant) {
  const recentes = (compteurs.get(ip) ?? []).filter((t) => maintenant - t < FENETRE_MS);
  if (recentes.length >= MAX_PAR_FENETRE) return true;
  recentes.push(maintenant);
  compteurs.set(ip, recentes);

  // Purge opportuniste : sans elle, la table grossit indéfiniment.
  if (compteurs.size > 5000) {
    for (const [cle, dates] of compteurs) {
      if (dates.every((t) => maintenant - t >= FENETRE_MS)) compteurs.delete(cle);
    }
  }
  return false;
}

function valider(corps) {
  const erreurs = {};
  const propre = {};

  for (const champ of ['organisation', 'nom', 'email']) {
    const valeur = String(corps?.[champ] ?? '').trim();
    if (!valeur) erreurs[champ] = 'Ce champ est requis.';
    else if (valeur.length > BORNES[champ]) erreurs[champ] = `Maximum ${BORNES[champ]} caractères.`;
    propre[champ] = valeur;
  }

  // Volontairement permissif : une validation d'e-mail trop stricte rejette
  // des adresses valides, et le seul test qui prouve quoi que ce soit est
  // l'envoi effectif d'un message.
  if (propre.email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(propre.email)) {
    erreurs.email = 'Adresse électronique invalide.';
  }

  const telephone = String(corps?.telephone ?? '').trim();
  if (telephone.length > BORNES.telephone) erreurs.telephone = 'Numéro trop long.';
  propre.telephone = telephone || null;

  const contexte = String(corps?.contexte ?? '').trim();
  if (contexte.length > BORNES.contexte) erreurs.contexte = `Maximum ${BORNES.contexte} caractères.`;
  propre.contexte = contexte || null;

  const besoins = Array.isArray(corps?.besoins) ? corps.besoins : [];
  propre.besoins = besoins.filter((b) => BESOINS.includes(b));
  if (besoins.length !== propre.besoins.length) {
    erreurs.besoins = 'Nature de besoin inconnue.';
  }

  return { erreurs, propre, valide: Object.keys(erreurs).length === 0 };
}

export default async function routesLeads(app) {
  app.post('/api/v1/leads', async (request, reply) => {
    const ip = request.ip;

    // Champ-piège : invisible et vide pour un humain, rempli par la plupart
    // des robots. On répond 202 sans rien enregistrer — signaler le rejet
    // apprendrait au robot à contourner le piège.
    if (String(request.body?.site ?? '').trim() !== '') {
      return reply.code(202).send({ recu: true });
    }

    if (tropDeDemandes(ip, Date.now())) {
      return reply.code(429).send({
        error: 'trop_de_demandes',
        message: 'Trop de demandes depuis cette adresse. Réessayez dans une heure.',
      });
    }

    const { erreurs, propre, valide } = valider(request.body);
    if (!valide) {
      return reply.code(400).send({ error: 'validation', champs: erreurs });
    }

    const lead = await withoutTenant((c) => leads.deposer(c, { ...propre, ip }));

    request.log.info({ leadId: lead.id, organisation: propre.organisation }, 'demande de contact reçue');
    return reply.code(201).send({ recu: true, id: lead.id });
  });

  app.get('/api/v1/leads', async (request, reply) => {
    if (!request.session) return reply.code(401).send({ error: 'non_authentifie' });
    exiger(request.session, 'leads:lire');

    const liste = await withoutTenant((c) =>
      leads.lister(c, { traites: request.query?.traites === '1' }),
    );
    return { leads: liste };
  });
}

export { BESOINS, BORNES };
