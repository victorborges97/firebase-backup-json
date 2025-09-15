import * as admin from "firebase-admin";
import { BackupColecao, CollectionConfig } from "./interfaces";
export interface PropsRestore {
    viewLog?: boolean;
}
declare const restorePath: (firestore: admin.firestore.Firestore, pathJson: string, { viewLog }: PropsRestore) => Promise<void>;
declare const restoreJson: (firestore: admin.firestore.Firestore, backupColecoes: BackupColecao[], { viewLog }: PropsRestore) => Promise<void>;
/**
 * Busca e restaura backups do bucket pelo intervalo de datas.
 */
declare function restoreBackupsByDate({ firestore, storage, caminho_backup, dataInicio, dataFim, viewLog, collections, }: {
    firestore: admin.firestore.Firestore;
    storage: admin.storage.Storage;
    caminho_backup: string;
    dataInicio: Date;
    dataFim: Date;
    viewLog?: boolean;
    collections?: CollectionConfig[];
}): Promise<void>;
export { restoreBackupsByDate, restoreJson, restorePath };
