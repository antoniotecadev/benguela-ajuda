# Firebase Setup Rapido (10 min)

## 1) Criar projeto

1. Ir para console.firebase.google.com
2. Criar projeto: benguela-ajuda

## 2) Ativar Firestore

1. Build > Firestore Database
2. Create database
3. Escolher modo de producao (ou teste para arranque imediato)
4. Escolher regiao mais proxima

## 3) Ativar Anonymous Auth

1. Build > Authentication
2. Get started
3. Sign-in method
4. Ativar Anonymous

## 4) Obter chaves web

1. Project settings > General
2. Em Your apps, criar app Web (</>)
3. Copiar config e preencher .env.local

Campos obrigatorios no .env.local:

- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
- NEXT_PUBLIC_FIREBASE_APP_ID

## 5) Aplicar regras

1. Firestore Database > Rules
2. Colar conteudo de firestore.rules
3. Publish

## 6) Testar local

1. npm run dev
2. Abrir http://localhost:3000
3. Publicar um PEDIDO de teste
4. Confirmar documento criado na colecao interacoes

## 7) Configurar Vercel

1. Project Settings > Environment Variables
2. Adicionar as mesmas variaveis do .env.local
3. Fazer novo deploy
