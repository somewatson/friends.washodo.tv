FROM node:alpine

# Install build dependencies for native modules (like better-sqlite3)
RUN apk add --no-cache python3 py3-setuptools make g++

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

CMD ["npm", "start"]
