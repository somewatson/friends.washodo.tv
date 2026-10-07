FROM node:22-bookworm

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
