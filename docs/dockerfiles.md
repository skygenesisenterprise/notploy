# Dockerfiles pour Notploy

## Dockerfile.dokploy (Application principale)

```dockerfile
# Multi-stage build pour l'application Next.js
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments
ARG NEXT_PUBLIC_APP_URL
ARG NEXTAUTH_SECRET
ARG DATABASE_URL

# Build the application
RUN corepack enable pnpm && pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

## Dockerfile.api (API de déploiement)

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN corepack enable pnpm && pnpm i --frozen-lockfile --prod

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS runner

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Switch to non-root user
USER nodejs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]
```

## Dockerfile.schedules (Service de planification)

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN corepack enable pnpm && pnpm i --frozen-lockfile --prod

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS runner

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application and dependencies
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Switch to non-root user
USER nodejs

EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]
```

## Dockerfile.monitoring (Service de monitoring)

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Change ownership of the app directory
RUN chown -R appuser:appgroup /root/

# Switch to non-root user
USER appuser

EXPOSE 3003

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/health || exit 1

CMD ["./main"]
```

## Instructions de build

### Build local
```bash
# Build toutes les images
docker build -f Dockerfile.dokploy -t skygenesisenterprise/notploy:latest .
docker build -f Dockerfile.api -t skygenesisenterprise/notploy-api:latest .
docker build -f Dockerfile.schedules -t skygenesisenterprise/notploy-schedules:latest .
docker build -f Dockerfile.monitoring -t skygenesisenterprise/notploy-monitoring:latest .

# Build avec tag de version
VERSION=1.0.0
docker build -f Dockerfile.dokploy -t skygenesisenterprise/notploy:$VERSION .
docker build -f Dockerfile.api -t skygenesisenterprise/notploy-api:$VERSION .
docker build -f Dockerfile.schedules -t skygenesisenterprise/notploy-schedules:$VERSION .
docker build -f Dockerfile.monitoring -t skygenesisenterprise/notploy-monitoring:$VERSION .
```

### Build multi-architecture
```bash
# Build pour AMD64 et ARM64
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile.dokploy \
  -t skygenesisenterprise/notploy:latest \
  --push .
```

## Variables d'environnement

### Application principale (dokploy)
```bash
NODE_ENV=production
PORT=3000
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret
DATABASE_URL=postgresql://...
```

### API
```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

### Schedules
```bash
NODE_ENV=production
PORT=3002
REDIS_URL=redis://redis:6379
DATABASE_URL=postgresql://...
```

### Monitoring
```bash
PORT=3003
DATABASE_URL=postgresql://...
PROMETHEUS_URL=http://prometheus:9090
```

## Docker Compose complet

```yaml
version: '3.8'

services:
  app:
    image: skygenesisenterprise/notploy:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/notploy
      - NEXTAUTH_URL=http://localhost:3000
      - NEXTAUTH_SECRET=your-secret
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  api:
    image: skygenesisenterprise/notploy-api:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/notploy
      - INNGEST_EVENT_KEY=your-event-key
      - INNGEST_SIGNING_KEY=your-signing-key
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  schedules:
    image: skygenesisenterprise/notploy-schedules:latest
    ports:
      - "3002:3002"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/notploy
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  monitoring:
    image: skygenesisenterprise/notploy-monitoring:latest
    ports:
      - "3003:3003"
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/notploy
      - PROMETHEUS_URL=http://prometheus:9090
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: notploy
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
```