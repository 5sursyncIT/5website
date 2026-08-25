#!/usr/bin/env node
/**
 * design-pull — audite l'écart entre la maquette Claude Design et @5sync/tokens.
 *
 * CE QUE FAIT CE SCRIPT
 * Il relève toutes les valeurs littérales employées par la maquette (tailles de
 * police, couleurs, largeurs de conteneur) et vérifie que chacune est déclarée
 * quelque part dans packages/tokens. Il signale deux dérives symétriques :
 *
 *   ENTRANTE — une valeur apparaît dans la maquette et n'existe dans aucun
 *              token. Quelqu'un a fait évoluer le design ; il faut l'extraire.
 *   SORTANTE — un token déclare une valeur que la maquette n'emploie plus.
 *              Token mort, ou régression du code par rapport au design.
 *
 * CE QU'IL NE FAIT PAS
 * Il ne télécharge rien. Le projet Claude Design est derrière l'authentification
 * claude.ai, à laquelle un script d'intégration continue n'a pas accès. Le
 * rafraîchissement du cache se fait depuis Claude Code, qui dispose de l'outil
 * DesignSync :
 *
 *     « rafraîchis design/reference/ depuis le projet Claude Design »
 *
 * Le script travaille ensuite sur ce cache, hors ligne — ce qui le rend
 * utilisable en intégration continue.
 *
 * USAGE
 *   node tools/design-pull.mjs [chemin/vers/maquette.dc.html]
 *   npm run design:pull
 *
 * Sort en code 1 si une dérive entrante est détectée.
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REFERENCE = join(ROOT, 'design/reference/site.dc.html');
const TOKEN_FILES = [
  'packages/tokens/classical.css',
  'packages/tokens/site.css',
  'packages/tokens/responsive.css',
];

const BOLD = '\u001b[1m';
const DIM = '\u001b[2m';
const GOLD = '\u001b[33m';
const RED = '\u001b[31m';
const GREEN = '\u001b[32m';
const OFF = '\u001b[0m';

/** Valeurs volontairement hors périmètre : trop locales pour mériter un token. */
const IGNORE = new Set(['0px', '1px', '2px', '3px', '6px']);

function fail(message) {
  console.error(`${RED}x${OFF} ${message}`);
  process.exit(2);
}

function readTokens() {
  const declared = new Map(); // valeur littérale -> [noms de tokens]

  const register = (value, name) => {
    const v = value.trim().toLowerCase();
    if (!declared.has(v)) declared.set(v, []);
    if (!declared.get(v).includes(name)) declared.get(v).push(name);
  };

  for (const file of TOKEN_FILES) {
    const path = join(ROOT, file);
    if (!existsSync(path)) fail(`Fichier de tokens introuvable : ${file}`);
    const css = readFileSync(path, 'utf8');
    for (const [, name, raw] of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      register(raw, name);

      // Une couleur peut être enfouie dans une valeur composée — c'est le cas
      // des ombres de Classical, « 0 1px 2px color-mix(in srgb, #2d2b2b 14%,
      // transparent) ». Sans ce second passage, la teinte serait comptée comme
      // absente des tokens alors qu'elle y est bel et bien déclarée.
      for (const [, fn] of raw.matchAll(/(color-mix\([^)]*\)|rgba?\([^)]*\))/gi)) register(fn, name);
    }
  }
  return declared;
}

/**
 * Normalise pour comparer. Trois écritures d'une même couleur doivent se
 * confondre, sans quoi le contrôle produit un bruit permanent et finit par être
 * désactivé — ce qui est exactement le scénario qu'il doit empêcher :
 *
 *   rgba(32,31,29,.16)
 *   rgb(32 31 29 / 16%)
 *   color-mix(in srgb, #201f1d 16%, transparent)   ← l'écriture de Classical
 */
function normalise(value) {
  const v = value.trim().toLowerCase();

  const mix = v.match(
    /^color-mix\(\s*in\s+srgb\s*,\s*(#[0-9a-f]{3,8})\s+([\d.]+)%\s*,\s*transparent\s*\)$/,
  );
  if (mix) return normalise(hexToRgba(mix[1], Number.parseFloat(mix[2]) / 100));

  const rgba = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/);
  if (rgba) {
    const [, r, g, b, a] = rgba;
    let alpha = a === undefined ? '1' : a;
    if (alpha.endsWith('%')) alpha = String(Number.parseFloat(alpha) / 100);
    return `rgb(${r} ${g} ${b} / ${Number.parseFloat(alpha)})`;
  }

  return v;
}

function hexToRgba(hex, alpha) {
  const h = hex.slice(1);
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const n = Number.parseInt(full.slice(0, 6), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${alpha})`;
}

/** Kind d'une valeur, pour ne comparer que ce qui est comparable. */
function kindOf(value) {
  if (value.startsWith('#') || value.startsWith('rgb')) return 'color';
  if (/^[\d.]+px$/.test(value)) return 'length';
  return 'other';
}

/**
 * Propriétés relevées dans la maquette. La liste est délibérément explicite :
 * une propriété non listée devient un angle mort silencieux du contrôle, donc
 * toute extension doit être un choix, jamais un effet de bord.
 */
const SCANNED = [
  'font-size',
  'border-radius',
  'max-width',
  'min-width',
  'width',
  'height',
  'padding',
  'padding-top',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'gap',
  'grid-template-columns',
];

function extractFromMaquette(html) {
  const found = new Map(); // valeur normalisée -> occurrences
  const fontSizes = new Set(); // valeurs vues en font-size, quel que soit l'usage

  const bump = (value) => {
    const key = normalise(value);
    found.set(key, (found.get(key) ?? 0) + 1);
    return key;
  };

  for (const [, size] of html.matchAll(/font-size:\s*([\d.]+px)/g)) fontSizes.add(bump(size));

  // Longueurs : on lit la déclaration entière, puis chaque terme en px.
  const props = SCANNED.join('|');
  const declaration = new RegExp(`(?:${props}):\\s*([^;"']+)`, 'gi');
  for (const [, body] of html.matchAll(declaration)) {
    for (const [, px] of body.matchAll(/([\d.]+px)/g)) bump(px);
  }

  // Couleurs, quelle que soit la propriété qui les porte.
  for (const [, hex] of html.matchAll(/#([0-9a-f]{6})\b/gi)) bump(`#${hex}`);
  for (const [, fn] of html.matchAll(/(rgba?\([^)]*\))/gi)) bump(fn);
  for (const [, fn] of html.matchAll(/(color-mix\([^)]*\))/gi)) bump(fn);

  return { found, fontSizes };
}

/**
 * Le miroir doit rester une copie conforme.
 *
 * packages/tokens/classical.css se présente comme un miroir de Classical. Si
 * quelqu'un l'édite « juste un peu » — pour corriger une teinte, pour ajuster
 * un rayon — le fichier ment sur ce qu'il est, et la source de vérité se
 * dédouble en silence. On compare donc chaque token du miroir à la référence.
 *
 * Un seul écart est attendu et toléré : la règle @import des Google Fonts,
 * retirée au profit de l'auto-hébergement. Elle ne déclare aucun token, donc
 * elle n'apparaît pas dans cette comparaison.
 */
function auditMirror() {
  const referencePath = join(ROOT, 'design/reference/styles.css');
  const mirrorPath = join(ROOT, 'packages/tokens/classical.css');
  if (!existsSync(referencePath)) return null;

  const tokensOf = (path) => {
    const map = new Map();
    for (const [, name, raw] of readFileSync(path, 'utf8').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      map.set(name, raw.trim().replace(/\s+/g, ' '));
    }
    return map;
  };

  const reference = tokensOf(referencePath);
  const mirror = tokensOf(mirrorPath);
  const ecarts = [];

  for (const [name, value] of reference) {
    if (!mirror.has(name)) ecarts.push([name, value, 'absent du miroir']);
    else if (mirror.get(name) !== value) ecarts.push([name, value, `miroir : ${mirror.get(name)}`]);
  }
  for (const name of mirror.keys()) {
    if (!reference.has(name)) ecarts.push([name, '—', 'ajouté au miroir, absent de Classical']);
  }
  return ecarts;
}

function main() {
  const explicit = process.argv[2];
  const source = explicit ? join(process.cwd(), explicit) : REFERENCE;

  if (!existsSync(source)) {
    console.error(`${RED}x${OFF} Maquette introuvable : ${relative(ROOT, source)}`);
    console.error(
      `\n  Rafraîchis le cache depuis Claude Code :\n` +
        `  ${DIM}« rafraîchis design/reference/ depuis le projet Claude Design »${OFF}\n` +
        `  ou passe un chemin : ${DIM}node tools/design-pull.mjs chemin/maquette.dc.html${OFF}\n`,
    );
    process.exit(2);
  }

  const declared = readTokens();
  const declaredNormalised = new Map();
  for (const [value, names] of declared) declaredNormalised.set(normalise(value), names);

  const { found: used, fontSizes } = extractFromMaquette(readFileSync(source, 'utf8'));
  const isIdentity = (value) => kindOf(value) === 'color' || fontSizes.has(value);

  /**
   * Deux régimes, et c'est ce qui rend le contrôle tenable dans la durée.
   *
   * BLOQUANT — couleurs et tailles de police. Ce sont les valeurs qui portent
   *   l'identité : une teinte ou un degré typographique hors tokens est une
   *   dérive du design, toujours.
   *
   * INFORMATIF — les autres longueurs. Un `padding: 18px 20px` propre à un
   *   composant relève de la composition, pas de l'identité. Les exiger toutes
   *   en tokens produirait une soupe de variables que personne ne relit, et le
   *   contrôle finirait désactivé — soit exactement ce qu'il doit empêcher.
   */
  const bloquant = [];
  const informatif = [];
  for (const [value, count] of used) {
    if (IGNORE.has(value)) continue;
    if (declaredNormalised.has(value)) continue;
    (isIdentity(value) ? bloquant : informatif).push([value, count]);
  }
  bloquant.sort((a, b) => b[1] - a[1]);
  informatif.sort((a, b) => b[1] - a[1]);
  const entrante = bloquant;

  const sortante = [];
  for (const [value, names] of declaredNormalised) {
    // Seuls les tokens dont le kind est réellement relevé par l'extracteur
    // peuvent être déclarés inutilisés. Un alias (var(--x)) ou une valeur non
    // scannée n'est pas « absent de la maquette » : il est hors périmètre.
    if (kindOf(value) === 'other') continue;
    if (IGNORE.has(value)) continue;
    if (!used.has(value)) sortante.push([value, names]);
  }

  console.log(`\n${BOLD}design-pull${OFF} ${DIM}- ${relative(ROOT, source)}${OFF}`);
  console.log(
    `${DIM}${used.size} valeurs relevées dans la maquette - ${declared.size} valeurs déclarées en tokens${OFF}\n`,
  );

  if (entrante.length > 0) {
    console.log(`${RED}${BOLD}DÉRIVE BLOQUANTE${OFF} ${DIM}- couleurs et degrés typographiques hors tokens${OFF}`);
    for (const [value, count] of entrante) {
      console.log(`  ${RED}+${OFF} ${value.padEnd(30)} ${DIM}${count} occurrence${count > 1 ? 's' : ''}${OFF}`);
    }
    console.log(`\n  ${DIM}-> à extraire dans packages/tokens/site.css, nommées par leur rôle.${OFF}\n`);
  } else {
    console.log(
      `${GREEN}v${OFF} Aucune dérive d'identité : toutes les couleurs et tailles de police de la\n` +
        `  maquette sont déclarées en tokens.\n`,
    );
  }

  if (informatif.length > 0) {
    const apercu = informatif.slice(0, 8);
    console.log(`${DIM}${BOLD}LONGUEURS DE COMPOSITION${OFF} ${DIM}- hors tokens, non bloquantes${OFF}`);
    console.log(
      `  ${DIM}${apercu.map(([v, c]) => `${v} (${c})`).join('  ')}` +
        `${informatif.length > apercu.length ? `  … et ${informatif.length - apercu.length} autres` : ''}${OFF}`,
    );
    console.log(
      `\n  ${DIM}-> espacements propres à un composant. À ne tokeniser que si une valeur${OFF}\n` +
        `  ${DIM}   se met à revenir partout : elle devient alors du rythme, donc du système.${OFF}\n`,
    );
  }

  if (sortante.length > 0) {
    console.log(`${DIM}${BOLD}DÉRIVE SORTANTE${OFF} ${DIM}- déclarées en tokens, absentes de la maquette${OFF}`);
    for (const [value, names] of sortante) {
      console.log(`  ${DIM}-  ${value.padEnd(30)} ${names.join(', ')}${OFF}`);
    }
    console.log(
      `\n  ${DIM}-> tokens morts, ou degrés de rampe que la maquette n'emploie pas encore.${OFF}\n` +
        `  ${DIM}   Informatif : ne fait pas échouer la vérification.${OFF}\n`,
    );
  }

  const ecartsMiroir = auditMirror();
  if (ecartsMiroir === null) {
    console.log(`${DIM}Référence Classical absente — contrôle du miroir sauté.${OFF}\n`);
  } else if (ecartsMiroir.length > 0) {
    console.log(`${RED}${BOLD}MIROIR DIVERGENT${OFF} ${DIM}- classical.css n'est plus une copie conforme${OFF}`);
    for (const [name, value, note] of ecartsMiroir) {
      console.log(`  ${RED}!${OFF} ${name.padEnd(26)} ${DIM}Classical : ${value} — ${note}${OFF}`);
    }
    console.log(
      `\n  ${DIM}-> le miroir ne s'édite pas. Corrige dans Claude Design, puis rafraîchis${OFF}\n` +
        `  ${DIM}   design/reference/ et recopie.${OFF}\n`,
    );
  } else {
    console.log(`${GREEN}v${OFF} Miroir conforme : les ${DIM}tokens de classical.css${OFF} sont ceux de Classical.\n`);
  }

  const enEchec = entrante.length > 0 || (ecartsMiroir !== null && ecartsMiroir.length > 0);
  process.exit(enEchec ? 1 : 0);
}

main();
