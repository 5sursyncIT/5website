# @5sync/tokens

Deux couches, deux statuts différents.

| Fichier | Statut | Qui l'édite |
| --- | --- | --- |
| `classical.css` | **Miroir** du design system Classical | Personne. On édite dans Claude Design, puis `npm run design:pull`. |
| `site.css` | **Extraction** des styles en ligne de la maquette | L'équipe, quand `design:pull` signale une valeur nouvelle. |

## Pourquoi deux couches

Classical est un design system de composants : il fixe les couleurs, les rayons,
les familles, et une échelle d'espacement de composant (`--space-1` à `--space-8`,
soit 4,6 à 36,8 px). Il plafonne `h1` à 42 px.

La maquette du site travaille à une autre échelle : héro à 78 px, sections à
96 px de respiration, conteneur à 1240 px. Ces valeurs n'existent nulle part dans
`styles.css` — elles vivent dans des attributs `style=""` du `.dc.html`. Les
extraire dans `site.css` est ce qui empêche qu'elles soient recopiées à la main
dans chaque composant, puis qu'elles divergent.

## Règle d'usage

Aucune couleur littérale ni taille de police en dur hors de ce paquet. C'est
vérifié par stylelint en intégration continue (`npm run lint:css`), et bloquant.

```css
/* non */
.titre { color: #b68235; font-size: 42px; }

/* oui */
.titre { color: var(--site-gold); font-size: var(--site-title-section); }
```

## Un écart connu

`--site-ground: #1a1917` est la seule valeur de la maquette qui ne se remappe
pas sur une rampe de Classical — la rampe neutre s'arrête à `#2d2b2b`, bien plus
clair. Le sol sombre du héro et du back-office est donc, à ce jour, un ajout de
la couche site. À arbitrer : le remonter dans Classical, ou l'assumer ici.
