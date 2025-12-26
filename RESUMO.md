# 🚀 Penny Finance - Resumo Rápido

## ✅ Status Atual (26/12/2025 04:36)

**Projeto:** Penny Finance MVP - Gestão Financeira UK  
**GitHub:** https://github.com/wendelwrlddd/PENNY.git  
**Deploy:** ✅ Funcionando na Vercel  

---

## 🌐 URLs Importantes

### Dashboard
```
https://penny-iota-rouge.vercel.app
```

### Webhook (WhatsApp)
```
https://penny-iota-rouge.vercel.app/api/webhook
```

### Painel Vercel
```
https://vercel.com/wendel-monteiros-projects/penny
```

---

## 🔑 Credenciais

**Token de Verificação WhatsApp:** `penny123`

**Firebase:**
- Project ID: `Penny-Wendell`
- API Key: `AIzaSyAG_q7Dsgrl9uX-EFtUYQI5rty0ncB8vZE`

**Gemini AI:**
- API Key: `AIzaSyDTXSZZL-7nfTMMIZ15rOFbwaoKhmrDEqs`

---

## ✅ O Que Está Pronto

- [x] Código no GitHub
- [x] Deploy na Vercel funcionando
- [x] Webhook validando corretamente (GET)
- [x] Dashboard com design moderno
- [x] Integração Gemini AI configurada
- [x] Integração Firebase configurada

---

## ⚠️ Pendente (Próxima Sessão)

### 1. Configurar Variáveis de Ambiente na Vercel

Acesse: https://vercel.com/wendel-monteiros-projects/penny/settings/environment-variables

Adicione:
```
VITE_FIREBASE_API_KEY=AIzaSyAG_q7Dsgrl9uX-EFtUYQI5rty0ncB8vZE
VITE_FIREBASE_PROJECT_ID=Penny-Wendell
VITE_FIREBASE_APP_ID=[pegar do Firebase Console]
GEMINI_API_KEY=AIzaSyDTXSZZL-7nfTMMIZ15rOFbwaoKhmrDEqs
FIREBASE_PROJECT_ID=Penny-Wendell
FIREBASE_SERVICE_ACCOUNT=[JSON completo do arquivo baixado]
```

### 2. Configurar WhatsApp Business API

Meta for Developers: https://developers.facebook.com/

- Callback URL: `https://penny-iota-rouge.vercel.app/api/webhook`
- Verify Token: `penny123`
- Inscrever em eventos: `messages`

### 3. Testar Fluxo Completo

1. Enviar mensagem no WhatsApp
2. Verificar processamento no Gemini
3. Confirmar salvamento no Firestore
4. Ver transação no Dashboard

---

## 🎯 Próxima Vez que Ligar

1. Abrir: https://vercel.com/wendel-monteiros-projects/penny
2. Configurar variáveis de ambiente
3. Fazer redeploy
4. Configurar WhatsApp Business
5. Testar mensagem real

---

**Tudo salvo e pronto para continuar! 🎉**
