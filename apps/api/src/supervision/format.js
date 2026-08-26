import { releve } from './compteurs.js';

/**
 * Rend le relevé au format d'exposition Prometheus.
 *
 * POURQUOI « cinqsync_ » ET NON « 5sync_ »
 * Un nom de métrique Prometheus doit correspondre à [a-zA-Z_:][a-zA-Z0-9_:]* :
 * il ne peut pas commencer par un chiffre. « 5sync_base_disponible » se lit
 * dans une expression PromQL comme le nombre 5 suivi de charabia, et promtool
 * refuse les règles d'alerte qui l'emploient. C'est promtool qui l'a signalé,
 * pas nous : d'où l'intérêt de faire valider les règles plutôt que de les
 * écrire et d'espérer.
 *
 * POURQUOI CE FORMAT PLUTÔT QU'UN JSON MAISON
 * Le lot 5 laissait la supervision « à décider selon ce que vous exploitez
 * déjà ». Le format Prometheus est la réponse qui n'oblige à rien : il se
 * scrute avec Prometheus, mais aussi avec Grafana Agent, Datadog, Vector,
 * Netdata, Zabbix et telegraf. Un JSON de notre invention aurait obligé à
 * écrire un adaptateur avant la première courbe.
 *
 * UNE VALEUR ABSENTE N'EST PAS ZÉRO. Quand il n'existe aucune sauvegarde, la
 * série `cinqsync_sauvegarde_age_secondes` n'est pas émise plutôt que d'être
 * émise à 0. Zéro voudrait dire « sauvegarde d'il y a une seconde » — soit
 * exactement l'inverse de la vérité, et l'alerte ne partirait jamais.
 */

const echapper = (v) =>
  String(v).replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');

function serie(nom, etiquettes, valeur) {
  const paires = Object.entries(etiquettes ?? {})
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}="${echapper(v)}"`);
  return `${nom}${paires.length ? `{${paires.join(',')}}` : ''} ${valeur}`;
}

export function formater(donnees) {
  const lignes = [];
  const bloc = (nom, aide, type, valeurs) => {
    if (valeurs.length === 0) return;
    lignes.push(`# HELP ${nom} ${aide}`, `# TYPE ${nom} ${type}`, ...valeurs);
  };

  bloc('cinqsync_base_disponible', 'La base répond (1) ou non (0).', 'gauge', [
    serie('cinqsync_base_disponible', null, donnees.baseDisponible),
  ]);

  bloc('cinqsync_service_info', 'Informations statiques du service.', 'gauge', [
    serie('cinqsync_service_info', { env: donnees.env }, 1),
  ]);

  // ── Sauvegarde ─────────────────────────────────────────────────────────
  bloc(
    'cinqsync_sauvegarde_age_secondes',
    "Âge de la dernière sauvegarde, d'après l'horodatage de son manifeste.",
    'gauge',
    donnees.sauvegarde.ageSecondes === null
      ? []
      : [serie('cinqsync_sauvegarde_age_secondes', null, donnees.sauvegarde.ageSecondes)],
  );

  bloc(
    'cinqsync_sauvegarde_authentifiee',
    'La dernière sauvegarde est chiffrée de façon authentifiée (1) ou non (0).',
    'gauge',
    donnees.sauvegarde.presente
      ? [
          serie(
            'cinqsync_sauvegarde_authentifiee',
            { methode: donnees.sauvegarde.methode },
            donnees.sauvegarde.authentifiee ? 1 : 0,
          ),
        ]
      : [],
  );

  bloc(
    'cinqsync_restauration_exercice_age_secondes',
    'Âge du dernier exercice de restauration RÉUSSI.',
    'gauge',
    donnees.ageExercice === null
      ? []
      : [serie('cinqsync_restauration_exercice_age_secondes', null, donnees.ageExercice)],
  );

  bloc(
    'cinqsync_hors_site_age_secondes',
    'Âge du dernier dépôt hors site vérifié par relecture.',
    'gauge',
    donnees.ageHorsSite === null
      ? []
      : [serie('cinqsync_hors_site_age_secondes', null, donnees.ageHorsSite)],
  );

  // ── Métier ─────────────────────────────────────────────────────────────
  if (donnees.base) {
    const b = donnees.base;
    const jauge = (nom, aide, valeur) => bloc(nom, aide, 'gauge', [serie(nom, null, valeur)]);
    jauge('cinqsync_organisations', 'Organisations clientes non closes.', b.organisations);
    jauge('cinqsync_comptes_actifs', 'Comptes utilisateurs actifs.', b.comptes);
    jauge('cinqsync_sessions_actives', 'Sessions ouvertes et non expirées.', b.sessions);
    jauge('cinqsync_tickets_ouverts', 'Tickets ni résolus ni clos.', b.ticketsOuverts);
    jauge('cinqsync_tickets_prioritaires', 'Tickets ouverts marqués prioritaires.', b.ticketsPrioritaires);
    jauge('cinqsync_interventions_rapport_a_deposer', 'Interventions dont le rapport manque.', b.rapportsADeposer);
    jauge('cinqsync_leads_en_attente', 'Demandes de contact non traitées.', b.leadsEnAttente);
    jauge(
      'cinqsync_connexions_echouees_fenetre',
      "Échecs de connexion dans la fenêtre d'observation de la limitation.",
      b.echecsConnexion,
    );
  }

  // ── Trafic ─────────────────────────────────────────────────────────────
  const { compteurs, durees } = releve();
  const parNom = new Map();
  for (const [k, v] of compteurs) {
    const nom = k.includes('{') ? k.slice(0, k.indexOf('{')) : k;
    if (!parNom.has(nom)) parNom.set(nom, []);
    parNom.get(nom).push(`${k} ${v}`);
  }

  bloc('cinqsync_requetes_total', 'Requêtes servies, par gabarit de route et code.', 'counter',
    parNom.get('cinqsync_requetes_total') ?? []);
  bloc('cinqsync_requetes_erreurs_total', 'Requêtes terminées en 5xx.', 'counter',
    parNom.get('cinqsync_requetes_erreurs_total') ?? []);

  // Un « summary » sans quantile : la somme et le nombre suffisent à tracer une
  // moyenne mobile, et les quantiles exacts coûteraient un histogramme complet
  // pour une précision dont personne n'a l'usage ici.
  //
  // LES SUFFIXES « _sum » ET « _count » NE SONT PAS TRADUITS, ET C'EST VOULU.
  // Tout le reste de ce projet est en français ; ces deux-là appartiennent au
  // protocole d'exposition, pas à nous. Les écrire « _somme » et « _nombre »
  // produit un fichier que promtool refuse — il y voit deux compteurs mal
  // nommés au lieu d'un summary — et qu'aucun collecteur n'interprète.
  const mesures = [];
  for (const [k, { somme, nombre }] of durees) {
    const nom = k.includes('{') ? k.slice(0, k.indexOf('{')) : k;
    const etiquettes = k.includes('{') ? k.slice(k.indexOf('{')) : '';
    mesures.push(`${nom}_sum${etiquettes} ${somme.toFixed(6)}`);
    mesures.push(`${nom}_count${etiquettes} ${nombre}`);
  }
  bloc(
    'cinqsync_requete_duree_secondes',
    'Temps de traitement des requêtes, par gabarit de route.',
    'summary',
    mesures,
  );

  // Le format exige une ligne vide finale.
  return `${lignes.join('\n')}\n`;
}
