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
exports.backup = void 0;
const admin = __importStar(require("firebase-admin"));
const fs = __importStar(require("fs"));
const moment_1 = __importDefault(require("moment"));
const firestore_1 = require("firebase-admin/firestore");
const exceptions_1 = require("./exceptions");
const utils_1 = require("./utils");
const getAndSaveBackupJson = async (firestore, { collections = [], dataInicio, dataFim, viewLog = false, saveLocal = true, }) => {
    try {
        (0, utils_1.logBackupInfo)(viewLog, "Iniciando... ", (0, moment_1.default)().format("YYYY-MM-DD HH:mm:ss"));
        let colecoes = [];
        for (var sub of collections) {
            if (sub.stope)
                continue;
            (0, utils_1.logBackupInfo)(viewLog, "BUSCANDO COLEÇÃO ", sub.pathCollection);
            const path = `${sub.pathCollection}`;
            let subCollectionData = await processCollection2(firestore, sub, dataInicio, dataFim, viewLog, path, sub.newCollectionName || path);
            if (subCollectionData == null)
                continue;
            colecoes.push(subCollectionData);
        }
        const backupJSON = JSON.stringify({ colecoes });
        if (saveLocal) {
            fs.writeFileSync((0, utils_1.getBackupFilename)(dataInicio, dataFim), backupJSON);
        }
        (0, utils_1.logBackupInfo)(viewLog, "FINISH ", (0, moment_1.default)().format("YYYY-MM-DD HH:mm:ss"));
        return {
            dataJson: { colecoes },
            dataString: backupJSON
        };
    }
    catch (error) {
        (0, utils_1.logBackupInfo)(viewLog, "❌ Erro ao fazer o backup: ", ((error === null || error === void 0 ? void 0 : error.message) || error).toString());
        throw new exceptions_1.FirebaseBackupJsonError("Erro ao fazer o backup", error.toString());
    }
};
exports.backup = getAndSaveBackupJson;
async function processCollection2(firestore, collection, dataInicio, dataFim, viewLog = false, path, newPath, parentInfo = "") {
    var _a;
    if (collection.stope) {
        (0, utils_1.logBackupInfo)(viewLog, "Processamento interrompido para coleção: ", path);
        return null;
    }
    var hasUpdatePath = path != newPath;
    (0, utils_1.logBackupInfo)(viewLog, "Iniciando processamento da coleção: ", path);
    let query = firestore.collection(path);
    // Filtro por ID (IN)
    if (collection.filtroId && Array.isArray(collection.filtroId) && collection.filtroId.length > 0) {
        // Firestore só permite até 10 elementos no array do 'in'
        const ids = collection.filtroId.slice(0, 10);
        query = query.where(admin.firestore.FieldPath.documentId(), "in", ids);
        (0, utils_1.logBackupInfo)(viewLog, "Aplicado filtro IN por ID: ", `[${ids.join(", ")}]`);
    }
    // Aplicando filtro por data, se necessário
    if (collection.filtroData) {
        const { name } = collection.filtroData;
        const startOfDay = new Date(dataInicio);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(dataFim);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query = query.where(name, ">=", firestore_1.Timestamp.fromDate(startOfDay))
            .where(name, "<=", firestore_1.Timestamp.fromDate(endOfDay));
        (0, utils_1.logBackupInfo)(viewLog, "Aplicado filtro por data: ", `${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);
    }
    try {
        // Obtendo documentos da coleção atual
        let collectionData = await fetchAllDocuments(query, path, newPath, hasUpdatePath, viewLog);
        (0, utils_1.logBackupInfo)(viewLog, "Coleção contém: ", collectionData.length.toString(), " documento(s)");
        // Se houver coleções filhas, processamos elas recursivamente
        if ((_a = collection.children) === null || _a === void 0 ? void 0 : _a.length) {
            (0, utils_1.logBackupInfo)(viewLog, "Buscando coleções filhas para: ", path);
            await Promise.all(collectionData.map(async (col) => {
                var _a, _b;
                col.collections = collection.children
                    ? await Promise.all((_a = collection.children) === null || _a === void 0 ? void 0 : _a.map(async (child) => {
                        var _a;
                        const childPath = `${path}/${col.id}/${child.pathCollection}`;
                        const parentInfo = `${newPath.replace(/[\/\\]/g, "_")}_${col.id}`;
                        (0, utils_1.logBackupInfo)(viewLog, "Processando subcoleção: ", childPath);
                        return await processCollection2(firestore, child, dataInicio, dataFim, viewLog, childPath, `${newPath}/${col.id}/${(_a = child.newCollectionName) !== null && _a !== void 0 ? _a : child.pathCollection}`, parentInfo);
                    }))
                    : null;
                // Filtrando filhos nulos (caso alguma coleção tenha sido ignorada)
                col.collections =
                    ((_b = col.collections) === null || _b === void 0 ? void 0 : _b.filter((child) => child !== null)) || [];
            }));
        }
        (0, utils_1.logBackupInfo)(viewLog, "Processamento concluído para coleção: ", path);
        return {
            path: newPath,
            documents: collectionData,
        };
    }
    catch (error) {
        (0, utils_1.logBackupInfo)(viewLog, "❌ Erro ao processar coleção: ", path);
        return null;
    }
}
async function fetchAllDocuments(query, path, newPath, hasUpdatePath, viewLog) {
    const pageSize = 500;
    let lastDoc = null;
    let hasMore = true;
    let collectionData = [];
    while (hasMore) {
        let pagedQuery = query.limit(pageSize);
        if (lastDoc) {
            pagedQuery = pagedQuery.startAfter(lastDoc);
        }
        const snapshot = await pagedQuery.get();
        if (snapshot.empty) {
            hasMore = false;
            break;
        }
        snapshot.docs.forEach((doc) => {
            const originalPath = `${path}/${doc.id}`;
            const newPath2 = `${newPath}/${doc.id}`;
            (0, utils_1.logBackupInfo)(viewLog, hasUpdatePath
                ? `📄 Documento encontrado: ${originalPath} → Novo path: ${newPath2}`
                : `📄 Documento encontrado: ${originalPath}`);
            collectionData.push({
                path: newPath2,
                id: doc.id,
                data: doc.data(),
            });
        });
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        hasMore = snapshot.size === pageSize;
    }
    return collectionData;
}
