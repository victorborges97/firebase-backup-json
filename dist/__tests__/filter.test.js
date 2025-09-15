"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../lib/utils");
const sampleBackup = {
    path: 'EMPRESAS',
    documents: [
        {
            path: 'EMPRESAS/abc',
            id: 'abc',
            data: { createdAt: { _seconds: 1700000000, _nanoseconds: 0 } },
            collections: [
                {
                    path: 'EMPRESAS/abc/RESERVATION',
                    documents: [
                        { path: 'EMPRESAS/abc/RESERVATION/r1', id: 'r1', data: {} }
                    ]
                }
            ]
        },
        {
            path: 'EMPRESAS/def',
            id: 'def',
            data: { createdAt: { _seconds: 1600000000, _nanoseconds: 0 } },
        }
    ]
};
test('filter by id keeps only matching doc', () => {
    const cfg = { pathCollection: 'EMPRESAS', filtroId: ['abc'] };
    const res = (0, utils_1.filterCollectionByConfig)(sampleBackup, cfg, new Date(0), new Date());
    expect(res).not.toBeNull();
    expect(res.documents.length).toBe(1);
    expect(res.documents[0].id).toBe('abc');
});
test('filter by date excludes older docs', () => {
    const cfg = { pathCollection: 'EMPRESAS', filtroData: { name: 'createdAt' } };
    // range that includes only 1700000000
    const inicio = new Date(1690000000 * 1000);
    const fim = new Date(1710000000 * 1000);
    const res = (0, utils_1.filterCollectionByConfig)(sampleBackup, cfg, inicio, fim);
    expect(res).not.toBeNull();
    expect(res.documents.length).toBe(1);
    expect(res.documents[0].id).toBe('abc');
});
test('newCollectionName renames root and document paths', () => {
    const cfg = { pathCollection: 'EMPRESAS', newCollectionName: 'BUSINESS', filtroId: ['abc'] };
    const res = (0, utils_1.filterCollectionByConfig)(sampleBackup, cfg, new Date(0), new Date());
    expect(res).not.toBeNull();
    expect(res.path.startsWith('BUSINESS')).toBeTruthy();
    expect(res.documents[0].path.startsWith('BUSINESS/')).toBeTruthy();
});
test('parent kept when child collection matches filter', () => {
    const sample2 = {
        path: 'EMPRESAS',
        documents: [
            {
                path: 'EMPRESAS/p1', id: 'p1', data: {},
                collections: [
                    { path: 'EMPRESAS/p1/RESERVATION', documents: [{ path: 'EMPRESAS/p1/RESERVATION/c1', id: 'c1', data: {} }] }
                ]
            }
        ]
    };
    const cfgParent = { pathCollection: 'EMPRESAS', filtroId: ['other'] };
    const cfgChild = { pathCollection: 'RESERVATION', filtroId: ['c1'] };
    const res = (0, utils_1.filterCollectionByConfig)(sample2, cfgParent, new Date(0), new Date());
    // parent alone with no matching id or child -> null
    expect(res).toBeNull();
    // when checking with child config, filterCollectionByConfig operates per collection; simulate combined behaviour
    const parentFiltered = (0, utils_1.filterCollectionByConfig)(sample2, { pathCollection: 'EMPRESAS', children: [cfgChild] }, new Date(0), new Date());
    expect(parentFiltered).not.toBeNull();
    expect(parentFiltered.documents.length).toBe(1);
    expect(parentFiltered.documents[0].collections.length).toBe(1);
});
