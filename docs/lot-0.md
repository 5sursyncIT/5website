# Lot 0 — Fondations

## Critère de fin

> L'atelier affiche tous les composants et passe la comparaison visuelle avec
> Claude Design.

**Atteint.** L'atelier rend chaque composant dans chacun de ses états, et la
régression visuelle tourne sur les trois largeurs de référence.

La comparaison a d'ailleurs servi tout de suite : elle a révélé deux défauts
que ni le build, ni les tests, ni stylelint n'auraient vus. Voir plus bas.

## Ce qui a été vérifié, et comment

| Vérification | Résultat |
| --- | --- |
| `npm run lint:css` | 0 violation |
| Le verrou mord vraiment | Une sonde avec `#b68235`, `rgba(…)` et `font-size: 42px` est rejetée sur les 3 |
| `npm run design:pull` | 0 dérive d'identité, miroir conforme |
| La détection de dérive du miroir mord | `#b68235` → `#b78337` fait échouer le contrôle |
| `npm test` | 2/2 |
| `npm run build` | 3 routes, toutes pré-générées en statique |
| Rendu de `/atelier` | 200, contenu réel présent |
| `npm run design:visual` | 3/3 conformes, stable d'un passage à l'autre |
| La régression visuelle mord | `--site-kpi` 36 → 37 px échoue sur les 3 largeurs |
| Débordement horizontal | aucun, en 1440 comme en 390 px |
| Polices auto-hébergées | 12 fichiers woff2 servis depuis notre origine, **0 appel à Google au runtime** |
| Vulnérabilités | 0 |

## Décisions prises en cours de route

**Next 16 plutôt que 15.** Next 15 embarque un postcss porteur d'une alerte de
sévérité haute, corrigée seulement par la montée en version majeure. Sur un
projet neuf, sans code à migrer, la version 16 était le choix évident.

**`/atelier` plutôt que `/_design`.** Dans l'App Router, un dossier préfixé par
`_` est privé et exclu du routage : `/_design` renvoyait 404. Le nom français
colle mieux au vocabulaire employé partout ailleurs.

**Un vrai `<table>` dans `DataTable`.** La maquette dessine ses tableaux avec
`display: grid` sur des `<div>`. Le rendu est juste, mais les en-têtes de
colonne ne sont plus annoncés aux lecteurs d'écran. Les largeurs sont
retrouvées par `table-layout: fixed` et un `<col>` par colonne — les gabarits
de la maquette contiennent tous exactement une fraction, et une colonne `auto`
unique reproduit `1fr` au pixel près.

**La référence de design est versionnée, pas mise en cache.** Un instantané
gitignoré aurait été absent du runner d'intégration continue, et le contrôle
d'écart aurait été silencieusement sauté à chaque exécution. Versionné, il rend
aussi les évolutions du design lisibles en revue.

## Ce que l'extraction a révélé

Trois choses que la lecture seule de `styles.css` ne montrait pas :

1. **Une troisième échelle typographique.** Les degrés 19 à 24 px sont tous en
   Cormorant Garamond **600** — des titres d'interface, distincts des titres
   éditoriaux en 400 et des chiffres en 300. Trois graisses, trois usages, à ne
   jamais confondre.

2. **Classical n'est pas employé en entier.** La rampe d'accent secondaire
   (18 valeurs) et l'échelle `--space-1..8` ne sont utilisées par aucune vue de
   la maquette. Le site a son propre rythme vertical — ce qui confirme, mesure
   à l'appui, la nécessité des deux couches.

3. **Une couleur hors système.** Le sol sombre `#1a1917` du héro et du
   back-office n'appartient à aucune rampe de Classical, dont le neutre
   s'arrête à `#2d2b2b`. À arbitrer : le remonter dans Classical, ou l'assumer
   comme un ajout de la couche site.

## Deux défauts trouvés par la capture d'écran

Aucun des deux n'aurait été attrapé par le build, les tests ou stylelint.

**La pastille de statut était rognée.** En `table-layout: fixed`, la largeur
d'un `<col>` est une largeur de *bordure* — marges comprises. Les gabarits de
la maquette (« 110px 1fr 130px … ») décrivent, eux, des largeurs de *contenu* :
la grille y réserve 130 px au contenu seul, la marge de 22 px étant portée par
la rangée. Mes 22 px par cellule mangeaient donc la colonne, et « VOTRE
RETOUR » se faisait couper. `DataTable` fait désormais l'addition lui-même.

**L'atelier ne montrait pas tous les tokens.** Les six degrés de titres
d'interface, ajoutés en cours d'extraction, n'avaient aucune section ; trois
degrés de corps manquaient aussi. Un atelier incomplet est pire qu'absent : il
donne l'illusion d'avoir tout vérifié. Corrigé, et c'est un point de vigilance
permanent — tout token ajouté doit y apparaître.

## Reste à trancher avant le lot 1

- **La maquette n'existe qu'en desktop.** Aucun artboard sous 1240 px. C'est le
  préalable au lot 1 ; voir le plan.
- **Deux valeurs proposées, pas extraites.** Le survol de bouton secondaire et
  l'en-tête de tableau sur sol sombre ne sont dessinés nulle part. Ils sont
  marqués `AJOUT` dans `site.css` et signalés par `design-pull`.
- **Les styles en ligne des `.jsx` échappent à stylelint.** Règle ESLint à
  ajouter au lot 1.
- **La base d'images ne couvre que l'atelier.** Les six pages publiques s'y
  ajoutent au lot 1, les portails au lot 3.
- **Le rendu mobile de l'atelier est mon propre repli**, pas un design validé :
  il ne présume rien de ce que décidera Claude Design pour le site.
