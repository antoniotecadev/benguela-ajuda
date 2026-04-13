# Benguela Ajuda

MVP de emergencia para ligar rapidamente quem precisa de apoio e quem pode ajudar.

## Funcionalidades

- Publicar `PEDIDO` ou `OFERTA`
- Filtros por tipo e bairro
- Etiquetas de urgencia (`CRITICO`, `NECESSARIO`, `APOIO`)
- Botao de contacto direto via WhatsApp
- Marcacao comunitaria de `Ja resolvido`
- PWA basico (instalavel no telemovel)

## 1) Configurar Firebase

1. Cria um projeto no Firebase.
2. Ativa Authentication com `Anonymous`.
3. Cria Firestore Database em modo de producao (ou teste para arranque).
4. Copia `.env.example` para `.env.local` e preenche os valores `NEXT_PUBLIC_FIREBASE_*`.

Guia detalhado: ver `FIREBASE_SETUP.md`.

## 2) Regras Firestore (arranque rapido)

Para lancar de imediato, podes comecar com regras de escrita/leitura abertas e depois endurecer.

```txt
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		match /interacoes/{doc} {
			allow read, write: if true;
		}
	}
}
```

## 3) Correr localmente

```bash
npm install
npm run dev
```

Abrir em `http://localhost:3000`.

## 4) Deploy rapido

1. Publica no GitHub.
2. Importa na Vercel.
3. Adiciona as mesmas variaveis de ambiente da `.env.local` na Vercel.
4. Faz deploy.

## Estrutura de dados (colecao `interacoes`)

```json
{
	"tipo": "PEDIDO",
	"categoria": "TRANSPORTE",
	"urgencia": "CRITICO",
	"localizacao": "Tchipiandalo",
	"descricao": "Preciso de transporte para 2 idosos para zona alta.",
	"contacto": "923000000",
	"nome": "",
	"resolvido": false,
	"createdAt": "timestamp"
}
```
