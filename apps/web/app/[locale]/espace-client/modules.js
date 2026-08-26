/**
 * Les six modules de l'espace client.
 *
 * L'AFFECTATION DES CHAMPS VIENT DE CLAUDE DESIGN, pas de nous. Elle remplace
 * l'ordre de sacrifice des colonnes que nous demandions : puisqu'il n'y a plus
 * de colonnes, chaque module déclare quatre rôles — référence, objet,
 * attributs, figure — et la rangée-fiche les dispose. Aucun champ n'est masqué
 * à aucune largeur.
 *
 * Voir « Artboards - Espace client.dc.html », section « Affectation des champs ».
 */

const date = (v) => (v ? new Intl.DateTimeFormat('fr-FR').format(new Date(v)) : null);
const mois = (v) =>
  v ? new Intl.DateTimeFormat('fr-FR', { month: '2-digit', year: 'numeric' }).format(new Date(v)) : null;
const fcfa = (v) => (v == null ? null : `${new Intl.NumberFormat('fr-FR').format(v)} FCFA`);

/** Les statuts « en attente d'une action du client » se distinguent des autres. */
const ATTENTE_CLIENT = new Set(['votre_retour', 'a_valider', 'a_renouveler', 'planifie', 'en_attente']);
const ton = (statut) => (ATTENTE_CLIENT.has(statut) ? 'muted' : 'gold');

const LIBELLES = {
  ouvert: 'OUVERT', en_cours: 'EN COURS', escalade: 'ESCALADÉ', votre_retour: 'VOTRE RETOUR',
  planifie: 'PLANIFIÉ', resolu: 'RÉSOLU', clos: 'CLOS',
  cadrage: 'CADRAGE', recette: 'RECETTE', suspendu: 'SUSPENDU',
  actif: 'ACTIF', a_renouveler: 'À RENOUVELER',
  depose: 'DÉPOSÉ', valide: 'VALIDÉ', signe: 'SIGNÉ', obsolete: 'OBSOLÈTE',
  en_service: 'EN SERVICE', retire: 'RETIRÉ', en_panne: 'EN PANNE',
  brouillon: 'BROUILLON', a_valider: 'À VALIDER', en_attente: 'EN ATTENTE',
  reglee: 'RÉGLÉE', annulee: 'ANNULÉE',
};

const statut = (v) => LIBELLES[v] ?? String(v ?? '').toUpperCase();

export const MODULES = {
  tickets: {
    libelle: 'Tickets de support',
    ressource: 'tickets',
    entete: 'RÉFÉRENCE · OBJET · SITE · NIVEAU',
    action: { libelle: 'Ouvrir un ticket', href: 'nouveau-ticket' },
    kpis: (i) => [
      { label: 'TICKETS OUVERTS', value: String(i.ouverts), detail: `${i.prioritaires} en priorité haute` },
      {
        label: 'PRISE EN CHARGE MOYENNE',
        value: i.priseEnChargeMinutes == null
          ? '—'
          : `${Math.floor(i.priseEnChargeMinutes / 60)} h ${String(i.priseEnChargeMinutes % 60).padStart(2, '0')}`,
        detail: 'depuis l’ouverture',
      },
      { label: 'RÉSOLUS CE MOIS', value: String(i.resolusCeMois), detail: 'sur l’exercice courant' },
      { label: 'EN ATTENTE DE VOTRE RETOUR', value: String(i.attenteClient), detail: 'action de votre côté' },
    ],
    sous: (i) => `${i.ouverts} ticket(s) ouvert(s) · ${i.attenteClient} en attente de votre retour`,
    fiche: (t) => ({
      id: t.id,
      reference: t.reference,
      objet: t.objet,
      attributs: [t.site?.toUpperCase(), `NIVEAU ${t.niveau.slice(1)}`, `OUVERT LE ${date(t.ouvert_le)}`].filter(Boolean),
      statut: statut(t.statut),
      ton: ton(t.statut),
    }),
  },

  projets: {
    libelle: 'Projets & jalons',
    ressource: 'projets',
    entete: 'PROJET · PHASE · ÉCHÉANCE',
    kpis: (i) => [
      { label: 'PROJETS ACTIFS', value: String(i.actifs), detail: `${i.enRecette} en phase de recette` },
      { label: 'JALONS VALIDÉS', value: `${i.jalonsValides}/${i.jalonsTotal}`, detail: 'sur le portefeuille' },
      { label: 'PROCHAIN JALON', value: i.prochainJalon ? date(i.prochainJalon) : '—', detail: i.prochainJalonLibelle ?? 'aucun à venir' },
      { label: 'AVANCEMENT MOYEN', value: `${i.avancementMoyenPct} %`, detail: 'pondéré par lot' },
    ],
    sous: (i) => `${i.actifs} projet(s) actif(s) · ${i.jalonsValides}/${i.jalonsTotal} jalons validés`,
    fiche: (p) => ({
      id: p.id,
      objet: p.nom,
      attributs: [String(p.phase).toUpperCase(), p.echeance ? `ÉCHÉANCE ${date(p.echeance)}` : null].filter(Boolean),
      figure: `${p.avancement_pct} %`,
      statut: statut(p.statut),
      ton: ton(p.statut),
    }),
  },

  contrats: {
    libelle: 'Contrats & SLA',
    ressource: 'contrats',
    entete: 'CONTRAT · PÉRIMÈTRE · ÉCHÉANCE',
    kpis: (i) => [
      { label: 'CONTRATS ACTIFS', value: String(i.actifs), detail: `${i.aRenouveler} à renouveler` },
      { label: 'HEURES CONSOMMÉES', value: `${i.heuresConsommees}/${i.forfaitHeures}`, detail: 'forfait annuel' },
      {
        label: 'RESPECT DES SLA',
        value: i.sla.respectPct == null ? '—' : `${i.sla.respectPct} %`,
        // Le taux annonce son assiette : « 100 % » sans dire sur quoi ne veut
        // rien dire, et « — » est plus honnête qu'un chiffre inventé.
        detail: i.sla.mesures === 0 ? 'aucune mesure sur la période' : `sur ${i.sla.mesures} ticket(s) rattaché(s)`,
      },
      { label: 'PROCHAINE ÉCHÉANCE', value: i.prochaineEcheance ? date(i.prochaineEcheance) : '—', detail: 'renouvellement' },
    ],
    sous: (i) => `${i.actifs} contrat(s) actif(s) · ${i.heuresConsommees}/${i.forfaitHeures} h consommées`,
    fiche: (c) => ({
      id: c.id,
      reference: c.reference,
      objet: c.intitule,
      attributs: [c.perimetre?.toUpperCase(), c.echeance ? `ÉCHÉANCE ${date(c.echeance)}` : null].filter(Boolean),
      figure: c.gti_heures != null ? `${c.gti_heures} h / ${c.gtr_heures} h` : null,
      statut: statut(c.statut),
      ton: ton(c.statut),
    }),
  },

  documents: {
    libelle: 'Documents & livrables',
    ressource: 'documents',
    entete: 'DOCUMENT · TYPE · VERSION · DATE',
    kpis: (i) => [
      { label: 'DOCUMENTS', value: String(i.total), detail: 'tous périmètres' },
      { label: 'RAPPORTS D’INTERVENTION', value: String(i.rapports), detail: 'déposés' },
      { label: 'LIVRABLES VALIDÉS', value: String(i.livrablesValides), detail: 'contradictoirement' },
      { label: 'DERNIER DÉPÔT', value: i.dernierDepot ? date(i.dernierDepot) : '—', detail: i.dernierDepotNom ?? '—' },
    ],
    sous: (i) => `${i.total} document(s) · dernier dépôt ${i.dernierDepot ? date(i.dernierDepot) : '—'}`,
    fiche: (d) => ({
      id: d.id,
      objet: d.nom,
      attributs: [
        String(d.type).replaceAll('_', ' ').toUpperCase(),
        d.version ? `VERSION ${d.version}` : null,
        d.depose_le ? date(d.depose_le) : null,
      ].filter(Boolean),
      statut: statut(d.statut),
      ton: ton(d.statut),
      telechargeable: Boolean(d.version),
    }),
  },

  parc: {
    libelle: 'Parc matériel',
    ressource: 'parc',
    entete: 'ÉQUIPEMENT · SITE · MISE EN SERVICE',
    kpis: (i) => [
      { label: 'ÉQUIPEMENTS SUIVIS', value: String(i.suivis), detail: `sur ${i.sitesCouverts} site(s)` },
      {
        label: 'SOUS GARANTIE',
        value: String(i.sousGarantie),
        detail: i.sousGarantiePct == null ? 'parc vide' : `soit ${i.sousGarantiePct} % du parc`,
      },
      { label: 'FIN DE GARANTIE < 6 MOIS', value: String(i.garantieBientotEchue), detail: 'à arbitrer' },
      { label: 'À RENOUVELER', value: String(i.aRenouveler), detail: 'garantie expirée' },
    ],
    sous: (i) => `${i.suivis} équipement(s) · ${i.garantieBientotEchue} fin(s) de garantie sous 6 mois`,
    fiche: (e) => ({
      id: e.id,
      objet: e.quantite > 1 ? `${e.designation} (${e.quantite} unités)` : e.designation,
      attributs: [e.site?.toUpperCase(), e.mise_en_service ? `EN SERVICE ${mois(e.mise_en_service)}` : null].filter(Boolean),
      figure: e.fin_garantie ? (e.garantie_expiree ? 'EXPIRÉE' : mois(e.fin_garantie)) : null,
      statut: statut(e.statut),
      ton: ton(e.statut),
    }),
  },

  finances: {
    libelle: 'Factures & devis',
    ressource: 'finances',
    entete: 'RÉFÉRENCE · OBJET · ÉCHÉANCE',
    kpis: (i) => [
      { label: 'PIÈCES DE L’EXERCICE', value: String(i.piecesExercice), detail: 'devis et factures' },
      { label: 'EN ATTENTE', value: String(i.enAttente), detail: fcfa(i.enAttenteFcfa) ?? '—' },
      { label: 'EN RETARD', value: String(i.enRetard), detail: 'échéance dépassée' },
      { label: 'DEVIS À VALIDER', value: String(i.devisAValider), detail: 'de votre côté' },
    ],
    sous: (i) => `${i.piecesExercice} pièce(s) · ${i.enAttente} en attente de règlement`,
    fiche: (p) => ({
      id: p.id,
      reference: p.reference,
      objet: p.objet,
      attributs: [p.echeance ? `ÉCHÉANCE ${date(p.echeance)}` : null, p.projet?.toUpperCase()].filter(Boolean),
      figure: fcfa(p.montant_fcfa),
      statut: statut(p.statut),
      ton: ton(p.statut),
    }),
  },
};

export const CLES = Object.keys(MODULES);
