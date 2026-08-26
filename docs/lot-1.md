# Lot 1 — Vitrine

Six pages publiques, contenu intégré, routes localisées, référencement,
budget de performance et formulaire de contact relié à l'API.

## Ce qui a été vérifié

| Vérification | Résultat |
| --- | --- |
| `npm run lint:css` | 0 violation |
| `npm run design:pull` | 0 dérive d'identité, miroir conforme |
| `npm run design:visual` | 21 vues conformes (7 vues × 3 largeurs) |
| `npm run perf:budget` | 6 pages dans le budget, sur 3G bridée |
| `npm test` | 78 tests |
| `npm run build` | 12 routes, toutes pré-générées |
| Formulaire **sans JavaScript** | demande enregistrée, confirmation affichée, validation rendue |
| 404 de préchargement | aucun |

## Le contenu n'a pas été recopié

Les 528 chaînes du site ont été extraites mécaniquement de la maquette par
`tools/extract-content.mjs` : les listes en évaluant `renderVals()` dans un
DCLogic factice, la prose en découpant le balisage par vue. Une transcription
manuelle aurait introduit des fautes invisibles dans des noms propres et des
références contractuelles — « Institut National de l'Audiovisuel », « CT-2024-07 ».

L'outil refuse d'écrire sur un fichier existant sans `--force` : depuis
l'extraction, `content/fr.js` **est** la source, et le relancer perdrait les
corrections faites depuis.

## Le budget de performance, revu à la mesure

Le plan annonçait **120 Ko de JavaScript**. Ce chiffre avait été posé avant
mesure, et il est inatteignable : le socle de l'App Router pèse **133 Ko à lui
seul**, sur une page sans aucun composant client. Il ne dépend pas de notre
code.

Maintenir 120 Ko aurait produit un contrôle en échec permanent, donc désactivé
sous quinze jours. Le seuil passe à 150 Ko, ce qui laisse 17 Ko à notre propre
code. Il reste mordant : il attrape toute dérive de notre côté sans échouer sur
une constante du framework.

Le LCP, lui, reste à 2,5 s — c'est le seul de ces chiffres qui décrit ce que le
visiteur vit, et le seul que le discours commercial engage. Mesuré à **1,5 s**
sur 3G bridée à 1,6 Mb/s et 300 ms de latence.

## Le formulaire fonctionne sans JavaScript, et il a fallu le refaire

La première version employait `useActionState`. Testée navigateur fermé au
script, elle échouait en silence : le navigateur postait, mais la demande
n'atteignait jamais l'API. La promesse était fausse.

Réécrit en action serveur passée directement à `<form action>`, avec le schéma
« poster, rediriger, afficher ». L'état vient de l'URL, pas d'un état React.
Vérifié dans les deux modes, validation comprise.

**Limite assumée :** après une erreur de validation sans JavaScript, les champs
sont vidés — la redirection perd le corps de la requête. Les remettre supposerait
de faire transiter les saisies par l'URL, donc dans les journaux du serveur et
l'historique du navigateur. Avec JavaScript, rien n'est perdu.

## Deux correctifs trouvés par la mesure

- **La sonde de santé mentait.** Elle lisait `config.databaseUrl`, un champ
  renommé au lot 2 : elle annonçait « non configurée » quoi qu'il arrive. Elle
  interroge désormais la base et répond 503 si celle-ci ne répond pas — une
  sonde qui lit sa propre configuration se déclare en bonne santé au moment
  précis où elle devrait alerter.
- **Le budget mesurait zéro.** Il sommait les en-têtes `content-length`, absents
  des réponses compressées : toutes les pages « passaient » à 0 Ko. Il lit
  maintenant le Resource Timing, et refuse de conclure si le total est nul.

## Ce qui reste au responsive

L'artboard des pages publiques n'est **pas livré**. Les replis en place sont
mécaniques et documentés comme provisoires : grilles en `auto-fit` qui
préservent la largeur minimale dessinée, rail qui passe au-dessus, navigation
en défilement horizontal sous 900 px — ce dernier reprenant le principe que
Claude Design a posé pour l'espace client en écartant explicitement le tiroir.

Aucun seuil n'a été inventé pour les cas que le brief signale comme
indécidables. Voir `docs/responsive.md` et `reponse-integration-01.md` dans le
projet Claude Design.

## Reste pour la suite

- **Les photographies.** Six emplacements portent encore leur texte de
  substitution. Images réelles et autorisations écrites des institutions
  concernées à obtenir — ce sont des salles techniques et des régies.
- **La version anglaise.** Les routes `/[locale]/` sont en place et
  `LOCALES` n'attend qu'une entrée ; les traductions n'existent pas.
- **Les portails.** `/fr/espace-client` et `/fr/back-office` sont des pages
  d'attente, `noindex`, pour que les deux boutons de l'en-tête ne pointent pas
  vers des 404 que Next précharge sur chaque page.
