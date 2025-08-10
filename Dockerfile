# Multi-stage build: build web (Vue) and server (TS), then run minimal runtime

FROM node:20-alpine AS base
WORKDIR /repo
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/patient-web/package.json apps/patient-web/
COPY apps/main-web/package.json apps/main-web/
COPY apps/admin-web/package.json apps/admin-web/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/ui/package.json packages/ui/
RUN npm install

FROM base AS build-api
COPY --from=base /repo/node_modules ./node_modules
COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN npm run build -w @apps/api && npm prune --omit=dev -w @apps/api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy API runtime deps and build output
COPY --from=build-api /repo/apps/api/package.json ./
COPY --from=build-api /repo/node_modules ./node_modules
COPY --from=build-api /repo/apps/api/dist ./dist
EXPOSE 3000
CMD ["node","dist/server.js"]
