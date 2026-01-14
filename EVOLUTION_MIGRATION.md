# Migração para Evolution API - Guia Completo

## ✅ Mudanças Realizadas

1. **Baileys desabilitado** em `server.js` (linhas 1687-1735)
2. **docker-compose.yml criado** para Evolution API
3. **Webhook já configurado** em `/webhooks/evolution`

## 📋 Próximos Passos

### Opção A: Instalar Docker Desktop (Recomendado)

1. **Baixar Docker Desktop**:
   - Acesse: https://www.docker.com/products/docker-desktop/
   - Baixe a versão para Windows
   - Instale e reinicie o computador

2. **Iniciar Evolution API**:
   ```powershell
   cd C:\Users\monte\Desktop\PENNY
   docker compose up -d
   ```

3. **Acessar Evolution Manager**:
   - Abra: http://localhost:8081/manager
   - API Key: `PENNY_SECURE_KEY_2024`

4. **Criar Instância WhatsApp**:
   - Clique em "Create Instance"
   - Nome: `penny`
   - Scan QR Code com seu WhatsApp
   - Configure webhook: `http://localhost:8080/webhooks/evolution`

### Opção B: Usar Evolution API Hospedada

Se não quiser instalar Docker, você pode usar uma instância Evolution hospedada:

1. **Serviços recomendados**:
   - https://evolution-api.com/ (oficial)
   - Railway.app
   - Render.com

2. **Configurar no código**:
   - Edite `lib/evolution.js`
   - Atualize `EVOLUTION_API_URL` com a URL da sua instância
   - Atualize `EVOLUTION_API_KEY`

### Opção C: Voltar para Baileys (Temporário)

Se quiser voltar para Baileys enquanto configura Evolution:

1. Abra `server.js`
2. Remova o `/*` da linha 1704
3. Remova o `*/` da linha 1735
4. Reinicie o servidor: `npm start`

## 🔧 Configuração do Webhook

O webhook já está pronto em `/webhooks/evolution`. Quando configurar a instância Evolution, use:

- **URL**: `http://localhost:8080/webhooks/evolution` (local)
- **URL**: `https://penny-finance-backend.fly.dev/webhooks/evolution` (produção)

## 📱 Testando a Conexão

Após conectar o WhatsApp via Evolution:

1. Envie uma mensagem para o número conectado
2. Verifique os logs do servidor
3. O bot deve responder normalmente

## ❓ Problemas Comuns

**Docker não inicia**:
- Certifique-se de que o Docker Desktop está rodando
- Verifique se a virtualização está habilitada no BIOS

**QR Code expira rápido**:
- Evolution tem QR codes mais duradouros que Baileys
- Se expirar, basta clicar em "Regenerate QR"

**Webhook não funciona**:
- Verifique se o servidor Penny está rodando (`npm start`)
- Teste o endpoint: http://localhost:8080/webhooks/evolution

## 🚀 Deploy no Fly.io

Quando estiver funcionando localmente:

1. A Evolution API pode rodar em um container separado no Fly
2. Ou você pode usar uma instância Evolution hospedada
3. Configure o webhook para apontar para o Fly.io

---

**Próximo passo**: Escolha uma das opções acima e me avise quando estiver pronto!
