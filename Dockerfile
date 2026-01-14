FROM node:20-slim

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV npm_config_omit=""
ENV NPM_CONFIG_OMIT=""

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Only keep this if you *really* needed it for rollup native issues
# RUN npm i -D @rollup/rollup-linux-x64-gnu || true

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm","run","start"]