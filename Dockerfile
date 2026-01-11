FROM node:20-slim

WORKDIR /app

# ✅ Install required system deps for Prisma (OpenSSL)
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Ensure optional deps are not skipped (rollup native issue)
ENV npm_config_omit=""
ENV NPM_CONFIG_OMIT=""

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# (Keep this only if you used it to fix rollup native)
RUN npm i -D @rollup/rollup-linux-x64-gnu || true

COPY . .

RUN npm run build

EXPOSE 3000
CMD ["npm","run","docker-start"]