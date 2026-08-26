#!/usr/bin/env node
/**
 * extract-content — amorce les fichiers de contenu depuis la maquette.
 *
 * ⚠  OUTIL À USAGE UNIQUE, PAS UN OUTIL DE SYNCHRONISATION.
 *
 * Il sert à créer apps/web/content/fr.json la première fois, sans recopier à
 * la main les quelque six cents chaînes de la maquette — une transcription
 * manuelle introduirait des fautes invisibles dans des noms propres, des
 * références contractuelles et des accents.
 *
 * Une fois le fichier créé, IL DEVIENT LA SOURCE. Le contenu éditorial se
 * corrige dans le dépôt, se relit en revue et suit l'historique Git. Relancer
 * cet outil écraserait ces corrections : il refuse donc d'écrire sur un
 * fichier existant sans --force.
 *
 * COMMENT
 * La maquette porte ses données dans la méthode renderVals() d'une classe qui
 * étend DCLogic, le moteur de Claude Design. On fournit un DCLogic factice,
 * on évalue la classe, on l'instancie et on appelle renderVals(). Les
 * gestionnaires d'événements disparaissent à la sérialisation JSON — c'est
 * exactement ce qu'on veut : on récupère le contenu, pas le comportement.
 *
 * USAGE
 *   node tools/extract-content.mjs [--force] [--out apps/web/content/fr.json]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAQUETTE = join(ROOT, 'design/reference/site.dc.html');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const outIndex = args.indexOf('--out');
const SORTIE = join(ROOT, outIndex >= 0 ? args[outIndex + 1] : 'apps/web/content/fr.json');

if (existsSync(SORTIE) && !FORCE) {
  console.error(
    `Refus : ${SORTIE.replace(`${ROOT}/`, '')} existe déjà.\n\n` +
      "  Ce fichier est devenu la source du contenu éditorial. Le réécrire depuis la\n" +
      "  maquette perdrait toutes les corrections faites depuis. Utilisez --force en\n" +
      '  connaissance de cause.',
  );
  process.exit(1);
}

const html = readFileSync(MAQUETTE, 'utf8');
const script = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)?.[1];
if (!script) {
  console.error('Aucun bloc de logique trouvé dans la maquette.');
  process.exit(2);
}

/**
 * DCLogic factice. renderVals() lit this.props et this.state, et appelle
 * quelques aides de la classe ; aucune n'a besoin du moteur réel pour rendre
 * les données. Les valeurs par défaut correspondent à celles déclarées dans
 * data-props de la maquette.
 */
const contexte = {
  DCLogic: class {
    constructor() {
      this.props = { startView: 'Accueil', showPlatformNav: true, showPhotos: true };
      this.state = { view: null, clientTab: 'tickets', adminTab: 'clients' };
    }

    setState() {}
  },
  console,
};

runInNewContext(`${script}\nglobalThis.__C = Component;`, contexte);
const valeurs = new contexte.__C().renderVals();

/**
 * On ne garde que le contenu éditorial. Les drapeaux d'affichage, les
 * gestionnaires et l'état des portails appartiennent au comportement, pas au
 * texte : les emporter ferait passer pour du contenu ce qui n'en est pas.
 */
const HORS_CONTENU = new Set([
  'isAccueil', 'isExpertises', 'isReferences', 'isSolutions', 'isApropos',
  'isContact', 'isClient', 'isAdmin', 'isSite', 'showPlatformNav', 'showPhotos',
  'navItems', 'clientNav', 'adminNav', 'clientTitle', 'clientSub', 'clientGrid',
  'clientCols', 'clientRows', 'clientKpis', 'clientActivity', 'adminTitle',
  'adminSub', 'adminAction', 'adminGrid', 'adminCols', 'adminRows', 'adminKpis',
  'charge', 'goAccueil', 'goExpertises', 'goReferences', 'goSolutions',
  'goApropos', 'goContact', 'goClient', 'goAdmin',
]);

const contenu = {};
for (const [cle, valeur] of Object.entries(valeurs)) {
  if (HORS_CONTENU.has(cle)) continue;
  if (typeof valeur === 'function') continue;
  contenu[cle] = valeur;
}

/**
 * Seconde passe : la PROSE.
 *
 * Les listes vivent dans renderVals(), mais les titres, chapôs et sur-titres
 * sont écrits en dur dans le balisage — c'est-à-dire la moitié du texte du
 * site. Sans cette passe, il faudrait les recopier à la main, et une faute
 * dans « Concevoir. Intégrer. Sécuriser. » ne se verrait pas en relecture.
 *
 * Le découpage se fait sur les blocs <sc-if value="{{ isXxx }}">, qui sont
 * exactement les six vues publiques.
 */
const VUES = {
  accueil: 'isAccueil',
  expertises: 'isExpertises',
  references: 'isReferences',
  solutions: 'isSolutions',
  apropos: 'isApropos',
  contact: 'isContact',
};

/** Décode les entités et rend les sauts de ligne explicites. */
function texte(brut) {
  return brut
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&laquo;', '«')
    .replaceAll('&raquo;', '»')
    .replaceAll(/\s+/g, ' ')
    .replaceAll(' \n ', '\n')
    .trim();
}

const pages = {};
for (const [nom, drapeau] of Object.entries(VUES)) {
  const debut = html.indexOf(`<sc-if value="{{ ${drapeau} }}"`);
  if (debut < 0) continue;
  // La vue court jusqu'au <sc-if> suivant : ils ne sont pas imbriqués au
  // premier niveau.
  const suivant = html.indexOf('<sc-if value="{{ is', debut + 10);
  const bloc = html.slice(debut, suivant < 0 ? html.length : suivant);

  const collecte = (motif) =>
    [...bloc.matchAll(motif)]
      .map((m) => texte(m[1]))
      .filter((t) => t && !t.includes('{{'));

  pages[nom] = {
    titres: collecte(/<h1[^>]*>([\s\S]*?)<\/h1>/g),
    sections: collecte(/<h2[^>]*>([\s\S]*?)<\/h2>/g),
    sousTitres: collecte(/<h3[^>]*>([\s\S]*?)<\/h3>/g),
    paragraphes: collecte(/<p[^>]*>([\s\S]*?)<\/p>/g),
    // Sur-titres : la signature est une police mono avec interlettrage large.
    surTitres: [
      ...new Set(
        collecte(/<div style="font-family: 'IBM Plex Mono'[^"]*letter-spacing: \.(?:1[2-9]|2[0-9])em[^"]*">([\s\S]*?)<\/div>/g),
      ),
    ],
  };
}

contenu.pages = pages;

mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, `${JSON.stringify(contenu, null, 2)}\n`);

const chaines = JSON.stringify(contenu).match(/"[^"]{2,}"/g)?.length ?? 0;
console.log(
  `${Object.keys(contenu).length} blocs de contenu extraits (~${chaines} chaînes) → ` +
    SORTIE.replace(`${ROOT}/`, ''),
);
console.log('Ce fichier est désormais la source : corrigez-le dans le dépôt, pas dans la maquette.');
