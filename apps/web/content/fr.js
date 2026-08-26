/**
 * Contenu éditorial du site public, en français.
 *
 * PROVENANCE ET STATUT
 * Amorcé mécaniquement depuis design/reference/site.dc.html par
 * tools/extract-content.mjs — les chaînes n'ont jamais été recopiées à la
 * main, ce qui écarte les fautes invisibles dans les noms propres et les
 * références contractuelles. Depuis cette extraction, CE FICHIER EST LA
 * SOURCE : le contenu se corrige ici, se relit en revue et suit l'historique
 * Git. Relancer l'extracteur écraserait ces corrections, il refuse donc
 * d'écrire sans --force.
 *
 * La version anglaise n'existe pas encore. Les routes /[locale]/ sont en place
 * et un content/en.js viendra s'y brancher sans toucher au rendu.
 */

export const site = {
  nom: '5/Sync IT',
  baseline: "Ingénierie des systèmes d'information, transformation numérique et des infrastructures. Un partenaire pour transformer durablement les organisations africaines.",
  formeJuridique: 'SUARL de droit sénégalais, active depuis 2016',
  adresse: "Almadies 2, Résidence El Hadji Oumar Dieng, 4e étage A — Dakar, Sénégal",
  telephone: "+221 33 805 79 09 · +221 76 881 30 39",
  email: "contact@5sursync.com",
  url: "https://5sursync.com",
  pays: "SÉNÉGAL · GUINÉE · R.D. CONGO · CÔTE D'IVOIRE",
  coordonnees: [
    {
      "k": "ADRESSE",
      "v": "Almadies 2, Résidence El Hadji Oumar Dieng, 4e étage A — Dakar, Sénégal"
    },
    {
      "k": "TÉLÉPHONE",
      "v": "+221 33 805 79 09 · +221 76 881 30 39"
    },
    {
      "k": "E-MAIL",
      "v": "contact@5sursync.com"
    },
    {
      "k": "SITE",
      "v": "https://5sursync.com"
    }
  ],
};

/** L'ordre fait la navigation, en en-tête comme en pied de page. */
export const navigation = [
  { slug: '', libelle: 'Accueil' },
  { slug: 'expertises', libelle: 'Expertises' },
  { slug: 'references', libelle: 'Références' },
  { slug: 'solutions', libelle: 'Solutions' },
  { slug: 'a-propos', libelle: 'À propos' },
  { slug: 'contact', libelle: 'Contact' },
];

export const accueil = {
  hero: {
    surTitre: "DAKAR, SÉNÉGAL — ACTIVITÉ DEPUIS 2016",
    // Le dernier segment est mis en italique doré dans la maquette.
    titre: ['Concevoir. Intégrer.', 'Sécuriser.'],
    titreAccent: 'Faire évoluer.',
    chapo: "Ingénierie des systèmes d'information, transformation numérique et des infrastructures. Un partenaire pour transformer durablement les organisations africaines.",
    stats: [
    {
      "n": "2016",
      "l": "Année de création, sans interruption"
    },
    {
      "n": "8",
      "l": "Collaborateurs en ingénierie"
    },
    {
      "n": "4",
      "l": "Pays d’intervention"
    },
    {
      "n": "6",
      "l": "Domaines d’expertise"
    }
  ],
  },
  promesse: {
    surTitre: "NOTRE PROMESSE",
    titre: "Transformer les ambitions numériques en systèmes fiables, sécurisés et exploitables.",
    chapo: "La technologie n'est jamais une fin en soi. Chaque choix doit répondre à un besoin opérationnel, être exploitable localement et produire une valeur mesurable.",
    volets: [
    {
      "n": "01",
      "t": "Conseil et architecture",
      "d": "Audit de l'existant, schéma directeur, architecture cible et feuille de route budgétée."
    },
    {
      "n": "02",
      "t": "Intégration et déploiement",
      "d": "Réseaux, serveurs, cloud, sécurité, applications métier : une seule équipe responsable du résultat."
    },
    {
      "n": "03",
      "t": "Exploitation et support",
      "d": "Supervision, maintenance, formation et transfert de compétences aux équipes du client."
    }
  ],
  },
  expertises: {
    surTitre: "NOS DOMAINES D'EXPERTISE",
    titre: "Six pôles, une seule chaîne de responsabilité",
    items: [
    {
      "n": "01",
      "t": "Conseil, audit & transformation",
      "d": "Audit SI et réseau, schéma directeur, architecture cible, AMOA, gouvernance et conduite du changement."
    },
    {
      "n": "02",
      "t": "Réseaux, connectivité & télécoms",
      "d": "LAN/WAN, Wi-Fi professionnel et public, fibre, liaisons radio, interconnexion multisite, téléphonie IP."
    },
    {
      "n": "03",
      "t": "Infrastructures, cloud & continuité",
      "d": "Serveurs, stockage NAS/SAN, virtualisation, sauvegarde, cloud privé, haute disponibilité, PRA/PCA."
    },
    {
      "n": "04",
      "t": "Cybersécurité & protection des données",
      "d": "Segmentation, pare-feu, contrôle des accès, VPN, durcissement, politiques de sécurité et reprise après incident."
    },
    {
      "n": "05",
      "t": "Applications métier, ERP & GED",
      "d": "Portails, applications web et mobiles, workflows, ERP, GED, signature électronique, API et reporting."
    },
    {
      "n": "06",
      "t": "Archives numériques & audiovisuel",
      "d": "Numérisation, restauration, métadonnées, MAM/DAM, stockage LTO, infrastructures broadcast et playout."
    }
  ],
  },
  methode: {
    surTitre: "NOTRE MÉTHODE DE DELIVERY",
    titre: "Une trajectoire en sept étapes, du diagnostic à l'évolution",
    chapo: "Gouvernance de projet, documentation, recette contradictoire et transfert de compétences sont inclus dans chaque mission.",
    etapes: [
    {
      "n": "1",
      "t": "Comprendre",
      "d": "Enjeux, métiers, contraintes"
    },
    {
      "n": "2",
      "t": "Auditer",
      "d": "Existant, risques, dépendances"
    },
    {
      "n": "3",
      "t": "Concevoir",
      "d": "Architecture et trajectoire"
    },
    {
      "n": "4",
      "t": "Déployer",
      "d": "Intégration progressive"
    },
    {
      "n": "5",
      "t": "Sécuriser",
      "d": "Accès, données, continuité"
    },
    {
      "n": "6",
      "t": "Transférer",
      "d": "Documentation et formation"
    },
    {
      "n": "7",
      "t": "Exploiter",
      "d": "Support et amélioration"
    }
  ],
    couches: [
    "Réseau",
    "Cloud & systèmes",
    "Applications",
    "Données",
    "Cybersécurité",
    "Audiovisuel"
  ],
  },
  cas: {
    surTitre: "CAS CLIENTS",
    titre: "Trois missions, trois natures de contrainte",
    items: [
    {
      "pays": "SÉNÉGAL — COLLECTIVITÉ",
      "client": "Ville de Dakar",
      "resume": "Interconnexion de sites municipaux, couverture Wi-Fi, téléphonie IP, architecture VPS et digitalisation des procédures métier.",
      "statut": "MISSION ET ACCOMPAGNEMENT ACTIFS",
      "photo": "PHOTO — SITE MUNICIPAL / SALLE TECHNIQUE"
    },
    {
      "pays": "GUINÉE — MÉDIA PUBLIC",
      "client": "Institut National de l'Audiovisuel",
      "resume": "Numérisation et restauration des archives, métadonnées, stockage LTO, MAM/DAM ResourceSpace, GED, ERP et formation.",
      "statut": "PROJETS STRUCTURANTS, LOTS EN COURS",
      "photo": "PHOTO — ATELIER DE NUMÉRISATION"
    },
    {
      "pays": "GUINÉE — BROADCAST",
      "client": "Radio Télévision Guinéenne",
      "resume": "Convergence IT, réseau IP et broadcast : virtualisation VMware, architecture UniFi, écosystème Blackmagic, playout.",
      "statut": "AUDIT, MODERNISATION ET FORMATION",
      "photo": "PHOTO — RÉGIE / PLAYOUT"
    }
  ],
  },
  references: {
    surTitre: "ILS NOUS FONT CONFIANCE",
    titre: "Des références publiques et privées, qualifiées une par une",
    chapo: "Chaque référence est présentée avec son statut réel : mission exécutée, projet en cours, audit ou réalisation publiée. Aucune proposition commerciale n'est présentée comme un marché exécuté.",
    items: [
    {
      "nom": "Ville de Dakar",
      "type": "SÉNÉGAL — COLLECTIVITÉ",
      "statut": "Mission / accompagnement"
    },
    {
      "nom": "Institut National de l'Audiovisuel",
      "type": "GUINÉE — MÉDIA PUBLIC",
      "statut": "Projets structurants"
    },
    {
      "nom": "Radio Télévision Guinéenne",
      "type": "GUINÉE — BROADCAST",
      "statut": "Audit et modernisation"
    },
    {
      "nom": "ANAPI / GUCE",
      "type": "RDC — AGENCE PUBLIQUE",
      "statut": "Mission d’audit SI"
    },
    {
      "nom": "Ministère de l'Information et de la Communication",
      "type": "GUINÉE — ADMINISTRATION",
      "statut": "Étude / optimisation"
    },
    {
      "nom": "Port Autonome de Dakar",
      "type": "SÉNÉGAL — INFRASTRUCTURE",
      "statut": "Référence réseau"
    },
    {
      "nom": "Centre des Expositions de Diamniadio",
      "type": "SÉNÉGAL — ÉVÉNEMENTIEL",
      "statut": "Réalisation publiée"
    },
    {
      "nom": "Wi-Fi public de Kouté",
      "type": "CÔTE D'IVOIRE — TERRITOIRE",
      "statut": "Projet de connectivité"
    },
    {
      "nom": "L'Harmattan Sénégal",
      "type": "SÉNÉGAL — ÉDITION",
      "statut": "Projet métier et support"
    },
    {
      "nom": "CPFA Dakar",
      "type": "SÉNÉGAL — FORMATION",
      "statut": "Projet web"
    }
  ],
  },
  empreinte: {
    surTitre: "NOTRE EMPREINTE RÉGIONALE",
    titre: "Quatre pays, des missions documentées",
    chapo: "Seuls les pays dans lesquels des missions ou réalisations sont documentées figurent ici.",
    pays: [
    {
      "nom": "Sénégal",
      "k": "RÉFÉRENCES OPÉRATIONNELLES",
      "d": "Ville de Dakar · Port Autonome de Dakar · Centre des Expositions de Diamniadio · L'Harmattan · CPFA"
    },
    {
      "nom": "Guinée",
      "k": "MISSIONS ET PROJETS STRUCTURANTS",
      "d": "Institut National de l'Audiovisuel · Radio Télévision Guinéenne · Ministère de l'Information et de la Communication"
    },
    {
      "nom": "Côte d'Ivoire",
      "k": "CONNECTIVITÉ PUBLIQUE",
      "d": "Wi-Fi public de Kouté : couverture, supervision et gestion des accès"
    },
    {
      "nom": "R.D. Congo",
      "k": "MISSION D'AUDIT",
      "d": "ANAPI / GUCE : audit du système d'information et recommandations de modernisation"
    }
  ],
  },
  smartqueue: {
    surTitre: "SOLUTION DÉVELOPPÉE PAR 5/SYNC IT",
    titre: "SmartQueue — digitaliser l'accueil et supprimer la file physique",
    chapo: "Une solution conçue par nos équipes à partir d'un constat simple : dans la plupart des administrations et agences, l'attente n'est pas un problème de personnel, mais un problème d'information et d'organisation des flux.",
    volets: [
    {
      "t": "Prise de ticket à distance",
      "d": "L'usager prend son rang depuis son téléphone, sans se déplacer trop tôt."
    },
    {
      "t": "Suivi et notifications",
      "d": "Position en temps réel, estimation de l'attente, alerte avant le passage."
    },
    {
      "t": "Interfaces usager et agent",
      "d": "Application mobile et web côté usager, pilotage des guichets côté organisation."
    },
    {
      "t": "Pensée pour nos réseaux",
      "d": "Conception adaptée aux connexions mobiles et aux débits réellement disponibles."
    }
  ],
  },
  appel: {
    titre: "Construisons votre prochaine infrastructure ou plateforme numérique.",
    chapo: "Audit, schéma directeur, architecture, déploiement, sécurisation, support : parlons de votre prochain projet structurant.",
  },
};

export const expertises = {
  titre: "Six pôles, une seule chaîne de responsabilité",
  poles: [
    {
      "n": "01",
      "t": "Conseil, audit & transformation",
      "d": "Audit SI et réseau, schéma directeur, architecture cible, AMOA, gouvernance et conduite du changement. Nous partons de l'existant réel — équipements, contrats, compétences — pour produire une trajectoire budgétée et tenable.",
      "tags": [
        "Audit SI",
        "Schéma directeur",
        "AMOA",
        "Gouvernance"
      ]
    },
    {
      "n": "02",
      "t": "Réseaux, connectivité & télécoms",
      "d": "LAN/WAN, Wi-Fi professionnel et public, fibre, liaisons radio, interconnexion multisite, téléphonie IP. Des architectures dimensionnées pour des sites étendus, denses ou difficiles à couvrir.",
      "tags": [
        "LAN/WAN",
        "Wi-Fi",
        "Fibre & radio",
        "Téléphonie IP",
        "UniFi"
      ]
    },
    {
      "n": "03",
      "t": "Infrastructures, cloud & continuité",
      "d": "Serveurs, stockage NAS/SAN, virtualisation, sauvegarde, cloud privé, haute disponibilité, PRA/PCA. Des restaurations testées, pas seulement planifiées.",
      "tags": [
        "VMware",
        "Proxmox",
        "NAS/SAN",
        "Veeam",
        "PRA/PCA"
      ]
    },
    {
      "n": "04",
      "t": "Cybersécurité & protection des données",
      "d": "Segmentation, pare-feu, contrôle des accès, VPN, durcissement, politiques de sécurité et reprise après incident. Aucune promesse absolue : nous réduisons des risques et documentons ce qui reste à couvrir.",
      "tags": [
        "Fortinet",
        "Palo Alto",
        "Wallix",
        "VPN",
        "Segmentation"
      ]
    },
    {
      "n": "05",
      "t": "Applications métier, ERP & GED",
      "d": "Portails, applications web et mobiles, workflows, ERP, GED, signature électronique, API et reporting. L'intégration avec l'existant comptable et métier fait partie du périmètre.",
      "tags": [
        "Odoo",
        "Dolibarr",
        "Alfresco",
        "Microsoft 365",
        "API"
      ]
    },
    {
      "n": "06",
      "t": "Archives numériques & audiovisuel",
      "d": "Numérisation, restauration, métadonnées, MAM/DAM, stockage LTO, infrastructures broadcast et playout. Le contenu cesse d'être un stock fragile pour devenir une ressource consultable et exploitable.",
      "tags": [
        "ResourceSpace",
        "LTO",
        "Blackmagic",
        "Playout",
        "Métadonnées"
      ]
    }
  ],
  contraintes: {
    surTitre: "LE CONTEXTE DE NOS CLIENTS",
    titre: "Six contraintes qui bloquent la modernisation",
    chapo: "5/Sync IT transforme ces contraintes en architecture, en feuille de route et en solutions opérationnelles — étape par étape, sans rupture de service.",
    items: [
    {
      "t": "Infrastructures vieillissantes",
      "d": "Équipements en fin de vie, pannes répétées, dépendance à des configurations non documentées."
    },
    {
      "t": "Silos applicatifs",
      "d": "Des outils qui ne se parlent pas, des données ressaisies, des décisions prises sans vision consolidée."
    },
    {
      "t": "Vulnérabilités cyber",
      "d": "Accès non maîtrisés, réseaux plats, sauvegardes incomplètes ou jamais testées."
    },
    {
      "t": "Interopérabilité limitée",
      "d": "Absence d'API, formats propriétaires, impossibilité d'échanger entre services ou institutions."
    },
    {
      "t": "Processus manuels",
      "d": "Circuits papier, validations informelles, délais de traitement subis par les usagers."
    },
    {
      "t": "Coût et complexité d'exploitation",
      "d": "Licences surdimensionnées, compétences non transférées, dépendance forte à un prestataire."
    }
  ],
  },
  stack: {
    surTitre: "ÉCOSYSTÈME TECHNOLOGIQUE",
    titre: "Des technologies choisies pour le besoin, pas pour le catalogue",
    // Mention nécessaire : citer une marque n'est pas s'en revendiquer partenaire.
    chapo: "Les marques citées sont des technologies utilisées, intégrées ou étudiées sur nos projets. Elles ne valent pas déclaration de partenariat, de certification ou d'agrément.",
    familles: [
    {
      "t": "Réseau & sécurité",
      "items": [
        "Ubiquiti UniFi",
        "Fortinet",
        "Palo Alto",
        "Wallix",
        "VPN & segmentation"
      ]
    },
    {
      "t": "Systèmes & virtualisation",
      "items": [
        "VMware",
        "Proxmox",
        "Windows Server",
        "Linux"
      ]
    },
    {
      "t": "Stockage & sauvegarde",
      "items": [
        "Synology",
        "NAS / SAN",
        "Veeam",
        "Proxmox Backup Server",
        "Archivage LTO"
      ]
    },
    {
      "t": "Applications & collaboration",
      "items": [
        "Microsoft 365",
        "SharePoint",
        "Odoo",
        "Dolibarr",
        "Alfresco",
        "ResourceSpace"
      ]
    },
    {
      "t": "Audiovisuel & archives",
      "items": [
        "Blackmagic Design",
        "Chaînes SDI",
        "Playout",
        "GrayMeta / SAMMA (études)"
      ]
    }
  ],
  },
};

export const references = {
  titre: "Des missions documentées, présentées avec leur statut réel",
  chapo: "Mission exécutée, projet en cours, audit ou réalisation publiée : chaque référence est qualifiée. Aucune proposition commerciale n'est présentée comme un marché exécuté.",
  etiquettes: {
    intervention: "NOTRE INTERVENTION",
    valeur: "VALEUR CRÉÉE",
  },
  cas: [
    {
      "pays": "SÉNÉGAL — VILLE DE DAKAR",
      "titre": "Connecter et moderniser les services d'une collectivité multisite",
      "contexte": "Des sites municipaux dispersés, des réseaux hétérogènes et des procédures encore largement manuelles pour les agents comme pour les usagers.",
      "photo": "PHOTO — SITE MUNICIPAL / SALLE TECHNIQUE",
      "lots": [
        {
          "n": "01",
          "t": "Architecture et interconnexion de sites"
        },
        {
          "n": "02",
          "t": "Couverture Wi-Fi et téléphonie IP"
        },
        {
          "n": "03",
          "t": "Architecture VPS pour les applications institutionnelles"
        },
        {
          "n": "04",
          "t": "Support technique de niveau 2"
        },
        {
          "n": "05",
          "t": "Accompagnement à la digitalisation des procédures métier"
        }
      ],
      "valeur": "Des services numériques municipaux accessibles depuis plusieurs sites, une exploitation documentée et une trajectoire de modernisation étalée dans le temps.",
      "statut": "MISSION ET ACCOMPAGNEMENT ACTIFS. LE PÉRIMÈTRE EXACT DES LOTS EXÉCUTÉS PEUT ÊTRE DÉTAILLÉ SUR DEMANDE."
    },
    {
      "pays": "GUINÉE — INSTITUT NATIONAL DE L'AUDIOVISUEL",
      "titre": "Préserver un patrimoine audiovisuel tout en modernisant le système d'information",
      "contexte": "Acquisition multi-formats, restauration et contrôle qualité, métadonnées, stockage en ligne et archivage LTO, MAM/DAM, valorisation : six maillons d'une même chaîne, à concevoir ensemble.",
      "photo": "PHOTO — ATELIER DE NUMÉRISATION / BANDES LTO",
      "lots": [
        {
          "n": "01",
          "t": "Site web et portails de valorisation"
        },
        {
          "n": "02",
          "t": "Numérisation et restauration des archives"
        },
        {
          "n": "03",
          "t": "Étude des chaînes d'acquisition, stockage et archivage"
        },
        {
          "n": "04",
          "t": "MAM/DAM ResourceSpace — recherche et gestion des médias"
        },
        {
          "n": "05",
          "t": "Infrastructures serveur, virtualisation et sauvegarde"
        },
        {
          "n": "06",
          "t": "GED, ERP, signature électronique et formation des équipes"
        }
      ],
      "valeur": "Le contenu cesse d'être un stock fragile pour devenir une ressource consultable, protégée et exploitable — infrastructure, données, métadonnées, sécurité et valorisation pensées ensemble.",
      "statut": "MISSIONS ET PROJETS STRUCTURANTS, CERTAINS LOTS EN COURS."
    },
    {
      "pays": "GUINÉE — RADIO TÉLÉVISION GUINÉENNE",
      "titre": "Faire converger IT, réseau et broadcast dans une architecture modernisée",
      "contexte": "Une capacité rare à réunir infrastructure informatique, réseau IP et environnement de diffusion dans une même approche de modernisation.",
      "photo": "PHOTO — RÉGIE / CHAÎNE PLAYOUT",
      "lots": [
        {
          "n": "01",
          "t": "Serveurs, NAS, virtualisation VMware, stockage et redondance"
        },
        {
          "n": "02",
          "t": "Sauvegarde et continuité de service"
        },
        {
          "n": "03",
          "t": "Audit réseau et nodal, architecture UniFi, segmentation et supervision"
        },
        {
          "n": "04",
          "t": "Écosystème Blackmagic : routage, multiview, interfaces, chaînes SDI"
        },
        {
          "n": "05",
          "t": "Livrable « RTG Playout »"
        },
        {
          "n": "06",
          "t": "Formation des équipes — réseau, virtualisation et audiovisuel"
        }
      ],
      "valeur": "Une modernisation qui reste exploitable par la maison, sans dépendance permanente à un prestataire externe.",
      "statut": "MISSION D'AUDIT, PROJET DE MODERNISATION ET SESSIONS DE FORMATION."
    }
  ],
  reseaux: {
    surTitre: "RÉSEAUX & CONNECTIVITÉ",
    titre: "Du site critique au Wi-Fi public",
    chapo: "Une même compétence appliquée à trois contraintes : criticité opérationnelle, densité événementielle et accès public à grande échelle.",
    items: [
    {
      "pays": "SÉNÉGAL",
      "nom": "Port Autonome de Dakar",
      "d": "Couverture Wi-Fi et interconnexion fibre et radio sur un environnement opérationnel étendu, avec des zones techniques difficiles à couvrir.",
      "enjeu": "Concevoir des réseaux adaptés à des sites critiques et étendus."
    },
    {
      "pays": "SÉNÉGAL",
      "nom": "Centre des Expositions de Diamniadio",
      "d": "Interconnexion et couverture Wi-Fi d'environ 8 000 m² pour SENFOOD AGRITECH et DAKAR-EXPO : exposants, visiteurs, stands et zones techniques.",
      "enjeu": "Déployer rapidement une connectivité à forte densité en environnement événementiel."
    },
    {
      "pays": "CÔTE D'IVOIRE",
      "nom": "Wi-Fi public — Kouté",
      "d": "Réseau Wi-Fi public, couverture radio, supervision et plateforme de gestion, en articulation avec les opérateurs et partenaires télécoms.",
      "enjeu": "Des solutions de connectivité pensées pour les territoires et les usages communautaires."
    }
  ],
  },
  metier: {
    surTitre: "APPLICATIONS MÉTIER & DIGITALISATION",
    titre: "Remplacer les circuits papier par des processus numériques traçables",
    items: [
      { nom: "L'Harmattan Sénégal", resume: "Digitalisation des processus éditoriaux : extension Dolibarr sur mesure, gestion des contrats d'auteurs, workflows de validation, facturation, gestion documentaire et intégration de la signature électronique." },
      { nom: "CPFA Dakar", resume: "Présence numérique institutionnelle : site web, structuration des contenus, catalogue et bibliothèque, procédures d'abonnement, hébergement et maintenance selon périmètre contractuel." },
    ],
  },
};

export const solutions = {
  titre: "Des solutions nées de problèmes concrets du terrain",
  smartqueue: {
    surTitre: "SMARTQUEUE",
    titre: "SmartQueue — digitaliser l'accueil et supprimer la file physique",
    chapo: "Une solution conçue par nos équipes à partir d'un constat simple : dans la plupart des administrations et agences, l'attente n'est pas un problème de personnel, mais un problème d'information et d'organisation des flux.",
    volets: [
    {
      "t": "Prise de ticket à distance",
      "d": "L'usager prend son rang depuis son téléphone, sans se déplacer trop tôt."
    },
    {
      "t": "Suivi et notifications",
      "d": "Position en temps réel, estimation de l'attente, alerte avant le passage."
    },
    {
      "t": "Interfaces usager et agent",
      "d": "Application mobile et web côté usager, pilotage des guichets côté organisation."
    },
    {
      "t": "Pensée pour nos réseaux",
      "d": "Conception adaptée aux connexions mobiles et aux débits réellement disponibles."
    }
  ],
  },
  cgim: {
    surTitre: "CAPACITÉ D'INGÉNIERIE",
    titre: "C-GIM — plateforme ERP intégrée pour le BTP",
    chapo: "Marchés, chantiers, achats, RH, GED, parc matériel, finance, mobilité terrain et tableaux de bord. Architecture conçue par 5/Sync IT : elle illustre notre capacité de conception, non un déploiement livré.",
    modules: [
    "Marchés",
    "Chantiers",
    "Achats",
    "RH",
    "GED",
    "Parc matériel",
    "Finance",
    "Mobilité terrain",
    "Tableaux de bord"
  ],
    capacites: [
    {
      "t": "Portails & applications",
      "d": "Web et mobile, espaces usagers, back-offices métier"
    },
    {
      "t": "ERP & gestion",
      "d": "Odoo, Dolibarr, intégration avec l'existant comptable"
    },
    {
      "t": "GED & workflows",
      "d": "Alfresco, circuits de validation, signature électronique"
    },
    {
      "t": "Collaboration",
      "d": "Microsoft 365, SharePoint, rationalisation des licences"
    },
    {
      "t": "API & interopérabilité",
      "d": "Échanges entre services, référentiels partagés"
    },
    {
      "t": "Pilotage",
      "d": "Reporting, tableaux de bord, indicateurs de service"
    }
  ],
  },
};

export const aPropos = {
  titre: "Une société d'ingénierie africaine, structurée pour des projets critiques",
  paragraphes: [
    "Société de droit sénégalais (SUARL) basée aux Almadies, à Dakar, 5/Sync IT accompagne depuis 2016 des administrations, des agences publiques, des médias et des entreprises sur leurs infrastructures, leurs applications et leurs données.",
    "Nos équipes interviennent sur des environnements hétérogènes, multisites et contraints, où la continuité de service et la maîtrise des coûts comptent autant que la performance technique."
  ],
  // Cette phrase est un engagement, pas une formule : elle explique pourquoi
  // aucun chiffre d'affaires ni taux de satisfaction ne figure sur le site.
  reserve: "Chiffre d'affaires, volumes de projets et taux de satisfaction ne sont pas communiqués : seules les données vérifiables figurent ici.",
  stats: [
    {
      "n": "2016",
      "l": "Année de création, sans interruption"
    },
    {
      "n": "8",
      "l": "Collaborateurs en ingénierie"
    },
    {
      "n": "4",
      "l": "Pays d’intervention"
    },
    {
      "n": "6",
      "l": "Domaines d’expertise"
    }
  ],
  pourquoi: {
    surTitre: "POURQUOI 5/SYNC IT",
    titre: "Six raisons de nous confier un projet structurant",
    items: [
    {
      "n": "01",
      "t": "Une vision de bout en bout",
      "d": "Du réseau à l'application, de la donnée à l'exploitation : un seul interlocuteur responsable du résultat."
    },
    {
      "n": "02",
      "t": "Une expérience institutionnelle",
      "d": "Collectivités, médias publics, agences et organisations multisites — nous connaissons vos contraintes de procédure."
    },
    {
      "n": "03",
      "t": "Une ingénierie adaptée au terrain",
      "d": "Des architectures progressives, dimensionnées selon les contraintes techniques et budgétaires réelles."
    },
    {
      "n": "04",
      "t": "Une approche ouverte",
      "d": "Propriétaire ou open source, selon l'intérêt du client — interopérabilité et maîtrise du coût total de possession."
    },
    {
      "n": "05",
      "t": "Un accompagnement dans la durée",
      "d": "Formation, documentation, support et maintenance : nous restons après la mise en production."
    },
    {
      "n": "06",
      "t": "Une présence régionale",
      "d": "Des missions documentées au Sénégal, en Guinée, en RDC et en Côte d'Ivoire."
    }
  ],
  },
};

export const contact = {
  surTitre: 'CONTACT',
  titre: "Parlons de votre prochain projet structurant.",
  chapo: "Audit, schéma directeur, architecture, déploiement, sécurisation, support. Décrivez votre contexte, nous revenons vers vous sous 48 heures ouvrées.",
  besoins: [
    "Audit / schéma directeur",
    "Réseau & connectivité",
    "Infrastructure & cloud",
    "Cybersécurité",
    "Application métier / ERP",
    "Archives & audiovisuel"
  ],
  champs: {
    organisation: { libelle: 'ORGANISATION', exemple: 'Ministère, collectivité, entreprise…' },
    nom: { libelle: 'NOM', exemple: 'Prénom et nom' },
    email: { libelle: 'E-MAIL', exemple: 'nom@organisation.sn' },
    besoin: { libelle: 'NATURE DU BESOIN' },
    contexte: {
      libelle: 'CONTEXTE',
      exemple: 'Sites concernés, existant, échéance, contraintes budgétaires…',
    },
  },
  envoyer: 'Envoyer la demande',
};
