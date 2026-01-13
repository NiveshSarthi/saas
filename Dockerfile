# Build stage - Install deps and build frontend
FROM node:20-alpine AS build

WORKDIR /app

# Copy frontend package files and install dependencies
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

# Copy backend package files and install dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Copy source code
COPY . .

# Build the frontend
WORKDIR /app/frontend
RUN npm run build

# Production stage - Lean image with only what's needed
FROM node:20-alpine AS production

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy backend code and dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

COPY backend/ ./backend/

# Copy built frontend from build stage
COPY --from=build /app/frontend/dist ./dist

# Expose the port
EXPOSE 3000

# Start the server
WORKDIR /app/backend
CMD ["node", "server.js"]
