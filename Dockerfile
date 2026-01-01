FROM node:20-slim

# Install pnpm
RUN npm install -g pnpm@10.26.0

WORKDIR /app

# Copy workspace manifests first (better caching)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./

# Copy TypeScript base config (required by package tsconfig.json files)
COPY tsconfig.base.json ./

# Copy monorepo source
COPY packages ./packages
COPY apps/api ./apps/api

# Install deps (workspace:* resolves correctly)
RUN pnpm install --frozen-lockfile

# Build shared workspace packages (only those with build scripts)
# Build in dependency order: dependencies first, then dependents
RUN pnpm --filter "@traceforge/telemetry" --filter "@traceforge/evaluator" \
    --filter "@traceforge/rag" --filter "@traceforge/llm" run build

# Build core (depends on the above packages)
RUN pnpm --filter "@traceforge/core" run build

# Build API
RUN pnpm --filter ./apps/api run build

# Cloud Run uses PORT env; Nest should listen on it
WORKDIR /app/apps/api

# Expose is optional on Cloud Run, but harmless
EXPOSE 8080

CMD ["node", "dist/main"]

