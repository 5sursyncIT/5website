# ═══════════════════════════════════════════════════════════════════════════
# age, en conteneur épinglé.
#
# POURQUOI UNE IMAGE PLUTÔT QU'UN PAQUET SUR LA MACHINE
# Le lot 5 s'est terminé sur « ni age ni gpg sur cette machine », et la
# sauvegarde est retombée sur openssl enc — qui chiffre sans authentifier.
# Faire dépendre le chiffrement de ce qui se trouve installé là où le script
# tourne, c'est accepter que la propriété de sécurité change selon la machine,
# et qu'elle change en silence.
#
# Ici, la même image donne le même age partout : poste de développement,
# intégration continue, serveur de production. Le script préfère toujours un
# age installé sur la machine s'il en trouve un — l'image n'est là que pour
# qu'il ne puisse jamais ne pas y en avoir.
#
# L'image est construite une fois et réutilisée ; « docker build » sur ce
# fichier est instantané ensuite.
# ═══════════════════════════════════════════════════════════════════════════
FROM alpine:3.20

RUN apk add --no-cache age

# Contrôle au build : une image qui ne sait pas chiffrer doit échouer ici, pas
# la nuit où la sauvegarde tourne.
RUN age --version && age-keygen --version

ENTRYPOINT ["age"]
