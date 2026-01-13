FROM node:20-slim

WORKDIR /app

# Instalar dependências necessárias para Baileys/Puppeteer se precisar (slim é muito limpo)
# Baileys puro não precisa de chrome, mas pode precisar de libs básicas
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Instalar dependências de produção
RUN npm install --omit=dev

COPY . .

# Criar diretório para volume
RUN mkdir -p /app/auth_info_baileys

EXPOSE 8080

CMD [ "node", "server.js" ]
