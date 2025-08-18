/**
 * Gera o nome do arquivo de backup no formato:
 * backup_YYYY-MM-DD-YYYY-MM-DD.json
 */
export declare function getBackupFilename(dataInicio: Date, dataFim: Date): string;
export declare function logBackupInfo(isView: boolean, ...message: string[]): void;
export declare function logRestoreInfo(isView: boolean, ...message: string[]): void;
