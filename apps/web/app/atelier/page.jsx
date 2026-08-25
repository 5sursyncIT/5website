import { notFound } from 'next/navigation';
import {
  Button,
  DataTable,
  Field,
  Kicker,
  KpiCard,
  Meter,
  SectionHeading,
  RecordList,
  SideNav,
  Stat,
  StatusTag,
  Tag,
} from '@5sync/ui';
import styles from './atelier.module.css';

export const metadata = {
  title: 'Atelier de composants',
  robots: { index: false, follow: false },
};

/* Les échantillons reprennent le contenu réel de la maquette. Un atelier peuplé
   de « Lorem ipsum » ne révèle ni les débordements, ni les césures, ni ce que
   font les accents sur une capitale interlettrée. */

const NEUTRES = [
  ['--color-bg', '#f3f2f2'],
  ['--color-surface', '#eae9e9'],
  ['--color-neutral-300', '#d7d3d3'],
  ['--color-neutral-400', '#bab6b6'],
  ['--color-neutral-500', '#9b9797'],
  ['--color-neutral-600', '#7d7979'],
  ['--color-neutral-700', '#605d5d'],
  ['--color-neutral-800', '#444141'],
  ['--color-neutral-900', '#2d2b2b'],
  ['--site-ground', '#1a1917'],
];

const ORS = [
  ['--color-accent-100', '#fff3e4'],
  ['--color-accent-200', '#ffe3bf'],
  ['--color-accent-300', '#facb8d'],
  ['--color-accent-400', '#e1ad66'],
  ['--color-accent-500', '#c28d41'],
  ['--color-accent', '#b68235'],
  ['--color-accent-600', '#a06f24'],
  ['--color-accent-700', '#7d5411'],
  ['--color-accent-800', '#5a3b0a'],
  ['--color-accent-900', '#3a270d'],
];

const TITRES = [
  ['--site-display-hero', '78px', 'Concevoir. Intégrer. Sécuriser.'],
  ['--site-display-page', '58px', 'Six pôles, une seule chaîne de responsabilité'],
  ['--site-display-contact', '50px', 'Parlons de votre prochain projet'],
  ['--site-display-cta', '46px', 'Construisons votre infrastructure'],
  ['--site-title-section', '42px', 'Une trajectoire en sept étapes'],
  ['--site-title-page', '40px', 'Des technologies choisies pour le besoin'],
  ['--site-title-app', '38px', 'Tickets de support'],
  ['--site-title-lg', '32px', 'Réseaux, connectivité & télécoms'],
  ['--site-title-md', '25px', 'Institut National de l’Audiovisuel'],
  ['--site-title-sm', '21px', 'Conseil et architecture'],
  ['--site-title-xs', '17px', 'Références'],
];

/* Titres d'interface — Cormorant Garamond 600. Une troisième graisse, à ne
   confondre ni avec les titres éditoriaux (400) ni avec les chiffres (300). */
const TITRES_UI = [
  ['--site-ui-title-lg', '24px', 'Ville de Dakar'],
  ['--site-ui-title', '23px', 'Contrats & SLA'],
  ['--site-ui-title-md', '22px', 'Parc matériel installé'],
  ['--site-ui-title-sm', '20px', 'Documents & livrables'],
  ['--site-ui-title-xs', '19px', 'Factures & devis'],
  ['--site-ui-strong', '16px', 'Voir nos références'],
];

const CORPS = [
  ['--site-lede', '18px', "Ingénierie des systèmes d'information et des infrastructures."],
  ['--site-body-lg', '16.5px', "La technologie n'est jamais une fin en soi."],
  ['--site-body-md', '15.5px', 'Segmentation, pare-feu, contrôle des accès, VPN, durcissement.'],
  ['--site-body', '15px', 'Audit SI et réseau, schéma directeur, architecture cible.'],
  ['--site-body-card', '14.5px', "Audit de l'existant, schéma directeur et feuille de route budgétée."],
  ['--site-body-sm', '14px', 'Coupure liaison radio site annexe Plateau'],
  ['--site-note', '13.5px', 'Rapport d’intervention INT-2026-118 déposé'],
  ['--site-note-alt', '13px', 'Formule · Support N2 étendu'],
  ['--site-note-sm', '12.5px', "Direction des systèmes d'information"],
  ['--site-note-xs', '11.5px', 'Sénégal · Guinée · R.D. Congo · Côte d’Ivoire'],
];

const ETIQUETTES = [
  ['--site-label', '11px', 'DAKAR, SÉNÉGAL — ACTIVITÉ DEPUIS 2016'],
  ['--site-label-sm', '10.5px', '22.08.2026 — 16:42'],
  ['--site-label-xs', '10px', 'DÉLAI MOYEN DE PRISE EN CHARGE'],
];

const NAV_CLIENT = [
  { href: '#tickets', label: 'Tickets de support', count: '6' },
  { href: '#projets', label: 'Projets & jalons', count: '3' },
  { href: '#contrats', label: 'Contrats & SLA', count: '2' },
  { href: '#documents', label: 'Documents & livrables', count: '18' },
  { href: '#parc', label: 'Parc matériel', count: '64' },
  { href: '#factures', label: 'Factures & devis', count: '5' },
];

const NAV_ADMIN = [
  { href: '#clients', label: 'Clients', count: '11' },
  { href: '#aprojets', label: 'Projets', count: '9' },
  { href: '#interventions', label: 'Interventions', count: '24' },
  { href: '#acontrats', label: 'Contrats & SLA', count: '7' },
  { href: '#facturation', label: 'Facturation', count: '12' },
];

const TICKETS = {
  columns: '110px 1fr 130px 110px 130px',
  headers: ['RÉFÉRENCE', 'OBJET', 'SITE', 'NIVEAU', 'STATUT'],
  rows: [
    {
      id: 'TCK-4471',
      cells: [
        'TCK-4471',
        'Coupure liaison radio site annexe Plateau',
        'Mairie annexe',
        'N3',
        <StatusTag key="s" tone="gold">ESCALADÉ</StatusTag>,
      ],
    },
    {
      id: 'TCK-4459',
      cells: [
        'TCK-4459',
        'Demande de compte VPN — 3 agents',
        'Hôtel de ville',
        'N1',
        <StatusTag key="s" tone="muted">VOTRE RETOUR</StatusTag>,
      ],
    },
    {
      id: 'TCK-4448',
      cells: [
        'TCK-4448',
        'Point d’accès Wi-Fi hors ligne — étage 3',
        'Hôtel de ville',
        'N1',
        <StatusTag key="s" tone="muted">PLANIFIÉ</StatusTag>,
      ],
    },
  ],
};

/* Rangée-fiche — données de l'artboard « Espace client », Claude Design. */
const FICHES = [
  { id: 'TCK-4471', href: '#t1', reference: 'TCK-4471', objet: 'Coupure liaison radio site annexe Plateau',
    attributs: ['MAIRIE ANNEXE', 'NIVEAU 3', 'OUVERT LE 24.08'], statut: 'ESCALADÉ', ton: 'gold' },
  { id: 'TCK-4468', href: '#t2', reference: 'TCK-4468', objet: 'Lenteur applicative portail agents',
    attributs: ['HÔTEL DE VILLE', 'NIVEAU 2', 'OUVERT LE 22.08'], statut: 'EN COURS', ton: 'gold' },
  { id: 'TCK-4463', href: '#t3', reference: 'TCK-4463', objet: 'Téléphonie IP — 4 postes muets',
    attributs: ['SERVICES TECHNIQUES', 'NIVEAU 2', 'OUVERT LE 21.08'], statut: 'EN COURS', ton: 'gold' },
  { id: 'TCK-4459', href: '#t4', reference: 'TCK-4459', objet: 'Demande de compte VPN — 3 agents',
    attributs: ['HÔTEL DE VILLE', 'NIVEAU 1', 'OUVERT LE 19.08'], statut: 'VOTRE RETOUR', ton: 'muted' },
  { id: 'TCK-4448', href: '#t5', reference: 'TCK-4448', objet: 'Point d’accès Wi-Fi hors ligne — étage 3',
    attributs: ['HÔTEL DE VILLE', 'NIVEAU 1', 'OUVERT LE 12.08'], statut: 'PLANIFIÉ', ton: 'muted' },
];

/* Le rôle « figure » : les factures portent un montant tabulaire. */
const FICHES_FACTURES = [
  { id: 'FAC-2026-041', reference: 'FAC-2026-041', objet: 'Support N2 — 3e trimestre 2026',
    attributs: ['ÉCHÉANCE 15.09.2026'], figure: '4 850 000 FCFA', statut: 'EN ATTENTE', ton: 'muted' },
  { id: 'DEV-2026-019', reference: 'DEV-2026-019', objet: 'Interconnexion sites — lot 3',
    attributs: ['ÉCHÉANCE 30.09.2026'], figure: '18 200 000 FCFA', statut: 'À VALIDER', ton: 'muted' },
  { id: 'FAC-2026-036', reference: 'FAC-2026-036', objet: 'Support N2 — 2e trimestre 2026',
    attributs: ['RÉGLÉE LE 12.07.2026'], figure: '4 850 000 FCFA', statut: 'RÉGLÉE', ton: 'gold' },
];

const CLIENTS = {
  columns: '1fr 140px 110px 110px 130px',
  headers: ['CLIENT', 'PAYS', 'PROJETS', 'TICKETS', 'STATUT'],
  rows: [
    {
      id: 'dakar',
      cells: ['Ville de Dakar', 'Sénégal', '3', '6', <StatusTag key="s" tone="gold" onGround>ACTIF</StatusTag>],
    },
    {
      id: 'ina',
      cells: [
        "Institut National de l'Audiovisuel",
        'Guinée',
        '2',
        '1',
        <StatusTag key="s" tone="gold" onGround>ACTIF</StatusTag>,
      ],
    },
    {
      id: 'anapi',
      cells: ['ANAPI / GUCE', 'R.D. Congo', '1', '0', <StatusTag key="s" tone="muted" onGround>AUDIT</StatusTag>],
    },
  ],
};

function Swatches({ items }) {
  return (
    <div className={styles.swatches}>
      {items.map(([token, value]) => (
        <div key={token} className={styles.swatch}>
          <div className={styles.chip} style={{ background: `var(${token})` }} />
          <div className={styles.swatchLabel}>
            {token.replace('--color-', '').replace('--site-', 'site/')}
            <span className={styles.swatchValue}>{value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Scale({ rows, family, weight }) {
  return (
    <div className={styles.scale}>
      {rows.map(([token, value, sample]) => (
        <div key={token} className={styles.scaleRow}>
          <div className={styles.scaleToken}>{token.replace('--site-', '')}</div>
          <div className={styles.scaleValue}>{value}</div>
          <div
            className={styles.scaleSample}
            style={{ fontFamily: family, fontWeight: weight, fontSize: `var(${token})` }}
          >
            {sample}
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
      </div>
      {note ? <p className={styles.sectionNote}>{note}</p> : null}
      {children}
    </section>
  );
}

export default function AtelierPage() {
  // L'atelier expose la grammaire interne du produit : il ne part pas en
  // production sans un feu vert explicite.
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DESIGN_WORKSHOP !== '1') {
    notFound();
  }

  return (
    <main id="contenu" className={styles.page}>
      <header className={styles.masthead}>
        <Kicker size="lg">Atelier de composants — hors production</Kicker>
        <h1 className={styles.title}>Chaque composant, dans chacun de ses états</h1>
        <p className={styles.intro}>
          À comparer côte à côte avec le volet Design System de Claude Design. Tout ce qui apparaît
          ici est construit sur <code>@5sync/tokens</code> : si une valeur diverge de la maquette,
          elle diverge d’abord ici, et se voit.
        </p>
      </header>

      <Section
        title="Neutres"
        note="La rampe de Classical, plus le sol sombre. Ce dernier est le seul ton de la maquette qui n’appartient pas au système — la rampe neutre s’arrête à #2d2b2b."
      >
        <Swatches items={NEUTRES} />
      </Section>

      <Section title="Ors" note="Rampe d’accent. Le 400 est réservé au sol sombre, le 700 aux liens et aux statuts sur fond clair.">
        <Swatches items={ORS} />
      </Section>

      <Section
        title="Titres — Cormorant Garamond 400"
        note="Onze degrés relevés dans la maquette. Les quatre premiers ne servent qu’une fois chacun : ce sont des titres de page, pas une échelle réutilisable."
      >
        <Scale rows={TITRES} family="var(--site-font-display)" weight={400} />
      </Section>

      <Section
        title="Chiffres — Cormorant Garamond 300"
        note="La graisse 300 est réservée aux chiffres. Elle n’est jamais employée pour du texte, sur aucune vue."
      >
        <div className={styles.bench}>
          <Stat value="2016" label="Année de création" size="md" />
          <Stat value="8" label="Collaborateurs" size="md" />
          <Stat value="4" label="Pays d’intervention" size="md" />
          <Stat value="6" label="Domaines d’expertise" size="md" />
        </div>
        <div className={`${styles.bench} ${styles.benchDark}`} style={{ marginTop: '16px' }}>
          <Stat value="2016" label="Année de création" size="md" onGround />
          <Stat value="99,4 %" label="Disponibilité réseau" size="md" onGround />
          <Stat value="01" label="Conseil et architecture" size="sm" onGround />
        </div>
        <p className={styles.caption}>Fond clair, puis sol sombre — le ton passe du 700 au 400.</p>
      </Section>

      <Section
        title="Titres d’interface — Cormorant Garamond 600"
        note="La troisième graisse du système, et la plus facile à confondre avec les deux autres. Classical la documente comme le plafond des titres d’interface : ils ont besoin du gras aux petites tailles."
      >
        <Scale rows={TITRES_UI} family="var(--site-font-display)" weight={600} />
      </Section>

      <Section title="Corps — Lora" note="Dix degrés, du chapô du héro à la ligne de pays du pied de page.">
        <Scale rows={CORPS} family="var(--site-font-body)" weight={400} />
      </Section>

      <Section
        title="Étiquettes — IBM Plex Mono"
        note="Toujours en capitales, toujours interlettrées. C’est le marqueur le plus répandu de la maquette : sur-titres, en-têtes de colonne, compteurs, horodatages."
      >
        <Scale rows={ETIQUETTES} family="var(--site-font-mono)" weight={400} />
        <div className={styles.bench} style={{ marginTop: '20px' }}>
          <Kicker size="lg">NOTRE PROMESSE</Kicker>
          <Kicker size="md">CONTRAT DE SERVICE</Kicker>
          <Kicker size="sm">VOTRE INTERLOCUTEUR</Kicker>
        </div>
      </Section>

      <Section
        title="Boutons"
        note="Trois variantes de Classical, trois gabarits de taille relevés dans la maquette : sm en en-tête, md dans les portails, lg dans le héro."
      >
        <div className={styles.bench}>
          <Button size="lg">Voir nos références</Button>
          <Button size="md">Ouvrir un ticket</Button>
          <Button size="sm">Espace client</Button>
          <Button size="sm" variant="secondary">Back-office</Button>
          <Button size="md" variant="ghost">Tout afficher</Button>
          <Button size="md" disabled>Indisponible</Button>
        </div>
        <div className={`${styles.bench} ${styles.benchDark}`} style={{ marginTop: '16px' }}>
          <Button size="lg" onGround>Voir nos références</Button>
          <Button size="lg" variant="secondary" onGround>Parler d’un projet</Button>
        </div>
        <p className={styles.caption}>Fond clair, puis sol sombre.</p>
      </Section>

      <Section
        title="Étiquettes de contenu et pastilles de statut"
        note="Deux composants distincts qu’il ne faut pas confondre. Le Tag vient de Classical et porte un aplat ; la pastille de statut est propre à la maquette — filet de 1 px, rayon 2 px, monospace."
      >
        <div className={styles.bench}>
          <Tag tone="accent">Fortinet</Tag>
          <Tag tone="accent-2">VMware</Tag>
          <Tag tone="neutral">ResourceSpace</Tag>
          <Tag tone="outline">Schéma directeur</Tag>
        </div>
        <div className={styles.bench} style={{ marginTop: '16px' }}>
          <StatusTag tone="gold">EN COURS</StatusTag>
          <StatusTag tone="gold">ESCALADÉ</StatusTag>
          <StatusTag tone="gold">RÉGLÉE</StatusTag>
          <StatusTag tone="muted">VOTRE RETOUR</StatusTag>
          <StatusTag tone="muted">À VALIDER</StatusTag>
          <StatusTag tone="muted">À RENOUVELER</StatusTag>
        </div>
        <div className={`${styles.bench} ${styles.benchDark}`} style={{ marginTop: '16px' }}>
          <StatusTag tone="gold" onGround>ACTIF</StatusTag>
          <StatusTag tone="muted" onGround>AUDIT</StatusTag>
        </div>
      </Section>

      <Section
        title="Indicateurs"
        note="Quatre par ligne côté client sur fond clair, cinq côté back-office sur sol sombre. La valeur est en Cormorant 400, pas 300."
      >
        <div className={`${styles.bench} ${styles.benchStack}`}>
          <div className={styles.benchGrid}>
            <KpiCard label="TICKETS OUVERTS" value="6" detail="2 en priorité haute" />
            <KpiCard label="DÉLAI MOYEN DE PRISE EN CHARGE" value="1 h 12" detail="GTI contractuelle : 2 h" />
            <KpiCard label="RÉSOLUS CE MOIS" value="14" detail="dont 3 en niveau 3" />
            <KpiCard label="DISPONIBILITÉ RÉSEAU" value="99,4 %" detail="sur 30 jours glissants" />
          </div>
        </div>
        <div className={`${styles.bench} ${styles.benchDark} ${styles.benchStack}`} style={{ marginTop: '16px' }}>
          <div className={styles.benchGrid}>
            <KpiCard label="CLIENTS ACTIFS" value="11" onGround />
            <KpiCard label="PROJETS EN COURS" value="9" onGround />
            <KpiCard label="TICKETS OUVERTS" value="6" onGround />
            <KpiCard label="ÉCHÉANCES SOUS 30 J" value="3" onGround />
            <KpiCard label="FACTURES EN ATTENTE" value="4" onGround />
          </div>
        </div>
        <p className={styles.caption}>
          Le libellé le plus long de la maquette est monté en essai — c’est lui qui fixe la hauteur de ligne.
        </p>
      </Section>

      <Section title="Jauge" note="Consommation d’un forfait d’heures. Rendue avec <progress> pour rester annoncée par les lecteurs d’écran.">
        <div className={`${styles.bench} ${styles.benchStack}`} style={{ maxWidth: '340px' }}>
          <Meter label="Heures d’intervention consommées" value={74} max={120} caption="74 / 120 H" />
        </div>
      </Section>

      <Section
        title="Champs de formulaire"
        note="Le champ de Classical, avec le libellé de la maquette — monospace capitales, et non Lora 12 px."
      >
        <div className={`${styles.bench} ${styles.benchStack}`} style={{ maxWidth: '520px' }}>
          <div style={{ display: 'grid', gap: '18px' }}>
            <Field label="ORGANISATION" id="org" placeholder="Ministère, collectivité, entreprise…" />
            <div className={styles.pair}>
              <Field label="NOM" id="nom" placeholder="Prénom et nom" />
              <Field label="E-MAIL" id="mail" type="email" placeholder="nom@organisation.sn" />
            </div>
            <Field
              label="CONTEXTE"
              id="ctx"
              as="textarea"
              rows={4}
              placeholder="Sites concernés, existant, échéance, contraintes budgétaires…"
            />
            <div>
              <Button size="md">Envoyer la demande</Button>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="Rangée-fiche"
        note="La forme arrêtée par Claude Design pour les tableaux de portail. Cinq colonnes fixes autour d’une colonne libre était une forme fausse à toutes les largeurs : à 1366 px elle tronquait le seul champ que l’agent lit. Ici l’objet prend toute la mesure et peut passer à la ligne."
      >
        <RecordList
          label="Tickets de support"
          summary="RÉFÉRENCE · OBJET · SITE · NIVEAU"
          summaryRight="STATUT"
          records={FICHES}
        />
        <p className={styles.caption}>Densité « confort ». Réduire la fenêtre : sous 480 px, la pastille remonte sur la ligne de référence.</p>

        <div style={{ marginTop: '20px' }}>
          <RecordList label="Factures et devis" summary="RÉFÉRENCE · OBJET · ÉCHÉANCE" summaryRight="MONTANT · STATUT" records={FICHES_FACTURES} density="compact" />
        </div>
        <p className={styles.caption}>Densité « compact », avec le rôle « figure » — le montant reste tabulaire.</p>

        <div style={{ marginTop: '20px' }}>
          <RecordList label="Clients, sur sol sombre" summary="RÉFÉRENCE · OBJET · PAYS" summaryRight="STATUT" records={FICHES.slice(0, 3)} onGround />
        </div>
        <p className={styles.caption}>Sur sol sombre — le back-office sous 1280 px. Survol doré, et non blanc : un survol blanc délave.</p>
      </Section>

      <Section
        title="Tableau de données — back-office au-delà de 1280 px"
        note="Conservé pour le seul back-office, au-dessus de 1280 px : l’opérateur y travaille en comparaison ligne à ligne. En dessous, il cède la place à la rangée-fiche. Un vrai <table> en disposition fixe, et non la grille de <div> de la maquette."
      >
        <DataTable
          caption="Tickets de support ouverts"
          columns={TICKETS.columns}
          headers={TICKETS.headers}
          rows={TICKETS.rows}
        />
        <div style={{ marginTop: '16px' }}>
          <DataTable
            caption="Comptes clients"
            columns={CLIENTS.columns}
            headers={CLIENTS.headers}
            rows={CLIENTS.rows}
            onGround
          />
        </div>
        <p className={styles.caption}>
          Sous 620 px, le tableau défile dans son propre cadre — la page ne part jamais de travers.
        </p>
      </Section>

      <Section
        title="Navigation latérale"
        note="Libellé, compteur, filet d’accent sur l’entrée active. Rendue en liste de liens, avec aria-current sur l’entrée courante."
      >
        <div className={styles.railBench}>
          <div className={styles.railPane}>
            <Kicker size="sm" style={{ marginBottom: '10px' }}>ESPACE CLIENT</Kicker>
            <div
              style={{
                fontFamily: 'var(--site-font-display)',
                fontWeight: 600,
                fontSize: 'var(--site-title-md)',
                lineHeight: 1.1,
              }}
            >
              Ville de Dakar
            </div>
            <div style={{ fontSize: 'var(--site-note-sm)', color: 'var(--site-soft)', marginBottom: '24px' }}>
              Direction des systèmes d’information
            </div>
            <SideNav items={NAV_CLIENT} active="#tickets" label="Sections de l’espace client" />
          </div>
          <div className={styles.railBody}>
            <SectionHeading size="app" level={2}>
              Tickets de support
            </SectionHeading>
            <p style={{ fontSize: 'var(--site-body-sm)', color: 'var(--site-soft)', margin: '6px 0 0' }}>
              6 tickets ouverts · 2 en attente de votre retour
            </p>
          </div>
        </div>

        <div className={styles.railBench} style={{ marginTop: '16px' }}>
          <div className={`${styles.railPane} ${styles.railPaneDark}`}>
            <Kicker size="sm" onGround style={{ marginBottom: '10px' }}>BACK-OFFICE</Kicker>
            <div
              style={{
                fontFamily: 'var(--site-font-display)',
                fontWeight: 600,
                fontSize: 'var(--site-title-md)',
                lineHeight: 1.1,
                color: 'var(--site-on-ground)',
                marginBottom: '24px',
              }}
            >
              5/Sync IT
            </div>
            <SideNav items={NAV_ADMIN} active="#clients" label="Sections du back-office" onGround />
          </div>
          <div className={`${styles.railBody} ${styles.railBodyDark}`}>
            <div style={{ color: 'var(--site-on-ground)' }}>
              <SectionHeading size="app" level={2}>
                Clients
              </SectionHeading>
              <p style={{ fontSize: 'var(--site-body-sm)', color: 'var(--site-on-ground-muted)', margin: '6px 0 0' }}>
                11 comptes · 4 pays
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Titres de section" note="Sur-titre et titre, dans les cinq gabarits que la maquette emploie.">
        <div className={`${styles.bench} ${styles.benchStack}`}>
          <div style={{ display: 'grid', gap: '34px' }}>
            <SectionHeading kicker="NOTRE PROMESSE" size="section">
              Transformer les ambitions numériques en systèmes fiables et exploitables.
            </SectionHeading>
            <SectionHeading kicker="EXPERTISES" size="inner">
              Des technologies choisies pour le besoin, pas pour le catalogue
            </SectionHeading>
            <SectionHeading size="app">Tickets de support</SectionHeading>
          </div>
        </div>
      </Section>
    </main>
  );
}
