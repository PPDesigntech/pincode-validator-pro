FROM node:20-slim

WORKDIR /app

# Force install optional deps (fixes rollup native module missing)
ENV NPM_CONFIG_OPTIONAL=true
ENV npm_config_optional=true

# Force Rollup to not use native bindings
ENV ROLLUP_DISABLE_NATIVE=1

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --include=optional

# Copy rest of the app
COPY . .

# Build the app
RUN npm run build

EXPOSE 3000

# Run migrations + start server
CMD ["npm","run","docker-start"]
