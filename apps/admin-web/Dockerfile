FROM node:20-alpine AS builder
WORKDIR /repo

# Install dependencies with workspace awareness (cache-friendly)
COPY package.json ./
COPY tsconfig.base.json ./
COPY apps/admin-web/package.json apps/admin-web/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/ui/package.json packages/ui/
RUN npm install

# Copy only what is needed to build this app
COPY packages/shared-types packages/shared-types
COPY packages/ui packages/ui
COPY apps/admin-web apps/admin-web

# Build only this workspace
RUN npm run build -w @apps/admin-web

FROM nginx:stable-alpine
COPY ./nginx.spa.conf /etc/nginx/nginx.conf
COPY --from=builder /repo/apps/admin-web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
