# Lot 2 — Socle et accès

## Critère de fin

> Les tests d'isolation entre organisations passent ; toute tentative d'accès
> croisé échoue.

**Atteint.** 19 tests d'isolation, 11 tests d'API de bout en bout, 16 tests
d'authentification, 6 garde-fous de schéma. Tous verts.

## La décision structurante

**L'isolation est tenue par PostgreSQL, pas par le code applicatif.**

Chaque table portant des données client active Row-Level Security. Une requête
qui « oublie » son filtre ne renvoie pas les données d'un autre client : elle ne
renvoie rien. Le défaut est le refus — hors de `withTenant`, `app.organisation_id`
vaut NULL, la comparaison vaut NULL, la politique rejette.

Une fuite exigerait donc une erreur **active**, pas un oubli.

### Trois pièges évités explicitement

| Piège | Conséquence si manqué | Parade |
| --- | --- | --- |
| Vue sans `security_invoker` | La vue s'exécute avec les droits de son propriétaire et ignore RLS | Test de schéma bloquant (voir addendum) |
| Oublier `FORCE ROW LEVEL SECURITY` | Le propriétaire des tables contourne ses propres politiques | `app.proteger()` le pose toujours |
| Connecter l'API en superutilisateur | Un superutilisateur ignore RLS **en toutes circonstances** : tout le dispositif devient décoratif | Rôle `app_5sync` distinct, non superutilisateur, testé comme tel |
| `set_config` sans le drapeau `local` | La connexion rendue au pool garde le périmètre du client précédent | `set_config(..., true)`, plus un test dédié |

Le deuxième piège est le plus traître : rien ne casse. Les requêtes continuent
de fonctionner, elles voient simplement tout. L'API refuse donc de démarrer en
production si `DATABASE_APP_URL` égale `DATABASE_URL`.

## Ce que les tests ont trouvé

**Un vrai défaut, attrapé par le test de bout en bout.** La politique initiale
disait `organisation_id = current_organisation() OR is_staff()`. Pour un compte
du personnel, le second terme était toujours vrai : demander explicitement le
périmètre de la Ville de Dakar ne restreignait rien et renvoyait aussi les
tickets de l'Institut National de l'Audiovisuel.

Ce n'était pas une fuite vers un client — le personnel 5/Sync a le droit de tout
voir — mais un mélange. Dans le back-office, l'opérateur ouvrant la fiche d'un
client aurait vu les dossiers d'un autre sur la même page, sans que rien ne le
signale. Corrigé en migration 014 :

```sql
organisation_id = app.current_organisation()
or (app.is_staff() and app.current_organisation() is null)
```

Le personnel voit tout quand il ne demande rien de précis. Dès qu'il pose un
périmètre, celui-ci le lie exactement comme un client.

## Le garde-fou qui survivra au lot 2

Le risque réel n'est pas que les politiques d'aujourd'hui soient fausses — elles
sont testées. C'est qu'une migration écrite dans six mois ajoute une table
cliente en oubliant `app.proteger()`.

Un test lit donc le catalogue PostgreSQL : **toute table portant
`organisation_id` doit avoir RLS activé, forcé, une politique et un déclencheur
d'audit.** Une exemption est possible, mais elle doit être déclarée en
commentaire de table, avec un motif d'au moins 80 caractères — et le test vérifie
qu'il y a bien une raison écrite, pas seulement une étiquette.

Quatre tables sont exemptées, chacune motivée dans la base elle-même :
`organisations` et `users` définissent le périmètre au lieu d'en dépendre,
`audit_log` est transverse par nature, `leads` ne concerne aucun client.

## Vérifications

| Vérification | Résultat |
| --- | --- |
| Isolation (19 tests) | vert |
| Dépôts métier (14 tests) | vert |
| API de bout en bout (11 tests) | vert |
| Authentification (16 tests) | vert |
| Schéma (7 garde-fous) | vert |
| **Total** | **69 tests, 69 verts** |
| **Épreuve : API connectée en superutilisateur** | **9 tests d'isolation sur 10 échouent** |
| Migrations | 16 posées, empreintes verrouillées |
| Vulnérabilités | 0 |

L'épreuve est la plus importante : un test d'isolation qui passe ne prouve rien
tant qu'il n'a pas échoué. En pointant l'API sur le compte propriétaire — l'erreur
classique — neuf tests sur dix tombent.

## Choix de modélisation

- **Les indicateurs se calculent, ils ne se stockent pas.** « Délai moyen de
  prise en charge », « 11/17 jalons », « 74/120 h » sont des vues sur des faits
  horodatés. Les figer en colonnes produirait des chiffres faux dès la première
  semaine d'exploitation.
- **Montants en francs CFA entiers.** Le XOF n'a pas de sous-unité ; un flottant
  sur une facture de 18 200 000 FCFA finit par se voir en comptabilité.
- **Sessions opaques, pas de JWT.** Révoquer un JWT suppose une liste de
  révocation consultée à chaque requête — c'est-à-dire la table qu'il prétendait
  éviter, plus la signature. Le jeton n'est jamais stocké, seulement son
  empreinte SHA-256.
- **SQL écrit à la main.** Les dépôts ne filtrent pas par organisation, et c'est
  voulu : écrire `where organisation_id = $1` donnerait l'illusion que c'est
  cette ligne qui protège.

## Base de développement

```bash
docker run -d --name 5sync-pg -e POSTGRES_USER=5sync -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=5sync_test -p 55432:5432 postgres:16-alpine
```

Puis, avec `DATABASE_URL` et `DATABASE_APP_URL` renseignées :

```bash
npm run db:migrate && npm run db:seed && npm test
```

Sans base configurée, les tests qui en dépendent se déclarent **sautés** plutôt
que de passer à vide — un test d'isolation qui passe sans base est pire
qu'absent.

## Addendum — les cinq dépôts restants

Posés sur le patron de `repositories/tickets.js` : `projets`, `contrats`,
`documents`, `parc`, `finances`. Aucun ne filtre par organisation — c'est
Row-Level Security qui le fait. 14 tests supplémentaires, dont chaque domaine
vérifié sur deux organisations aux volumes **différents** : à volumes égaux, un
indicateur qui compterait la mauvaise organisation donnerait le même chiffre.

### Une fuite trouvée en chemin, et elle était invisible

**Les vues SQL contournaient le cloisonnement.** En PostgreSQL, une vue
s'exécute par défaut avec les privilèges de son *propriétaire*, pas de celui
qui l'interroge. Créées par le propriétaire des tables, `projets_avancement` et
`contrats_consommation` ignoraient donc les politiques : depuis le périmètre
d'un client, elles renvoyaient les lignes de toutes les organisations.

Mesuré avant correction : la table `projets` renvoyait 1 ligne, la vue
`projets_avancement` en renvoyait 3.

C'est le contournement le plus discret du dispositif, parce qu'il ne ressemble
à rien : les politiques sont posées, les tables protégées, les 54 tests du lot 2
passent — et une vue de commodité rend le tout inopérant. **Aucun test du lot 2
ne passait par une vue.** Corrigé en migration 015 (`security_invoker = true`),
et désormais interdit par un garde-fou de schéma.

### Trois décisions de calcul

- **Le respect des SLA dit sur quelle assiette il porte.** Un ticket n'est
  mesurable que rattaché à un contrat : la Ville de Dakar en a deux, à
  2 h / 8 h et 4 h / 24 h, et les confondre donnerait un taux faux. D'où la
  migration 016 qui ajoute `contrat_id`. Les tickets non rattachés sont exclus
  et **leur nombre est renvoyé** — « 100 % » sans assiette ne veut rien dire.
  Sans aucune mesure, le taux vaut `null`, pas 100 %.
- **Le parc compte des unités, pas des lignes.** « Points d'accès UniFi
  (12 unités) » occupe une ligne et vaut douze équipements. Compter les
  enregistrements donnerait un parc trois fois plus petit.
- **L'avancement est pondéré par le poids des jalons**, pas par leur nombre :
  un projet à un lot ne pèse pas autant qu'un projet à six. C'est ce que la
  maquette annonce — « pondéré par lot ».

### Le jeu de démonstration n'était pas idempotent

Il se disait relançable ; il ne l'était pas. Supprimer les organisations
n'emporte pas les comptes du personnel 5/Sync, dont `organisation_id` est NULL
par contrainte — aucune cascade ne les atteint. Le second passage échouait sur
une collision d'adresse e-mail. Corrigé, et vérifié en le lançant deux fois.

## Reste pour la suite

- **Second facteur TOTP** pour le back-office : colonne `totp_secret` en place,
  vérification au lot 5.
- **Limitation de débit** sur la connexion : lot 5.
- **Les routes des cinq domaines.** Les dépôts existent et sont testés ; seuls
  les tickets sont exposés en HTTP. Les cinq autres attendent le lot 3, où ils
  suivront `routes/v1/tickets.js`.
- **Le dépôt effectif des fichiers.** `documents.deposer()` enregistre une
  version et son empreinte ; l'écriture sur disque, la vérification du type
  réel et l'analyse antivirus sont au lot 3.
- **Le journal d'audit est en écriture seule mais pas encore exposé.** La
  capacité `audit:lire` existe, la route non.
