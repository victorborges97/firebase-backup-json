import * as admin from "firebase-admin";
import { PropsBackup } from "./interfaces";
declare const getAndSaveBackupJson: (firestore: admin.firestore.Firestore, { collections, dataInicio, dataFim, viewLog, saveLocal, }: PropsBackup) => Promise<{
    dataJson: {
        colecoes: any[];
    };
    dataString: string;
}>;
export { getAndSaveBackupJson as backup };
