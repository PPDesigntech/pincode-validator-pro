FROM node:20-slim

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# IMPORTANT: make sure optional deps are not skipped
ENV npm_config_optional=true
ENV npm_config_omit=
ENV NPM_CONFIG_OMIT=

COPY package*.json ./
COPY prisma ./prisma

# clean install
RUN npm ci

# ✅ Force Rollup native binary install (DON'T ignore errors)
RUN npm i -D @rollup/rollup-linux-x64-gnu

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "docker-start"]