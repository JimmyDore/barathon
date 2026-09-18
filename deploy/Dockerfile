# Barathon : un seul conteneur SvelteKit (adapter-node) qui sert pages et API.

# --- Build ---------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
# better-sqlite3 est un module natif : si aucun binaire précompilé ne
# correspond (musl + ABI de Node 24), npm le compile avec node-gyp.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
 && npm prune --omit=dev

# --- Runtime -------------------------------------------------------------
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DATA_DIR=/data
# node_modules vient de l'étape build (même image de base, donc même libc et
# même ABI) : le binaire de better-sqlite3 y est déjà compilé.
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# scripts/backup.mjs <dest> : snapshot SQLite cohérent, lancé par
# deploy/backup.sh via `docker exec`.
COPY --from=build /app/scripts ./scripts
# /data est normalement un volume (/root/barathon-data, uid 1000) ; le créer
# ici permet aussi de lancer l'image seule en local.
RUN mkdir -p /data && chown node:node /data
EXPOSE 3000
# Utilisateur `node` (uid 1000) : /root/barathon-data lui appartient sur l'hôte.
USER node
# wget vient de busybox (code 1 en cas d'échec). 127.0.0.1 plutôt que
# localhost, qui peut viser ::1.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:3000/health"]
CMD ["node", "build"]
