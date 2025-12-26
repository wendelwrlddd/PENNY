# 🔍 Como Ver os Logs do Webhook na Vercel

## 📍 Acesse o Painel de Logs

1. **Vá para:** https://vercel.com/wendel-monteiros-projects/penny-finances

2. **Clique em:** **Deployments** (no menu lateral)

3. **Clique no último deployment** (o mais recente)

4. **Clique em:** **Functions** (na aba superior)

5. **Clique em:** `api/webhook`

6. **Veja os logs em tempo real!**

---

## 🧪 Teste o Webhook

### Teste 1: Enviar Mensagem de Teste

```bash
curl -X POST https://penny-finances.vercel.app/api/webhook \
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

### Teste 2: Enviar do WhatsApp Real

Configure o webhook no Meta for Developers:
- URL: `https://penny-finances.vercel.app/api/webhook`
- Token: `penny123`

Envie uma mensagem de teste no WhatsApp.

---

## 📊 O Que Você Verá nos Logs

Com o novo código, os logs vão mostrar **CADA PASSO**:

```
========================================
🔔 Webhook called: 2025-12-26T16:04:44.000Z
Method: POST
URL: /api/webhook
========================================
📦 Raw webhook body: { ... }
🔍 Parsed structure: { hasEntry: true, hasChanges: true, ... }
📱 Message from: 5511999999999
💬 Text: Spent 10 pounds on lunch
🔐 Checking environment variables...
Environment check: {
  GEMINI_API_KEY: '✅ Present',
  FIREBASE_SERVICE_ACCOUNT: '✅ Present',
  FIREBASE_PROJECT_ID: '✅ Present'
}
📥 Importing modules...
✅ Modules imported successfully
🤖 Calling Gemini AI...
Input text: Spent 10 pounds on lunch
🤖 [Gemini] Starting extraction for: Spent 10 pounds on lunch
🤖 [Gemini] Model loaded: gemini-pro
🤖 [Gemini] Sending request to API...
🤖 [Gemini] Response received
🤖 [Gemini] Raw response: { ... }
✅ Gemini response received: { amount: 10, currency: '£', ... }
💾 Attempting to save to Firestore...
Collection: transactions
Data to save: { ... }
✅ Successfully saved to Firestore!
Document ID: abc123xyz
========================================
```

---

## ❌ Se Der Erro, Você Verá:

```
========================================
❌ ERROR OCCURRED:
Error name: Error
Error message: Missing required environment variables
Error stack: Error: Missing required environment variables
    at handler (webhook.js:89:13)
========================================
```

---

## 🔍 Problemas Comuns e Como Identificar

### Problema 1: Variáveis de Ambiente Faltando
**Log:**
```
Environment check: {
  GEMINI_API_KEY: '❌ Missing',
  ...
}
```
**Solução:** Configure as variáveis na Vercel

### Problema 2: JSON do Firebase Inválido
**Log:**
```
❌ Firebase initialization error: Unexpected token
```
**Solução:** Verifique se o JSON está correto

### Problema 3: Gemini API Key Inválida
**Log:**
```
❌ [Gemini] Error: API key not valid
```
**Solução:** Verifique a chave do Gemini

### Problema 4: Estrutura do Webhook Errada
**Log:**
```
⚠️ Invalid webhook structure - missing entry
```
**Solução:** Verifique o formato do JSON enviado pelo WhatsApp

---

## ✅ Verificar se Salvou no Firebase

1. Acesse: https://console.firebase.google.com/
2. Selecione: **Penny-Wendell**
3. Vá em: **Firestore Database**
4. Procure a coleção: **transactions**
5. Veja se apareceu um novo documento!

---

## 📱 Verificar no Dashboard

Acesse: https://penny-finances.vercel.app

Se a transação foi salva, ela deve aparecer na lista automaticamente!

---

**Agora você tem logs completos para debugar qualquer problema! 🎉**
