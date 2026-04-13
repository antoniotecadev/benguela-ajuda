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

Com autenticação anónima, mantém a leitura pública e exige login para escrever.
As regras abaixo também limitam o formato dos dados para evitar lixo no Firestore e só
permitem alterar um registo para `resolvido: true`.

```txt
rules_version = '2';
service cloud.firestore {
	match /databases/{database}/documents {
		function isSignedIn() {
			return request.auth != null;
		}

		function isStringWithinLimit(field, maxLength) {
			return field is string && field.size() > 0 && field.size() <= maxLength;
		}

		function isValidDocument(data) {
			return data.keys().hasOnly([
					"nome",
					"localizacao",
					"tipo",
					"categoria",
					"urgencia",
					"descricao",
					"contacto",
					"resolvido",
					"createdAt"
				])
				&& isStringWithinLimit(data.nome, 40)
				&& isStringWithinLimit(data.localizacao, 60)
				&& isStringWithinLimit(data.tipo, 10)
				&& isStringWithinLimit(data.categoria, 20)
				&& isStringWithinLimit(data.urgencia, 15)
				&& isStringWithinLimit(data.descricao, 300)
				&& isStringWithinLimit(data.contacto, 12)
				&& data.contacto.matches('^[0-9]{9}$|^244[0-9]{9}$')
				&& data.resolvido is bool;
		}

		function canCreatePost(data) {
			return isSignedIn() && isValidDocument(data) && data.resolvido == false;
		}

		function canResolvePost() {
			return isSignedIn()
				&& resource.data.resolvido == false
				&& request.resource.data.resolvido == true
				&& request.resource.data.nome == resource.data.nome
				&& request.resource.data.localizacao == resource.data.localizacao
				&& request.resource.data.tipo == resource.data.tipo
				&& request.resource.data.categoria == resource.data.categoria
				&& request.resource.data.urgencia == resource.data.urgencia
				&& request.resource.data.descricao == resource.data.descricao
				&& request.resource.data.contacto == resource.data.contacto
				&& request.resource.data.createdAt == resource.data.createdAt;
		}

		match /interacoes/{docId} {
			allow read: if true;
			allow create: if canCreatePost(request.resource.data);
			allow update: if canResolvePost();
			allow delete: if false;
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
