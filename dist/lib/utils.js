"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterCollectionByConfig = exports.docMatchesDateFilter = exports.docMatchesIdFilter = exports.adjustPathsInDocument = exports.getCollectionNameFromPath = exports.logRestoreInfo = exports.logBackupInfo = exports.getBackupFilename = void 0;
const moment_1 = __importDefault(require("moment"));
/**
 * Gera o nome do arquivo de backup no formato:
 * bkp_DD-MM-YYYY_DD-MM-YYYY.json
 */
function getBackupFilename(dataInicio, dataFim) {
    const inicio = (0, moment_1.default)(dataInicio).format("DD-MM-YYYY");
    const fim = (0, moment_1.default)(dataFim).format("DD-MM-YYYY");
    return `bkp_${inicio}_${fim}.json`;
}
exports.getBackupFilename = getBackupFilename;
function logBackupInfo(isView, ...message) {
    if (isView) {
        console.log(`[BACKUP] ${message.join(" ")}`);
    }
}
exports.logBackupInfo = logBackupInfo;
function logRestoreInfo(isView, ...message) {
    if (isView) {
        console.log(`[RESTORE] ${message.join(" ")}`);
    }
}
exports.logRestoreInfo = logRestoreInfo;
// --- Helpers para filtro/ajuste usados no restore ---
function getCollectionNameFromPath(path) {
    const parts = path.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : path;
}
exports.getCollectionNameFromPath = getCollectionNameFromPath;
function adjustPathsInDocument(doc, originalRoot, newRoot) {
    if (!newRoot || originalRoot === newRoot)
        return doc;
    const replaceSegment = (p) => {
        if (!p)
            return p;
        return p.split("/").map(seg => seg === originalRoot ? newRoot : seg).join("/");
    };
    if (doc.path) {
        doc.path = replaceSegment(doc.path);
    }
    if (doc.collections && Array.isArray(doc.collections)) {
        for (const child of doc.collections) {
            if (child.path)
                child.path = replaceSegment(child.path);
            if (child.documents && Array.isArray(child.documents)) {
                child.documents.forEach((d) => adjustPathsInDocument(d, originalRoot, newRoot));
            }
        }
    }
}
exports.adjustPathsInDocument = adjustPathsInDocument;
function docMatchesIdFilter(doc, filtroId) {
    if (!filtroId || filtroId.length === 0)
        return true;
    return filtroId.includes(doc.id);
}
exports.docMatchesIdFilter = docMatchesIdFilter;
function docMatchesDateFilter(doc, filtroData, inicio, fim) {
    var _a;
    if (!filtroData || !inicio || !fim)
        return true;
    const field = filtroData.name;
    const value = (_a = doc.data) === null || _a === void 0 ? void 0 : _a[field];
    if (!value)
        return false;
    let dateVal = null;
    if (value && typeof value === 'object' && value._seconds !== undefined) {
        dateVal = new Date(value._seconds * 1000);
    }
    else if (value instanceof Date) {
        dateVal = value;
    }
    else if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime()))
            dateVal = parsed;
    }
    if (!dateVal)
        return false;
    return dateVal >= inicio && dateVal <= fim;
}
exports.docMatchesDateFilter = docMatchesDateFilter;
function filterCollectionByConfig(backupColecao, config, inicio, fim) {
    const rootName = getCollectionNameFromPath(backupColecao.path);
    if (rootName !== config.pathCollection)
        return null;
    const originalRoot = rootName;
    const newRoot = config.newCollectionName;
    const filteredDocuments = [];
    for (const doc of backupColecao.documents) {
        let newDoc = JSON.parse(JSON.stringify(doc));
        if (newDoc.collections && Array.isArray(newDoc.collections) && config.children && config.children.length) {
            const newChildren = [];
            for (const childConfig of config.children) {
                for (const childCollection of newDoc.collections) {
                    const childRoot = getCollectionNameFromPath(childCollection.path);
                    if (childRoot === childConfig.pathCollection) {
                        const filteredChild = filterCollectionByConfig(childCollection, childConfig, inicio, fim);
                        if (filteredChild)
                            newChildren.push(filteredChild);
                    }
                }
            }
            newDoc.collections = newChildren;
        }
        else {
            newDoc.collections = [];
        }
        const matchesId = docMatchesIdFilter(newDoc, config.filtroId);
        const matchesDate = docMatchesDateFilter(newDoc, config.filtroData || null, inicio, fim);
        if (matchesId && matchesDate || (newDoc.collections && newDoc.collections.length > 0)) {
            adjustPathsInDocument(newDoc, originalRoot, newRoot);
            filteredDocuments.push(newDoc);
        }
    }
    if (filteredDocuments.length === 0)
        return null;
    const replaceSegment = (p) => {
        if (!p)
            return p;
        return p.split("/").map(seg => seg === originalRoot ? newRoot : seg).join("/");
    };
    const result = {
        path: newRoot ? replaceSegment(backupColecao.path) : backupColecao.path,
        documents: filteredDocuments,
    };
    return result;
}
exports.filterCollectionByConfig = filterCollectionByConfig;
