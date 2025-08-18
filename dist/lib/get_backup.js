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
const getAndSaveBackupJson = async ({ collections = [], dataInicio, dataFim, }) => {
    try {
        console.log("INIT BACKUP", (0, moment_1.default)().format("YYYY-MM-DD HH:mm:ss"));
        let colecoes = [];
        for (var sub of collections) {
            if (sub.stope)
                continue;
            console.log("BUSCANDO COLEÇÃO", sub.pathCollection);
            const path = `${sub.pathCollection}`;
            let subCollectionData = await processCollection2(sub, dataInicio, dataFim, path, sub.newCollectionName || path);
            if (subCollectionData == null)
                continue;
            colecoes.push(subCollectionData);
        }
        //@ts-ignore
        const backupJSON = JSON.stringify({
            colecoes,
        }, null, 2);
        fs.writeFileSync(`backup_${(0, moment_1.default)(dataInicio).format("YYYY-MM-DD")}-${(0, moment_1.default)(dataFim).format("YYYY-MM-DD")}.json`, backupJSON);
        console.log("FINISH BACKUP", (0, moment_1.default)().format("YYYY-MM-DD HH:mm:ss"));
        // console.log(backupJSON);
    }
    catch (error) {
        console.error("Erro ao fazer o backup:", error);
    }
};
exports.backup = getAndSaveBackupJson;
async function processCollection2(collection, dataInicio, dataFim, path, newPath) {
    var _a;
    if (collection.stope) {
        console.log(`🚫 Processamento interrompido para coleção: ${path}`);
        return null;
    }
    var hasUpdatePath = path != newPath;
    console.log(`🔄 Iniciando processamento da coleção: ${path}`);
    let collectionData = [];
    const firestore = admin.firestore();
    let query = firestore.collection(path);
    // Aplicando filtro por data, se necessário
    if (collection.filtroData) {
        const { name } = collection.filtroData;
        const startOfDay = new Date(dataInicio);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(dataFim);
        endOfDay.setUTCHours(23, 59, 59, 999);
        query = query.where(name, ">=", firestore_1.Timestamp.fromDate(startOfDay))
            .where(name, "<=", firestore_1.Timestamp.fromDate(endOfDay));
        console.log(`📅 Aplicado filtro por data (${name}): ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);
    }
    try {
        // Obtendo documentos da coleção atual
        const collectionSnapshot = await query.get();
        console.log(`📂 Coleção ${path} contém ${collectionSnapshot.size} documento(s)`);
        collectionData = collectionSnapshot.docs.map((doc) => {
            const originalPath = `${path}/${doc.id}`;
            const newPath2 = `${newPath}/${doc.id}`;
            console.log(hasUpdatePath
                ? `📄 Documento encontrado: ${originalPath} → Novo path: ${newPath2}`
                : `📄 Documento encontrado: ${originalPath}`);
            return {
                path: newPath2,
                id: doc.id,
                data: doc.data(),
            };
        });
        // Se houver coleções filhas, processamos elas recursivamente
        if ((_a = collection.children) === null || _a === void 0 ? void 0 : _a.length) {
            console.log(`🔍 Buscando coleções filhas para ${path}`);
            await Promise.all(collectionData.map(async (col) => {
                var _a, _b;
                col.collections = collection.children
                    ? await Promise.all((_a = collection.children) === null || _a === void 0 ? void 0 : _a.map(async (child) => {
                        var _a;
                        const childPath = `${path}/${col.id}/${child.pathCollection}`;
                        console.log(`📂 Processando subcoleção: ${childPath}`);
                        return await processCollection2(child, dataInicio, dataFim, childPath, `${newPath}/${col.id}/${(_a = child.newCollectionName) !== null && _a !== void 0 ? _a : child.pathCollection}`);
                    }))
                    : null;
                // Filtrando filhos nulos (caso alguma coleção tenha sido ignorada)
                col.collections =
                    ((_b = col.collections) === null || _b === void 0 ? void 0 : _b.filter((child) => child !== null)) || [];
            }));
        }
        console.log(`✅ Processamento concluído para coleção: ${path}`);
        return {
            path: newPath,
            documents: collectionData,
        };
    }
    catch (error) {
        console.error(`❌ Erro ao processar coleção: ${path}`, error);
        return null;
    }
}
