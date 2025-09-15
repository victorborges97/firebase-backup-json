import * as admin from "firebase-admin";
import { PropsBackup } from "./interfaces";
declare const getAndSaveBackupJson: (firestore: admin.firestore.Firestore, { collections, dataInicio, dataFim, viewLog, saveLocal, }: PropsBackup) => Promise<{
    dataJson: {
        colecoes: any[];
    };
    dataString: string;
}>;
declare function backupStorage(storage: admin.storage.Storage, firestore: admin.firestore.Firestore, path: string, { collections, dataInicio, dataFim, viewLog, saveLocal, }: PropsBackup): Promise<void>;
export { getAndSaveBackupJson as backup, backupStorage };
