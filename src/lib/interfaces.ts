export interface BackupColecao {
    path: string;
    documents: BackupDocumento[];
}
export interface BackupDocumento {
    path: string;
    id: string;
    data: any;
    collections?: BackupColecao[];
}

export interface Collection {
    pathCollection: string;
    newCollectionName?: string;
    filtroData?: FiltroData | undefined;
    filtroId?: string[] | undefined; // Filtro por ID (IN)
    children?: Collection[] | undefined;
    stope?: boolean;
}

export interface FiltroData {
    name: string;
}

export interface PropsBackup {
    dataInicio: Date;
    dataFim: Date;
    collections: Collection[];
    viewLog?: boolean;
    saveLocal?: boolean;
}
