FROM node:20-slim AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install

FROM base AS builder
WORKDIR /app
# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-workspace.yaml ./
COPY apps/api ./apps/api
# Copy node_modules from deps stage for caching, then reinstall to set up workspace links
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm install --prefer-offline
WORKDIR /app/apps/api
# Provide dummy DATABASE_URL for schema validation (not actually used during generate)
RUN DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy" pnpm exec prisma generate
RUN pnpm build
# Verify dist folder was created
RUN ls -la dist/ && test -f dist/server.js || (echo "ERROR: dist/server.js not found after build" && exit 1)

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Install OpenSSL for Prisma runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# Copy workspace structure for pnpm
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
# Install production dependencies fresh in runner stage (this ensures ESM resolution works)
RUN pnpm install --prod --filter ./apps/api...
# Copy Prisma schema and regenerate client (ensures correct binary for this image)
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
RUN cd apps/api && DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy" npx --yes prisma@5.9.1 generate
# Copy built application files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
# Verify dist folder was copied correctly
RUN test -f dist/server.js || (echo "ERROR: dist/server.js not found after copy" && exit 1)
CMD ["sh", "-c", "npx --yes prisma@5.9.1 migrate deploy && node dist/server.js"]

FROM base AS test
WORKDIR /app
# Install OpenSSL for Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
# Copy workspace structure
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
# Install all dependencies (including devDependencies for vitest)
RUN pnpm install --filter ./apps/api...
# Copy source code and Prisma schema
COPY apps/api ./apps/api
WORKDIR /app/apps/api
# Generate Prisma client (with dummy DATABASE_URL for validation)
RUN DATABASE_URL="postgresql://dummy:dummy@dummy:5432/dummy" pnpm exec prisma generate
# Default command: run migrations then tests
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm test --run"]
