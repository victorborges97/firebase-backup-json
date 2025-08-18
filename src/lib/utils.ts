import moment from "moment";

/**
 * Gera o nome do arquivo de backup no formato:
 * backup_YYYY-MM-DD-YYYY-MM-DD.json
 */
export function getBackupFilename(dataInicio: Date, dataFim: Date): string {
    const inicio = moment(dataInicio).format("YYYY-MM-DD");
    const fim = moment(dataFim).format("YYYY-MM-DD");
    return `backup_${inicio}-${fim}.json`;
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