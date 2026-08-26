#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Dépôt hors site des sauvegardes.
#
# POURQUOI CE SCRIPT EXISTE
# Une sauvegarde posée sur la machine qu'elle protège ne protège de rien. Elle
# couvre exactement un cas — la suppression accidentelle — et aucun des autres :
# ni le disque qui lâche, ni le chiffrement par rançongiciel, qui cherche les
# répertoires de sauvegarde en premier, ni l'incendie du local technique.
#
# CE QU'IL FAIT, ET CE QU'IL NE CROIT PAS SUR PAROLE
# Il envoie, puis il RELIT ce qu'il a envoyé et compare l'empreinte. Un envoi
# qui se termine par « succès » en ayant écrit un fichier tronqué est le mode
# de panne le plus courant du transfert de fichiers — coupure réseau, quota
# atteint, disque plein en face. Sans relecture, on découvre le tronquage le
# jour de la restauration, c'est-à-dire trop tard.
#
# L'empreinte comparée est celle du fichier CHIFFRÉ, relevée au moment de la
# sauvegarde. Ce script n'a donc jamais besoin de la clé de déchiffrement, et
# c'est voulu : la machine qui pousse hors site n'a aucune raison de pouvoir
# lire ce qu'elle pousse.
#
# CE QUE CETTE VÉRIFICATION PROUVE, ET CE QU'ELLE NE PROUVE PAS
# Elle prouve que le transfert n'a rien abîmé. Elle ne prouve rien contre
# quelqu'un qui contrôlerait le dépôt distant : il réécrirait le fichier et le
# manifeste ensemble. C'est le chiffrement authentifié qui répond à celui-là —
# age refuse de déchiffrer un fichier modifié, quelle que soit la cohérence
# des empreintes qui l'accompagnent. Voir age-cles.sh.
#
# TRANSPORTS
#   rsync  — vers un chemin local (disque externe, montage NFS) ou par SSH.
#   rclone — vers S3, Backblaze B2, OVH Object Storage, etc.
#
#   ./infra/hors-site.sh            dépose et vérifie ce qui manque en face
#   ./infra/hors-site.sh --verifier relit sans rien envoyer
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=infra/lib-sauvegarde.sh
source "$RACINE/infra/lib-sauvegarde.sh"

SOURCE="${SAUVEGARDE_DIR:-$RACINE/.sauvegardes}"
TRANSPORT="${HORS_SITE_TRANSPORT:-}"
CIBLE="${HORS_SITE_CIBLE:-}"
# Plus longue que la rotation locale de sept jours : le répertoire local couvre
# l'incident courant, le hors site couvre l'incident qu'on découvre tard —
# une corruption de données remarquée trois semaines après coup, par exemple.
RETENTION="${HORS_SITE_RETENTION_JOURS:-30}"
IMAGE_RCLONE="${IMAGE_RCLONE:-rclone/rclone:1.68}"

VERIFIER_SEULEMENT=0
[ "${1:-}" = "--verifier" ] && VERIFIER_SEULEMENT=1

# ── Le dépôt hors site n'est pas facultatif en production ────────────────
if [ -z "$TRANSPORT" ] || [ -z "$CIBLE" ]; then
  if [ "${NODE_ENV:-}" = "production" ]; then
    echo "Refus : aucun dépôt hors site configuré." >&2
    echo >&2
    echo "  HORS_SITE_TRANSPORT et HORS_SITE_CIBLE ne sont pas définis. En" >&2
    echo "  production, les sauvegardes doivent quitter la machine qu'elles" >&2
    echo "  protègent — sans quoi elles ne couvrent que la suppression" >&2
    echo "  accidentelle, et aucun des sinistres contre lesquels on sauvegarde." >&2
    echo >&2
    echo "  Exemples :" >&2
    echo "    HORS_SITE_TRANSPORT=rsync  HORS_SITE_CIBLE=sauvegardes@nas.local:/vol/5sync" >&2
    echo "    HORS_SITE_TRANSPORT=rclone HORS_SITE_CIBLE=ovh:5sync-sauvegardes/base" >&2
    exit 1
  fi
  echo "Aucun dépôt hors site configuré — rien à faire. (HORS_SITE_TRANSPORT / HORS_SITE_CIBLE)"
  exit 0
fi

# ── Les deux transports, derrière une interface commune ──────────────────
#
# Trois opérations suffisent : envoyer, relire, lister. Les factoriser ainsi
# permet d'ajouter un transport sans toucher à la logique de vérification —
# qui est la seule partie où il y a quelque chose à se tromper.

rclone_executer() {
  if command -v rclone >/dev/null 2>&1; then
    rclone "$@"
  else
    # Le fichier de configuration de rclone porte des identifiants : il est
    # monté en lecture seule, et rien d'autre du disque n'est exposé.
    $DOCKER run --rm -u "$(id -u):$(id -g)" \
      -v "${RCLONE_CONFIG:-$HOME/.config/rclone/rclone.conf}:/config/rclone/rclone.conf:ro" \
      -v "$SOURCE:/data" -v "$TRAVAIL:/travail" \
      "$IMAGE_RCLONE" "$@"
  fi
}

envoyer() {
  local fichier="$1" nom; nom="$(basename "$fichier")"
  case "$TRANSPORT" in
    rsync)
      # --partial NON : un transfert coupé ne doit pas laisser en face un
      # fichier au nom définitif et au contenu incomplet. Mieux vaut
      # recommencer que garder une ruine qui ressemble à une sauvegarde.
      rsync --archive --checksum "$fichier" "$CIBLE/"
      ;;
    rclone)
      if command -v rclone >/dev/null 2>&1; then
        rclone copyto "$fichier" "$CIBLE/$nom"
      else
        rclone_executer copyto "/data/$nom" "$CIBLE/$nom"
      fi
      ;;
    *) echo "Transport inconnu : $TRANSPORT" >&2; return 1 ;;
  esac
}

relire() {
  local nom="$1" vers="$2"
  case "$TRANSPORT" in
    rsync)  rsync --archive "$CIBLE/$nom" "$vers" ;;
    rclone)
      if command -v rclone >/dev/null 2>&1; then
        rclone copyto "$CIBLE/$nom" "$vers"
      else
        rclone_executer copyto "$CIBLE/$nom" "/travail/$(basename "$vers")"
      fi
      ;;
  esac
}

lister_distant() {
  case "$TRANSPORT" in
    rsync)
      # --list-only fonctionne aussi bien sur un chemin local que par SSH.
      rsync --list-only "$CIBLE/" 2>/dev/null | awk '{print $NF}' | grep -E '\.(dump\.enc|manifeste)$' || true
      ;;
    rclone)
      if command -v rclone >/dev/null 2>&1; then rclone lsf "$CIBLE/" 2>/dev/null || true
      else rclone_executer lsf "$CIBLE/" 2>/dev/null || true
      fi
      ;;
  esac
}

supprimer_distant() {
  local nom="$1"
  case "$TRANSPORT" in
    rsync)
      case "$CIBLE" in
        *:*) ssh "${CIBLE%%:*}" "rm -f '${CIBLE#*:}/$nom'" ;;
        *)   rm -f "$CIBLE/$nom" ;;
      esac
      ;;
    rclone)
      if command -v rclone >/dev/null 2>&1; then rclone deletefile "$CIBLE/$nom"
      else rclone_executer deletefile "$CIBLE/$nom"
      fi
      ;;
  esac
}

# ── Travail ──────────────────────────────────────────────────────────────
TRAVAIL="$(mktemp -d)"
trap 'rm -rf "$TRAVAIL"' EXIT

[ -d "$SOURCE" ] || { echo "Répertoire de sauvegarde introuvable : $SOURCE" >&2; exit 1; }

# Le dépôt local n'a qu'une cible possible pour rsync sans SSH : on la crée.
case "$TRANSPORT:$CIBLE" in rsync:*:*) : ;; rsync:*) mkdir -p "$CIBLE" ;; esac

echo "═══ Dépôt hors site ═══"
echo "Transport : $TRANSPORT → $CIBLE"
echo

DISTANTS="$(lister_distant)"
DEPOSES=0 VERIFIES=0 ECHECS=0 IGNORES=0

for manifeste in "$SOURCE"/*.manifeste; do
  [ -e "$manifeste" ] || continue
  case "$(basename "$manifeste")" in dernier.manifeste) continue ;; esac

  # shellcheck disable=SC1090
  ( source "$manifeste" >/dev/null 2>&1 ) || { echo "  manifeste illisible : $(basename "$manifeste")"; ECHECS=$((ECHECS+1)); continue; }
  # shellcheck disable=SC1090
  source "$manifeste"

  NOM_ENC="$horodatage.dump.enc"
  NOM_MAN="$horodatage.manifeste"
  CHIFFRE_LOCAL="$SOURCE/$NOM_ENC"
  [ -e "$CHIFFRE_LOCAL" ] || continue

  # Les sauvegardes d'avant le lot 6 n'ont pas d'empreinte du chiffré. On ne
  # les dépose pas en silence : une copie qu'on ne saurait pas vérifier
  # donnerait l'illusion d'une protection sans la propriété qui la fonde.
  if [ -z "${empreinte_chiffre_sha256:-}" ]; then
    echo "  $horodatage : ignoré — manifeste sans empreinte du fichier chiffré"
    echo "                (sauvegarde antérieure au lot 6 ; relancez ./infra/sauvegarde.sh)"
    IGNORES=$((IGNORES+1))
    unset empreinte_chiffre_sha256
    continue
  fi

  deja_en_face=0
  grep -qx "$NOM_ENC" <<<"$DISTANTS" && deja_en_face=1

  if [ "$deja_en_face" -eq 0 ] && [ "$VERIFIER_SEULEMENT" -eq 1 ]; then
    echo "  $horodatage : ABSENT en face"
    ECHECS=$((ECHECS+1))
    unset empreinte_chiffre_sha256
    continue
  fi

  if [ "$deja_en_face" -eq 0 ]; then
    printf '  %s : dépôt… ' "$horodatage"
    if ! envoyer "$CHIFFRE_LOCAL" || ! envoyer "$SOURCE/$NOM_MAN"; then
      echo "ÉCHEC de l'envoi"
      ECHECS=$((ECHECS+1)); unset empreinte_chiffre_sha256; continue
    fi
    DEPOSES=$((DEPOSES+1))
  else
    printf '  %s : déjà en face, ' "$horodatage"
  fi

  # ── LA RELECTURE. C'est la seule ligne de ce script qui prouve quelque
  # chose : tout le reste ne fait que déplacer des octets.
  printf 'relecture… '
  RELU="$TRAVAIL/$NOM_ENC"
  rm -f "$RELU"
  if ! relire "$NOM_ENC" "$RELU" 2>/dev/null || [ ! -s "$RELU" ]; then
    echo "ÉCHEC — impossible de relire la copie déposée"
    ECHECS=$((ECHECS+1)); unset empreinte_chiffre_sha256; continue
  fi

  OBTENUE="$(sha256sum "$RELU" | cut -d' ' -f1)"
  if [ "$OBTENUE" != "$empreinte_chiffre_sha256" ]; then
    echo "ÉCHEC — la copie en face diffère de l'originale"
    echo "      attendue : $empreinte_chiffre_sha256"
    echo "      obtenue  : $OBTENUE"
    ECHECS=$((ECHECS+1)); unset empreinte_chiffre_sha256; continue
  fi

  echo "conforme ($(numfmt --to=iec "$(stat -c%s "$RELU")"))"
  VERIFIES=$((VERIFIES+1))
  rm -f "$RELU"
  unset empreinte_chiffre_sha256
done

# ── Rétention distante ───────────────────────────────────────────────────
#
# Appliquée APRÈS les vérifications, et seulement si aucune n'a échoué :
# supprimer d'anciennes copies alors qu'on vient de constater que la nouvelle
# est illisible, c'est réduire le nombre de sauvegardes valides au moment
# précis où l'on découvre qu'il y en a une de moins.
if [ "$VERIFIER_SEULEMENT" -eq 0 ] && [ "$ECHECS" -eq 0 ] && [ "$RETENTION" -gt 0 ]; then
  LIMITE="$(date -u -d "-$RETENTION days" +%Y%m%dT%H%M%SZ 2>/dev/null || true)"
  if [ -n "$LIMITE" ]; then
    SUPPRIMES=0
    while read -r nom; do
      [ -n "$nom" ] || continue
      horo="${nom%%.*}"
      [[ "$horo" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || continue
      if [[ "$horo" < "$LIMITE" ]]; then
        supprimer_distant "$nom" >/dev/null 2>&1 && SUPPRIMES=$((SUPPRIMES+1))
      fi
    done <<<"$DISTANTS"
    [ "$SUPPRIMES" -gt 0 ] && echo && echo "Rétention : $SUPPRIMES fichier(s) de plus de $RETENTION jours retirés."
  fi
fi

echo
if [ "$ECHECS" -eq 0 ]; then
  # Marqueur relevé par la supervision. Écrit seulement si au moins une copie a
  # été VÉRIFIÉE par relecture : un passage qui n'a rien trouvé à vérifier ne
  # prouve rien, et le dater reviendrait à faire taire l'alerte sans avoir
  # protégé quoi que ce soit.
  if [ "$VERIFIES" -gt 0 ]; then
    printf 'horodatage=%s\ntransport=%s\ndeposees=%s\nverifiees=%s\n' \
      "$(date -u +%Y%m%dT%H%M%SZ)" "$TRANSPORT" "$DEPOSES" "$VERIFIES" > "$SOURCE/dernier-hors-site"
  fi

  echo "HORS SITE CONFORME — $DEPOSES déposée(s), $VERIFIES vérifiée(s) par relecture."
  [ "$IGNORES" -gt 0 ] && echo "($IGNORES sauvegarde(s) ignorée(s), faute d'empreinte du fichier chiffré.)"
  exit 0
fi

echo "HORS SITE EN ÉCHEC — $ECHECS problème(s), $VERIFIES vérifiée(s)." >&2
exit 1
