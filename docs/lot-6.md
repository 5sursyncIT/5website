# Lot 6 — Mise en production réelle

Le lot 5 s'était clos sur trois réserves : `age` n'était pas installé, le dépôt
hors site n'était pas branché, la supervision se limitait à une sonde. Ce lot
les lève.

Il en a trouvé quatre autres en chemin, et ce sont peut-être les plus
importantes : **la pile de production n'avait jamais démarré.**

## Critère de fin

> `docker compose up` monte les quatre services ; la sauvegarde est chiffrée de
> façon authentifiée, déposée hors site et relue ; la supervision voit tout cela.

**Atteint.** La pile complète a été construite, montée, migrée et exercée ; les
métriques ont été relevées depuis le réseau interne et refusées depuis
l'extérieur.

## Ce qui a été vérifié

| Vérification | Résultat |
| --- | --- |
| `npm test` | **142 tests**, dont 11 nouveaux |
| `docker compose up --build` | les 4 services montent, `/api/v1/health` répond `ok` |
| Migrations depuis l'image déployée | 18 migrations posées |
| Site public servi par la pile | `/` 307 → `/fr`, `/fr/expertises` 200 |
| Sauvegarde chiffrée par clé publique age | 295 Ko, sans phrase secrète, sans terminal |
| Sauvegarde age altérée d'un octet | **refusée au déchiffrement**, pas seulement à l'empreinte |
| En production, sans clé publique | refus, et aucun vidage en clair laissé derrière |
| Dépôt hors site, transport `rsync` | déposé, relu, empreinte conforme |
| Dépôt hors site, transport `rclone` vers S3 | déposé, relu, empreinte conforme (MinIO) |
| Copie distante tronquée | détectée par la relecture, sur les deux transports |
| Exercice de restauration, chemin age | réussi en 7 s, isolation intacte |
| Règles d'alerte | `promtool check rules` — 12 règles |
| Exposition des métriques | `promtool check metrics` — valide |
| Métriques depuis l'extérieur | 404, **même avec le bon jeton** |
| Métriques depuis le réseau interne | 200, avec le jeton |
| `nginx -t` sur la configuration livrée | valide |

## Quatre raisons pour lesquelles la pile ne pouvait pas démarrer

Aucune n'a été trouvée en relisant du code. Toutes ont été trouvées en tapant
`docker compose up` — ce que, manifestement, personne n'avait fait depuis que
ces fichiers existaient.

### 1. nginx refusait de se lancer

`limit_req_zone` était déclaré **dans le bloc `server`**, où nginx l'interdit :
la zone est une mémoire partagée par tous les serveurs virtuels du processus,
la déclarer par serveur n'a pas de sens, et nginx le dit en refusant de
démarrer plutôt qu'en ignorant la ligne.

Conséquence : le conteneur nginx ne montait pas, donc **rien** n'était joignable
— ni le site, ni l'API. La limitation de débit décrite au lot 5 comme
« complément de celle tenue en base » n'a jamais été active une seconde.

### 2. L'API refusait de démarrer

`compose.yml` ne transmettait pas `DATABASE_APP_URL`. Or `assertProductionConfig()`
l'exige dès que `NODE_ENV=production` — c'est-à-dire toujours, dans ce fichier.

Le refus était le **bon** comportement : sans cette variable, l'API se
connecterait avec le propriétaire des tables, qui contourne Row-Level Security,
et l'isolation entre organisations serait inopérante. C'est la configuration qui
était incomplète, pas le garde-fou.

### 3. L'API ne pouvait pas écrire ses documents

Docker recopie dans un volume nommé vide les droits du répertoire correspondant
de l'image. `/srv/documents` n'existait pas dans l'image : le volume était donc
créé par le démon, appartenant à root, et le service — qui tourne sans
privilèges, comme il le doit — n'y écrivait rien. En production,
`verifierStockage()` coupe le démarrage, et le conteneur redémarrait en boucle.

Là encore, le garde-fou du lot 1 faisait son travail. Personne n'était là pour
l'entendre.

### 4. On ne pouvait pas migrer la base déployée

L'image n'embarquait pas `db/migrations`. Migrer une production aurait supposé
d'avoir en plus un dépôt Git sur le serveur — donc de faire dépendre le schéma
de deux sources capables de diverger. L'image qui sert le code porte désormais
le schéma qu'il attend.

**Ce que ces quatre défauts ont en commun :** ils étaient tous dans des fichiers
de configuration, et aucun contrôle ne lisait ces fichiers. Une configuration
qu'on ne fait pas valider est du texte. L'intégration continue valide maintenant
`nginx -t`, `promtool check rules` et `docker compose config` à chaque fusion.

## Le chiffrement des sauvegardes : le chemin recommandé ne fonctionnait pas

Le lot 5 laissait la consigne « installer `age` avant la mise en production ».
En l'installant, on découvre que le code qui l'aurait employé est faux :

```bash
age --passphrase --output "$CHIFFRE" "$BRUT" <<<"$SAUVEGARDE_CLE"
```

**`age --passphrase` exige un terminal et refuse de lire une phrase sur un
tube.** C'est un choix délibéré de son auteur. Cette ligne ne pouvait donc
tourner ni dans une tâche planifiée, ni en intégration continue — mais comme
`age` n'était installé nulle part, elle n'avait jamais été exécutée. La branche
recommandée était la branche morte.

### Une paire de clés, pas une phrase secrète

C'est la bonne façon d'employer age pour une sauvegarde, et elle est meilleure
que ce qu'on cherchait à faire :

**La clé publique suffit à chiffrer.** La machine qui sauvegarde n'a jamais
besoin du secret qui déchiffre. Quelqu'un qui la compromet ne peut pas lire les
sauvegardes passées — ce qu'une phrase secrète posée sur cette même machine ne
permet pas de promettre. L'identité vit ailleurs : coffre de l'entreprise,
support chiffré rangé dans un autre bâtiment.

`./infra/age-cles.sh` génère la paire, refuse d'écraser une identité existante,
et rappelle que sans elle aucune restauration n'est possible — sans recours,
sans réinitialisation, sans personne à appeler.

### age vient avec le projet, pas avec la machine

Faire dépendre le chiffrement de ce qui se trouve installé là où le script
tourne, c'est accepter que la propriété de sécurité change selon la machine, et
qu'elle change **en silence** : c'est exactement ce qui s'est passé au lot 5.

`infra/age.Dockerfile` fournit un age épinglé. Les scripts préfèrent toujours un
age installé sur la machine ; l'image n'existe que pour qu'il ne puisse jamais
ne pas y en avoir.

### Le repli non authentifié est désormais un refus

En production, `sauvegarde.sh` refuse `openssl enc` au lieu de l'employer en
avertissant. Un avertissement dans une tâche planifiée n'est lu par personne.

Le gain est vérifié plutôt qu'affirmé : altérer un octet d'une sauvegarde age
la fait échouer **au déchiffrement** — `failed to decrypt and authenticate
payload chunk` — et non à la comparaison d'empreinte du manifeste. La
différence compte, parce que l'empreinte est un contrôle qu'on peut oublier de
faire, et qu'un attaquant qui atteint le répertoire réécrit en même temps que
le fichier.

## Le dépôt hors site relit ce qu'il a écrit

`infra/hors-site.sh` envoie, puis **relit la copie déposée et compare son
empreinte**. C'est la seule ligne du script qui prouve quelque chose ; tout le
reste ne fait que déplacer des octets.

Un envoi qui se termine par « succès » en ayant écrit un fichier tronqué est le
mode de panne le plus courant du transfert de fichiers : coupure réseau, quota
atteint, disque plein en face. Sans relecture, on le découvre le jour de la
restauration.

L'empreinte comparée est celle du fichier **chiffré**, relevée à la sauvegarde
et inscrite au manifeste. Le script n'a donc jamais besoin de la clé — la
machine qui pousse hors site n'a aucune raison de pouvoir lire ce qu'elle
pousse.

**Ce que cette vérification ne prouve pas**, et c'est dit dans le script :
rien contre quelqu'un qui contrôlerait le dépôt distant, puisqu'il réécrirait
fichier et manifeste ensemble. C'est le chiffrement authentifié qui répond à
celui-là.

Deux transports, éprouvés tous les deux : `rsync` — chemin local, disque
externe, montage NFS ou SSH — et `rclone`, vers S3 et compatibles. Le second a
été exercé contre un vrai MinIO, y compris le remplacement d'un objet par un
fichier tronqué, que la relecture attrape.

La rétention distante est appliquée **après** les vérifications, et seulement si
aucune n'a échoué : supprimer d'anciennes copies alors qu'on vient de constater
que la nouvelle est illisible reviendrait à réduire le nombre de sauvegardes
valides au moment précis où l'on découvre qu'il y en a une de moins.

## La supervision mesure ce qui réveillerait quelqu'un

`GET /api/v1/metrics`, au format d'exposition Prometheus — le seul qui n'oblige
à rien : Prometheus, mais aussi Grafana Agent, Datadog, Vector, Netdata,
telegraf. Un JSON de notre invention aurait demandé un adaptateur avant la
première courbe.

Trois chiffres comptent plus que les autres :

1. **La base répond-elle ?** Tout le reste en découle.
2. **Quand date la dernière sauvegarde ?** Une sauvegarde qui a cessé de tourner
   ne fait aucun bruit — c'est sa propriété la plus dangereuse.
3. **Quand date le dernier exercice de restauration RÉUSSI ?** C'est celui qu'on
   ne trouve presque jamais supervisé, et le seul qui distingue « nous
   sauvegardons » de « nous savons restaurer ».

`restauration-test.sh` et `hors-site.sh` déposent un marqueur horodaté quand ils
réussissent — et seulement alors. Le dépôt hors site n'écrit le sien que si au
moins une copie a été **vérifiée** : un passage qui n'a rien trouvé à vérifier
ne prouve rien, et le dater ferait taire l'alerte sans avoir protégé quoi que
ce soit.

### Une valeur absente n'est pas zéro

Quand il n'existe aucune sauvegarde, la série n'est pas émise — plutôt que
d'être émise à `0`. Zéro voudrait dire « sauvegarde d'il y a une seconde », soit
exactement l'inverse de la vérité, et l'alerte de retard ne partirait jamais.
C'est `absent(...)` qui attrape ce cas, et une règle le fait.

### L'âge vient du manifeste, pas de la date du fichier

Une copie, un `rsync` ou une restauration de volume remettent la date du fichier
à aujourd'hui et feraient passer pour fraîche une sauvegarde de la semaine
dernière. L'âge est calculé depuis l'horodatage inscrit **dans** le manifeste.

### Deux serrures sur les métriques, pas une

Le relevé dit combien d'organisations sont clientes et combien de comptes
existent : ce sont des chiffres commerciaux. Un jeton porteur les protège
— comparé à durée constante, un `===` s'arrêtant au premier caractère qui
diffère — et nginx renvoie 404 sur cette adresse depuis l'extérieur, même avec
le bon jeton. Le collecteur passe par le réseau interne.

Sans `METRICS_TOKEN`, la route répond 404 et le démarrage l'annonce. C'est un
avertissement et non un refus de démarrer : mettre la supervision sur le chemin
critique du démarrage rendrait le service moins disponible, pas mieux
supervisé. La contrepartie est couverte — `absent(cinqsync_base_disponible)`
fait du silence lui-même une alerte.

### Deux erreurs de protocole, trouvées par promtool

**Un nom de métrique ne peut pas commencer par un chiffre.** Prometheus impose
`[a-zA-Z_:][a-zA-Z0-9_:]*` : `5sync_base_disponible` se lit dans une expression
PromQL comme le nombre 5 suivi de charabia, et `promtool` refuse les règles qui
l'emploient. D'où `cinqsync_`. Un test vérifie maintenant qu'aucune métrique
émise ne commence par un chiffre.

**Les suffixes `_sum` et `_count` ne se traduisent pas.** Tout ce projet est en
français ; ces deux-là appartiennent au format d'exposition. Écrits `_somme` et
`_nombre`, promtool y voit deux compteurs mal nommés au lieu d'un `summary`, et
aucun collecteur ne les interprète.

Les deux ont été trouvées en faisant valider les fichiers plutôt qu'en les
relisant. C'est la même leçon que les quatre défauts de configuration.

## La cardinalité est bornée par le code, pas par le trafic

Étiqueter par `request.url` produirait une série par identifiant de ticket
rencontré : quelques milliers de tickets, et le collecteur garde des centaines
de milliers de séries pour une information qui n'en est pas une. On étiquette
par le **gabarit** de route — `/api/v1/tickets/:id` — dont le nombre est borné
par le code. Ce qui n'a pas de gabarit est regroupé sous `inconnue`, pour qu'un
balayage d'URL par un robot ne crée pas une série par tentative.

Deux tests l'imposent : trois identifiants doivent donner **une** série, et cinq
URL inventées ne doivent en créer qu'une.

## Ce qui reste

- **`SAUVEGARDE_CLE` reste employée par gpg et openssl**, c'est-à-dire hors
  production. Elle disparaîtra le jour où le repli non authentifié sera retiré
  tout à fait — ce qui suppose que plus aucune sauvegarde openssl ne subsiste.
- **Les sauvegardes prises avant ce lot** n'ont pas d'empreinte du fichier
  chiffré : `hors-site.sh` les ignore et le dit, plutôt que de déposer une copie
  qu'il ne saurait pas vérifier.
- **La rotation des clés age** n'a pas de procédure écrite. Renouveler la paire
  rend illisibles les sauvegardes antérieures ; le script refuse d'écraser une
  identité, mais refuser n'est pas une procédure.
- **La planification** n'est pas posée : rien ne lance encore `sauvegarde.sh`
  ni `hors-site.sh` la nuit. C'est une tâche `cron` ou un `systemd.timer` à
  installer sur le serveur, et cela dépend de l'hébergement retenu.
- **Aucune alerte n'est routée.** Les règles sont écrites et validées ; où elles
  sonnent — courriel, SMS, Slack — reste à décider avec vous.
- **Le lot 4 visuel** est toujours bloqué sur les artboards du back-office.
