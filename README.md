# @jvborges.97/firebase-backup-json

Backup e restore de coleções e subcoleções do Firestore em formato JSON, com suporte a filtros, paginação e hierarquia.

## Instalação

```bash
npm install @jvborges.97/firebase-backup-json
```

## Pré-requisitos

- Node.js 16+
- Conta de serviço do Firebase (arquivo JSON)
- Firestore já inicializado no seu projeto

## Uso Básico

### Backup

```typescript
import * as admin from "firebase-admin";
import { backup } from "@jvborges.97/firebase-backup-json";

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccount.json")),
});

const firestore = admin.firestore();

const dataInicio = new Date("2025-01-01T00:00:00Z");
const dataFim = new Date("2025-01-31T23:59:59Z");

await backup(firestore, {
  dataInicio,
  dataFim,
  collections: [
    {
      pathCollection: "EMPRESAS",
      filtroId: ["empresa1", "empresa2"], // opcional: filtro por IDs
      filtroData: { name: "createdAt" },  // opcional: filtro por campo de data
      children: [
        {
          pathCollection: "RESERVATION",
          filtroData: { name: "createdAt" },
        },
        {
          pathCollection: "SERVICES",
        },
      ],
    },
  ],
  viewLog: true,    // opcional: exibe logs detalhados
  saveLocal: true,  // opcional: salva localmente (default: true)
});
```

### Restore

```typescript
import * as admin from "firebase-admin";
import { restorePath } from "@jvborges.97/firebase-backup-json";

admin.initializeApp({
  credential: admin.credential.cert(require("./serviceAccount.json")),
});

const firestore = admin.firestore();

await restorePath(firestore, "backup_2025-01-01-2025-01-31.json", { viewLog: true });
```

## Parâmetros
### Backup

- **firestore**: Instância do Firestore (`admin.firestore()`).
- **dataInicio**: Data inicial para filtro de documentos.
- **dataFim**: Data final para filtro de documentos.
- **collections**: Array de coleções a serem exportadas, podendo conter subcoleções aninhadas.
- **viewLog**: (opcional) Exibe logs detalhados do processo.
- **saveLocal**: (opcional) Salva o arquivo localmente (default: `true`).

### Restore

- **firestore**: Instância do Firestore (`admin.firestore()`).
- **pathJson**: Caminho do arquivo JSON de backup.
- **options.viewLog**: (opcional) Exibe logs detalhados do processo.

### Exemplo de configuração de coleção

```js
{
  pathCollection: "NOME_DA_COLECAO",
  filtroId: ["id1", "id2"], // opcional, até 10 IDs por consulta
  filtroData: { name: "campoData" }, // opcional
  newCollectionName: "novo_nome", // opcional
  stope: false, // opcional, para ignorar coleção
  children: [ /* subcoleções */ ]
}
```

## Saída

- Um arquivo JSON será salvo no diretório atual, nomeado como:
  ```
  backup_YYYY-MM-DD-YYYY-MM-DD.json
  ```
- O arquivo contém toda a estrutura das coleções e subcoleções exportadas.

## Observações

- O filtro `filtroId` usa o operador `in` do Firestore (máximo 10 IDs por consulta).
- O backup é feito em memória antes de salvar o arquivo. Para coleções muito grandes, recomenda-se dividir o backup em partes.
- Subcoleções são exportadas e restauradas recursivamente.
- O restore converte automaticamente tipos especiais do Firestore (Timestamp, GeoPoint, DocumentReference).
- O restore utiliza batches de até 500 documentos por operação, conforme limite do Firestore.

## Licença

MIT

---