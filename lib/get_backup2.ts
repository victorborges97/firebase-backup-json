import { DocumentData, Query } from "@google-cloud/firestore";
import * as admin from "firebase-admin";
import * as fs from "fs";
import moment from "moment";

import { Timestamp } from "firebase-admin/firestore";
import { FirebaseBackupJsonError } from "./exceptions";
import { Collection, PropsBackup } from "./interfaces";
import { getBackupFilename, logBackupInfo } from "./utils";

const getAndSaveBackupJson = async (firestore: admin.firestore.Firestore, {
    collections = [],
    dataInicio,
    dataFim,
    viewLog = false,
    saveLocal = true,
}: PropsBackup) => {
    try {
        logBackupInfo(viewLog, "Iniciando... ", moment().format("YYYY-MM-DD HH:mm:ss"));
        let colecoes: any[] = [];

        for (var sub of collections) {
            if (sub.stope) continue;

            logBackupInfo(viewLog, "BUSCANDO COLEÇÃO ", sub.pathCollection);
            const path = `${sub.pathCollection}`;

            let subCollectionData = await processCollection2(
                firestore,
                sub,
                dataInicio,
                dataFim,
                viewLog,
                path,
                sub.newCollectionName || path
            );
            if (subCollectionData == null) continue;
            colecoes.push(subCollectionData);
        }

        const backupJSON = JSON.stringify({colecoes});

        if (saveLocal) {
            fs.writeFileSync(
                getBackupFilename(dataInicio, dataFim),
                backupJSON
            );
        }

        logBackupInfo(viewLog, "FINISH ", moment().format("YYYY-MM-DD HH:mm:ss"));
        return {
            dataJson: { colecoes },
            dataString: backupJSON
        };
    } catch (error) {
        logBackupInfo(viewLog, "❌ Erro ao fazer o backup: ", error?.message || error);
        throw new FirebaseBackupJsonError("Erro ao fazer o backup", error);
    }
};

async function processCollection2(
    firestore: admin.firestore.Firestore,
    collection: Collection,
    dataInicio: Date,
    dataFim: Date,
    viewLog: boolean = false,
    path: string,
    newPath: string,
    parentInfo: string = ""
): Promise<{ path: string; documents: any[] } | null> {
    if (collection.stope) {
        logBackupInfo(viewLog, "Processamento interrompido para coleção: ", path);
        return null;
    }

    var hasUpdatePath = path != newPath;

    logBackupInfo(viewLog, "Iniciando processamento da coleção: ", path);

    let collectionData: any[] = [];
    let query: Query<DocumentData> = firestore.collection(path);

    // Filtro por ID (IN)
    if (collection.filtroId && Array.isArray(collection.filtroId) && collection.filtroId.length > 0) {
        // Firestore só permite até 10 elementos no array do 'in'
        const ids = collection.filtroId.slice(0, 10);
        query = query.where(admin.firestore.FieldPath.documentId(), "in", ids);
        logBackupInfo(viewLog, "Aplicado filtro IN por ID: ", `[${ids.join(", ")}]`);
    }

    // Aplicando filtro por data, se necessário
    if (collection.filtroData) {
        const { name } = collection.filtroData;
        const startOfDay = new Date(dataInicio);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(dataFim);
        endOfDay.setUTCHours(23, 59, 59, 999);

        query = query.where(name, ">=", Timestamp.fromDate(startOfDay))
        .where(name, "<=", Timestamp.fromDate(endOfDay));

        logBackupInfo(viewLog, "Aplicado filtro por data: ", `${startOfDay.toISOString()} - ${endOfDay.toISOString()}`);
    }

    try {
        // Obtendo documentos da coleção atual
        let collectionData = await fetchAllDocuments(query, path, newPath, hasUpdatePath, viewLog);

        logBackupInfo(viewLog, "Coleção contém: ", collectionData.length.toString(), " documento(s)");

        // Se houver coleções filhas, processamos elas recursivamente
        if (collection.children?.length) {
            logBackupInfo(viewLog, "Buscando coleções filhas para: ", path);

            await Promise.all(
                collectionData.map(async (col) => {
                    col.collections = collection.children
                        ? await Promise.all(
                              collection.children?.map(async (child) => {
                                  const childPath = `${path}/${col.id}/${child.pathCollection}`;
                                  const parentInfo = `${newPath.replace(/[\/\\]/g, "_")}_${col.id}`;

                                  logBackupInfo(viewLog, "Processando subcoleção: ", childPath);
                                  return await processCollection2(
                                      firestore,
                                      child,
                                      dataInicio,
                                      dataFim,
                                      viewLog,
                                      childPath,
                                      `${newPath}/${col.id}/${
                                          child.newCollectionName ??
                                          child.pathCollection
                                      }`,
                                      parentInfo,
                                  );
                              })
                          )
                        : null;
                    // Filtrando filhos nulos (caso alguma coleção tenha sido ignorada)
                    col.collections =
                        col.collections?.filter(
                            (child: any) => child !== null
                        ) || [];
                })
            );
        }

        logBackupInfo(viewLog, "Processamento concluído para coleção: ", path);

        return {
            path: newPath,
            documents: collectionData,
        };
    } catch (error) {
        logBackupInfo(viewLog, "❌ Erro ao processar coleção: ", path);
        return null;
    }
}

async function fetchAllDocuments(
    query: Query<DocumentData>,
    path: string,
    newPath: string,
    hasUpdatePath: boolean,
    viewLog: boolean
): Promise<any[]> {
    const pageSize = 500;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let hasMore = true;
    let collectionData: any[] = [];

    while (hasMore) {
        let pagedQuery = query.limit(pageSize);
        if (lastDoc) {
            pagedQuery = pagedQuery.startAfter(lastDoc);
        }
        const snapshot = await pagedQuery.get();

        if (snapshot.empty) {
            hasMore = false;
            break;
        }

        snapshot.docs.forEach((doc) => {
            const originalPath = `${path}/${doc.id}`;
            const newPath2 = `${newPath}/${doc.id}`;
            
            logBackupInfo(
                viewLog,
                hasUpdatePath
                    ? `📄 Documento encontrado: ${originalPath} → Novo path: ${newPath2}`
                    : `📄 Documento encontrado: ${originalPath}`
            );
            collectionData.push({
                path: newPath2,
                id: doc.id,
                data: doc.data(),
            });
        });

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        hasMore = snapshot.size === pageSize;
    }

    return collectionData;
}

export { getAndSaveBackupJson as backup };

