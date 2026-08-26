#!/usr/bin/env bash
# Régénère ou vérifie la base d'images DANS le même conteneur que la CI.
#
# Pourquoi ne pas simplement lancer node tools/visual.mjs : une base en pixels
# est spécifique à sa plateforme. Régénérée sur une machine de développement,
# elle diverge de 0,5 à 1,2 % sur le runner — sur tous les glyphes, sans qu'une
# seule mise en page ait bougé. L'image officielle Playwright, épinglée à la
# version exacte du paquet, donne le même rendu partout.
#
#   npm run design:visual:update        régénère la base
#   ./tools/visual-docker.sh            vérifie sans régénérer
#
# Prérequis : un serveur qui répond sur $PORT (défaut 3000).
set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('playwright/package.json').version")"
IMAGE="mcr.microsoft.com/playwright:v${VERSION}-noble"
PORT="${PORT:-3000}"

DOCKER=docker
docker info >/dev/null 2>&1 || DOCKER="sudo docker"

exec $DOCKER run --rm --network host \
  -v "$RACINE:/travail" -w /travail \
  "$IMAGE" \
  node tools/visual.mjs --url "http://localhost:${PORT}" "$@"
