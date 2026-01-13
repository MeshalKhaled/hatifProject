FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/ui/package.json ./apps/ui/
RUN pnpm install

FROM base AS builder
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/ui ./apps/ui
# Copy node_modules from deps stage for caching, then reinstall to set up workspace links
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm install --prefer-offline
WORKDIR /app/apps/ui
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/apps/ui/.next/standalone ./
COPY --from=builder /app/apps/ui/.next/static ./apps/ui/.next/static
# Create empty public directory (Next.js may reference it, but it's optional)
RUN mkdir -p ./apps/ui/public
WORKDIR /app/apps/ui
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
