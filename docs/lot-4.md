# Lot 4 — Back-office : la couche HTTP

## Ce que ce lot livre, et ce qu'il ne livre pas

**Il livre l'API du back-office. Il ne livre aucun écran.**

Les artboards du back-office ne sont pas livrés — la demande déposée le
26.08.2026 (`design/brief-artboards-back-office.md`) est restée sans réponse,
et le projet Claude Design ne contient toujours que les artboards de l'espace
client. Sur les onze vues de liste dessinées, **aucune vue de détail, aucun
écran de création** n'existe : ni la fiche d'un client, ni le détail d'un
ticket côté opérateur, ni les quatre formulaires derrière les cinq boutons
d'action.

Attendre pour tout n'était pas nécessaire. Ce qui suit ne dépend d'aucun
dessin : ce qui est requis en base est requis ici, ce qui est calculé est
calculé, et qui a le droit de quoi se déduit des rôles déjà déclarés. Le
nombre de champs affichés, leur ordre et ce qui se passe après
l'enregistrement restent entiers pour le design.

## Ce qui a été vérifié

| Vérification | Résultat |
| --- | --- |
| `npm test` | **131 tests**, dont 23 nouveaux — et trois passages d'affilée |
| `npm run lint:css` · `design:pull` | 0 violation, 0 dérive, miroir conforme |
| `npm audit --omit=dev` | 0 vulnérabilité |
| Les cinq créations, depuis un compte client | 403 sur les cinq |
| Le compte référent créé | se connecte réellement, avec le secret rendu une fois |
| Création refusée | aucune organisation ne survit — tout ou rien vérifié en base |
| Note interne, vue d'un compte client | absente de la réponse HTTP, pas masquée à l'affichage |
| Réponse publique / note interne | l'une notifie le client, l'autre non |
| Rattachement au contrat d'un autre client | 400, jamais la clé étrangère |
| Journal d'audit | lisible en `admin` seul ; ni POST, ni PATCH, ni DELETE |
| Identifiant mal formé | 404, plus 500 |

## Les treize routes

**Les cinq créations** — `POST` sur `/organisations`, `/projets`, `/contrats`,
`/interventions`, `/finances`. Ce sont les cinq boutons du back-office qui ne
menaient nulle part.

**Les gestes sur un ticket** — le fil (`GET`/`POST .../messages`), le
changement d'état (`PATCH /tickets/:id`), l'imputation d'heures
(`POST /contrats/:id/heures`).

**Les interventions**, qui n'avaient aucune route : liste, indicateurs, détail.

**Le journal d'audit** (`GET /audit`), qui n'en avait aucune non plus.

## Cinq décisions, et leurs raisons

### Le montant d'une pièce est calculé, jamais reçu

Quand une pièce porte des lignes, son montant est la somme des lignes — le
`montantFcfa` envoyé par l'appelant est ignoré. Deux sources pour un même
total finissent par diverger, et le jour où elles divergent, c'est sur une
facture, donc devant un client. Un test envoie délibérément un montant
mensonger avec des lignes justes, et vérifie que ce sont les lignes qui
l'emportent.

L'arrondi porte sur le total de **chaque ligne**, pas sur la somme : c'est la
ligne qui est imprimée, et un total qu'on ne retrouve pas en additionnant ce
qui est imprimé est un litige.

### Les horodatages d'un ticket se déduisent du statut

`pris_en_charge_le` se pose au premier départ de « ouvert » et **ne bouge
plus** : un aller-retour par « votre_retour » ne doit pas remettre la GTI à
zéro. `resolu_le` s'efface à la réouverture — un ticket rouvert n'est pas un
ticket résolu, et le laisser daté fausserait le respect des SLA **dans le sens
flatteur**, ce qui est la direction dans laquelle une erreur ne se remarque
jamais.

### « Absent » et « vide » ne sont pas la même chose

`contrat` absent du corps d'un `PATCH` laisse le rattachement en l'état ;
`contrat: null` le retire. Les confondre détacherait un ticket de son contrat
à chaque changement de statut — et viderait, requête après requête, l'assiette
sur laquelle le respect des SLA est calculé. Personne ne l'aurait vu : le taux
resterait affiché, simplement calculé sur de moins en moins de tickets.

### Deux capacités pour les contrats

Rédiger un contrat est un engagement commercial : `contrats:ecrire`, réservé à
`admin`. Y imputer des heures est le geste quotidien d'un intervenant :
`contrats:imputer`, ouvert à `staff`. Une seule capacité aurait obligé à
choisir entre bloquer le staff sur son travail courant et lui ouvrir la
rédaction des contrats.

Les minutes sont bornées à une journée. Au-delà, c'est une saisie en heures
prise pour des minutes, ou une virgule qui a sauté : le refus coûte une
correction, l'acceptation fausse un forfait.

### Le mot de passe provisoire est rendu une fois, et c'est un pis-aller

Créer un client crée aussi son premier référent, faute de quoi l'organisation
est une coquille que personne ne peut ouvrir. Ce compte a besoin d'un secret,
et **il n'existe pas encore de parcours de réinitialisation dans ce projet** :
un secret que personne ne connaît donnerait un compte inutilisable. Il est
donc rendu une seule fois, à l'opérateur qui vient de créer le compte, et
n'est jamais relisible.

L'alphabet exclut les caractères que personne ne sait dicter au téléphone —
0/O, 1/l/I — parce que c'est ainsi qu'il sera transmis en pratique.

**À remplacer par un lien d'invitation à usage unique** dès qu'un parcours de
réinitialisation existera. C'est écrit ici pour que ce ne soit pas oublié.

## Quatre choses trouvées en construisant

### Les sites d'un nouveau client ne s'inséraient pas

Créer une organisation, ses sites et son référent dans une même transaction
échouait en 500. `organisations` et `users` sont hors cloisonnement — leur
exemption est motivée en commentaire de table depuis la migration 012 — mais
`sites`, lui, est protégé : sa politique exige un contexte, et une transaction
ouverte sans contexte s'y voit refuser l'insertion.

La correction n'était pas d'exempter `sites`, ni de créer en deux temps — ce
qui rendrait possible l'organisation sans ses sites. C'est le contexte
transverse du personnel qui convient, et lui seul.

### Un identifiant mal formé répondait 500

`/api/v1/tickets/pas-un-uuid` descendait jusqu'à PostgreSQL, qui refusait la
conversion : le refus arrivait bien, mais il se présentait comme une **panne du
service** alors que c'est une URL invalide. En exploitation, cela réveille
quelqu'un la nuit pour rien, et cela noie les vraies 500 dans le bruit.

Le contrôle est posé une fois, dans un `preHandler` global, et non route par
route : les routes existantes en bénéficient sans avoir été touchées, et
celles de demain en hériteront sans que personne n'ait à y penser.

La réponse est **404 et non 400** : un identifiant qui n'a pas la forme d'un
identifiant ne désigne aucune ressource, et c'est déjà la réponse donnée à une
ressource hors périmètre. Deux réponses différentes apprendraient à distinguer
« mal formé » de « pas à vous ».

### `users` ne porte pas de déclencheur d'audit, et il ne faut pas en poser

En ouvrant le journal à la lecture, la question se pose : que contient-il
exactement ? Le déclencheur `app.tracer()` écrit la **ligne entière** dans
`details`. Sur `users`, il y ferait entrer les empreintes de mots de passe et
les secrets TOTP — dans une table en écriture seule, où un secret révoqué
resterait lisible pour toujours.

Aucune migration ne pose ce déclencheur sur `users`. C'était juste, ce n'était
écrit nulle part : ça l'est maintenant, dans le dépôt d'audit, pour que
personne ne « complète » la traçabilité en croyant bien faire.

### La suite de tests se sabotait elle-même, au cinquième passage

En ajoutant vingt-trois tests qui ouvrent des sessions, toute la suite s'est
mise à répondre **429** — y compris des tests que rien n'avait touchés.

La cause n'était pas le nouveau code. Plusieurs suites se trompent de mot de
passe **exprès**, depuis 127.0.0.1 : c'est ainsi qu'on vérifie qu'un refus ne
dit pas s'il porte sur l'adresse ou sur le mot de passe. Chaque exécution en
laissait deux en base, et la limitation par adresse posée au lot 5 bloque à
dix échecs sur quinze minutes. **Au cinquième `npm test` d'affilée, la suite
tombait** — c'est-à-dire précisément pendant qu'on développe.

Un test qui échoue pour une raison sans rapport avec ce qu'il vérifie est pire
qu'un test absent : il désigne le mauvais coupable, et on apprend à le
relancer au lieu de le lire.

Les suites concernées effacent désormais leurs échecs volontaires, comme
`durcissement.test.js` le faisait déjà pour ses adresses de documentation.
Vérifié en enchaînant trois exécutions complètes : 131 tests à chaque fois, et
il ne reste en base que des tentatives **réussies**, que la limitation ignore.

## Le journal d'audit est en lecture seule, et c'est une propriété, pas un oubli

Ni `POST`, ni `PATCH`, ni `DELETE`, ni purge. Un journal qu'une route peut
modifier ne prouve plus rien — c'est exactement ce qu'on lui demande. Un test
vérifie que les trois verbes répondent 404.

La rotation, le jour où le volume l'imposera, sera une tâche d'exploitation
avec sa propre trace, pas un appel d'API.

La pagination se fait par identifiant décroissant et non par décalage : un
`offset` sur un journal qui grossit pendant la lecture saute des lignes et en
répète d'autres.

Le filtre de table est une **liste fermée**. `table_cible` est indexée, et
laisser passer une chaîne quelconque ferait balayer le journal entier à chaque
faute de frappe. La liste dit aussi, en un coup d'œil, ce que ce service trace
réellement.

## Ce qui reste

- **Les écrans.** Tout le lot 4 visuel : les cinq listes, la fiche client, le
  détail d'un ticket, les quatre créations, le détail d'un document. Bloqué
  sur les artboards.
- **L'écran d'enrôlement du second facteur**, annoncé au lot 5 comme venant
  avec le back-office. Les routes existent et sont testées depuis le lot 5.
- **Le parcours de réinitialisation de mot de passe**, dont dépend le
  remplacement du secret provisoire par un lien d'invitation.
- **La modification et la suppression.** Ce lot ne fait que créer et changer
  l'état d'un ticket. Corriger une pièce, clore un projet, retirer un
  équipement : rien de tout cela n'a de route, et rien ne dit encore ce qui
  doit être modifiable — c'est une question de design autant que de code.
- **L'historique des versions d'un document** reste sans forme : la base
  conserve chaque version, son empreinte et son auteur ; la maquette n'affiche
  qu'un numéro.
