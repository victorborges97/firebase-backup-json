import { CollectionConfig } from "./interfaces";
/**
 * Gera o nome do arquivo de backup no formato:
 * bkp_DD-MM-YYYY_DD-MM-YYYY.json
 */
export declare function getBackupFilename(dataInicio: Date, dataFim: Date): string;
export declare function logBackupInfo(isView: boolean, ...message: string[]): void;
export declare function logRestoreInfo(isView: boolean, ...message: string[]): void;
export declare function getCollectionNameFromPath(path: string): string;
export declare function adjustPathsInDocument(doc: any, originalRoot: string, newRoot?: string): any;
export declare function docMatchesIdFilter(doc: any, filtroId?: string[]): boolean;
export declare function docMatchesDateFilter(doc: any, filtroData: {
    name: string;
} | null | undefined, inicio?: Date, fim?: Date): boolean;
export declare function filterCollectionByConfig(backupColecao: any, config: CollectionConfig, inicio?: Date, fim?: Date): any | null;
