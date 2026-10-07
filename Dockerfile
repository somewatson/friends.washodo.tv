FROM node:20-bookworm

# Install build tools for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    python3-setuptools \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create data directory and set ownership
RUN mkdir -p /app/data && chown -R node:node /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Run as non-root user
USER node

CMD ["npm", "start"]
