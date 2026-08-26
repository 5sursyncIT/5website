#!/usr/bin/env node
/**
 * budget — vérifie le budget de performance des pages publiques.
 *
 * POURQUOI C'EST UN CONTRÔLE ET NON UNE MESURE PONCTUELLE
 * 5/Sync IT vend des solutions « pensées pour nos réseaux » et des connexions
 * réellement disponibles en Afrique de l'Ouest. Un site institutionnel qui
 * met huit secondes à s'afficher sur un mobile en 3G contredit ce discours
 * mieux qu'aucun concurrent ne saurait le faire.
 *
 * Les seuils sont donc bloquants, et volontairement mesurés sur un réseau
 * bridé plutôt qu'en local où tout va vite.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';

/** 3G rapide : 1,6 Mb/s en descente, 300 ms de latence aller-retour.
    downloadThroughput et uploadThroughput sont en octets par seconde. */
const RESEAU = {
  offline: false,
  latency: 300,
  downloadThroughput: Math.round((1.6 * 1024 * 1024) / 8),
  uploadThroughput: Math.round((750 * 1024) / 8),
};

/**
 * SEUILS, ET POURQUOI CEUX-LÀ.
 *
 * Le plan annonçait 120 Ko de JavaScript. Ce chiffre a été posé avant mesure,
 * et il est inatteignable : le socle de l'App Router — React et le routeur —
 * pèse 133 Ko à lui seul, sur une page SANS aucun composant client (mesuré
 * sur /atelier, entièrement rendu côté serveur). Il ne dépend pas de notre
 * code.
 *
 * Maintenir 120 Ko aurait produit un contrôle en échec permanent, donc
 * désactivé sous quinze jours. On le relève à 150 Ko, ce qui laisse 17 Ko à
 * notre propre code — l'en-tête, seul composant client du site, en consomme
 * 10 pour indiquer la page courante aux lecteurs d'écran. Le seuil reste donc
 * mordant : il attrape toute dérive de notre côté sans échouer sur une
 * constante du framework.
 *
 * Le LCP, lui, reste à 2,5 s. C'est le seul de ces chiffres qui décrit ce que
 * le visiteur vit réellement, et le seul que le discours commercial engage.
 */
const BUDGET = {
  jsKo: 150,      // socle du framework (133) + 17 pour notre code
  totalKo: 700,   // tout compris, polices incluses
  lcpMs: 2500,    // plus grand contenu affiché, sur réseau bridé
};

const PAGES = ['/fr', '/fr/expertises', '/fr/references', '/fr/solutions', '/fr/a-propos', '/fr/contact'];

const navigateur = await chromium.launch();
const echecs = [];
const lignes = [];

for (const chemin of PAGES) {
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await contexte.newPage();
  const session = await contexte.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', RESEAU);

  await page.goto(`${BASE}${chemin}`, { waitUntil: 'load', timeout: 60000 });

  /**
   * Le poids se lit dans le Resource Timing, PAS dans l'en-tête content-length.
   *
   * Une réponse compressée en chunked n'a pas de content-length : la sommer
   * donne zéro, et le budget passe en ne mesurant rien. C'est le piège
   * classique de ce genre de contrôle — il rassure d'autant plus qu'il est
   * cassé. transferSize compte les octets réellement passés sur le réseau,
   * en-têtes et compression compris.
   */
  const poids = await page.evaluate(() => {
    const total = { js: 0, css: 0, font: 0, image: 0, autre: 0 };
    const document = performance.getEntriesByType('navigation')[0];
    total.autre += document?.transferSize ?? 0;

    for (const r of performance.getEntriesByType('resource')) {
      const octets = r.transferSize || r.encodedBodySize || 0;
      if (r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name)) total.js += octets;
      else if (r.initiatorType === 'css' || /\.css(\?|$)/.test(r.name)) total.css += octets;
      else if (/\.(woff2?|ttf|otf)(\?|$)/.test(r.name)) total.font += octets;
      else if (/\.(png|jpe?g|webp|avif|svg)(\?|$)/.test(r.name)) total.image += octets;
      else total.autre += octets;
    }
    return total;
  });

  if (poids.js === 0 && poids.css === 0) {
    throw new Error(
      `${chemin} : aucun octet de JS ni de CSS mesuré. La mesure est cassée — ` +
        'un budget qui ne mesure rien passe toujours.',
    );
  }
  const lcp = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let valeur = 0;
        new PerformanceObserver((liste) => {
          for (const e of liste.getEntries()) valeur = e.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => resolve(Math.round(valeur)), 1200);
      }),
  );

  const ko = (o) => Math.round(o / 1024);
  const total = Object.values(poids).reduce((a, b) => a + b, 0);
  const ligne = { page: chemin, js: ko(poids.js), css: ko(poids.css), polices: ko(poids.font), total: ko(total), lcp };
  lignes.push(ligne);

  if (ligne.js > BUDGET.jsKo) echecs.push(`${chemin} : ${ligne.js} Ko de JS (budget ${BUDGET.jsKo})`);
  if (ligne.total > BUDGET.totalKo) echecs.push(`${chemin} : ${ligne.total} Ko au total (budget ${BUDGET.totalKo})`);
  if (lcp > BUDGET.lcpMs) echecs.push(`${chemin} : LCP ${lcp} ms (budget ${BUDGET.lcpMs})`);

  await contexte.close();
}

await navigateur.close();

console.log('\nBudget de performance — 3G rapide, 1,6 Mb/s, 300 ms de latence\n');
console.table(lignes);

if (echecs.length) {
  console.log('\nHORS BUDGET :');
  for (const e of echecs) console.log(`  x ${e}`);
  process.exit(1);
}
console.log('\nv Toutes les pages tiennent dans le budget.\n');
