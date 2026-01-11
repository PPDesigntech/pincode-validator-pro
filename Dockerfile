FROM node:20-slim

WORKDIR /app

# Install deps first (better caching)
COPY package*.json ./
COPY prisma ./prisma

# Render sometimes omits optional deps. Make sure it doesn't.
ENV npm_config_omit=""
ENV NPM_CONFIG_OMIT=""

# Install deps
RUN npm ci

# ✅ Force install Rollup native binding (prevents rollup/dist/native.js crash)
# Most Render builds are linux x64 glibc.
RUN npm i -D @rollup/rollup-linux-x64-gnu || true

# Copy rest of app
COPY . .

# Build
RUN npm run build

EXPOSE 3000

CMD ["npm","run","docker-start"]
