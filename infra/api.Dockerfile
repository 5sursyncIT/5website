# Image du service API.

FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/tokens/package.json packages/tokens/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev --workspace=@5sync/api --include-workspace-root

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S api -u 1001
COPY --from=deps --chown=api:nodejs /repo/node_modules ./node_modules
COPY --chown=api:nodejs apps/api ./apps/api

# Les migrations voyagent AVEC l'image, et non à côté.
#
# migrate.js les cherche en /app/db/migrations. Sans cette copie, la seule
# façon de migrer une base déployée serait d'avoir aussi un dépôt Git sur le
# serveur — donc de faire dépendre le schéma de deux sources qui peuvent
# diverger. Ici, l'image qui sert le code est celle qui porte le schéma qu'il
# attend, et « docker compose exec api node apps/api/src/db/migrate-cli.js »
# suffit.
COPY --chown=api:nodejs db/migrations ./db/migrations

# LE POINT DE MONTAGE DES DOCUMENTS EST CRÉÉ ICI, ET IL APPARTIENT À « api ».
#
# Docker recopie dans un volume nommé VIDE le contenu ET les droits du
# répertoire correspondant de l'image. Sans ce mkdir, le volume est créé par le
# démon, appartient à root, et le service — qui tourne sans privilèges, comme
# il le doit — ne peut rien y écrire. En production, verifierStockage() coupe
# alors le démarrage, et le conteneur redémarre en boucle.
#
# C'est ce qui se passait : la pile complète n'avait jamais pu monter. Le refus
# de démarrer était le bon comportement, il n'y avait simplement personne pour
# l'entendre. Le chemin doit rester aligné sur DOCUMENTS_DIR dans compose.yml.
RUN mkdir -p /srv/documents && chown -R api:nodejs /srv/documents

USER api
EXPOSE 4000
CMD ["node", "apps/api/src/server.js"]
