"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restorePath = exports.restoreJson = void 0;
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const moment_1 = __importDefault(require("moment"));
const exceptions_1 = require("./exceptions");
const utils_1 = require("./utils");
async function saveBackupToFirestore(firestore, collectionData, batch, batchOps, viewLog) {
    (0, utils_1.logRestoreInfo)(viewLog, "🔄 Processando coleção: ", collectionData.path);
    for (const documentData of collectionData.documents) {
        (0, utils_1.logRestoreInfo)(viewLog, "📄 Adicionando documento: ", documentData.path);
        const documentRef = firestore.doc(documentData.path);
        // 🛠️ Converte timestamps antes de salvar
        const convertedData = restoreFirestoreTypes(documentData.data);
        batch.set(documentRef, convertedData);
        let currentBatch = batchOps[batchOps.length - 1];
        currentBatch.count++;
        (0, utils_1.logRestoreInfo)(viewLog, "📊 Batch atual: ", batchOps.length.toString(), "Contador: ", currentBatch.count.toString());
        if (currentBatch.count >= 500) {
            (0, utils_1.logRestoreInfo)(viewLog, "🚀 Commitando batch #", batchOps.length.toString(), "com ", currentBatch.count.toString(), "documentos");
            currentBatch.batch.commit();
            batchOps.push({ batch: firestore.batch(), count: 0 });
        }
        if (documentData.collections) {
            (0, utils_1.logRestoreInfo)(viewLog, "📂 Documento ", documentData.path, " contém subcoleções");
            for (const childCollection of documentData.collections) {
                await saveBackupToFirestore(firestore, childCollection, currentBatch.batch, batchOps, viewLog);
            }
        }
    }
}
const restoreFile = async (firestore, pathJson, { viewLog = false }) => {
    try {
        if (pathJson.length === 0) {
            (0, utils_1.logRestoreInfo)(viewLog, "⚠️ Nenhum caminho fornecido");
            return;
        }
        (0, utils_1.logRestoreInfo)(viewLog, "✅ INICIANDO ", (0, moment_1.default)().format("YYYY-MM-DD HH:mm:ss"));
        const backupColecoes = parseBackupJSON(fs.readFileSync(pathJson, "utf8"));
        await restoreBackupJsonInFirebase(firestore, backupColecoes, { viewLog });
    }
    catch (error) {
        (0, utils_1.logRestoreInfo)(true, "❌ Erro ao restaurar arquivo:", error.toString());
    }
};
exports.restorePath = restoreFile;
const restoreBackupJsonInFirebase = async (firestore, backupColecoes, { viewLog = false }) => {
    try {
        if (backupColecoes.length === 0) {
            (0, utils_1.logRestoreInfo)(viewLog, "⚠️ Nenhum dado de backup encontrado");
            return;
        }
        let batchOps = [{ batch: admin.firestore().batch(), count: 0 }];
        for (const backupColecao of backupColecoes) {
            (0, utils_1.logRestoreInfo)(viewLog, "🗂 Restaurando coleção raiz: ", backupColecao.path);
            await saveBackupToFirestore(firestore, backupColecao, batchOps[0].batch, batchOps, viewLog);
        }
        // Commit de todos os batches pendentes
        for (let i = 0; i < batchOps.length; i++) {
            if (batchOps[i].count > 0) {
                (0, utils_1.logRestoreInfo)(viewLog, "✅ Commitando batch final #", (i + 1).toString(), "com ", batchOps[i].count.toString(), "documentos");
                await batchOps[i].batch.commit();
            }
        }
        (0, utils_1.logRestoreInfo)(viewLog, "🎉 Restauração concluída com sucesso!");
        (0, utils_1.logRestoreInfo)(viewLog, "🎉 FINALIZADO RESTORE BACKUP", (0, moment_1.default)().format("YYYY-MM-DD HH:mm:ss"));
    }
    catch (error) {
        (0, utils_1.logRestoreInfo)(viewLog, "❌ Erro ao fazer o restore backup:", error.toString());
        throw new exceptions_1.FirebaseBackupJsonError("Erro ao fazer o restore backup", error.toString());
    }
};
exports.restoreJson = restoreBackupJsonInFirebase;
function parseBackupJSON(jsonData) {
    const backupData = JSON.parse(jsonData);
    if (!backupData || !backupData.colecoes) {
        throw new exceptions_1.FirebaseBackupJsonError("Formato JSON inválido. O campo 'colecoes' é obrigatório.", null);
    }
    return backupData.colecoes;
}
function restoreFirestoreTypes(data) {
    if (typeof data !== "object" || data === null)
        return data;
    // Se for um Timestamp Firestore salvo no formato JSON
    if (data._seconds !== undefined &&
        data._nanoseconds !== undefined &&
        Object.keys(data).length === 2) {
        return new admin.firestore.Timestamp(data._seconds, data._nanoseconds);
    }
    // Se for um GeoPoint (Firestore GeoPoint)
    if (typeof data._latitude === "number" &&
        typeof data._longitude === "number") {
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
    const convertedData = {};
    for (const key in data) {
        convertedData[key] = restoreFirestoreTypes(data[key]);
    }
    return convertedData;
}
