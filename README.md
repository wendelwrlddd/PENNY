# 💷 Penny Finance - UK Personal Finance SaaS MVP

Sistema de gestão financeira pessoal focado no Reino Unido com integração WhatsApp, processamento de IA via Google Gemini e armazenamento em Firebase Firestore.

## 🏗️ Arquitetura

- **Frontend**: React + Vite + TailwindCSS
- **Backend**: Vercel Serverless Functions (Node.js)
- **Banco de Dados**: Firebase Firestore
- **Inteligência Artificial**: Google Gemini API

## 📋 Funcionalidades

- ✅ Webhook para receber mensagens do WhatsApp
- ✅ Extração automática de dados financeiros via IA
- ✅ Armazenamento estruturado no Firestore
- ✅ Dashboard em tempo real com atualizações automáticas
- ✅ Formatação de moeda em Libras (£)
- ✅ Categorização de despesas e receitas
- ✅ Estatísticas de gastos e balanço

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone <seu-repositorio>
cd PENNY
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env` e preencha com suas credenciais:

```bash
cp .env.example .env
```

**Variáveis necessárias:**

```env
# Frontend (Vite)
VITE_FIREBASE_API_KEY=sua-api-key
VITE_FIREBASE_PROJECT_ID=seu-project-id
VITE_FIREBASE_APP_ID=seu-app-id

# Backend (Vercel Functions)
GEMINI_API_KEY=sua-gemini-api-key
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### 4. Configure o Firebase

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Crie um novo projeto ou use um existente
3. Ative o **Firestore Database**
4. Baixe as credenciais do **Service Account** (Settings > Service Accounts > Generate New Private Key)
5. Copie o conteúdo JSON para a variável `FIREBASE_SERVICE_ACCOUNT` no `.env`

### 5. Configure a API do Gemini

1. Acesse [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crie uma API Key
3. Adicione a chave na variável `GEMINI_API_KEY` no `.env`

## 💻 Desenvolvimento Local

### Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

O frontend estará disponível em: `http://localhost:5173`

### Testar o webhook localmente

Para testar o webhook, você pode usar ferramentas como **Postman** ou **curl**:

```bash
curl -X POST http://localhost:5173/api/webhook \
  -H "Content-Type: application/json" \
  -d '{"message": "Spent 5 pounds on coffee"}'
```

**Nota**: Para desenvolvimento local do webhook, você precisará usar uma ferramenta como [Vercel CLI](https://vercel.com/docs/cli) para simular as serverless functions:

```bash
npm install -g vercel
vercel dev
```

## 🌐 Deploy na Vercel

### 1. Instale a Vercel CLI

```bash
npm install -g vercel
```

### 2. Faça login na Vercel

```bash
vercel login
```

### 3. Deploy do projeto

```bash
vercel
```

### 4. Configure as variáveis de ambiente na Vercel

No dashboard da Vercel:
1. Acesse **Settings** > **Environment Variables**
2. Adicione todas as variáveis do arquivo `.env`
3. Faça redeploy do projeto

### 5. URL do Webhook

Após o deploy, sua URL do webhook será:
```
https://seu-projeto.vercel.app/api/webhook
```

## 📱 Integração com WhatsApp

### Configuração do Webhook

O webhook agora suporta **verificação do Facebook** e **recebimento de mensagens**.

**Token de Verificação:** `penny123`

**URL do Webhook (após deploy):**
```
https://seu-projeto.vercel.app/api/webhook
```

### Passo a Passo:

1. **Deploy na Vercel:**
   ```bash
   vercel --prod
   ```

2. **Configure no Meta for Developers:**
   - Acesse: https://developers.facebook.com/
   - Adicione produto WhatsApp
   - Configure webhook com URL acima
   - Use token: `penny123`

3. **Teste a verificação:**
   ```bash
   curl "https://seu-projeto.vercel.app/api/webhook?hub.mode=subscribe&hub.verify_token=penny123&hub.challenge=TEST"
   ```

**Documentação completa:** Veja [WHATSAPP_SETUP.md](./WHATSAPP_SETUP.md)

---

## 🔧 Estrutura do Projeto

```
PENNY/
├── api/
│   └── webhook.js          # Vercel Serverless Function
├── lib/
│   ├── firebase.js         # Firebase Admin SDK
│   └── gemini.js           # Google Gemini AI
├── src/
│   ├── App.jsx             # Dashboard React
│   └── index.css           # Estilos TailwindCSS
├── .env                    # Variáveis de ambiente (não commitado)
├── .env.example            # Template de variáveis
├── vercel.json             # Configuração Vercel
└── package.json
```

## 📊 Formato de Dados

### Transação no Firestore

```json
{
  "amount": 5,
  "currency": "£",
  "category": "Food & Drink",
  "description": "Coffee",
  "date": "2025-12-26T03:20:33.000Z",
  "type": "expense",
  "createdAt": "2025-12-26T03:20:33.000Z",
  "originalMessage": "Spent 5 pounds on coffee"
}
```

## 🎨 Interface

O dashboard apresenta:
- 📊 Lista de transações em tempo real
- 💰 Formatação automática em GBP (£)
- 🔴 Despesas em vermelho
- 🟢 Receitas em verde
- 📈 Estatísticas: Total de Despesas, Total de Receitas, Balanço

## 🔒 Segurança

- ✅ Variáveis de ambiente não são commitadas
- ✅ Firebase Service Account protegido
- ✅ API Keys no backend (não expostas no frontend)
- ✅ Validação de requisições no webhook

## 📝 Licença

MIT

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

---

**Desenvolvido com ❤️ para o mercado UK**
