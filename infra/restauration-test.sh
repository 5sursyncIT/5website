#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Exercice de restauration.
#
# Restaure la dernière sauvegarde sur une base VIERGE, vérifie que ce qui en
# sort est utilisable, et chronomètre l'opération.
#
# POURQUOI CE SCRIPT EXISTE
# Le site promet à nos clients « des restaurations testées, pas seulement
# planifiées ». Une sauvegarde qu'on n'a jamais restaurée est une hypothèse.
# Le premier essai ne doit pas avoir lieu le jour de l'incident.
#
# CE QU'IL VÉRIFIE, ET C'EST PLUS QUE « ÇA A MARCHÉ »
#
#   1. INTÉGRITÉ  — l'empreinte du manifeste correspond au fichier déchiffré.
#   2. COMPLÉTUDE — les comptages correspondent à ceux relevés à la sauvegarde.
#   3. SÉCURITÉ   — et c'est le contrôle qui manque presque toujours : le
#                   cloisonnement survit-il à la restauration ? Une base
#                   restaurée sans Row-Level Security, sans FORCE, ou avec un
#                   rôle applicatif superutilisateur fonctionnerait
#                   parfaitement — et exposerait tous les clients les uns aux
#                   autres. Une restauration qui rétablit les données en
#                   perdant l'isolation est un échec, pas un succès.
#
# Le chronomètre n'est pas décoratif : c'est le chiffre qu'on met dans un
# engagement de reprise, et le seul moyen de savoir s'il est tenable.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="${SAUVEGARDE_DIR:-$RACINE/.sauvegardes}"
CONTENEUR="5sync-restauration-test"
PORT="${PORT_TEST:-55433}"
IMAGE="${POSTGRES_IMAGE:-postgres:16-alpine}"

DOCKER=docker
docker info >/dev/null 2>&1 || DOCKER="sudo docker"

: "${SAUVEGARDE_CLE:?SAUVEGARDE_CLE non définie.}"

[ -e "$SOURCE/dernier.enc" ] || { echo "Aucune sauvegarde dans $SOURCE." >&2; exit 1; }

CHIFFRE="$(readlink -f "$SOURCE/dernier.enc")"
MANIFESTE="$(readlink -f "$SOURCE/dernier.manifeste")"
# shellcheck disable=SC1090
source "$MANIFESTE"

# Le nom de la base vient du MANIFESTE, produit par la sauvegarde : la
# restauration n'a pas à deviner ce qui a été sauvegardé.
echo "═══ Exercice de restauration ═══"
echo "Sauvegarde : $(basename "$CHIFFRE")  ($methode, $horodatage)"
echo

DEBUT=$(date +%s)
TRAVAIL="$(mktemp -d)"
nettoyer() { $DOCKER rm -f "$CONTENEUR" >/dev/null 2>&1 || true; rm -rf "$TRAVAIL"; }
trap nettoyer EXIT

# ── 1. Déchiffrement et intégrité ────────────────────────────────────────
echo "[1/5] Déchiffrement…"
CLAIR="$TRAVAIL/restauration.dump"
case "$methode" in
  age)     age --decrypt --output "$CLAIR" "$CHIFFRE" <<<"$SAUVEGARDE_CLE" ;;
  gpg)     gpg --batch --yes --quiet --passphrase "$SAUVEGARDE_CLE" --output "$CLAIR" --decrypt "$CHIFFRE" ;;
  openssl) openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass pass:"$SAUVEGARDE_CLE" -in "$CHIFFRE" -out "$CLAIR" ;;
  *)       echo "Méthode de chiffrement inconnue : $methode" >&2; exit 1 ;;
esac

OBTENUE="$(sha256sum "$CLAIR" | cut -d' ' -f1)"
if [ "$OBTENUE" != "$empreinte_sha256" ]; then
  echo "ÉCHEC : empreinte incorrecte." >&2
  echo "  attendue : $empreinte_sha256" >&2
  echo "  obtenue  : $OBTENUE" >&2
  exit 1
fi
echo "      empreinte conforme"

# ── 2. Machine vierge ────────────────────────────────────────────────────
echo "[2/5] Démarrage d'une base vierge…"
$DOCKER rm -f "$CONTENEUR" >/dev/null 2>&1 || true
$DOCKER run -d --name "$CONTENEUR" \
  -e POSTGRES_USER=restaure -e POSTGRES_PASSWORD=restaure -e POSTGRES_DB="$base" \
  -p "$PORT:5432" "$IMAGE" >/dev/null

# pg_isready NE SUFFIT PAS. L'image PostgreSQL lance un serveur TEMPORAIRE le
# temps de son initialisation, puis le redémarre : pg_isready répond « prêt »
# contre ce serveur transitoire, et les commandes suivantes tombent pendant le
# redémarrage. On exige donc trois requêtes réelles consécutives.
PRETES=0
for _ in $(seq 1 90); do
  if $DOCKER exec "$CONTENEUR" psql -U restaure -d "$base" -tAc 'select 1' >/dev/null 2>&1; then
    PRETES=$((PRETES + 1))
    [ "$PRETES" -ge 3 ] && break
  else
    PRETES=0
  fi
  sleep 1
done

if [ "$PRETES" -lt 3 ]; then
  echo "ÉCHEC : la base de restauration n'a pas répondu de façon stable." >&2
  exit 1
fi
echo "      prête"

# ── 3. Restauration ──────────────────────────────────────────────────────
echo "[3/5] Restauration…"
$DOCKER cp "$CLAIR" "$CONTENEUR:/tmp/restauration.dump"
# --no-owner : la base d'origine a ses propres rôles, la cible non. Les erreurs
# de propriété sont donc attendues et ignorées ; toute AUTRE erreur compte.
JOURNAL="$TRAVAIL/restauration.log"
$DOCKER exec "$CONTENEUR" pg_restore -U restaure -d "$base" --no-owner --no-acl \
  /tmp/restauration.dump > "$JOURNAL" 2>&1 || true

# grep -c renvoie 1 sans correspondance : sans le || true, set -e couperait,
# et avec un « || echo 0 » naïf on obtient deux lignes au lieu d'un nombre.
ERREURS=$(grep -c '^pg_restore: error' "$JOURNAL" 2>/dev/null || true)
ERREURS=${ERREURS:-0}
GRAVES=$(grep '^pg_restore: error' "$JOURNAL" 2>/dev/null | grep -vci 'role\|owner\|permission' || true)
GRAVES=${GRAVES:-0}
echo "      $ERREURS avertissement(s), dont $GRAVES hors propriété de rôles"

# Un exercice qui échoue sans dire pourquoi ne sert à rien : on montre les
# erreurs qui comptent, au lieu de les laisser dans un fichier temporaire
# effacé à la sortie.
if [ "$GRAVES" -gt 0 ]; then
  grep '^pg_restore: error' "$JOURNAL" | grep -vi 'role\|owner\|permission' | head -5 | sed 's/^/        /'
fi

# ── 4. Complétude ────────────────────────────────────────────────────────
echo "[4/5] Comptages…"
# Une requête qui échoue renvoie un marqueur au lieu de faire tomber le script.
# Sans cela, la moindre indisponibilité interrompt l'exercice après « Comptages »
# sans un mot d'explication — ce qui est exactement ce qu'un exercice de
# restauration ne doit pas faire.
psql_test() {
  local sortie
  if sortie="$($DOCKER exec "$CONTENEUR" psql -U restaure -d "$base" -tAc "$1" 2>&1)"; then
    printf '%s' "$sortie" | tr -d ' \n'
  else
    printf 'ERREUR(%s)' "$(printf '%s' "$sortie" | head -1 | cut -c1-60)"
  fi
}

ECHECS=0
verifier() {
  local table="$1" attendu="$2"
  local obtenu; obtenu="$(psql_test "select count(*) from $table")"
  case "$obtenu" in
    ERREUR*)
      printf "      %-16s %s\n" "$table" "$obtenu"
      ECHECS=$((ECHECS + 1))
      return
      ;;
  esac
  if [ "$obtenu" = "$attendu" ]; then
    printf "      %-16s %-6s conforme\n" "$table" "$obtenu"
  else
    printf "      %-16s %-6s ATTENDU %s\n" "$table" "$obtenu" "$attendu"
    ECHECS=$((ECHECS + 1))
  fi
}
verifier organisations "$organisations"
verifier users "$users"
verifier tickets "$tickets"
verifier documents "$documents"
verifier schema_migrations "$migrations"

# ── 5. Le cloisonnement a-t-il survécu ? ─────────────────────────────────
echo "[5/5] Cloisonnement…"

# LA MÊME RÈGLE QUE LE TEST DE SCHÉMA, mot pour mot — y compris l'exemption.
# Deux définitions du même fait finissent par diverger, et ici la divergence
# produit une fausse alerte à chaque exercice. Une alerte qu'on apprend à
# ignorer est pire que pas d'alerte du tout : elle donne l'habitude de passer
# outre le jour où elle est vraie.
NON_PROTEGEES="$(psql_test "
  select coalesce(string_agg(c.relname, ', '), '')
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and exists (select 1 from pg_attribute a
                  where a.attrelid = c.oid and a.attname = 'organisation_id'
                    and not a.attisdropped)
     and coalesce(obj_description(c.oid, 'pg_class'), '') not like 'app:hors-cloisonnement%'
     and not (c.relrowsecurity and c.relforcerowsecurity)")"

VUES_OUVERTES="$(psql_test "
  select coalesce(string_agg(c.relname, ', '), '')
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'v'
     and coalesce((select option_value from pg_options_to_table(c.reloptions)
                    where option_name = 'security_invoker'), 'false') <> 'true'")"

if [ -n "$NON_PROTEGEES" ]; then
  echo "      ÉCHEC — tables sans cloisonnement forcé : $NON_PROTEGEES"
  ECHECS=$((ECHECS + 1))
else
  EXEMPTEES="$(psql_test "
    select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and coalesce(obj_description(c.oid, 'pg_class'), '') like 'app:hors-cloisonnement%'")"
  echo "      toutes les tables clientes gardent RLS activé et forcé"
  echo "      ($EXEMPTEES exemption(s) documentée(s) en commentaire de table)"
fi

if [ -n "$VUES_OUVERTES" ]; then
  echo "      ÉCHEC — vues qui contournent le cloisonnement : $VUES_OUVERTES"
  ECHECS=$((ECHECS + 1))
else
  echo "      toutes les vues s'exécutent avec les droits de l'appelant"
fi

DUREE=$(( $(date +%s) - DEBUT ))
echo
if [ "$ECHECS" -eq 0 ] && [ "$GRAVES" -eq 0 ]; then
  echo "RESTAURATION RÉUSSIE en ${DUREE} s — données rétablies, isolation intacte."
  echo "Consignez cette durée : c'est votre délai de reprise mesuré, pas estimé."
  exit 0
fi

echo "RESTAURATION EN ÉCHEC après ${DUREE} s — $ECHECS contrôle(s), $GRAVES erreur(s) grave(s)." >&2
exit 1
