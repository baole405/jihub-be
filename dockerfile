# Stage 1: Install dependencies
FROM node:22-alpine AS dependencies
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Stage 2: Build application
FROM node:22-alpine AS build
WORKDIR /usr/src/app
COPY --from=dependencies /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Production image
FROM node:22-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application (includes compiled migrations + entities in dist/)
COPY --from=build /usr/src/app/dist ./dist

RUN chown -R nestjs:nodejs /usr/src/app
USER nestjs

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/main"]
