#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Fonctions partagées par sauvegarde.sh et restauration-test.sh.
#
# Ce fichier n'est pas exécutable : il se « source ». Le mettre en commun n'est
# pas une coquetterie — chiffrement et déchiffrement DOIVENT parler du même
# format. Écrits deux fois, ils divergent, et la divergence ne se découvre que
# le jour de la restauration.
# ═══════════════════════════════════════════════════════════════════════════

IMAGE_AGE="${IMAGE_AGE:-5sync-age:1}"
DOCKERFILE_AGE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/age.Dockerfile"

DOCKER=docker
docker info >/dev/null 2>&1 || DOCKER="sudo docker"

# ── age, sur la machine ou en conteneur ──────────────────────────────────
#
# On préfère toujours un age installé sur la machine : c'est plus rapide et
# cela n'exige pas Docker. Le conteneur n'existe que pour garantir qu'il y ait
# TOUJOURS un age — le lot 5 s'est terminé faute d'en avoir un, et le repli
# silencieux sur openssl a coûté la propriété d'authentification sans que rien
# ne l'empêche.

age_sur_machine() { command -v age >/dev/null 2>&1; }

age_en_conteneur_possible() {
  $DOCKER info >/dev/null 2>&1 || return 1
  $DOCKER image inspect "$IMAGE_AGE" >/dev/null 2>&1 && return 0
  [ -f "$DOCKERFILE_AGE" ] || return 1
  echo "  Construction de l'image $IMAGE_AGE (une seule fois)…" >&2
  $DOCKER build -q -f "$DOCKERFILE_AGE" -t "$IMAGE_AGE" "$(dirname "$DOCKERFILE_AGE")" >/dev/null 2>&1
}

age_disponible() { age_sur_machine || age_en_conteneur_possible; }

age_version() {
  if age_sur_machine; then age --version
  else $DOCKER run --rm --entrypoint age "$IMAGE_AGE" --version
  fi
}

# Exécute age. Les arguments qui désignent un fichier existant ou un chemin
# dont le répertoire parent existe sont montés dans le conteneur et réécrits ;
# les autres passent tels quels.
#
# POURQUOI CETTE GYMNASTIQUE : un conteneur ne voit pas le système de fichiers
# de la machine. Monter la racine serait plus simple et donnerait au conteneur
# de chiffrement une vue sur tout le disque — pour un outil qui manipule le
# contenu entier d'une base de données, ce n'est pas le compromis à prendre.
age_executer() {
  if age_sur_machine; then
    age "$@"
    return
  fi

  local -a arguments=() montages=()
  local -A vus=()
  local index=0

  for brut in "$@"; do
    local repertoire=""
    # Un argument qui commence par « - » est une option, jamais un chemin :
    # le tester avec dirname ferait interpréter « --output » comme une option
    # de dirname, qui s'en plaint bruyamment à chaque sauvegarde.
    if [[ "$brut" != -* ]] && { [ -e "$brut" ] || { [[ "$brut" == */* ]] && [ -d "$(dirname -- "$brut")" ]; }; }; then
      repertoire="$(cd "$(dirname -- "$brut")" && pwd)"
    fi

    if [ -z "$repertoire" ]; then
      arguments+=("$brut")
      continue
    fi

    local point="${vus[$repertoire]:-}"
    if [ -z "$point" ]; then
      point="/mnt/d$index"
      vus[$repertoire]="$point"
      montages+=(-v "$repertoire:$point")
      index=$((index + 1))
    fi
    arguments+=("$point/$(basename "$brut")")
  done

  # -u : sans cela, les fichiers produits appartiennent à root sur la machine,
  # et la rotation de la sauvegarde ne peut plus les effacer.
  $DOCKER run --rm -u "$(id -u):$(id -g)" "${montages[@]}" \
    --entrypoint age "$IMAGE_AGE" "${arguments[@]}"
}

# ── La règle : en production, pas de chiffrement non authentifié ─────────
#
# openssl enc chiffre mais n'authentifie pas : une altération ne se voit pas au
# déchiffrement, seulement à la comparaison d'empreinte du manifeste. Or c'est
# un contrôle que l'on peut oublier de faire, et qu'un attaquant qui atteint le
# répertoire de sauvegarde peut réécrire en même temps que le fichier.
#
# Hors production, le repli reste toléré pour ne pas empêcher un poste de
# développement de tourner. En production, il est refusé — accepter « parce
# que age n'est pas installé » revient à n'avoir aucune authentification les
# jours où cela compte.
authentification_exigee() {
  case "${SAUVEGARDE_AUTHENTIFICATION:-}" in
    exigee) return 0 ;;
    toleree) return 1 ;;
  esac
  [ "${NODE_ENV:-}" = "production" ]
}

# ── Chiffrement ──────────────────────────────────────────────────────────
#
# Trois méthodes, par ordre de préférence. La méthode retenue est écrite dans
# le manifeste : la restauration n'a pas à deviner ce qui a été employé.
#
# AGE EMPLOIE UNE PAIRE DE CLÉS, PAS UNE PHRASE SECRÈTE, ET C'EST DÉLIBÉRÉ.
# D'abord parce que « age --passphrase » exige un terminal et refuse de lire
# une phrase sur un tube : il ne peut pas tourner dans une tâche planifiée ni
# en intégration continue. Ensuite, et surtout, parce que la clé publique
# suffit à chiffrer : la machine qui sauvegarde n'a jamais besoin du secret qui
# déchiffre. Quelqu'un qui la compromet ne peut pas lire les sauvegardes
# passées — ce qu'une phrase secrète posée sur cette même machine ne permet
# pas de promettre.
#
# chiffrer <clair> <chiffre> ; écrit la méthode employée sur la sortie standard.
chiffrer() {
  local clair="$1" chiffre="$2"

  if [ -n "${SAUVEGARDE_DESTINATAIRE:-}" ] && age_disponible; then
    age_executer --recipient "$SAUVEGARDE_DESTINATAIRE" --output "$chiffre" "$clair"
    printf 'age'
    return
  fi

  if [ -n "${SAUVEGARDE_DESTINATAIRE:-}" ] && ! age_disponible; then
    echo "Refus : SAUVEGARDE_DESTINATAIRE est définie mais age est introuvable," >&2
    echo "et Docker n'a pas permis de construire $IMAGE_AGE. Chiffrer autrement" >&2
    echo "produirait un fichier que la clé configurée ne déchiffrera pas." >&2
    return 1
  fi

  if authentification_exigee; then
    echo "Refus : aucun chiffrement authentifié disponible." >&2
    echo >&2
    echo "  SAUVEGARDE_DESTINATAIRE n'est pas définie. En production, la sauvegarde" >&2
    echo "  doit être authentifiée : une altération doit se voir au déchiffrement," >&2
    echo "  et non dépendre d'une comparaison d'empreinte qu'un attaquant ayant" >&2
    echo "  atteint ce répertoire peut réécrire en même temps que le fichier." >&2
    echo >&2
    echo "  Générez une paire de clés :   ./infra/age-cles.sh" >&2
    echo "  Pour passer outre en connaissance de cause : SAUVEGARDE_AUTHENTIFICATION=toleree" >&2
    return 1
  fi

  if command -v gpg >/dev/null 2>&1 && [ -n "${SAUVEGARDE_CLE:-}" ]; then
    gpg --batch --yes --symmetric --cipher-algo AES256 \
        --passphrase "$SAUVEGARDE_CLE" --output "$chiffre" "$clair"
    printf 'gpg'
    return
  fi

  : "${SAUVEGARDE_CLE:?ni SAUVEGARDE_DESTINATAIRE ni SAUVEGARDE_CLE — rien pour chiffrer.}"
  echo "  ATTENTION : chiffrement NON AUTHENTIFIÉ (openssl enc). Une altération" >&2
  echo "  ne se verra pas au déchiffrement ; l'intégrité repose entièrement sur" >&2
  echo "  l'empreinte du manifeste. Toléré hors production seulement." >&2
  openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
    -pass pass:"$SAUVEGARDE_CLE" -in "$clair" -out "$chiffre"
  printf 'openssl'
}

# dechiffrer <chiffre> <clair> <methode>
dechiffrer() {
  local chiffre="$1" clair="$2" methode="$3"

  case "$methode" in
    age)
      : "${SAUVEGARDE_IDENTITE:?SAUVEGARDE_IDENTITE non définie — chemin du fichier d’identité age.}"
      [ -r "$SAUVEGARDE_IDENTITE" ] || {
        echo "Identité age illisible : $SAUVEGARDE_IDENTITE" >&2
        return 1
      }
      age_disponible || { echo "age introuvable, et l'image $IMAGE_AGE n'a pas pu être construite." >&2; return 1; }
      age_executer --decrypt --identity "$SAUVEGARDE_IDENTITE" --output "$clair" "$chiffre"
      ;;
    gpg)
      : "${SAUVEGARDE_CLE:?SAUVEGARDE_CLE non définie.}"
      gpg --batch --yes --quiet --passphrase "$SAUVEGARDE_CLE" --output "$clair" --decrypt "$chiffre"
      ;;
    openssl)
      : "${SAUVEGARDE_CLE:?SAUVEGARDE_CLE non définie.}"
      openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
        -pass pass:"$SAUVEGARDE_CLE" -in "$chiffre" -out "$clair"
      ;;
    *)
      echo "Méthode de chiffrement inconnue : $methode" >&2
      return 1
      ;;
  esac
}
