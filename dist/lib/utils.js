"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logRestoreInfo = exports.logBackupInfo = exports.getBackupFilename = void 0;
const moment_1 = __importDefault(require("moment"));
/**
 * Gera o nome do arquivo de backup no formato:
 * backup_YYYY-MM-DD-YYYY-MM-DD.json
 */
function getBackupFilename(dataInicio, dataFim) {
    const inicio = (0, moment_1.default)(dataInicio).format("YYYY-MM-DD");
    const fim = (0, moment_1.default)(dataFim).format("YYYY-MM-DD");
    return `backup_${inicio}-${fim}.json`;
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
