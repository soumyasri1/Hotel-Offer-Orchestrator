# syntax=docker/dockerfile:1

# Debian (glibc) rather than Alpine: the Temporal SDK's native core is only
# published for glibc and fails to load on musl (ld-linux-x86-64.so.2 missing).

# ---- build stage -------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies so they are not copied into the runtime image.
RUN npm prune --omit=dev

# ---- runtime stage -----------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# curl is used by the compose healthcheck; ca-certificates for Temporal Cloud TLS.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
# Landing-page background photos, served at /static.
COPY public ./public

# Run unprivileged; the node image already ships a `node` user.
USER node

EXPOSE 3000

# Overridden to dist/temporal/worker.js for the worker service.
CMD ["node", "dist/api/server.js"]
