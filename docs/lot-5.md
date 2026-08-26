# Lot 5 — Durcissement et mise en production

## Critère de fin

> Restauration complète réussie depuis une sauvegarde, sur une machine vierge,
> chronométrée.

**Atteint. 5 secondes**, sur le volume actuel. Et l'exercice a été mis à
l'épreuve : altérer un octet de la sauvegarde le fait échouer sur l'empreinte,
annoncer sept organisations là où il n'y en a que trois le fait échouer sur les
comptages.

## Ce qui a été vérifié

| Vérification | Résultat |
| --- | --- |
| `npm test` | 108 tests |
| Exercice de restauration | réussi en 5 s, isolation intacte |
| L'exercice détecte une sauvegarde altérée | oui, sur l'empreinte |
| L'exercice détecte une restauration incomplète | oui, sur les comptages |
| CSP appliquée | 0 violation au navigateur, sur les deux politiques |
| Force brute sur la connexion | bloquée au 6e essai |
| Second facteur | conforme aux vecteurs RFC 6238 |
| `design:visual` · `perf:budget` · `audit` | conformes |

## Trois trous comblés, dont un que nous avions annoncé bouché

**La connexion n'avait aucune limite.** Un attaquant pouvait essayer des mots de
passe aussi vite que le réseau le permettait. Argon2id rend chaque essai
coûteux, ce qui aide, mais ne remplace pas une limite : il rend l'attaque lente,
pas impossible, et rend surtout le service attaquable par épuisement de CPU.

La limite est **en base et non en mémoire** — un compteur en mémoire se remet à
zéro à chaque redémarrage, donc il suffit de faire tomber le service — et porte
sur **deux axes** : par adresse, contre mille mots de passe sur un compte ; par
compte, contre un mot de passe sur mille comptes depuis mille adresses, cas
contre lequel la limite par adresse ne peut rien.

Le verrouillage est **borné dans le temps**. Un verrouillage définitif
transformerait la protection en déni de service : il suffirait d'échouer
volontairement pour fermer l'accès d'un agent.

**Le second facteur n'existait pas.** La colonne `totp_secret` était en base
depuis le lot 2 et aucun code ne la lisait. Elle est maintenant obligatoire pour
tout compte 5/Sync — le seul rôle dont la compromission expose l'ensemble des
clients.

L'état est porté par **la session**, pas par le compte : « ce compte a un second
facteur » et « cette session l'a franchi » sont deux choses différentes. Sans ce
drapeau, un jeton obtenu avant l'enrôlement resterait valable après.

L'algorithme est vérifié contre **les vecteurs officiels de la RFC 6238**, et
non contre lui-même — c'est la seule façon de savoir qu'une implémentation de
crypto est juste.

**La CSP n'existait pas.** Le commentaire de la configuration Nginx en annonçait
une « volontairement stricte » ; aucun en-tête `Content-Security-Policy` n'était
émis. C'est corrigé, et l'arbitrage est explicite plutôt que masqué :

- **Espace client, back-office, connexion** — déjà dynamiques puisqu'ils lisent
  le cookie. Le nonce n'y coûte rien, et c'est là que tout se joue. CSP stricte,
  sans `unsafe-inline`.
- **Pages publiques** — statiques, pré-générées, et n'affichant aucune saisie
  d'utilisateur : le formulaire de contact ne réaffiche pas les valeurs reçues,
  donc il n'y a pas de contenu réfléchi à couvrir. `unsafe-inline` y est toléré
  pour les scripts, et pour eux seuls. L'alternative — un nonce partout —
  rendrait les six pages dynamiques et ferait tomber le budget de performance,
  qui est un argument commercial de ce site.

La CSP est émise par le middleware et **non dupliquée dans Nginx** : quand deux
en-têtes CSP coexistent, le navigateur applique leur intersection, et le moindre
écart casse la page sans que la cause soit visible.

## L'exercice de restauration vérifie l'isolation, pas seulement les données

C'est le contrôle qui manque presque toujours. Une base restaurée sans
Row-Level Security, sans `FORCE`, ou avec un rôle applicatif superutilisateur
fonctionnerait parfaitement — et exposerait tous les clients les uns aux autres.
**Une restauration qui rétablit les données en perdant l'isolation est un échec,
pas un succès.**

Le premier passage a signalé `users` et `audit_log` comme non cloisonnées. Ce
n'était pas une régression mais une **fausse alerte de mon script** : ces deux
tables portent une exemption motivée en commentaire, que le test de schéma
connaît et que le script de restauration ignorait. Deux définitions du même fait
finissent toujours par diverger — et une alerte qu'on apprend à ignorer est pire
que pas d'alerte, parce qu'elle donne l'habitude de passer outre le jour où elle
est vraie. Le script emploie désormais la règle du test de schéma, mot pour mot.

## Le verrou du second facteur a cassé quatre tests, et c'est la preuve qu'il mord

Quatre tests des lots précédents se connectaient en personnel et agissaient
directement. Ils échouent maintenant en `second_facteur_requis`. Le correctif
n'était pas d'affaiblir le verrou mais de leur faire franchir le second facteur
— ce que fait un vrai intervenant. L'aide `connecterPersonnel()` reproduit le
parcours réel plutôt que de le contourner.

## Antivirus

Branché sur clamd par le protocole INSTREAM, sans dépendance ni binaire invoqué
— donc sans ligne de commande où faire passer un nom de fichier. L'analyse a
lieu **avant toute écriture** : un fichier reconnu ne touche jamais le disque.

**En production, un antivirus configuré mais injoignable fait échouer le dépôt.**
Accepter « parce que le scanner est en panne » revient à n'avoir aucun scanner
les jours où ça compte. Hors production, on avertit et on laisse passer.

Si `CLAMD_HOST` n'est pas configuré du tout, les dépôts passent — c'est un choix
de déploiement possible — mais chaque dépôt le journalise.

## Ce qui reste

- **Ni age ni gpg sur cette machine** : la sauvegarde retombe sur `openssl enc`,
  qui chiffre mais n'authentifie pas. L'intégrité repose alors sur l'empreinte
  du manifeste. Le script le signale bruyamment ; à corriger avant la mise en
  production réelle en installant `age`.
- **Le dépôt hors site** n'est pas branché : les sauvegardes restent locales,
  avec une rotation de sept jours. Une sauvegarde sur la machine qu'elle
  protège ne protège de rien.
- **La supervision** se limite à la sonde `/api/v1/health`. Ni métriques, ni
  alerte : à décider selon ce que vous exploitez déjà.
- **Le second facteur n'a pas d'interface web** : les routes existent et sont
  testées, l'écran d'enrôlement viendra avec le back-office.
