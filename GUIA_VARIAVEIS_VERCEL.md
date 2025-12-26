# 🔧 Guia: Configurar Variáveis de Ambiente na Vercel

## 📋 Passo 1: Pegar o VITE_FIREBASE_APP_ID

1. Acesse: https://console.firebase.google.com/
2. Selecione o projeto **Penny-Wendell**
3. Clique no ícone de **engrenagem** ⚙️ > **Configurações do projeto**
4. Role até **Seus apps** > **SDK setup and configuration**
5. Copie o valor de `appId` (algo como: `1:123456789:web:abc123def456`)

---

## 📋 Passo 2: Pegar o FIREBASE_SERVICE_ACCOUNT (JSON completo)

1. Abra o arquivo no seu computador:
   ```
   c:\Users\monte\Downloads\penny-wendell-firebase-adminsdk-fbsvc-36573af991.json
   ```

2. **Copie TODO o conteúdo** (incluindo as chaves `{` e `}`)

3. O JSON deve ter esta estrutura:
   ```json
   {
     "type": "service_account",
     "project_id": "Penny-Wendell",
     "private_key_id": "...",
     "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
     "client_email": "...",
     "client_id": "...",
     "auth_uri": "https://accounts.google.com/o/oauth2/auth",
     "token_uri": "https://oauth2.googleapis.com/token",
     "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
     "client_x509_cert_url": "...",
     "universe_domain": "googleapis.com"
   }
   ```

---

## 📋 Passo 3: Adicionar na Vercel (MÉTODO CORRETO)

### Acesse o Painel
https://vercel.com/wendel-monteiros-projects/penny/settings/environment-variables

### Adicione UMA POR VEZ (não cole tudo de uma vez!)

#### 1️⃣ VITE_FIREBASE_API_KEY
- **Key:** `VITE_FIREBASE_API_KEY`
- **Value:** `AIzaSyAG_q7Dsgrl9uX-EFtUYQI5rty0ncB8vZE`
- **Environment:** ✅ Production ✅ Preview ✅ Development
- Clique em **Save**

#### 2️⃣ VITE_FIREBASE_PROJECT_ID
- **Key:** `VITE_FIREBASE_PROJECT_ID`
- **Value:** `Penny-Wendell`
- **Environment:** ✅ Production ✅ Preview ✅ Development
- Clique em **Save**

#### 3️⃣ VITE_FIREBASE_APP_ID
- **Key:** `VITE_FIREBASE_APP_ID`
- **Value:** `[COLE O APP_ID QUE VOCÊ PEGOU NO PASSO 1]`
- **Environment:** ✅ Production ✅ Preview ✅ Development
- Clique em **Save**

#### 4️⃣ GEMINI_API_KEY
- **Key:** `GEMINI_API_KEY`
- **Value:** `AIzaSyDTXSZZL-7nfTMMIZ15rOFbwaoKhmrDEqs`
- **Environment:** ✅ Production ✅ Preview ✅ Development
- Clique em **Save**

#### 5️⃣ FIREBASE_PROJECT_ID
- **Key:** `FIREBASE_PROJECT_ID`
- **Value:** `Penny-Wendell`
- **Environment:** ✅ Production ✅ Preview ✅ Development
- Clique em **Save**

#### 6️⃣ FIREBASE_SERVICE_ACCOUNT (MAIS IMPORTANTE!)
- **Key:** `FIREBASE_SERVICE_ACCOUNT`
- **Value:** `[COLE TODO O JSON DO ARQUIVO AQUI - SEM QUEBRAS DE LINHA EXTRAS]`
- **Environment:** ✅ Production ✅ Preview ✅ Development
- Clique em **Save**

**⚠️ ATENÇÃO:** O JSON deve estar em UMA ÚNICA LINHA ou formatado corretamente. A Vercel aceita JSON com quebras de linha, mas certifique-se de copiar EXATAMENTE como está no arquivo.

---

## 📋 Passo 4: Redeploy

Após adicionar TODAS as 6 variáveis:

### Opção 1: Via Dashboard
1. Vá em **Deployments**
2. Clique nos **3 pontinhos** ⋮ do último deploy
3. Clique em **Redeploy**
4. Aguarde o build terminar

### Opção 2: Via CLI
```bash
cd c:\Users\monte\Desktop\PENNY
vercel --prod
```

---

## ✅ Verificar se Funcionou

Após o redeploy, teste o webhook:

```bash
curl -X POST https://penny-iota-rouge.vercel.app/api/webhook \
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

## 🔍 Ver Logs (Se Der Erro)

1. Acesse: https://vercel.com/wendel-monteiros-projects/penny
2. Vá em **Deployments**
3. Clique no último deployment
4. Vá em **Functions**
5. Clique em `api/webhook`
6. Veja os logs de erro

---

## ❌ Erros Comuns

### Erro: "FIREBASE_SERVICE_ACCOUNT is not valid JSON"
**Solução:** Certifique-se de copiar TODO o JSON, incluindo `{` e `}`

### Erro: "Invalid service account"
**Solução:** Verifique se o JSON está correto e não tem caracteres extras

### Erro: "GEMINI_API_KEY is not valid"
**Solução:** Verifique se copiou a chave completa sem espaços

---

**Pronto! Após configurar tudo, seu webhook estará 100% funcional! 🚀**
