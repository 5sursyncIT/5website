# Lot 3 — Espace client

## Critère de fin

> Un client pilote — la Ville de Dakar — parcourt ses six modules sur données réelles.

**Atteint.** Parcours vérifié au navigateur : accès sans session renvoyé vers
`/fr/connexion?suite=…`, connexion, puis les six modules servis avec les
données du seul périmètre de la Ville de Dakar et des indicateurs calculés.

## Ce qui a été vérifié

| Vérification | Résultat |
| --- | --- |
| `npm test` | 94 tests |
| `npm run design:visual` | 24 vues conformes |
| `npm run perf:budget` | dans le budget |
| `npm run lint:css` · `design:pull` | 0 violation, 0 dérive |
| Six modules d'un compte client | 1 entrée chacun, aucune de l'autre organisation |
| Accès croisé explicite (`?organisation=`) | 403 |
| Ressource d'un autre client par identifiant | 404, jamais 403 |
| Agent sur les pièces financières | 403 ; sur les tickets, 200 |
| Exécutable renommé `.pdf` | refusé sur son contenu |
| Téléchargement | identique à l'octet, `no-store`, hors racine web |

## Les six modules sont pilotés par une table, pas dupliqués

Ils partagent exactement la même forme — indicateurs, rangée-fiche, cartes
latérales — et ne diffèrent que par l'affectation des champs. Cette affectation
**vient de Claude Design** : quatre rôles par module (référence, objet,
attributs, figure), qui remplacent l'ordre de sacrifice des colonnes que nous
demandions. Puisqu'il n'y a plus de colonnes, aucun champ n'est masqué à aucune
largeur.

Écrits six fois, ces modules auraient divergé. La table rend aussi visible en
un coup d'œil la correspondance route/capacité — ce qu'on veut pouvoir
vérifier en revue.

## Trois refus, trois codes différents, et c'est délibéré

- **401** — pas de session. Le portail renvoie vers la connexion en conservant
  la destination.
- **403** — session valide, mais rôle insuffisant. Un agent sur les pièces
  financières voit un message qui le lui dit, pas une liste vide qui
  ressemblerait à une panne.
- **404** — ressource hors périmètre. Répondre « interdit » confirmerait que la
  référence existe : c'est déjà une information sur un autre client.

## Deux bugs trouvés en cours de route

- **Le rail affichait le nom du compte à la place de l'organisation.** La route
  `/api/v1/organisations/:id` n'existait pas — le dépôt était écrit, jamais
  exposé. Le portail retombait silencieusement sur `session.nom`, ce qui donnait
  « Référent DSI » deux fois. Or c'est le périmètre qui doit être lisible d'un
  coup d'œil, surtout pour un agent travaillant pour plusieurs entités.
- **Un test de contrôle d'accès qui ne testait rien.** Envoyé avec un corps non
  multipart, l'appel était rejeté en 415 par Fastify **avant** d'entrer dans la
  route : le refus arrivait bien, mais pas de la vérification de capacité que
  le test prétendait couvrir. Corrigé, et le comportement d'ordre est désormais
  couvert par son propre test.

## Notifications

Les envois partent **hors transaction et sans être attendus** : un serveur de
courrier lent ne doit pas faire échouer un ticket qui a bien été ouvert. La
conséquence est assumée — une notification peut se perdre — et c'est le bon
compromis.

Deux versions par message, texte brut et HTML : les messageries
d'administration filtrent souvent le HTML, et un message qui n'a que cette
version arrive vide. L'objet ne divulgue rien — « TCK-4471 » n'apprend rien à
qui lit par-dessus l'épaule, l'objet du ticket si. Les destinataires d'un dépôt
de document sont en copie cachée : les adresses des agents d'une même
collectivité n'ont pas à circuler entre eux par nos soins.

En développement et en test, rien ne part : les messages sont capturés en
mémoire. Le jeu de démonstration étant peuplé d'organisations réelles, un envoi
accidentel écrirait à de vraies adresses.

## Ce qui reste

- **La régression visuelle s'arrête aux pages publiques.** Capturer l'espace
  client suppose d'ajouter PostgreSQL et l'API au job visuel et d'y ouvrir une
  session. Prévu, non fait — écrit ici plutôt que sous-entendu.
- **Les fiches de détail.** Les rangées pointent vers `/espace-client/:module/:id`,
  qui n'existe pas encore ; seuls les documents ont une action réelle, le
  téléchargement.
- **L'analyse antivirus des dépôts.** Le type réel est vérifié, la taille
  bornée, le chemin fabriqué — mais aucun fichier n'est scanné. À brancher au
  lot 5 avec le durcissement.
- **Le second facteur** pour le back-office, également au lot 5.
