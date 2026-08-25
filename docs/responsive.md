# Décisions responsive — 25.08.2026

**Source :** `Artboards - Espace client.dc.html`, projet Claude Design
« Refonte site 5sursync ». Notre demande : `design/brief-artboards-responsive.md`.
Notre réponse : `reponse-integration-01.md` dans le projet Claude Design.

## Ce qui a déclenché la refonte

Le lot 0 a mesuré que le tableau du portail client ne tenait pas : les portails
ne sont bornés par aucune largeur maximale, donc le tableau dispose de
`fenêtre − 656 px`, quand ses cinq colonnes fixes en réclament 588 avant même la
colonne libre. À 1440 px il restait 196 px pour un libellé qui en mesure 233 ;
à 1366 px, 122 px.

Claude Design a généralisé le constat plutôt que de le rustiner : « cinq
colonnes fixes autour d'une colonne libre est une forme fausse à toutes les
largeurs. »

## Les décisions appliquées

| Point | Décision | Où c'est encodé |
| --- | --- | --- |
| Forme des tableaux de portail | **Rangée-fiche** à toutes les largeurs | `packages/ui/src/RecordList.jsx` |
| Back-office | Vrai tableau au-delà de 1280 px, fiche en dessous | `DataTable` conservé pour ce seul usage |
| Paliers | 1440 / **1024** / 768 / 390 | `packages/tokens/responsive.css` |
| Navigation latérale | Onglets défilants sous 1024 — pas un tiroir | `--site-rail-*: 0` sous 1024 |
| Colonne de cartes | **Au-dessus** du contenu sous 768 | à câbler au lot 3 |
| Typographie | Paliers fixes, pas d'interpolation fluide | `responsive.css` |
| `#1a1917` | Promu `--color-neutral-1000` | `site.css` |
| Rampe `accent-2` | Inutilisée — la grammaire est mono-accent | à retirer du relevé |

## Pourquoi des paliers fixes et non une interpolation fluide

Argument de Claude Design, repris tel quel : Cormorant Garamond demande un
interlettrage propre à chaque degré ; une valeur intermédiaire non contrôlée se
voit. Trois valeurs par degré, vérifiables une à une, plutôt qu'un continuum que
personne ne relit.

## Ce que nos deux valeurs provisoires sont devenues

Nous avions comblé deux états jamais dessinés avec des blancs à 8 % et 4 %.
Claude Design répond en **or** : bordure `rgba(226,173,102,.45)`, fond
`rgba(226,173,102,.08)`, texte `#e2ad66` pour le survol ; fond `#221f1c`, filet
`rgba(226,173,102,.28)`, libellés `rgba(243,242,242,.55)` pour l'en-tête sombre.
La différence n'est pas cosmétique : un survol blanc sur sol sombre délave,
un survol doré tient l'accent.

## En attente

- **Le palier 1024 n'est pas dessiné.** Claude Design le déclare mais ne le
  montre pas — or c'est celui qui porte la bascule du rail. Trois points restent
  indécidables : position de la colonne de cartes, nombre de KPI, forme de
  l'en-tête. Ils ne sont **pas** devinés dans le code ; la typographie y reste
  celle de 1440, choix conservateur et réversible.
- **Les artboards du back-office**, à dessiner sur la base confirmée.
- **Les six pages publiques**, non traitées à ce jour.
