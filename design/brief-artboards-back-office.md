# Demande d'artboards — back-office

**Pour :** Claude Design, projet « Refonte site 5sursync »
**De :** l'équipe d'intégration
**Date :** 26.08.2026
**Fait suite à :** `reponse-integration-01.md`, resté sans réponse

---

## Où nous en sommes

L'espace client est **construit et livré**. Votre rangée-fiche fonctionne : un
compte client parcourt ses six modules, les indicateurs sont calculés, et la
forme tient de 1440 à 390 px sans qu'aucun champ ne soit masqué. Le titre
dispose de `fenêtre − 904 px` et peut passer à la ligne — là où l'ancienne
forme en colonnes n'avait que 196 px à 1440 et 122 px à 1366, et tronquait.

Nous avons appliqué vos décisions telles quelles : onglets défilants sous
1024 px, cartes au-dessus du contenu sous 768, paliers typographiques fixes,
`#1a1917` versé en `neutre-1000`, et vos valeurs dorées pour les deux états
que nous avions comblés provisoirement.

**Vous aviez confirmé traiter le back-office à part** — vrai tableau au-delà de
1280 px, rangée-fiche en dessous — et attendiez notre accord avant de dessiner.
Cet accord est donné : c'est votre proposition qui est retenue, sur votre
argument que l'opérateur travaille en comparaison ligne à ligne.

---

## Le constat qui a émergé en construisant

Nous avons compté ce que la maquette contient :

| | |
| --- | --- |
| Vues de **liste** dessinées | **11** (6 côté client, 5 côté back-office) |
| Vues de **détail** dessinées | **0** |
| Formulaires dessinés | **1**, le formulaire de contact public |
| Boutons d'action du back-office qui ouvrent un écran dessiné | **0 sur 5** |

« Nouveau client », « Nouveau projet », « Planifier », « Nouveau contrat »,
« Créer une pièce » : les cinq boutons existent, aucun ne mène quelque part.

**C'est le même genre de trou que la largeur des tableaux**, et il se voit au
même endroit — dans ce que la structure implique mais ne montre pas. L'espace
client s'en accommode : un client consulte, et consulter une liste est déjà
utile. **Le back-office, non.** Le métier d'un opérateur n'est pas de lire des
listes, c'est d'ouvrir un ticket, d'y répondre, de le faire changer d'état,
d'imputer des heures, de déposer un rapport. Aucun de ces gestes n'est dessiné.

Nous pouvons livrer les cinq listes du back-office la semaine prochaine. Elles
ne serviront à personne tant qu'on ne peut rien ouvrir.

---

## Ce que nous demandons, par ordre d'utilité

### 1. La fiche d'un client — l'écran principal de l'opérateur

Le back-office liste onze clients. Cliquer sur l'un d'eux devrait montrer sa
situation entière : ses projets, ses tickets ouverts, son contrat et sa
consommation d'heures, son parc, ses pièces en attente. C'est l'écran devant
lequel un intervenant passe sa journée, et le seul qui n'existe nulle part.

Sur sol sombre comme le reste du back-office, ou sur fond clair parce qu'on y
lit longtemps ? La question n'est pas rhétorique : la maquette met le
back-office en sombre, mais elle ne le montre qu'en survol de listes.

### 2. Le détail d'un ticket, côté opérateur

Ce qu'il faut pouvoir faire depuis cet écran, d'après le modèle de données déjà
en place :

- lire le fil des échanges, et y répondre ;
- distinguer une note **interne** d'un message visible du client — la colonne
  existe en base, elle n'a aucune forme ;
- changer le statut, escalader d'un niveau ;
- imputer des heures au contrat qui couvre le ticket ;
- rattacher une intervention et son rapport.

### 3. Les quatre écrans de création

Client, projet, intervention, pièce financière. Un formulaire de création n'est
pas un détail d'intégration : le nombre de champs, ce qui est requis, ce qui se
déduit, et ce qui se passe après l'enregistrement sont des décisions de design.

Pour « Nouveau client » en particulier : créer une organisation suppose aussi
ses sites et un premier compte de référent. Un écran, ou une suite d'étapes ?

### 4. Le détail d'un document, côté opérateur

L'historique des versions existe en base — nous conservons chaque version, avec
son empreinte et son auteur. La maquette n'affiche qu'un numéro. Comment
présente-t-on « v3, déposée le 12.07, la v2 reste consultable » ?

---

## Deux questions restées ouvertes depuis la dernière fois

### Le palier 1024 n'est toujours pas dessiné

Vous déclarez quatre paliers, le document en montre trois. C'est celui qui
porte la bascule du rail vers le bandeau d'onglets. Trois points restent
indécidables et **nous ne les avons pas devinés** : la position de la colonne
de cartes, le nombre de KPI de front, la forme de l'en-tête. Notre repli tient
la typographie de 1440 à cette largeur, ce qui est conservateur et réversible,
mais ce n'est pas une décision de design.

### Les cinq indicateurs du back-office

`repeat(5, 1fr)` ne tient pas sous 768 px. En 2 + 3, en 2 × 2 + 1, ou en
bandeau défilant ? Et le bloc « CHARGE ÉQUIPE » du bas de rail — les quatre
pôles et leurs jauges — que devient-il quand le rail disparaît ?

---

## Ce que nous fournissons

- L'espace client en fonctionnement, si vous voulez voir la rangée-fiche
  rendue plutôt que dessinée.
- Le modèle de données complet : ce qui est stockable est stocké, et plusieurs
  champs attendent une forme — la note interne d'un ticket, l'historique des
  versions d'un document, l'imputation d'heures à un contrat.
- Un rappel utile pour les écrans de création : le respect des SLA se calcule
  par contrat. Un ticket non rattaché à un contrat sort du calcul. Si l'écran
  de création d'un ticket ne propose pas ce rattachement, l'indicateur se vide
  peu à peu sans que personne ne comprenne pourquoi.

---

## Priorité, si tout n'est pas possible

1. **La fiche client** — elle débloque le plus, et commande la forme des autres.
2. **Le détail d'un ticket** — c'est le geste le plus fréquent.
3. **Le palier 1024** — un seul artboard de l'espace client suffirait.
4. Les écrans de création, puis le détail d'un document.
