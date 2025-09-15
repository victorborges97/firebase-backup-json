import moment from "moment";
import { CollectionConfig } from "./interfaces";

/**
 * Gera o nome do arquivo de backup no formato:
 * bkp_DD-MM-YYYY_DD-MM-YYYY.json
 */
export function getBackupFilename(dataInicio: Date, dataFim: Date): string {
    const inicio = moment(dataInicio).format("DD-MM-YYYY");
    const fim = moment(dataFim).format("DD-MM-YYYY");
    return `bkp_${inicio}_${fim}.json`;
}

export function logBackupInfo(isView: boolean, ...message: string[]): void {
    if (isView) {
        console.log(`[BACKUP] ${message.join(" ")}`);
    }
}

export function logRestoreInfo(isView: boolean, ...message: string[]): void {
    if (isView) {
        console.log(`[RESTORE] ${message.join(" ")}`);
    }
}

// --- Helpers para filtro/ajuste usados no restore ---

export function getCollectionNameFromPath(path: string) {
    const parts = path.split("/").filter(Boolean);
    return parts.length ? parts[parts.length - 1] : path;
}

export function adjustPathsInDocument(doc: any, originalRoot: string, newRoot?: string) {
    if (!newRoot || originalRoot === newRoot) return doc;

    const replaceSegment = (p: string) => {
        if (!p) return p;
        return p.split("/").map(seg => seg === originalRoot ? newRoot : seg).join("/");
    };

    if (doc.path) {
        doc.path = replaceSegment(doc.path);
    }
    if (doc.collections && Array.isArray(doc.collections)) {
        for (const child of doc.collections) {
            if (child.path) child.path = replaceSegment(child.path);
            if (child.documents && Array.isArray(child.documents)) {
                child.documents.forEach((d: any) => adjustPathsInDocument(d, originalRoot, newRoot));
            }
        }
    }
}

export function docMatchesIdFilter(doc: any, filtroId?: string[]) {
    if (!filtroId || filtroId.length === 0) return true;
    return filtroId.includes(doc.id);
}

export function docMatchesDateFilter(doc: any, filtroData: { name: string } | null | undefined, inicio?: Date, fim?: Date) {
    if (!filtroData || !inicio || !fim) return true;
    const field = filtroData.name;
    const value = doc.data?.[field];
    if (!value) return false;

    let dateVal: Date | null = null;
    if (value && typeof value === 'object' && value._seconds !== undefined) {
        dateVal = new Date(value._seconds * 1000);
    } else if (value instanceof Date) {
        dateVal = value;
    } else if (typeof value === 'string') {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) dateVal = parsed;
    }

    if (!dateVal) return false;
    return dateVal >= inicio && dateVal <= fim;
}

export function filterCollectionByConfig(backupColecao: any, config: CollectionConfig, inicio?: Date, fim?: Date): any | null {
    const rootName = getCollectionNameFromPath(backupColecao.path);
    if (rootName !== config.pathCollection) return null;

    const originalRoot = rootName;
    const newRoot = config.newCollectionName;

    const filteredDocuments: any[] = [];

    for (const doc of backupColecao.documents) {
        let newDoc: any = JSON.parse(JSON.stringify(doc));

        if (newDoc.collections && Array.isArray(newDoc.collections) && config.children && config.children.length) {
            const newChildren: any[] = [];
            for (const childConfig of config.children) {
                for (const childCollection of newDoc.collections) {
                    const childRoot = getCollectionNameFromPath(childCollection.path);
                    if (childRoot === childConfig.pathCollection) {
                        const filteredChild = filterCollectionByConfig(childCollection, childConfig, inicio, fim);
                        if (filteredChild) newChildren.push(filteredChild);
                    }
                }
            }
            newDoc.collections = newChildren;
        } else {
            newDoc.collections = [];
        }

        const matchesId = docMatchesIdFilter(newDoc, config.filtroId);
        const matchesDate = docMatchesDateFilter(newDoc, config.filtroData || null, inicio, fim);

        if (matchesId && matchesDate || (newDoc.collections && newDoc.collections.length > 0)) {
            adjustPathsInDocument(newDoc, originalRoot, newRoot);
            filteredDocuments.push(newDoc);
        }
    }

    if (filteredDocuments.length === 0) return null;

    const replaceSegment = (p: string) => {
        if (!p) return p;
        return p.split("/").map(seg => seg === originalRoot ? newRoot : seg).join("/");
    };

    const result = {
        path: newRoot ? replaceSegment(backupColecao.path) : backupColecao.path,
        documents: filteredDocuments,
    };
    return result;
}