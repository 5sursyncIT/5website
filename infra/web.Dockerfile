# Image du service web. La sortie « standalone » de Next fait que l'image
# finale n'embarque ni node_modules complet, ni sources.

FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/tokens/package.json packages/tokens/
COPY packages/ui/package.json packages/ui/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /repo
ARG ENABLE_DESIGN_WORKSHOP=0
ENV ENABLE_DESIGN_WORKSHOP=$ENABLE_DESIGN_WORKSHOP
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@5sync/web

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Le serveur autonome de Next se lie à process.env.HOSTNAME, que Docker fixe à
# l'identifiant du conteneur. Sans cette ligne il n'écoute que sur cette
# adresse : joignable depuis le réseau Docker, mais pas sur localhost, et
# aucune sonde de santé interne ne passe. Le serveur annonce « Ready » quand
# même, ce qui rend le symptôme trompeur.
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
