# Build stage - Install deps and build frontend
FROM node:20-alpine AS build

WORKDIR /app

# Copy root package files and install frontend dependencies
COPY package*.json ./
RUN npm ci

# Copy server package files and install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Production stage - Lean image with only what's needed
FROM node:20-alpine AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy server code and dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

COPY server/ ./server/

# Copy built frontend from build stage
COPY --from=build /app/dist ./dist

# Expose the port
EXPOSE 3000

# Start the server
WORKDIR /app/server
CMD ["node", "server.js"]
