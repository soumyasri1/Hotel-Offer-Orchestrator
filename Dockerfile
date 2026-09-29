# syntax=docker/dockerfile:1

# ---- build stage -------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies so they are not copied into the runtime image.
RUN npm prune --omit=dev

# ---- runtime stage -----------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# The Temporal SDK's native worker core needs libgcc/libstdc++ on Alpine.
RUN apk add --no-cache libgcc libstdc++ curl

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Run unprivileged; the node image already ships a `node` user.
USER node

EXPOSE 3000

# Overridden to dist/temporal/worker.js for the worker service.
CMD ["node", "dist/api/server.js"]
