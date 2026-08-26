#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Sauvegarde chiffrée de la base.
#
# Produit trois fichiers par exécution :
#   <horodatage>.dump.enc   le vidage PostgreSQL, chiffré
#   <horodatage>.manifeste  empreinte, taille, version, comptages de contrôle
#   dernier                 lien vers la sauvegarde la plus récente
#
# POURQUOI UN MANIFESTE
# Une sauvegarde dont on ne peut pas prouver l'intégrité n'est pas une
# sauvegarde, c'est un fichier. L'empreinte est calculée AVANT chiffrement et
# vérifiée APRÈS déchiffrement par restauration-test.sh : c'est ce qui
# distingue « le fichier existe » de « le fichier est restaurable ».
#
# Les comptages de contrôle servent au même but à un autre niveau : une
# restauration qui aboutit avec zéro organisation est un échec silencieux.
#
# CHIFFREMENT
# age est préféré, gpg ensuite : tous deux authentifient, donc une altération
# se voit au déchiffrement. À défaut, openssl enc est employé — il chiffre mais
# n'authentifie pas, d'où l'empreinte du manifeste qui joue ce rôle. Ce repli
# est signalé bruyamment : ce n'est pas ce qu'on veut en production.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESTINATION="${SAUVEGARDE_DIR:-$RACINE/.sauvegardes}"
CONTENEUR="${POSTGRES_CONTENEUR:-5sursync-postgres-1}"

# Le nom de base et l'utilisateur se DÉDUISENT de DATABASE_URL quand ils ne
# sont pas donnés. Les coder en dur ici créerait une seconde source de vérité :
# c'est exactement ce qui a fait échouer le premier exercice en intégration
# continue, où la base s'appelle 5sync_ci et non 5sync.
depuis_url() {
  local url="${DATABASE_URL:-}" champ="$1"
  [ -n "$url" ] || return 1
  case "$champ" in
    base) printf '%s' "${url##*/}" | cut -d'?' -f1 ;;
    utilisateur) printf '%s' "${url#*://}" | cut -d':' -f1 ;;
  esac
}

UTILISATEUR="${POSTGRES_USER:-$(depuis_url utilisateur || echo 5sync)}"
BASE="${POSTGRES_DB:-$(depuis_url base || echo 5sync)}"
HORODATAGE="$(date -u +%Y%m%dT%H%M%SZ)"

DOCKER=docker
docker info >/dev/null 2>&1 || DOCKER="sudo docker"

: "${SAUVEGARDE_CLE:?SAUVEGARDE_CLE non définie — la sauvegarde doit être chiffrée.}"

mkdir -p "$DESTINATION"
BRUT="$DESTINATION/$HORODATAGE.dump"
CHIFFRE="$BRUT.enc"
MANIFESTE="$DESTINATION/$HORODATAGE.manifeste"

echo "Vidage de $BASE depuis $CONTENEUR…"
# -Fc : format compressé et restaurable sélectivement par pg_restore.
# --no-owner : la restauration ne présuppose pas les mêmes rôles qu'à la source.
$DOCKER exec "$CONTENEUR" pg_dump -U "$UTILISATEUR" -d "$BASE" -Fc --no-owner > "$BRUT"

EMPREINTE="$(sha256sum "$BRUT" | cut -d' ' -f1)"
TAILLE="$(stat -c%s "$BRUT")"

echo "Comptages de contrôle…"
compter() {
  $DOCKER exec "$CONTENEUR" psql -U "$UTILISATEUR" -d "$BASE" -tAc "select count(*) from $1" 2>/dev/null || echo 0
}
ORGS="$(compter organisations)"
USERS="$(compter users)"
TICKETS="$(compter tickets)"
DOCS="$(compter documents)"
MIGRATIONS="$(compter schema_migrations)"

if [ "$ORGS" -eq 0 ] && [ "$MIGRATIONS" -eq 0 ]; then
  echo "Refus : la base semble vide. Une sauvegarde de rien écraserait la rotation." >&2
  rm -f "$BRUT"
  exit 1
fi

echo "Chiffrement…"
if command -v age >/dev/null; then
  METHODE=age
  age --passphrase --output "$CHIFFRE" "$BRUT" <<<"$SAUVEGARDE_CLE"
elif command -v gpg >/dev/null; then
  METHODE=gpg
  gpg --batch --yes --symmetric --cipher-algo AES256 \
      --passphrase "$SAUVEGARDE_CLE" --output "$CHIFFRE" "$BRUT"
else
  METHODE=openssl
  echo "  ATTENTION : ni age ni gpg. openssl enc chiffre mais n'authentifie pas ;" >&2
  echo "  l'intégrité repose sur l'empreinte du manifeste. À corriger avant la" >&2
  echo "  mise en production." >&2
  openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
    -pass pass:"$SAUVEGARDE_CLE" -in "$BRUT" -out "$CHIFFRE"
fi

rm -f "$BRUT"

cat > "$MANIFESTE" <<MANIFESTE_FIN
horodatage=$HORODATAGE
base=$BASE
methode=$METHODE
empreinte_sha256=$EMPREINTE
taille_octets=$TAILLE
organisations=$ORGS
users=$USERS
tickets=$TICKETS
documents=$DOCS
migrations=$MIGRATIONS
MANIFESTE_FIN

ln -sfn "$HORODATAGE.dump.enc" "$DESTINATION/dernier.enc"
ln -sfn "$HORODATAGE.manifeste" "$DESTINATION/dernier.manifeste"

# Rotation : sept quotidiennes suffisent pour l'incident courant. L'archivage
# long terme est le rôle du dépôt hors site, pas de ce répertoire.
ls -1t "$DESTINATION"/*.dump.enc 2>/dev/null | tail -n +8 | while read -r vieux; do
  rm -f "$vieux" "${vieux%.dump.enc}.manifeste"
done

echo
echo "Sauvegarde : $(basename "$CHIFFRE") ($(numfmt --to=iec "$(stat -c%s "$CHIFFRE")"), $METHODE)"
echo "Contrôle   : $ORGS organisations · $USERS comptes · $TICKETS tickets · $MIGRATIONS migrations"
echo
echo "Une sauvegarde non restaurée n'est pas une sauvegarde :"
echo "  ./infra/restauration-test.sh"
