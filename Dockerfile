FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Copy rest of the app
COPY . .

# Build the app
RUN npm run build

# Expose port (Render uses PORT env)
EXPOSE 3000

# Start app
CMD ["npm","run","docker-start"]
