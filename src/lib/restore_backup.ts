import * as admin from "firebase-admin";
import * as fs from "fs";
import moment from "moment";
import { FirebaseBackupJsonError } from "./exceptions";
import { BackupColecao } from "./interfaces";
import { logRestoreInfo } from "./utils";

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

const restoreFile = async (firestore: admin.firestore.Firestore, pathJson: string, { viewLog = false }: PropsRestore) => {
    try {
        if (pathJson.length === 0) {
            logRestoreInfo(viewLog, "⚠️ Nenhum caminho fornecido");
            return;
        }

        logRestoreInfo(viewLog, "✅ INICIANDO ", moment().format("YYYY-MM-DD HH:mm:ss"));

        const backupColecoes: BackupColecao[] = parseBackupJSON(
            fs.readFileSync(pathJson, "utf8")
        );

        await restoreBackupJsonInFirebase(firestore, backupColecoes, { viewLog });
    } catch (error: any) {
        logRestoreInfo(true, "❌ Erro ao restaurar arquivo:", error.toString());
    }
};

const restoreBackupJsonInFirebase = async (firestore: admin.firestore.Firestore, backupColecoes: BackupColecao[], { viewLog = false }: PropsRestore) => {
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

export {
    restoreBackupJsonInFirebase as restoreJson, restoreFile as restorePath
};

