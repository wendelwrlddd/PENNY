FROM node:18-slim

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy all files (including pre-built client/dist if not ignored)
COPY . .

EXPOSE 8080

CMD [ "node", "server.js" ]
