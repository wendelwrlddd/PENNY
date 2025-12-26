# 📥 Como Importar .env na Vercel

## Método 1: Import via Dashboard (Recomendado)

1. **Prepare o arquivo `.env.vercel`:**
   - Abra o arquivo `.env.vercel` que criei
   - Substitua `COLE_SEU_APP_ID_AQUI` pelo App ID do Firebase
   - Substitua `COLE_O_JSON_COMPLETO_AQUI_EM_UMA_LINHA` pelo JSON completo

2. **Pegar o App ID:**
   - Vá em: https://console.firebase.google.com/
   - Projeto **Penny-Wendell** > ⚙️ Configurações
   - Copie o `appId`

3. **Pegar o Service Account JSON:**
   - Abra: `c:\Users\monte\Downloads\penny-wendell-firebase-adminsdk-fbsvc-36573af991.json`
   - Copie TODO o conteúdo
   - **IMPORTANTE:** Cole em UMA ÚNICA LINHA (sem quebras)
   - Ou use um minificador JSON online

4. **Importar na Vercel:**
   - Acesse: https://vercel.com/wendel-monteiros-projects/penny/settings/environment-variables
   - Clique em **"Add New"** > **"Import .env"**
   - Cole o conteúdo do arquivo `.env.vercel`
   - Selecione: **Production, Preview, Development**
   - Clique em **"Import"**

---

## Método 2: Via CLI (Mais Rápido)

```bash
cd c:\Users\monte\Desktop\PENNY

# Criar arquivo .env.production.local
# Cole as variáveis lá

# Fazer pull das variáveis
vercel env pull .env.production.local

# Fazer push das variáveis
vercel env add VITE_FIREBASE_API_KEY production
# (Cole o valor quando pedir)

# Repetir para cada variável
```

---

## ⚠️ IMPORTANTE: Formato do JSON

O `FIREBASE_SERVICE_ACCOUNT` deve estar em **UMA ÚNICA LINHA**.

**Exemplo correto:**
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"Penny-Wendell","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\nXXXXX\n-----END PRIVATE KEY-----\n","client_email":"firebase@penny.iam.gserviceaccount.com"}
```

**Exemplo ERRADO (com quebras):**
```
FIREBASE_SERVICE_ACCOUNT={
  "type": "service_account",
  "project_id": "Penny-Wendell"
}
```

---

## 🔧 Minificar JSON (Se Necessário)

Use este site para minificar o JSON:
https://jsonformatter.org/json-minify

1. Cole o conteúdo do arquivo JSON
2. Clique em "Minify"
3. Copie o resultado
4. Cole no `.env.vercel` após `FIREBASE_SERVICE_ACCOUNT=`

---

## ✅ Verificar Após Importar

Após importar, verifique se todas as 6 variáveis apareceram:
- ✅ VITE_FIREBASE_API_KEY
- ✅ VITE_FIREBASE_PROJECT_ID
- ✅ VITE_FIREBASE_APP_ID
- ✅ GEMINI_API_KEY
- ✅ FIREBASE_PROJECT_ID
- ✅ FIREBASE_SERVICE_ACCOUNT

Se alguma estiver faltando, adicione manualmente.

---

## 🚀 Redeploy

Após importar:
```bash
vercel --prod
```

Ou no dashboard: **Deployments** > **⋮** > **Redeploy**
