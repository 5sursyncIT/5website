# Demande d'artboards responsive — 5Sync IT

**Pour :** Claude Design, projet « Refonte site 5sursync »
**De :** l'équipe d'intégration — lot 0 livré, lot 1 bloqué sur ces décisions
**Date :** 25.08.2026

---

## Ce qui bloque

La maquette `5Sync IT - Site.dc.html` est complète et exploitable — huit vues,
données réelles, grammaire entièrement tokenisée. Nous l'avons intégrée : les
tokens sont extraits en deux couches, les composants sont construits, la
régression visuelle tourne.

Mais **elle n'existe qu'à une seule largeur.** Le conteneur du site public est
figé à 1240 px et aucun artboard n'existe en deçà. Les portails, eux, ne sont
bornés par rien du tout : ils occupent toute la largeur de la fenêtre.

Nous ne voulons pas inventer ces règles à votre place. Le repli d'un tableau
dense à cinq colonnes n'est pas une décision d'implémentation — c'est du design.

---

## D'abord : un problème qui n'est pas mobile

**Les tableaux de portail ne tiennent déjà pas sur un portable standard.**

Le portail client dispose de : largeur de fenêtre − 252 px (rail) − 80 px
(marges) − 300 px (colonne de cartes) − 24 px (gouttière) = **fenêtre − 656 px**.

Les onze tableaux ont tous cinq colonnes. Le plus étroit impose 480 px de
colonnes fixes, plus 64 px de gouttières et 44 px de marges de rangée =
**588 px avant même la colonne libre.**

| Largeur de fenêtre | Reste pour la colonne « objet » |
| --- | --- |
| 1920 px | 676 px — confortable |
| 1536 px | 292 px — juste |
| **1440 px** | **196 px — tronqué** |
| 1366 px | 122 px — inutilisable |
| 1280 px | 36 px — cassé |
| 1244 px | 0 px — la colonne disparaît |

Or le libellé « Coupure liaison radio site annexe Plateau » mesure **233 px** en
Lora 14 px, et « Interconnexion sites municipaux — lot 2 » davantage encore.
Mesures faites dans les polices réelles du projet, pas estimées.

**Conclusion : sur un MacBook 14" ou un portable 1366×768 — l'équipement le plus
probable d'un agent de collectivité — le tableau est déjà illisible.** La
question n'est donc pas « comment le replier sur mobile », mais « quelle est sa
forme correcte », dont le desktop actuel n'est qu'un cas particulier trop
optimiste.

---

## Les décisions demandées

### 1. Les paliers

Nous proposons trois artboards par vue : **1440 / 768 / 390 px** — ce sont les
largeurs sur lesquelles notre régression visuelle est déjà calée. À confirmer ou
à corriger. Si un quatrième palier est nécessaire (1024 ?), dites-le.

### 2. Les tableaux de portail — la décision la plus lourde

Onze tableaux, cinq colonnes chacun. Trois voies possibles :

- **Colonnes prioritaires.** Chaque tableau déclare un ordre de sacrifice ; les
  colonnes tombent une à une vers la gauche. Il faut alors que vous nous donniez
  cet ordre pour chacun des onze — et le sort des colonnes masquées : rangée
  dépliable, ou perdues ?
- **Bascule en cartes.** Sous un seuil, chaque rangée devient une carte
  empilée. Il faut la maquette de cette carte : quels champs, quelle hiérarchie,
  où va la pastille de statut.
- **Défilement horizontal du tableau seul.** Le moins coûteux, le moins
  agréable. Acceptable pour le back-office, douteux pour l'espace client.

La réponse peut différer entre l'espace client et le back-office.

### 3. La navigation latérale

252 px côté client, 236 px côté back-office. Elle porte aussi le nom du client
et l'interlocuteur. Sous quelle largeur disparaît-elle, et en quoi — tiroir,
onglets horizontaux, sélecteur déroulant ?

### 4. La colonne de cartes du portail client

300 px : « contrat de service » avec sa jauge d'heures, et « activité récente ».
Passe-t-elle sous le tableau, au-dessus, ou dans un panneau escamotable ?

### 5. Le héro de l'accueil

Grille `1.35fr / 1fr`, avec quatre statistiques sur un filet vertical. Le titre
est à **78 px**. Que devient-il en 390 px ? Et les quatre statistiques : en
2 × 2, en ligne défilante, ou réduites à deux ?

### 6. Les grilles éditoriales

Sept structures distinctes dans la maquette, dont :

| Grille | Où | Question |
| --- | --- | --- |
| `320px 1fr` | rail de section + texte | le rail passe-t-il au-dessus ? |
| `repeat(3, 1fr)` | promesse, expertises | 3 → 2 → 1, à quels seuils ? |
| `repeat(7, 1fr)` | les 7 étapes de la méthode | 7 colonnes sur 1240 px, donc ~150 px chacune — impossible plus bas |
| `repeat(6, 1fr)` | 6 contraintes, 6 raisons | idem |
| `repeat(5, 1fr)` | KPI du back-office | 5 → ? |

### 7. L'en-tête collant

Six liens de navigation, le sélecteur FR/EN, deux boutons de plateforme. Cela ne
tient pas en 390 px. À quel seuil bascule-t-on, et vers quoi ?

### 8. L'échelle typographique

Faut-il des valeurs mobiles pour les grands degrés — héro 78 px, titres de page
58 px, titres de section 42 et 40 px, KPI 36 px ? Et si oui : **paliers fixes
par artboard, ou interpolation fluide entre deux bornes ?** Les deux
s'implémentent ; le rendu diffère, et c'est un choix de design.

---

## Ce dont nous avons besoin en retour

Idéalement, les huit vues aux trois largeurs. Si c'est trop, l'ordre de priorité
qui débloque le plus vite notre lot 1 :

1. **L'espace client** — c'est là que la question est la plus dure, et elle
   commande aussi la correction du desktop.
2. **L'accueil** — héro, grilles éditoriales, en-tête.
3. **Le back-office** — mêmes patrons que l'espace client, sur sol sombre.
4. Les quatre autres pages publiques, qui réemploient les mêmes grilles.

## Ce que nous fournissons de notre côté

- Les tokens extraits, en deux couches documentées, avec le relevé
  d'occurrences de chaque valeur.
- Le constat que la rampe d'accent secondaire et l'échelle `--space-1..8` de
  Classical ne sont employées par aucune vue.
- Une valeur hors système à arbitrer : le sol sombre `#1a1917` n'appartient à
  aucune rampe de Classical, dont le neutre s'arrête à `#2d2b2b`.
- Deux états jamais dessinés, que nous avons provisoirement comblés et qui
  demandent votre arbitrage : le survol d'un bouton secondaire sur sol sombre,
  et l'en-tête de tableau sur sol sombre.
