#!/usr/bin/env node
/**
 * visual — régression visuelle sur l'atelier de composants.
 *
 * Capture chaque vue aux trois largeurs de référence et compare au pixel avec
 * la base versionnée dans design/baselines/. Une différence non intentionnelle
 * devient un échec de build, et non une découverte trois semaines plus tard.
 *
 * USAGE
 *   node tools/visual.mjs                 compare, échoue si ça diverge
 *   node tools/visual.mjs --update        réécrit la base (à relire en revue !)
 *   node tools/visual.mjs --url http://…  cible un autre serveur
 *
 * PRÉREQUIS
 *   Un serveur qui répond, et Chromium avec ses bibliothèques système :
 *     sudo npx playwright install-deps chromium
 *
 * POURQUOI LA BASE EST VERSIONNÉE
 * Comme design/reference/, elle n'a d'intérêt que relue. Un diff d'image dans
 * une proposition de modification montre exactement ce que le changement fait
 * au rendu — c'est la seule forme de revue de design qui ne repose pas sur la
 * bonne foi de l'auteur.
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_DIR = join(ROOT, 'design/baselines');
const DIFF_DIR = join(BASE_DIR, '__diff__');

const BOLD = '\u001b[1m';
const DIM = '\u001b[2m';
const RED = '\u001b[31m';
const GREEN = '\u001b[32m';
const GOLD = '\u001b[33m';
const OFF = '\u001b[0m';

/** Les trois largeurs du plan : desktop, tablette, mobile. */
const VIEWPORTS = [
  { name: 'desktop', width: 1440 },
  { name: 'tablette', width: 768 },
  { name: 'mobile', width: 390 },
];

/** Vues capturées : les six pages publiques, plus l'atelier de composants. */
const VUES = [
  { name: 'accueil', path: '/fr' },
  { name: 'expertises', path: '/fr/expertises' },
  { name: 'references', path: '/fr/references' },
  { name: 'solutions', path: '/fr/solutions' },
  { name: 'a-propos', path: '/fr/a-propos' },
  { name: 'contact', path: '/fr/contact' },
  { name: 'connexion', path: '/fr/connexion' },
  // L'espace client demande une session : le capturer suppose d'ajouter
  // PostgreSQL et l'API au job visuel, et d'y ouvrir une session. Prévu, non
  // fait — la couverture s'arrête donc aux pages publiques, et c'est écrit
  // plutôt que sous-entendu.
  { name: 'atelier', path: '/atelier' },
];

/** Seuil par pixel (0–1) : en dessous, c'est de l'antialiasing, pas un écart. */
const SEUIL_PIXEL = 0.1;
/** Part de pixels divergents tolérée avant de déclarer un écart. */
const SEUIL_IMAGE = 0.0005;

const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const urlIndex = args.indexOf('--url');
const BASE_URL = urlIndex >= 0 ? args[urlIndex + 1] : 'http://localhost:3000';

async function capture(page, vue, viewport) {
  await page.setViewportSize({ width: viewport.width, height: 900 });
  const reponse = await page.goto(`${BASE_URL}${vue.path}`, { waitUntil: 'load' });

  // Une page absente produirait une capture de la page 404, et donc un écart
  // incompréhensible : « 68 000 pixels divergents » au lieu de « la page n'est
  // pas là ». On nomme la cause tout de suite.
  if (reponse && reponse.status() >= 400) {
    const indice =
      vue.path === '/atelier'
        ? "\n  L'atelier n'est publié que si le build a été fait avec " +
          'ENABLE_DESIGN_WORKSHOP=1. La variable est lue AU BUILD : la poser au ' +
          'démarrage du serveur ne suffit pas.'
        : '';
    throw new Error(`${vue.path} répond ${reponse.status()}.${indice}`);
  }
  await page.evaluate(() => document.fonts.ready);
  // Les polices posées, on laisse la mise en page se stabiliser : sans cela,
  // la première capture diffère de toutes les suivantes.
  await page.waitForTimeout(500);
  return page.screenshot({ fullPage: true });
}

function compare(baseline, actual) {
  const a = PNG.sync.read(baseline);
  const b = PNG.sync.read(actual);

  if (a.width !== b.width || a.height !== b.height) {
    return { dimensions: `${a.width}x${a.height} → ${b.width}x${b.height}`, ratio: 1, diff: null };
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: SEUIL_PIXEL,
  });
  return { dimensions: null, ratio: pixels / (a.width * a.height), diff, pixels };
}

async function main() {
  mkdirSync(BASE_DIR, { recursive: true });

  const browser = await chromium.launch();
  // deviceScaleFactor 1 : une base en 2x pèse quatre fois plus pour la même
  // information, et le dépôt la garde pour toujours.
  const page = await browser.newPage({ deviceScaleFactor: 1 });

  const echecs = [];
  console.log(`\n${BOLD}visual${OFF} ${DIM}- ${BASE_URL}${OFF}\n`);

  for (const vue of VUES) {
    for (const viewport of VIEWPORTS) {
      const nom = `${vue.name}-${viewport.name}-${viewport.width}`;
      const chemin = join(BASE_DIR, `${nom}.png`);
      const actuel = await capture(page, vue, viewport);

      if (UPDATE || !existsSync(chemin)) {
        writeFileSync(chemin, actuel);
        const verbe = UPDATE ? 'réécrite' : 'créée';
        console.log(`  ${GOLD}~${OFF} ${nom.padEnd(26)} ${DIM}base ${verbe}${OFF}`);
        continue;
      }

      const { dimensions, ratio, diff, pixels } = compare(readFileSync(chemin), actuel);

      if (dimensions) {
        echecs.push(nom);
        console.log(`  ${RED}x${OFF} ${nom.padEnd(26)} ${DIM}hauteur changée : ${dimensions}${OFF}`);
        continue;
      }

      if (ratio > SEUIL_IMAGE) {
        echecs.push(nom);
        mkdirSync(DIFF_DIR, { recursive: true });
        writeFileSync(join(DIFF_DIR, `${nom}.png`), PNG.sync.write(diff));
        writeFileSync(join(DIFF_DIR, `${nom}.actuel.png`), actuel);
        console.log(
          `  ${RED}x${OFF} ${nom.padEnd(26)} ${DIM}${pixels} pixels divergents ` +
            `(${(ratio * 100).toFixed(3)} %)${OFF}`,
        );
      } else {
        console.log(`  ${GREEN}v${OFF} ${nom.padEnd(26)} ${DIM}conforme${OFF}`);
      }
    }
  }

  await browser.close();

  if (echecs.length > 0) {
    console.log(
      `\n${RED}${BOLD}${echecs.length} vue(s) divergente(s).${OFF}\n` +
        `  ${DIM}Images de différence : design/baselines/__diff__/${OFF}\n` +
        `  ${DIM}Si le changement est voulu : node tools/visual.mjs --update, puis relire le diff.${OFF}\n`,
    );
    process.exit(1);
  }

  const n = readdirSync(BASE_DIR).filter((f) => f.endsWith('.png')).length;
  console.log(`\n${GREEN}v${OFF} ${n} vue(s) conformes à la base.\n`);
}

await main();
