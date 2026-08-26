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
# age, avec une CLÉ PUBLIQUE (SAUVEGARDE_DESTINATAIRE). La machine qui
# sauvegarde n'a donc jamais besoin du secret qui déchiffre : la compromettre
# ne donne pas accès aux sauvegardes passées.
#
# gpg ensuite, openssl enc en dernier recours — ce dernier chiffre sans
# authentifier, et n'est plus toléré qu'hors production. Voir lib-sauvegarde.sh
# pour le détail de l'arbitrage.
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

# shellcheck source=infra/lib-sauvegarde.sh
source "$RACINE/infra/lib-sauvegarde.sh"

# Aucune exigence de secret ici : chiffrer avec age ne demande que la clé
# publique. C'est chiffrer(), dans la bibliothèque, qui refuse s'il ne trouve
# de quoi produire un fichier authentifié — et qui dit lequel des deux
# réglages manque.

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
# Le vidage en clair est effacé quoi qu'il arrive : un refus de chiffrer ne
# doit pas laisser la base entière lisible dans le répertoire de sauvegarde.
if ! METHODE="$(chiffrer "$BRUT" "$CHIFFRE")"; then
  rm -f "$BRUT" "$CHIFFRE"
  exit 1
fi

rm -f "$BRUT"

# Empreinte du fichier CHIFFRÉ, en plus de celle du clair.
#
# Elles ne répondent pas à la même question. Celle du clair dit « ce qui sort
# du déchiffrement est bien ce qui a été sauvegardé ». Celle du chiffré dit
# « la copie posée hors site est bien celle qui est partie d'ici » — et elle
# se vérifie sans la clé, donc depuis n'importe où, y compris par le script de
# dépôt hors site qui n'a aucune raison de pouvoir déchiffrer.
EMPREINTE_CHIFFRE="$(sha256sum "$CHIFFRE" | cut -d' ' -f1)"

cat > "$MANIFESTE" <<MANIFESTE_FIN
horodatage=$HORODATAGE
base=$BASE
methode=$METHODE
destinataire=${SAUVEGARDE_DESTINATAIRE:-}
empreinte_sha256=$EMPREINTE
empreinte_chiffre_sha256=$EMPREINTE_CHIFFRE
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
