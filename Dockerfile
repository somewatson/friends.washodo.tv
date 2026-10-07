# Stage 1: Build
FROM node:20-bookworm AS builder

# Install build tools for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    python3-setuptools \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-bullseye-slim

WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# The app needs the .env file if provided
COPY .env* ./

CMD ["npm", "start"]
