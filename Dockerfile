# Railway build for the chatbot SaaS app.
#
# We use a Dockerfile (instead of Railpack's auto-build) so the install step can
# run WITHOUT --frozen-lockfile. Railpack always forces a frozen install for
# pnpm, which fails after the MySQL -> PostgreSQL switch because the committed
# pnpm-lock.yaml still references mysql2. --no-frozen-lockfile lets pnpm
# reconcile the lockfile with package.json (drop mysql2, add postgres).
FROM node:22-slim

# libatomic1 is required by some native Node modules on slim images.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libatomic1 \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm via Corepack (uses the version from package.json "packageManager").
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --no-frozen-lockfile

# Copy the rest of the source and build the client + server bundles.
COPY . .
RUN pnpm run build

ENV NODE_ENV=production

# The server reads PORT from the environment (Railway sets it automatically).
CMD ["pnpm", "run", "start"]
