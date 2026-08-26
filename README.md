# 5/Sync IT

Site institutionnel, espace client et back-office — construits d'après la
maquette Claude Design « Refonte site 5sursync », en JavaScript de bout en bout.

**Lots 0, 1, 2, 3, 5 et 6 livrés** — fondations, vitrine, socle de données et
accès, espace client, durcissement, mise en production. Du **lot 4** — le
back-office — seule la couche HTTP est livrée : les écrans attendent des
artboards. Voir `docs/`.

## Démarrer

```bash
npm install
npm run dev            # http://localhost:3000
```

L'atelier de composants est sur `/atelier`. Il rend chaque composant dans
chacun de ses états, à comparer côte à côte avec le volet Design System de
Claude Design.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement du site |
| `npm run build` | Build de production |
| `npm test` | Tests (`node --test`, sans dépendance) |
| `npm run lint:css` | **Bloquant.** Aucune couleur ni taille de police en dur hors des tokens |
| `npm run design:pull` | **Bloquant.** Écart entre la maquette et les tokens, et conformité du miroir |
| `npm run design:visual` | **Bloquant.** Régression visuelle au pixel, en 1440 / 768 / 390 px |
| `npm run design:visual:update` | Réécrit la base d'images — à relire en revue, jamais à lancer par réflexe |
| `npm run db:migrate` | Applique les migrations SQL |
| `npm run db:seed` | Jeu de démonstration — refuse de tourner en production |
| `./infra/age-cles.sh` | Génère la paire de clés qui protège les sauvegardes |
| `./infra/sauvegarde.sh` | Vidage chiffré et manifeste de contrôle |
| `./infra/hors-site.sh` | Dépose hors site, **et relit ce qu'il a déposé** |
| `./infra/restauration-test.sh` | **Le seul contrôle qui prouve que les sauvegardes servent** |

## Organisation

```
apps/web        Next.js 16 — vitrine et portails
apps/api        Fastify 5 — API REST /api/v1, sessions, RBAC
db              Migrations SQL versionnées et jeu de démonstration
packages/tokens Les deux couches de tokens (voir son README)
packages/ui     Composants, construits sur les tokens
design/reference Instantané versionné de la maquette Claude Design
design/baselines Base d'images de la régression visuelle
infra           Compose, Nginx, Dockerfiles, sauvegardes, supervision
tools           design-pull, visual
```

## La règle qui tient tout le reste

**Aucune couleur littérale, aucune taille de police en dur, hors de
`packages/tokens`.** Deux contrôles bloquants l'appliquent :

- `lint:css` échoue sur toute valeur en dur dans une feuille de style ;
- `design:pull` échoue si la maquette emploie une couleur ou un degré
  typographique qui n'est pas tokenisé, ou si quelqu'un a édité le miroir de
  Classical ;
- `design:visual` échoue si le rendu s'écarte de la base d'images versionnée.
  Un token décalé d'un pixel suffit à le déclencher.

Les deux tournent en intégration continue, avant la fusion.

**Un angle mort connu :** stylelint ne lit pas les styles en ligne des fichiers
`.jsx`. L'atelier en emploie quelques-uns, tous en `var(--…)`. À couvrir par une
règle ESLint au lot 1, avant que le site public n'en accumule.

## Environnement

```bash
cp .env.example .env
docker compose -f infra/compose.yml --env-file .env up --build   # http://localhost:8080
```

Les migrations se posent depuis l'image, qui les embarque :

```bash
docker compose -f infra/compose.yml --env-file .env exec api node apps/api/src/db/migrate-cli.js
```

### Sauvegardes et supervision

Trois réglages avant toute mise en production réelle, et le service ou les
scripts refusent de tourner sans eux :

- **`SAUVEGARDE_DESTINATAIRE`** — clé publique age, générée par
  `./infra/age-cles.sh`. Sans elle, la sauvegarde refuse de chiffrer sans
  authentifier. L'identité, elle, ne reste pas sur le serveur.
- **`HORS_SITE_TRANSPORT` / `HORS_SITE_CIBLE`** — une sauvegarde posée sur la
  machine qu'elle protège ne protège de rien.
- **`METRICS_TOKEN`** — sans lui, `/api/v1/metrics` répond 404 et le service
  n'émet aucune métrique.

Les règles d'alerte Prometheus sont dans `infra/supervision/alertes.yml`. Voir
`docs/lot-6.md` pour ce qu'elles surveillent et pourquoi.

L'atelier n'est pas publié sur un build de production sauf
`ENABLE_DESIGN_WORKSHOP=1`. Attention : la page étant pré-générée, la variable
est lue **au build**, pas au démarrage — la poser sur un conteneur déjà
construit n'a aucun effet.
