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
USER api
EXPOSE 4000
CMD ["node", "apps/api/src/server.js"]
