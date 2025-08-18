import { PropsBackup } from "./interfaces";
declare const getAndSaveBackupJson: ({ collections, dataInicio, dataFim, }: PropsBackup) => Promise<void>;
export { getAndSaveBackupJson as backup };
