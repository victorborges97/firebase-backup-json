import { DocumentData, Query } from "@google-cloud/firestore";
import * as admin from "firebase-admin";
import * as fs from "fs";
import moment from "moment";

import { Collection, PropsBackup } from "./interfaces";
import { Timestamp } from "firebase-admin/firestore";

const getAndSaveBackupJson = async ({
    collections = [],
    dataInicio,
    dataFim,
}: PropsBackup) => {
    try {
        console.log("INIT BACKUP", moment().format("YYYY-MM-DD HH:mm:ss"));
        let colecoes: any[] = [];

        for (var sub of collections) {
            if (sub.stope) continue;

            console.log("BUSCANDO COLEÇÃO", sub.pathCollection);
            const path = `${sub.pathCollection}`;

            let subCollectionData = await processCollection2(
                sub,
                dataInicio,
                dataFim,
                path,
                sub.newCollectionName || path
            );
            if (subCollectionData == null) continue;
            colecoes.push(subCollectionData);
        }

        //@ts-ignore
        const backupJSON = JSON.stringify(
            {
                colecoes,
            },
            null,
            2
        );

        fs.writeFileSync(
            `backup_${moment(dataInicio).format("YYYY-MM-DD")}-${moment(
                dataFim
            ).format("YYYY-MM-DD")}.json`,
            backupJSON
        );

        console.log("FINISH BACKUP", moment().format("YYYY-MM-DD HH:mm:ss"));

        // console.log(backupJSON);
    } catch (error) {
        console.error("Erro ao fazer o backup:", error);
    }
};

async function processCollection2(
    collection: Collection,
    dataInicio: Date,
    dataFim: Date,
    path: string,
    newPath: string
): Promise<{ path: string; documents: any[] } | null> {
    if (collection.stope) {
        console.log(`🚫 Processamento interrompido para coleção: ${path}`);
        return null;
    }

    var hasUpdatePath = path != newPath;

    console.log(`🔄 Iniciando processamento da coleção: ${path}`);

    let collectionData: any[] = [];
    const firestore = admin.firestore();
    let query: Query<DocumentData, DocumentData> = firestore.collection(path);

    // Aplicando filtro por data, se necessário
    if (collection.filtroData) {
        const { name } = collection.filtroData;
        const startOfDay = new Date(dataInicio);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(dataFim);
        endOfDay.setUTCHours(23, 59, 59, 999);

        query = query.where(name, ">=", Timestamp.fromDate(startOfDay))
        .where(name, "<=", Timestamp.fromDate(endOfDay));

        console.log(
            `📅 Aplicado filtro por data (${name}): ${startOfDay.toISOString()} - ${endOfDay.toISOString()}`
        );
    }

    try {
        // Obtendo documentos da coleção atual
        const collectionSnapshot = await query.get();
        console.log(
            `📂 Coleção ${path} contém ${collectionSnapshot.size} documento(s)`
        );

        collectionData = collectionSnapshot.docs.map((doc) => {
            const originalPath = `${path}/${doc.id}`;
            const newPath2 = `${newPath}/${doc.id}`;

            console.log(
                hasUpdatePath
                    ? `📄 Documento encontrado: ${originalPath} → Novo path: ${newPath2}`
                    : `📄 Documento encontrado: ${originalPath}`
            );

            return {
                path: newPath2,
                id: doc.id,
                data: doc.data(),
            };
        });

        // Se houver coleções filhas, processamos elas recursivamente
        if (collection.children?.length) {
            console.log(`🔍 Buscando coleções filhas para ${path}`);

            await Promise.all(
                collectionData.map(async (col) => {
                    col.collections = collection.children
                        ? await Promise.all(
                              collection.children?.map(async (child) => {
                                  const childPath = `${path}/${col.id}/${child.pathCollection}`;
                                  console.log(
                                      `📂 Processando subcoleção: ${childPath}`
                                  );
                                  return await processCollection2(
                                      child,
                                      dataInicio,
                                      dataFim,
                                      childPath,
                                      `${newPath}/${col.id}/${
                                          child.newCollectionName ??
                                          child.pathCollection
                                      }`
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

        console.log(`✅ Processamento concluído para coleção: ${path}`);

        return {
            path: newPath,
            documents: collectionData,
        };
    } catch (error) {
        console.error(`❌ Erro ao processar coleção: ${path}`, error);
        return null;
    }
}

export { getAndSaveBackupJson as backup };
