import * as admin from "firebase-admin";
import { BackupColecao } from "./interfaces";
export interface PropsRestore {
    viewLog?: boolean;
}
declare const restoreFile: (firestore: admin.firestore.Firestore, pathJson: string, { viewLog }: PropsRestore) => Promise<void>;
declare const restoreBackupJsonInFirebase: (firestore: admin.firestore.Firestore, backupColecoes: BackupColecao[], { viewLog }: PropsRestore) => Promise<void>;
export { restoreBackupJsonInFirebase as restoreJson, restoreFile as restorePath };
