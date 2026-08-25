# Référence de design — instantané versionné

Ces fichiers sont une copie de la maquette Claude Design du projet
« Refonte site 5sursync » (`79586523-4316-460a-9d3c-d9cfd6af9384`).

| Fichier | Origine |
| --- | --- |
| `site.dc.html` | La maquette des 8 vues |
| `styles.css` | Le design system Classical, tel que livré |

## Pourquoi c'est versionné et non mis en cache

C'est la base de comparaison de `npm run design:pull`. Versionnée, elle donne
deux choses qu'un cache local ne donne pas :

1. **La CI peut faire le contrôle.** Un cache gitignoré serait absent du
   runner, et le contrôle serait silencieusement sauté à chaque exécution —
   c'est-à-dire inexistant.
2. **L'évolution du design se relit en revue.** Quand la maquette bouge, le
   diff de ce fichier apparaît dans la proposition de modification, à côté des
   tokens qu'il a fallu ajouter. On voit le design changer.

## Rafraîchir

Depuis Claude Code, qui dispose de l'outil DesignSync :

> rafraîchis `design/reference/` depuis le projet Claude Design

puis `npm run design:pull` pour voir ce qui a bougé, et enfin extraire les
nouvelles valeurs dans `packages/tokens/site.css`.

Ne pas éditer ces fichiers à la main : ce sont des copies, pas des sources.
