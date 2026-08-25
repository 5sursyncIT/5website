import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

import { withTenant } from '../src/db/tenant.js';
import { getOwnerPool } from '../src/db/pool.js';
import * as depots from '../src/repositories/index.js';
import { baseDisponible, RAISON_SAUT, closePools } from './helpers.js';

/**
 * Deux organisations, chacune peuplée dans les six domaines, avec des volumes
 * DIFFÉRENTS. Des volumes identiques laisseraient passer une fuite : un
 * indicateur qui compte les deux organisations donnerait le double, ce qui se
 * voit ; mais un indicateur qui compte la mauvaise donnerait le même chiffre.
 */
async function jeuComplet() {
  const pool = getOwnerPool();
  const suffixe = `${process.pid}-${Date.now()}`;

  const org = async (nom) =>
    (
      await pool.query(
        'insert into organisations (nom, pays, est_demo) values ($1,$2,true) returning id',
        [`${nom} ${suffixe}`, 'Sénégal'],
      )
    ).rows[0].id;

  const a = await org('Dépôts A');
  const b = await org('Dépôts B');

  const site = async (o, nom) =>
    (await pool.query('insert into sites (organisation_id, nom) values ($1,$2) returning id', [o, nom]))
      .rows[0].id;

  const siteA1 = await site(a, 'Hôtel de ville');
  const siteA2 = await site(a, 'Mairie annexe');
  await site(b, 'Régie');

  // ── Contrat de A : GTI 2 h, GTR 8 h, forfait 120 h ──────────────────────
  const contratA = (
    await pool.query(
      `insert into contrats (organisation_id, reference, intitule, perimetre,
                             gti_heures, gtr_heures, forfait_heures, echeance, statut)
       values ($1,'CT-A','Support N2','Réseau',2,8,120,'2026-12-31','actif') returning id`,
      [a],
    )
  ).rows[0].id;
  await pool.query(
    'insert into contrat_heures (organisation_id, contrat_id, minutes) values ($1,$2,$3)',
    [a, contratA, 74 * 60],
  );
  await pool.query(
    `insert into contrats (organisation_id, reference, intitule, gti_heures, gtr_heures,
                           forfait_heures, echeance, statut)
     values ($1,'CT-B','Maintenance',4,24,60,'2026-09-30','a_renouveler')`,
    [b],
  );

  // ── Tickets de A : trois rattachés au contrat, un dépassement de GTI ────
  const ticket = (ref, heures, priseMinutes, resoluHeures, rattache) =>
    pool.query(
      `insert into tickets (organisation_id, reference, objet, site_id, contrat_id, statut,
                            ouvert_le, pris_en_charge_le, resolu_le)
       values ($1,$2,$3,$4,$5,$6,
               now() - ($7||' hours')::interval,
               now() - ($7||' hours')::interval + ($8||' minutes')::interval,
               case when $9::int is null then null
                    else now() - ($7||' hours')::interval + ($9||' hours')::interval end)`,
      [
        a,
        ref,
        `Objet ${ref}`,
        siteA1,
        rattache ? contratA : null,
        resoluHeures === null ? 'en_cours' : 'resolu',
        heures,
        priseMinutes,
        resoluHeures,
      ],
    );

  await ticket('TCK-A1', 100, 60, 4, true); // GTI 1 h ok, GTR 4 h ok
  await ticket('TCK-A2', 90, 90, 6, true); // GTI 1,5 h ok, GTR 6 h ok
  await ticket('TCK-A3', 80, 180, null, true); // GTI 3 h > 2 h : DÉPASSEMENT
  await ticket('TCK-A4', 70, 30, null, false); // hors périmètre SLA
  await pool.query(
    `insert into tickets (organisation_id, reference, objet) values ($1,'TCK-B1','Ticket de B')`,
    [b],
  );

  // ── Projets : A a 3 jalons dont 2 validés, pondérés 1/2/1 ───────────────
  const projetA = (
    await pool.query(
      `insert into projets (organisation_id, nom, phase, statut, echeance)
       values ($1,'Interconnexion lot 2','deploiement','en_cours','2026-10-30') returning id`,
      [a],
    )
  ).rows[0].id;
  await pool.query(
    `insert into jalons (organisation_id, projet_id, libelle, echeance, valide_le, poids, rang) values
       ($1,$2,'Étude','2026-03-31', now(), 1, 1),
       ($1,$2,'Lot 2a','2026-07-31', now(), 2, 2),
       ($1,$2,'Lot 2b', current_date + 20, null, 1, 3)`,
    [a, projetA],
  );
  const projetB = (
    await pool.query(
      "insert into projets (organisation_id, nom, statut) values ($1,'Playout','recette') returning id",
      [b],
    )
  ).rows[0].id;
  await pool.query(
    `insert into jalons (organisation_id, projet_id, libelle, valide_le, poids)
     values ($1,$2,'Recette', null, 1)`,
    [b, projetB],
  );

  // ── Parc : A = 12 + 1 + 1 = 14 unités, dont 12 sous garantie ───────────
  await pool.query(
    `insert into equipements (organisation_id, designation, site_id, quantite,
                              mise_en_service, fin_garantie, statut) values
       ($1,'Points d''accès UniFi',$2,12,'2025-05-01', current_date + interval '2 years','en_service'),
       ($1,'Switch cœur 48 ports',$3,1,'2021-02-01', current_date - interval '1 month','a_renouveler'),
       ($1,'Pare-feu Fortinet',$2,1,'2024-03-01', current_date + interval '3 months','en_service')`,
    [a, siteA1, siteA2],
  );
  await pool.query(
    `insert into equipements (organisation_id, designation, quantite, fin_garantie)
     values ($1,'Serveur playout',3, current_date + interval '1 year')`,
    [b],
  );

  // ── Documents : A a 2 documents, l'un en v3 ─────────────────────────────
  const doc = async (o, nom, type, statut) =>
    (
      await pool.query(
        'insert into documents (organisation_id, nom, type, statut) values ($1,$2,$3,$4) returning id',
        [o, nom, type, statut],
      )
    ).rows[0].id;

  const docA1 = await doc(a, 'Schéma directeur réseau', 'livrable_projet', 'valide');
  const docA2 = await doc(a, 'Rapport INT-2026-118', 'rapport_intervention', 'depose');
  await doc(b, 'PV de recette', 'recette', 'signe');

  for (const v of [1, 2, 3]) {
    await pool.query(
      `insert into document_versions (organisation_id, document_id, version, chemin,
                                      taille_octets, type_mime, empreinte_sha256)
       values ($1,$2,$3,$4,1024,'application/pdf', sha256($5::bytea))`,
      [a, docA1, v, `/srv/documents/${docA1}/v${v}.pdf`, Buffer.from(`v${v}`)],
    );
  }
  await pool.query(
    `insert into document_versions (organisation_id, document_id, version, chemin,
                                    taille_octets, type_mime, empreinte_sha256)
     values ($1,$2,1,$3,2048,'application/pdf', sha256('x'::bytea))`,
    [a, docA2, `/srv/documents/${docA2}/v1.pdf`],
  );

  // ── Pièces : A a 3 pièces, 1 en attente en retard, 1 devis à valider ────
  await pool.query(
    `insert into pieces (organisation_id, reference, type, objet, montant_fcfa,
                         echeance, statut, reglee_le) values
       ($1,'FAC-A-041','facture','Support N2 T3',4850000, current_date - 5,'en_attente',null),
       ($1,'DEV-A-019','devis','Interconnexion lot 3',18200000, current_date + 30,'a_valider',null),
       ($1,'FAC-A-036','facture','Support N2 T2',4850000, current_date - 40,'reglee', current_date - 38)`,
    [a],
  );
  await pool.query(
    `insert into pieces (organisation_id, reference, type, objet, montant_fcfa, statut)
     values ($1,'FAC-B-001','facture','Audit nodal',6750000,'en_attente')`,
    [b],
  );

  return {
    a,
    b,
    contratA,
    docA1,
    async nettoyer() {
      await pool.query('delete from organisations where id = any($1)', [[a, b]]);
    },
  };
}

describe('Dépôts métier', { skip: baseDisponible ? false : RAISON_SAUT }, () => {
  let jeu;
  const dansA = (fn) => withTenant({ organisationId: jeu.a }, fn);
  const dansB = (fn) => withTenant({ organisationId: jeu.b }, fn);

  before(async () => {
    jeu = await jeuComplet();
  });

  after(async () => {
    await jeu?.nettoyer();
    await closePools();
  });

  // ── Cloisonnement, domaine par domaine ─────────────────────────────────

  test('chaque dépôt ne liste que le périmètre courant', async () => {
    const listesA = await dansA(async (c) => ({
      tickets: await depots.tickets.lister(c),
      projets: await depots.projets.lister(c),
      contrats: await depots.contrats.lister(c),
      documents: await depots.documents.lister(c),
      parc: await depots.parc.lister(c),
      finances: await depots.finances.lister(c),
    }));

    assert.equal(listesA.tickets.length, 4);
    assert.equal(listesA.projets.length, 1);
    assert.equal(listesA.contrats.length, 1);
    assert.equal(listesA.documents.length, 2);
    assert.equal(listesA.parc.length, 3);
    assert.equal(listesA.finances.length, 3);

    for (const [domaine, lignes] of Object.entries(listesA)) {
      assert.ok(
        lignes.every((l) => !('organisation_id' in l) || l.organisation_id === jeu.a),
        `${domaine} a laissé passer une ligne hors périmètre`,
      );
    }
  });

  test('les vues jointes respectent aussi le cloisonnement', async () => {
    // projets et contrats passent par des vues SQL. Une vue s'exécute par
    // défaut avec les droits de son propriétaire et contourne alors RLS :
    // c'est le contournement le plus discret du dispositif.
    const projetsB = await dansB((c) => depots.projets.lister(c));
    const contratsB = await dansB((c) => depots.contrats.lister(c));

    assert.equal(projetsB.length, 1);
    assert.equal(projetsB[0].nom, 'Playout');
    assert.equal(contratsB.length, 1);
    assert.equal(contratsB[0].reference, 'CT-B');
  });

  test('lire par identifiant à travers le périmètre échoue partout', async () => {
    const pieceB = await dansB(async (c) => (await depots.finances.lister(c))[0]);
    const projetB = await dansB(async (c) => (await depots.projets.lister(c))[0]);

    const [piece, projet] = await dansA(async (c) => [
      await depots.finances.parId(c, pieceB.id),
      await depots.projets.parId(c, projetB.id),
    ]);

    assert.equal(piece, null);
    assert.equal(projet, null);
  });

  // ── Justesse des indicateurs ───────────────────────────────────────────

  test('projets — avancement pondéré par le poids des jalons, pas par leur nombre', async () => {
    const i = await dansA((c) => depots.projets.indicateurs(c));

    assert.equal(i.actifs, 1);
    assert.equal(i.jalonsValides, 2);
    assert.equal(i.jalonsTotal, 3);
    // Poids validés 1 + 2 = 3 sur 4 au total → 75 %, et non 2/3 = 67 %.
    assert.equal(i.avancementMoyenPct, 75);
    assert.ok(i.prochainJalon instanceof Date);
    assert.equal(i.prochainJalonLibelle, 'Lot 2b');
  });

  test('contrats — le respect des SLA dit sur quelle assiette il porte', async () => {
    const i = await dansA((c) => depots.contrats.indicateurs(c));

    assert.equal(i.actifs, 1);
    assert.equal(i.heuresConsommees, 74);
    assert.equal(i.forfaitHeures, 120);

    // Trois tickets rattachés, un seul dépasse la GTI de 2 h.
    assert.equal(i.sla.mesures, 3);
    assert.equal(i.sla.depassements, 1);
    assert.equal(i.sla.respectPct, 67);
    // Le quatrième ticket n'est rattaché à aucun contrat : il est annoncé,
    // pas silencieusement inclus dans le taux.
    assert.equal(i.sla.horsPerimetre, 1);
  });

  test('contrats — sans mesure, le taux est null et non 100 %', async () => {
    const i = await dansB((c) => depots.contrats.indicateurs(c));

    assert.equal(i.sla.mesures, 0);
    assert.equal(i.sla.respectPct, null, 'un taux inventé est pire qu’un taux absent');
  });

  test('parc — les indicateurs comptent des unités, pas des lignes', async () => {
    const i = await dansA((c) => depots.parc.indicateurs(c));

    // Trois lignes, mais 12 + 1 + 1 = 14 unités.
    assert.equal(i.suivis, 14);
    assert.equal(i.sousGarantie, 13);
    assert.equal(i.sousGarantiePct, 93);
    // Le pare-feu expire dans 3 mois ; le switch est déjà expiré, donc exclu.
    assert.equal(i.garantieBientotEchue, 1);
    assert.equal(i.aRenouveler, 1);
    assert.equal(i.sitesCouverts, 2);
  });

  test('documents — la liste donne la version courante, pas toutes les versions', async () => {
    const [liste, versions] = await dansA(async (c) => [
      await depots.documents.lister(c),
      await depots.documents.versions(c, jeu.docA1),
    ]);

    assert.equal(liste.length, 2);
    assert.equal(liste.find((d) => d.nom === 'Schéma directeur réseau').version, 3);
    assert.equal(versions.length, 3, 'les versions antérieures doivent rester consultables');
  });

  test('documents — le dépôt d’une version incrémente sans écraser', async () => {
    const v = await dansA((c) =>
      depots.documents.deposer(c, {
        organisationId: jeu.a,
        documentId: jeu.docA1,
        chemin: '/srv/documents/nouveau.pdf',
        tailleOctets: 4096,
        typeMime: 'application/pdf',
        empreinteSha256: Buffer.alloc(32, 7),
        deposePar: null,
      }),
    );

    assert.equal(v.version, 4);

    const versions = await dansA((c) => depots.documents.versions(c, jeu.docA1));
    assert.equal(versions.length, 4);
  });

  test('documents — le chemin résolu est hors de toute racine servie', async () => {
    const v = await dansA((c) =>
      depots.documents.versionPourTelechargement(c, { documentId: jeu.docA1 }),
    );

    assert.match(v.chemin, /^\/srv\/documents\//);
    assert.equal(v.version, 4);
  });

  test('finances — « en attente » et « en retard » sont distingués', async () => {
    const i = await dansA((c) => depots.finances.indicateurs(c));

    assert.equal(i.enAttente, 1);
    assert.equal(i.enRetard, 1, 'une échéance dépassée n’est pas simplement « en attente »');
    assert.equal(i.enAttenteFcfa, 4_850_000);
    assert.equal(i.devisAValider, 1);
    assert.equal(i.dernierReglementRef, 'FAC-A-036');
  });

  test('finances — les montants restent des entiers exacts', async () => {
    const lignes = await dansA((c) => depots.finances.lister(c));
    const devis = lignes.find((l) => l.reference === 'DEV-A-019');

    assert.equal(devis.montant_fcfa, 18_200_000);
    assert.equal(Number.isInteger(devis.montant_fcfa), true);
  });

  test('finances — solder une pièce est idempotent', async () => {
    const enAttente = await dansA(async (c) =>
      (await depots.finances.lister(c, { statut: 'en_attente' }))[0],
    );

    const premier = await dansA((c) => depots.finances.marquerReglee(c, { id: enAttente.id }));
    const second = await dansA((c) => depots.finances.marquerReglee(c, { id: enAttente.id }));

    assert.equal(premier.reference, enAttente.reference);
    assert.equal(second, null, 'une pièce déjà réglée ne doit pas être re-soldée');
  });

  test('écrire dans un autre périmètre reste refusé par la base', async () => {
    await assert.rejects(
      () =>
        withTenant({ organisationId: jeu.a }, (c) =>
          depots.contrats.consommer(c, {
            organisationId: jeu.b,
            contratId: jeu.contratA,
            minutes: 60,
          }),
        ),
      /row-level security/i,
    );
  });
});
