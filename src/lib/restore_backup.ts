import * as admin from "firebase-admin";
import * as fs from "fs";
import moment from "moment";
import { FirebaseBackupJsonError } from "./exceptions";
import { BackupColecao, CollectionConfig } from "./interfaces";
import { filterCollectionByConfig, logRestoreInfo } from "./utils";

export interface PropsRestore {
    viewLog?: boolean;
}

async function saveBackupToFirestore(
    firestore: admin.firestore.Firestore,
    collectionData: BackupColecao,
    batch: admin.firestore.WriteBatch,
    batchOps: { batch: admin.firestore.WriteBatch; count: number }[],
    viewLog: boolean
) {
    logRestoreInfo(viewLog, "🔄 Processando coleção: ", collectionData.path);
    for (const documentData of collectionData.documents) {
        logRestoreInfo(viewLog, "📄 Adicionando documento: ", documentData.path);

        const documentRef = firestore.doc(documentData.path);

        // 🛠️ Converte timestamps antes de salvar
        const convertedData = restoreFirestoreTypes(documentData.data);

        batch.set(documentRef, convertedData);

        let currentBatch = batchOps[batchOps.length - 1];

        currentBatch.count++;

        logRestoreInfo(viewLog, "📊 Batch atual: ", batchOps.length.toString(), "Contador: ", currentBatch.count.toString());

        if (currentBatch.count >= 500) {
            logRestoreInfo(viewLog, "🚀 Commitando batch #", batchOps.length.toString(), "com ", currentBatch.count.toString(), "documentos");
            currentBatch.batch.commit();
            batchOps.push({ batch: firestore.batch(), count: 0 });
        }

        if (documentData.collections) {
            logRestoreInfo(viewLog, "📂 Documento ", documentData.path, " contém subcoleções");
            for (const childCollection of documentData.collections) {
                await saveBackupToFirestore(
                    firestore,
                    childCollection,
                    currentBatch.batch,
                    batchOps,
                    viewLog
                );
            }
        }
    }
}

const restorePath = async (firestore: admin.firestore.Firestore, pathJson: string, { viewLog = false }: PropsRestore) => {
    try {
        if (pathJson.length === 0) {
            logRestoreInfo(viewLog, "⚠️ Nenhum caminho fornecido");
            return;
        }

        logRestoreInfo(viewLog, "✅ INICIANDO ", moment().format("YYYY-MM-DD HH:mm:ss"));

        const backupColecoes: BackupColecao[] = parseBackupJSON(
            fs.readFileSync(pathJson, "utf8")
        );

        await restoreJson(firestore, backupColecoes, { viewLog });
    } catch (error: any) {
        logRestoreInfo(true, "❌ Erro ao restaurar arquivo:", error.toString());
    }
};

const restoreJson = async (firestore: admin.firestore.Firestore, backupColecoes: BackupColecao[], { viewLog = false }: PropsRestore) => {
    try {
        if (backupColecoes.length === 0) {
            logRestoreInfo(viewLog, "⚠️ Nenhum dado de backup encontrado");
            return;
        }

        let batchOps = [{ batch: admin.firestore().batch(), count: 0 }];

        for (const backupColecao of backupColecoes) {
            logRestoreInfo(viewLog, "🗂 Restaurando coleção raiz: ", backupColecao.path);
            await saveBackupToFirestore(
                firestore,
                backupColecao,
                batchOps[0].batch,
                batchOps,
                viewLog
            );
        }

        // Commit de todos os batches pendentes
        for (let i = 0; i < batchOps.length; i++) {
            if (batchOps[i].count > 0) {
                logRestoreInfo(viewLog, "✅ Commitando batch final #", (i + 1).toString(), "com ", batchOps[i].count.toString(), "documentos");
                await batchOps[i].batch.commit();
            }
        }

        logRestoreInfo(viewLog, "🎉 Restauração concluída com sucesso!");
        logRestoreInfo(viewLog, "🎉 FINALIZADO RESTORE BACKUP", moment().format("YYYY-MM-DD HH:mm:ss"));
    } catch (error: any) {
        logRestoreInfo(viewLog, "❌ Erro ao fazer o restore backup:", error.toString());
        throw new FirebaseBackupJsonError("Erro ao fazer o restore backup", error.toString());
    }
};

function parseBackupJSON(jsonData: string): BackupColecao[] {
    const backupData = JSON.parse(jsonData);

    if (!backupData || !backupData.colecoes) {
        throw new FirebaseBackupJsonError(
            "Formato JSON inválido. O campo 'colecoes' é obrigatório.",
            null
        );
    }

    return backupData.colecoes;
}

function restoreFirestoreTypes(data: any): any {
    if (typeof data !== "object" || data === null) return data;

    // Se for um Timestamp Firestore salvo no formato JSON
    if (
        data._seconds !== undefined &&
        data._nanoseconds !== undefined &&
        Object.keys(data).length === 2
    ) {
        return new admin.firestore.Timestamp(data._seconds, data._nanoseconds);
    }

    // Se for um GeoPoint (Firestore GeoPoint)
    if (
        typeof data._latitude === "number" &&
        typeof data._longitude === "number"
    ) {
        return new admin.firestore.GeoPoint(data._latitude, data._longitude);
    }

    // Se for uma referência de documento (Firestore DocumentReference)
    if (data._firestore && data._path && Array.isArray(data._path.segments)) {
        const firestore = admin.firestore();
        return firestore.doc(data._path.segments.join("/"));
    }

    // Se for um objeto normal, percorre recursivamente
    if (Array.isArray(data)) {
        return data.map(restoreFirestoreTypes);
    }

    const convertedData: any = {};
    for (const key in data) {
        convertedData[key] = restoreFirestoreTypes(data[key]);
    }

    return convertedData;
}

// ... helpers moved to utils.ts

/**
 * Busca e restaura backups do bucket pelo intervalo de datas.
 */
async function restoreBackupsByDate({
    firestore,
    storage,
    caminho_backup,
    dataInicio,
    dataFim,
    viewLog = false,
    collections,
}: {
    firestore: admin.firestore.Firestore;
    storage: admin.storage.Storage;
    caminho_backup: string;
    dataInicio: Date;
    dataFim: Date;
    viewLog?: boolean;
    collections?: CollectionConfig[];
}) {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);

    const bucket = storage.bucket();

    // 1. Listar todos arquivos do bucket nesse prefixo
    const [files] = await bucket.getFiles({ prefix: caminho_backup });

    // 2. Filtrar arquivos que estão no intervalo de datas
    logRestoreInfo(viewLog, `🔍 Procurando arquivos de backup entre ${moment(inicio).format("DD-MM-YYYY")} e ${moment(fim).format("DD-MM-YYYY")}`);
    logRestoreInfo(viewLog, `📁 Total de arquivos encontrados no bucket com o prefixo '${caminho_backup}': ${files.length}`);
    const arquivosFiltrados = files.filter((file) => {
        const match = file.name.match(/bkp_(\d{2}-\d{2}-\d{4})_(\d{2}-\d{2}-\d{4})\.json$/);
        if (!match) return false;
        const dataInicioArquivo = moment(match[1], "DD-MM-YYYY").toDate();
        const dataFimArquivo = moment(match[2], "DD-MM-YYYY").toDate();
        // O arquivo é incluído se houver sobreposição com o intervalo solicitado
        return dataFimArquivo >= inicio && dataInicioArquivo <= fim;
    });
    logRestoreInfo(viewLog, `✅ Total de arquivos de backup encontrados no intervalo: ${arquivosFiltrados.length}`);

    console.log(arquivosFiltrados.map(f => f.name).join("\n"));

    if (arquivosFiltrados.length === 0) {
        throw new Error("Nenhum arquivo de backup encontrado no intervalo.");
    }

    // 3. Restaurar documentos de cada arquivo
    for (const file of arquivosFiltrados) {
        try {
            // Tenta baixar o arquivo para memória
            const [contents] = await file.download();
            const jsonData = contents.toString("utf8");
            const backupColecoes: BackupColecao[] = parseBackupJSON(jsonData);
            // Se foi passada uma configuração de collections, filtramos o backup antes de restaurar
            if (collections && collections.length) {
                const inicioFile = new Date(dataInicio);
                const fimFile = new Date(dataFim);
                const filtered: BackupColecao[] = [];
                for (const cfg of collections) {
                    for (const bc of backupColecoes) {
                        const fc = filterCollectionByConfig(bc, cfg, inicioFile, fimFile);
                        if (fc) filtered.push(fc as BackupColecao);
                    }
                }

                if (filtered.length === 0) {
                    logRestoreInfo(viewLog, `⚠️ Nenhum documento correspondente à configuração encontrado no arquivo ${file.name}`);
                } else {
                    await restoreJson(firestore, filtered, { viewLog });
                }
            } else {
                await restoreJson(firestore, backupColecoes, { viewLog });
            }
        } catch (error: any) {
            logRestoreInfo(true, `❌ Erro ao restaurar arquivo ${file.name}:`, error.toString());
        }
    }
}

export { restoreBackupsByDate, restoreJson, restorePath };

