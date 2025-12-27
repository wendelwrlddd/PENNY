# 🔗 Guia de Integração WhatsApp - Penny Finance

## ✅ O Que Foi Implementado

### Webhook Atualizado (`/api/webhook.js`)

O webhook agora suporta **2 modos de operação**:

---

## 📋 PARTE A: Verificação do Facebook (GET)

Quando você configura o webhook no Facebook/WhatsApp Business, ele faz um teste de segurança.

**Como funciona:**

1. Facebook envia uma requisição **GET** com parâmetros:
   - `hub.mode` = "subscribe"
   - `hub.verify_token` = "penny123" (nossa senha)
   - `hub.challenge` = código aleatório

2. Nosso webhook verifica se o token está correto

3. Se estiver correto, retorna o `challenge` de volta

**Token configurado:** `penny123`

---

## 📱 PARTE B: Receber Mensagens (POST)

Quando um usuário envia mensagem no WhatsApp, o Facebook envia um **POST** com JSON complexo.

**Estrutura do JSON do WhatsApp:**
```json
{
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5511999999999",
          "type": "text",
          "text": {
            "body": "Spent 5 pounds on coffee"
          }
        }]
      }
    }]
  }]
}
```

**O que o webhook faz:**

1. ✅ Navega no JSON para extrair o texto da mensagem
2. ✅ Pega o número de telefone do usuário
3. ✅ Envia para o Gemini AI processar
4. ✅ Salva no Firestore com campo `userPhone`
5. ✅ Retorna sucesso para o Facebook

---

## 🚀 Próximos Passos para Deploy

### 1. Fazer Deploy na Vercel

```bash
# No terminal, dentro da pasta PENNY
vercel --prod
```

Isso vai:
- Fazer upload do código
- Criar as serverless functions
- Te dar uma URL (ex: `https://penny-finance.vercel.app`)

### 2. Configurar Variáveis de Ambiente na Vercel

No dashboard da Vercel:
1. Vá em **Settings** → **Environment Variables**
2. Adicione:
   - `GEMINI_API_KEY` = `[SUA_CHAVE_AQUI]`
   - `FIREBASE_PROJECT_ID` = `Penny-Wendell`
   - `FIREBASE_SERVICE_ACCOUNT` = (cole o JSON completo do arquivo que você baixou)

### 3. URL do Webhook

Após o deploy, sua URL será:
```
https://SEU-PROJETO.vercel.app/api/webhook
```

---

## 🔧 Configurar no Facebook/WhatsApp Business

### Passo 1: Acessar Meta for Developers

1. Vá em: https://developers.facebook.com/
2. Crie um app ou use um existente
3. Adicione o produto **WhatsApp**

### Passo 2: Configurar Webhook

1. Na seção **Configuration** do WhatsApp
2. Clique em **Edit** no campo Webhook
3. Preencha:
   - **Callback URL**: `https://seu-projeto.vercel.app/api/webhook`
   - **Verify Token**: `penny123`
4. Clique em **Verify and Save**

**O que acontece:**
- Facebook vai fazer uma requisição GET
- Nosso webhook vai responder com o challenge
- Se tudo estiver certo, aparece ✅ verificado

### Passo 3: Inscrever nos Eventos

Marque a opção **messages** para receber mensagens.

---

## 🧪 Como Testar

### Teste 1: Verificação Manual (GET)

```bash
curl "https://seu-projeto.vercel.app/api/webhook?hub.mode=subscribe&hub.verify_token=penny123&hub.challenge=TESTE123"
```

**Resposta esperada:** `TESTE123`

### Teste 2: Mensagem Simulada (POST)

```bash
curl -X POST https://seu-projeto.vercel.app/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "5511999999999",
            "type": "text",
            "text": {
              "body": "Spent 10 pounds on lunch"
            }
          }]
        }
      }]
    }]
  }'
```

**Resposta esperada:**
```json
{
  "success": true,
  "transactionId": "abc123...",
  "data": {
    "amount": 10,
    "currency": "£",
    "category": "Food & Drink",
    "description": "Lunch",
    "type": "expense"
  }
}
```

---

## 📊 Logs para Debug

O webhook agora tem logs detalhados:

```
Facebook verification attempt: { mode: 'subscribe', token: 'penny123' }
✅ Verification successful!

📱 Message from: 5511999999999
💬 Text: Spent 10 pounds on lunch
🤖 Sending to Gemini AI...
✅ Gemini response: { amount: 10, currency: '£', ... }
💾 Saving to Firestore...
✅ Saved with ID: abc123
```

Você pode ver esses logs na Vercel em **Deployments** → **Functions** → **Logs**

---

## 🔐 Segurança

- ✅ Token de verificação: `penny123`
- ✅ Validação de tipo de mensagem (só aceita texto)
- ✅ Tratamento de erros
- ✅ Logs para debugging

---

## 📝 Campos Salvos no Firestore

Agora cada transação inclui:

```json
{
  "amount": 10,
  "currency": "£",
  "category": "Food & Drink",
  "description": "Lunch",
  "date": "2025-12-26T06:59:16.000Z",
  "type": "expense",
  "userPhone": "5511999999999",      // ← NOVO
  "originalMessage": "Spent 10...",
  "createdAt": "2025-12-26T06:59:16.000Z"
}
```

---

## ✅ Checklist de Deploy

- [ ] Fazer `vercel --prod`
- [ ] Configurar variáveis de ambiente na Vercel
- [ ] Copiar URL do webhook
- [ ] Configurar no Facebook/WhatsApp Business
- [ ] Testar verificação (GET)
- [ ] Enviar mensagem de teste no WhatsApp
- [ ] Verificar logs na Vercel
- [ ] Confirmar transação no Firebase Console

---

**Pronto para conectar com WhatsApp! 🚀**
