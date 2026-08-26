#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Génère la paire de clés qui protège les sauvegardes.
#
# DEUX MOITIÉS, DEUX ENDROITS, ET C'EST TOUT L'INTÉRÊT
#
#   La clé PUBLIQUE (« age1… ») chiffre. Elle va dans le .env du serveur, en
#   clair. Elle ne permet rien d'autre que de chiffrer : quelqu'un qui la lit
#   ne peut pas ouvrir une seule sauvegarde.
#
#   L'IDENTITÉ (« AGE-SECRET-KEY-1… ») déchiffre. Elle ne doit PAS rester sur
#   la machine qu'elle protège. Un serveur compromis avec son propre secret de
#   déchiffrement, c'est un serveur dont l'attaquant repart avec l'historique
#   entier des données clients — y compris ce qui a été supprimé depuis.
#
# C'est ce que ne permet pas une phrase secrète : chiffrer et déchiffrer avec
# la même chose oblige à poser le secret de déchiffrement là où la sauvegarde
# tourne.
#
# Sans l'identité, aucune restauration n'est possible. Aucune. Il n'y a pas de
# recours, pas de réinitialisation, personne à appeler. Rangez-la comme un
# document notarié.
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=infra/lib-sauvegarde.sh
source "$RACINE/infra/lib-sauvegarde.sh"

SORTIE="${1:-$RACINE/.sauvegardes/identite-age.txt}"

if [ -e "$SORTIE" ]; then
  echo "Refus : $SORTIE existe déjà." >&2
  echo >&2
  echo "  L'écraser rendrait TOUTES les sauvegardes existantes illisibles, sans" >&2
  echo "  avertissement et sans recours. Si vous voulez vraiment renouveler la" >&2
  echo "  clé, déplacez l'ancienne d'abord — et gardez-la : elle reste la seule" >&2
  echo "  chose qui ouvre les sauvegardes déjà prises." >&2
  exit 1
fi

age_disponible || {
  echo "age introuvable et l'image $IMAGE_AGE n'a pas pu être construite." >&2
  exit 1
}

mkdir -p "$(dirname "$SORTIE")"
# umask avant création : poser les droits après coup laisse une fenêtre, courte
# mais réelle, pendant laquelle le secret est lisible par tout le monde.
( umask 077
  if age_sur_machine; then
    age-keygen -o "$SORTIE" 2>/dev/null
  else
    $DOCKER run --rm -u "$(id -u):$(id -g)" \
      -v "$(cd "$(dirname "$SORTIE")" && pwd):/mnt/d0" \
      --entrypoint age-keygen "$IMAGE_AGE" -o "/mnt/d0/$(basename "$SORTIE")" 2>/dev/null
  fi
)

DESTINATAIRE="$(grep -o 'age1[a-z0-9]*' "$SORTIE" | head -1)"
[ -n "$DESTINATAIRE" ] || { echo "La génération n'a produit aucune clé publique." >&2; exit 1; }

echo
echo "═══ Paire de clés de sauvegarde ═══"
echo
echo "Clé publique — à poser dans votre .env, sur le serveur :"
echo
echo "  SAUVEGARDE_DESTINATAIRE=$DESTINATAIRE"
echo
echo "Identité — écrite dans :"
echo
echo "  $SORTIE"
echo
echo "CE QU'IL RESTE À FAIRE, ET CE N'EST PAS FACULTATIF :"
echo
echo "  1. Copiez l'identité hors de cette machine — coffre de mots de passe de"
echo "     l'entreprise, ou support chiffré rangé ailleurs que dans le même"
echo "     bâtiment que le serveur."
echo "  2. Effacez-la d'ici :  shred -u $SORTIE"
echo "  3. Vérifiez que vous savez la retrouver AVANT d'en avoir besoin :"
echo "     SAUVEGARDE_IDENTITE=<chemin> ./infra/restauration-test.sh"
echo
echo "L'étape 3 est la seule qui prouve quoi que ce soit. Une clé rangée que"
echo "personne n'a jamais essayé de relire est une clé dont on découvre le jour"
echo "de l'incident qu'elle était tronquée."
echo
