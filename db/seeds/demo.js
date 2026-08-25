#!/usr/bin/env node
/**
 * Jeu de démonstration — données de la maquette Claude Design.
 *
 * ⚠  CES DONNÉES SONT FICTIVES MAIS NOMINATIVES. Elles attribuent des tickets,
 * des montants et des échéances à des organisations réelles — Ville de Dakar,
 * Institut National de l'Audiovisuel, Radio Télévision Guinéenne. Publiées, on
 * les prendrait pour des faits.
 *
 * Deux verrous, parce qu'un seul finit toujours par sauter :
 *   1. Le script refuse de s'exécuter si NODE_ENV vaut « production ».
 *   2. Chaque organisation créée porte est_demo = true, donc reste
 *      identifiable et supprimable même si le premier verrou a été contourné.
 */

import { getOwnerPool, closePools } from '../../apps/api/src/db/pool.js';
import { hacher } from '../../apps/api/src/auth/passwords.js';

if (process.env.NODE_ENV === 'production') {
  console.error(
    'Refus : ce jeu de démonstration attribue des données fictives à des organisations\n' +
      "réelles. Il n'a rien à faire en production.",
  );
  process.exit(1);
}

const MOT_DE_PASSE_DEMO = process.env.SEED_PASSWORD ?? 'demo-5sync-2026';

const ORGANISATIONS = [
  { nom: 'Ville de Dakar', pays: 'Sénégal', statut: 'actif' },
  { nom: "Institut National de l'Audiovisuel", pays: 'Guinée', statut: 'actif' },
  { nom: 'Radio Télévision Guinéenne', pays: 'Guinée', statut: 'actif' },
  { nom: 'Port Autonome de Dakar', pays: 'Sénégal', statut: 'actif' },
  { nom: 'ANAPI / GUCE', pays: 'R.D. Congo', statut: 'audit' },
  { nom: "L'Harmattan Sénégal", pays: 'Sénégal', statut: 'actif' },
  { nom: 'Wi-Fi public de Kouté', pays: "Côte d'Ivoire", statut: 'projet' },
];

const SITES_DAKAR = ['Hôtel de ville', 'Mairie annexe', 'Services techniques', 'Archives', 'Salle technique'];

const COMPTES_5SYNC = [
  { role: 'admin', email: 'admin@5sursync.com', nom: 'Papa Youssoupha Diop' },
  { role: 'staff', email: 'intervenant@5sursync.com', nom: 'Intervenant de démonstration' },
];

const TICKETS = [
  ['TCK-4471', 'Coupure liaison radio site annexe Plateau', 'Mairie annexe', 'n3', 'escalade', true, 40],
  ['TCK-4468', 'Lenteur applicative portail agents', 'Hôtel de ville', 'n2', 'en_cours', true, 95],
  ['TCK-4463', 'Téléphonie IP — 4 postes muets', 'Services techniques', 'n2', 'en_cours', false, 55],
  ['TCK-4459', 'Demande de compte VPN — 3 agents', 'Hôtel de ville', 'n1', 'votre_retour', false, 80],
  ['TCK-4452', 'Restauration fichier GED', 'Archives', 'n2', 'votre_retour', false, 120],
  ['TCK-4448', "Point d’accès Wi-Fi hors ligne — étage 3", 'Hôtel de ville', 'n1', 'planifie', false, 70],
];

const pool = getOwnerPool();
const client = await pool.connect();

try {
  await client.query('begin');

  // Idempotent : on repart d'une base de démonstration propre.
  //
  // Supprimer les organisations ne suffit pas. Les comptes du personnel 5/Sync
  // ont organisation_id NULL — c'est la contrainte users_org_selon_role qui
  // l'impose — donc aucune cascade ne les emporte. Sans cette seconde ligne,
  // relancer l'amorçage échoue sur une collision d'adresse e-mail.
  await client.query('delete from organisations where est_demo');
  await client.query('delete from users where organisation_id is null and email = any($1)', [
    COMPTES_5SYNC.map((c) => c.email),
  ]);

  const empreinte = await hacher(MOT_DE_PASSE_DEMO);
  const ids = new Map();

  for (const o of ORGANISATIONS) {
    const { rows } = await client.query(
      'insert into organisations (nom, pays, statut, est_demo) values ($1,$2,$3,true) returning id',
      [o.nom, o.pays, o.statut],
    );
    ids.set(o.nom, rows[0].id);
  }

  const dakar = ids.get('Ville de Dakar');
  const sites = new Map();
  for (const nom of SITES_DAKAR) {
    const { rows } = await client.query(
      'insert into sites (organisation_id, nom) values ($1,$2) returning id',
      [dakar, nom],
    );
    sites.set(nom, rows[0].id);
  }

  // Comptes 5/Sync : organisation_id NULL, la contrainte de la table l'impose.
  for (const c of COMPTES_5SYNC) {
    await client.query(
      `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
       values (null, $1, $2, $3, $4)`,
      [c.role, c.email, c.nom, empreinte],
    );
  }

  await client.query(
    `insert into users (organisation_id, role, email, nom, mot_de_passe_hash)
     values ($1, 'client_admin', 'dsi@villededakar.sn', 'Référent DSI', $2),
            ($1, 'client_user', 'agent@villededakar.sn', 'Agent municipal', $2),
            ($3, 'client_admin', 'dsi@ina.gn', 'Référent INA', $2)`,
    [dakar, empreinte, ids.get("Institut National de l'Audiovisuel")],
  );

  const { rows: [contrat] } = await client.query(
    `insert into contrats (organisation_id, reference, intitule, perimetre,
                           gti_heures, gtr_heures, forfait_heures, echeance, statut)
     values ($1,'CT-2024-07','Support technique N2','Réseau, postes, téléphonie',2,8,120,'2026-12-31','actif')
     returning id`,
    [dakar],
  );
  await client.query(
    `insert into contrat_heures (organisation_id, contrat_id, minutes, motif)
     values ($1,$2,$3,'Interventions cumulées 2026')`,
    [dakar, contrat.id, 74 * 60],
  );

  for (const [ref, objet, site, niveau, statut, prise, ilYaHeures] of TICKETS) {
    await client.query(
      `insert into tickets (organisation_id, reference, objet, site_id, niveau, statut,
                            priorite_haute, contrat_id, ouvert_le, pris_en_charge_le)
       values ($1,$2,$3,$4,$5,$6,$7,$8, now() - ($9 || ' hours')::interval,
               case when $10 then now() - ($9 || ' hours')::interval + interval '72 minutes' else null end)`,
      [dakar, ref, objet, sites.get(site), niveau, statut, niveau === 'n3', contrat.id, ilYaHeures, prise],
    );
  }

  const { rows: [projet] } = await client.query(
    `insert into projets (organisation_id, nom, phase, statut, echeance)
     values ($1, 'Interconnexion sites municipaux — lot 2', 'deploiement', 'en_cours', '2026-10-30')
     returning id`,
    [dakar],
  );
  await client.query(
    `insert into jalons (organisation_id, projet_id, libelle, echeance, valide_le, rang) values
       ($1,$2,'Étude et architecture','2026-03-31', now(), 1),
       ($1,$2,'Déploiement lot 2a','2026-07-31', now(), 2),
       ($1,$2,'Déploiement lot 2b','2026-10-30', null, 3)`,
    [dakar, projet.id],
  );

  await client.query(
    `insert into pieces (organisation_id, reference, type, objet, montant_fcfa, echeance, statut) values
       ($1,'FAC-2026-041','facture','Support N2 — 3e trimestre 2026',4850000,'2026-09-15','en_attente'),
       ($1,'DEV-2026-019','devis','Interconnexion sites — lot 3',18200000,'2026-09-30','a_valider'),
       ($1,'FAC-2026-036','facture','Support N2 — 2e trimestre 2026',4850000,'2026-07-12','reglee')`,
    [dakar],
  );

  await client.query(
    `insert into equipements (organisation_id, designation, site_id, quantite,
                              mise_en_service, fin_garantie, statut) values
       ($1,'Points d''accès UniFi',$2,12,'2025-05-01','2028-05-01','en_service'),
       ($1,'Pare-feu Fortinet — cœur de réseau',$3,1,'2024-03-01','2027-03-01','en_service'),
       ($1,'Serveur hôte VMware — nœud 1',$4,1,'2023-11-01', current_date + interval '4 months','en_service'),
       ($1,'NAS Synology — sauvegarde',$4,1,'2023-11-01', current_date + interval '4 months','en_service'),
       ($1,'Switch cœur 48 ports',$5,1,'2021-02-01', current_date - interval '3 months','a_renouveler')`,
    [dakar, sites.get('Mairie annexe'), sites.get('Hôtel de ville'),
     sites.get('Salle technique'), sites.get('Services techniques')],
  );

  const { rows: [schema] } = await client.query(
    `insert into documents (organisation_id, nom, type, statut, projet_id)
     values ($1,'Schéma directeur réseau — sites municipaux','livrable_projet','valide',$2)
     returning id`,
    [dakar, projet.id],
  );
  for (const v of [1, 2, 3]) {
    await client.query(
      `insert into document_versions (organisation_id, document_id, version, chemin,
                                      taille_octets, type_mime, empreinte_sha256)
       values ($1,$2,$3,$4,$5,'application/pdf', sha256($6::bytea))`,
      [dakar, schema.id, v, `/srv/documents/${schema.id}/v${v}.pdf`, 480_000 + v * 1024,
       Buffer.from(`schema-v${v}`)],
    );
  }

  const { rows: [rapport] } = await client.query(
    `insert into documents (organisation_id, nom, type, statut)
     values ($1,'Rapport d''intervention INT-2026-118','rapport_intervention','depose') returning id`,
    [dakar],
  );
  await client.query(
    `insert into document_versions (organisation_id, document_id, version, chemin,
                                    taille_octets, type_mime, empreinte_sha256)
     values ($1,$2,1,$3,214000,'application/pdf', sha256('rapport'::bytea))`,
    [dakar, rapport.id, `/srv/documents/${rapport.id}/v1.pdf`],
  );

  await client.query('commit');

  console.log(`Jeu de démonstration posé : ${ORGANISATIONS.length} organisations, 5 comptes.`);
  console.log(`Mot de passe commun : ${MOT_DE_PASSE_DEMO}`);
  console.log('Comptes : admin@5sursync.com · dsi@villededakar.sn · dsi@ina.gn');
} catch (erreur) {
  await client.query('rollback');
  console.error(`Échec de l'amorçage : ${erreur.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await closePools();
}
