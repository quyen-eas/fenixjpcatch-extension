/*
 * Copyright (C) 2026  Fenix Labs
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {IDBFactory, IDBKeyRange} from 'fake-indexeddb';
import {beforeEach, describe, expect, test, vi} from 'vitest';
import {DictionaryDatabase} from '../../ext/js/dictionary/dictionary-database.js';
import {DictionaryImporter} from '../../ext/js/dictionary/dictionary-importer.js';
import {OptionsUtil} from '../../ext/js/data/options-util.js';
import {FenixInstallError} from '../../ext/js/fenix/dictionary-downloader.js';
import {readArchiveTitle} from '../../ext/js/fenix/archive-index.js';
import {FenixDictionaryInstaller} from '../../ext/js/fenix/dictionary-installer.js';
import {FENIX_DICTIONARIES, getDictionaryDownloadUrl} from '../../ext/js/fenix/dictionary-release.js';
import {OnboardingStateStore} from '../../ext/js/fenix/onboarding-state.js';
import {chrome, fetch} from '../mocks/common.js';
import {DictionaryImporterMediaLoader} from '../mocks/dictionary-importer-media-loader.js';
import {setupStubs} from '../utilities/database.js';
import {applyModifications} from './fixtures/apply-modifications.js';
import {createMemoryStorage} from './fixtures/memory-storage.js';
import {FIXTURE_KANJI_COUNT, FIXTURE_TERM_COUNT, createFixtureArchive, createFixtureFiles} from './fixtures/dictionary-fixtures.js';

vi.stubGlobal('fetch', fetch);
vi.stubGlobal('chrome', chrome);
vi.stubGlobal('IDBKeyRange', IDBKeyRange);
setupStubs();

const [TERM, KANJI] = FENIX_DICTIONARIES;

/**
 * @typedef {object} Environment
 * @property {FenixDictionaryInstaller} installer
 * @property {DictionaryDatabase} database
 * @property {import('settings').Options} options
 * @property {OptionsUtil} optionsUtil
 * @property {OnboardingStateStore} state
 * @property {string[]} downloads Requested URLs, in order.
 * @property {() => number} getDatabaseUpdates
 * @property {() => number} getImportCalls How many times the importer was invoked.
 */

/**
 * A complete installer environment: real importer + database (fake IndexedDB), real default options.
 * @param {{failUrls?: Set<string>, archives?: Map<string, ArrayBuffer>, overrides?: Partial<import('../../ext/js/fenix/dictionary-installer.js').InstallerDependencies> | ((context: {database: DictionaryDatabase}) => Partial<import('../../ext/js/fenix/dictionary-installer.js').InstallerDependencies>)}} [config]
 * @returns {Promise<Environment>} The installer plus the objects it operates on, for assertions.
 */
async function createEnvironment({failUrls = new Set(), archives, overrides = {}} = {}) {
    globalThis.indexedDB = new IDBFactory();
    const database = new DictionaryDatabase();
    await database.prepare();
    const optionsUtil = new OptionsUtil();
    await optionsUtil.prepare();
    const options = optionsUtil.getDefault();
    const state = new OnboardingStateStore(createMemoryStorage());
    /** @type {string[]} */
    const downloads = [];
    /** @type {Map<string, ArrayBuffer>} */
    const served = archives ?? new Map([
        [getDictionaryDownloadUrl(TERM), await createFixtureArchive('ja-vi')],
        [getDictionaryDownloadUrl(KANJI), await createFixtureArchive('kanji-vi')],
    ]);
    let databaseUpdates = 0;

    let importCalls = 0;
    const installer = new FenixDictionaryInstaller({
        download: async (url, onProgress) => {
            downloads.push(url);
            if (failUrls.has(url)) { throw new FenixInstallError('download', `HTTP 404 for ${url}`); }
            const archive = served.get(url);
            if (typeof archive === 'undefined') { throw new FenixInstallError('download', `HTTP 404 for ${url}`); }
            onProgress(archive.byteLength / 2, archive.byteLength);
            onProgress(archive.byteLength, archive.byteLength);
            return structuredClone(archive);
        },
        importArchive: async (archive, onProgress) => {
            ++importCalls;
            const importer = new DictionaryImporter(new DictionaryImporterMediaLoader(), onProgress);
            return await importer.importDictionary(database, archive, {prefixWildcardsSupported: false, yomitanVersion: '0.0.0.0'});
        },
        readArchiveTitle,
        deleteDictionary: async (title) => { await database.deleteDictionary(title, 1000, () => {}); },
        getDictionaryInfo: () => database.getDictionaryInfo(),
        getOptionsFull: async () => options,
        getProfileIndex: () => 0,
        modifyGlobalSettings: async (targets) => {
            applyModifications(options, targets);
            return [];
        },
        notifyDatabaseUpdated: async () => { ++databaseUpdates; },
        state,
        createDictionarySettings: (name, enabled, styles) => ({name, alias: name, enabled, allowSecondarySearches: false, definitionsCollapsible: 'not-collapsible', partsOfSpeechFilter: true, useDeinflections: true, styles: styles ?? ''}),
        ...(typeof overrides === 'function' ? overrides({database}) : overrides),
    });
    return {installer, database, options, optionsUtil, state, downloads, getDatabaseUpdates: () => databaseUpdates, getImportCalls: () => importCalls};
}

/**
 * @param {import('../../ext/js/fenix/dictionary-installer.js').InstallEvent[]} events
 * @param {string} id
 * @returns {string[]}
 */
function phases(events, id) {
    return events.filter(({spec}) => spec.id === id).map(({phase}) => phase);
}

describe('Fixture dictionaries', () => {
    test('are well-formed and carry a sequence on every term', () => {
        const files = createFixtureFiles('ja-vi');
        const terms = /** @type {unknown[][]} */ (files.get('term_bank_1.json'));
        expect(terms).toHaveLength(FIXTURE_TERM_COUNT);
        expect(terms.length).toBeGreaterThanOrEqual(20);
        for (const row of terms) {
            expect(row).toHaveLength(8);
            expect(row[6]).toBeGreaterThanOrEqual(9000001);
        }
        expect(/** @type {unknown[]} */ (createFixtureFiles('kanji-vi').get('kanji_bank_1.json'))).toHaveLength(FIXTURE_KANJI_COUNT);
        expect(files.has('kanji_bank_1.json')).toBe(false);
    });
});

describe('FenixDictionaryInstaller', () => {
    beforeEach(() => {
        globalThis.indexedDB = new IDBFactory();
    });

    test('first run downloads and imports both dictionaries and puts them first in the profile', async () => {
        const env = await createEnvironment();
        // A dictionary the user already has stays below ours.
        env.options.profiles[0].options.dictionaries = [{name: 'User dictionary', alias: 'User dictionary', enabled: true, allowSecondarySearches: false, definitionsCollapsible: 'not-collapsible', partsOfSpeechFilter: true, useDeinflections: true, styles: ''}];

        /** @type {import('../../ext/js/fenix/dictionary-installer.js').InstallEvent[]} */
        const events = [];
        const ok = await env.installer.installFirstRun((event) => { events.push(event); });

        expect(ok).toBe(true);
        expect(env.downloads).toStrictEqual(FENIX_DICTIONARIES.map((spec) => getDictionaryDownloadUrl(spec)));
        expect(phases(events, 'ja-vi')[0]).toBe('downloading');
        expect(phases(events, 'ja-vi').at(-1)).toBe('installed');
        expect(phases(events, 'ja-vi')).toContain('importing');
        const downloading = events.filter(({phase, spec}) => phase === 'downloading' && spec.id === 'ja-vi');
        expect(downloading.some(({loaded, total}) => total !== 0 && loaded === total)).toBe(true);

        const profile = env.options.profiles[0].options;
        expect(profile.dictionaries.map(({name}) => name)).toStrictEqual([TERM.title, KANJI.title, 'User dictionary']);
        expect(profile.dictionaries.slice(0, 2).every(({enabled}) => enabled)).toBe(true);
        expect(profile.general.mainDictionary).toBe(TERM.title);
        expect(() => { env.optionsUtil.validate(env.options); }).not.toThrow();
        expect(env.getDatabaseUpdates()).toBe(2);
        expect((await env.state.load()).dictionaries).toStrictEqual({'ja-vi': true, 'kanji-vi': true});

        // The imported data is usable.
        const info = await env.database.getDictionaryInfo();
        expect(info.map(({title}) => title).sort()).toStrictEqual([KANJI.title, TERM.title].sort());
        const titles = new Map([[TERM.title, {alias: TERM.title, allowSecondarySearches: false}]]);
        const terms = await env.database.findTermsBulk(['食べる'], titles, 'exact');
        expect(terms).toHaveLength(1);
        expect(terms[0].sequence).toBeGreaterThanOrEqual(9000001);
        const kanji = await env.database.findKanjiBulk(['日'], new Map([[KANJI.title, {alias: KANJI.title, allowSecondarySearches: false}]]));
        expect(kanji).toHaveLength(1);
    });

    test('a second run does nothing', async () => {
        const env = await createEnvironment();
        await env.installer.installFirstRun(() => {});
        env.downloads.length = 0;
        const before = structuredClone(env.options);
        const ok = await env.installer.installFirstRun(() => {});
        expect(ok).toBe(true);
        expect(env.downloads).toStrictEqual([]);
        expect(env.options).toStrictEqual(before);
    });

    test('a dictionary that the user removed is not reinstalled', async () => {
        const env = await createEnvironment();
        await env.installer.installFirstRun(() => {});
        await env.database.deleteDictionary(KANJI.title, 1000, () => {});
        env.downloads.length = 0;

        /** @type {import('../../ext/js/fenix/dictionary-installer.js').InstallEvent[]} */
        const events = [];
        const ok = await env.installer.installFirstRun((event) => { events.push(event); });
        expect(ok).toBe(false);
        expect(env.downloads).toStrictEqual([]);
        expect(phases(events, 'kanji-vi')).toStrictEqual(['missing']);

        // Explicit install from the page's button works again.
        expect(await env.installer.install(KANJI, () => {})).toBe(true);
        expect(env.downloads).toStrictEqual([getDictionaryDownloadUrl(KANJI)]);
    });

    test('a failed download is reported, nothing is recorded, and a retry succeeds', async () => {
        const failUrls = new Set([getDictionaryDownloadUrl(TERM)]);
        const env = await createEnvironment({failUrls});

        /** @type {import('../../ext/js/fenix/dictionary-installer.js').InstallEvent[]} */
        const events = [];
        const ok = await env.installer.installFirstRun((event) => { events.push(event); });
        expect(ok).toBe(false);
        expect(phases(events, 'ja-vi').at(-1)).toBe('error');
        const errorEvent = events.find(({phase}) => phase === 'error');
        expect(errorEvent?.error?.code).toBe('download');
        expect(phases(events, 'kanji-vi').at(-1)).toBe('installed');
        expect((await env.state.load()).dictionaries).toStrictEqual({'kanji-vi': true});
        // The term dictionary still ends up above the kanji dictionary once it arrives.
        failUrls.clear();
        expect(await env.installer.installFirstRun(() => {})).toBe(true);
        expect(env.options.profiles[0].options.dictionaries.map(({name}) => name)).toStrictEqual([TERM.title, KANJI.title]);
    });

    test('reports invalid archives as import errors', async () => {
        const env = await createEnvironment({archives: new Map([[getDictionaryDownloadUrl(TERM), new TextEncoder().encode('not a zip').buffer]])});
        /** @type {import('../../ext/js/fenix/dictionary-installer.js').InstallEvent[]} */
        const events = [];
        expect(await env.installer.install(TERM, (event) => { events.push(event); })).toBe(false);
        expect(events.at(-1)?.phase).toBe('error');
        expect(events.at(-1)?.error?.code).toBe('import');
        expect((await env.state.load()).dictionaries).toStrictEqual({});
    });

    test('repairs a dictionary that was imported but never registered in the profile', async () => {
        const env = await createEnvironment();
        // Simulate an interrupted run: data in the database, nothing in the options or the state.
        const importer = new DictionaryImporter(new DictionaryImporterMediaLoader(), () => {});
        await importer.importDictionary(env.database, await createFixtureArchive('ja-vi'), {prefixWildcardsSupported: false, yomitanVersion: '0.0.0.0'});
        env.downloads.length = 0;
        await env.installer.installFirstRun(() => {});
        expect(env.downloads).toStrictEqual([getDictionaryDownloadUrl(KANJI)]);
        expect(env.options.profiles[0].options.dictionaries.map(({name}) => name)).toStrictEqual([TERM.title, KANJI.title]);
    });

    describe('partial and wrong imports', () => {
        /** @type {import('../../ext/js/fenix/dictionary-installer.js').InstallEvent[]} */
        let events = [];
        /** @type {(event: import('../../ext/js/fenix/dictionary-installer.js').InstallEvent) => void} */
        const record = (event) => { events.push(event); };
        beforeEach(() => { events = []; });

        /**
         * @param {Environment} env
         * @returns {Promise<string[]>}
         */
        async function titlesInDatabase(env) {
            return (await env.database.getDictionaryInfo()).map(({title}) => title);
        }

        test('P1: an import with row-write errors is removed, not recorded, and succeeds when retried', async () => {
            const env = await createEnvironment();
            const bulkAdd = env.database.bulkAdd.bind(env.database);
            let fail = true;
            vi.spyOn(env.database, 'bulkAdd').mockImplementation(async (store, entries, start, count) => {
                if (fail && store === 'terms') { throw new Error('disk full'); }
                await bulkAdd(store, entries, start, count);
            });

            expect(await env.installer.install(TERM, record)).toBe(false);
            const error = events.at(-1)?.error;
            expect(events.at(-1)?.phase).toBe('error');
            expect(error?.code).toBe('import');
            expect(error?.message).toContain('disk full');
            expect(await titlesInDatabase(env)).toStrictEqual([]); // the partial import was deleted
            expect(env.options.profiles[0].options.dictionaries).toStrictEqual([]);
            expect((await env.state.load()).dictionaries).toStrictEqual({});
            expect(await env.installer.getInstalled()).toStrictEqual(new Map([['ja-vi', false], ['kanji-vi', false]]));

            // The next first-run attempt installs it from scratch.
            fail = false;
            events = [];
            expect(await env.installer.installFirstRun(record)).toBe(true);
            expect(await titlesInDatabase(env)).toStrictEqual([TERM.title, KANJI.title].sort());
            expect(env.options.profiles[0].options.dictionaries.map(({name}) => name)).toStrictEqual([TERM.title, KANJI.title]);
            const terms = await env.database.findTermsBulk(['食べる'], new Map([[TERM.title, {alias: TERM.title, allowSecondarySearches: false}]]), 'exact');
            expect(terms).toHaveLength(1);
        });

        test('invalid data is rejected by the importer before it writes anything', async () => {
            const broken = await createFixtureArchive('ja-vi', 'broken', (files) => {
                files.set('term_bank_1.json', [['食べる', 'たべる']]); // rows must have 8 fields
            });
            const env = await createEnvironment({archives: new Map([[getDictionaryDownloadUrl(TERM), broken], [getDictionaryDownloadUrl(KANJI), await createFixtureArchive('kanji-vi')]])});

            expect(await env.installer.install(TERM, record)).toBe(false);
            expect(events.at(-1)?.error?.code).toBe('import');
            expect(await titlesInDatabase(env)).toStrictEqual([]);
            expect((await env.state.load()).dictionaries).toStrictEqual({});
        });

        test('P1: a null result that left data behind is cleaned up too', async () => {
            const env = await createEnvironment({overrides: ({database}) => ({
                importArchive: async (archive) => {
                    // Imports fully, then reports failure the way the importer does for late problems (e.g. invalid CSS).
                    await new DictionaryImporter(new DictionaryImporterMediaLoader(), () => {}).importDictionary(database, archive, {prefixWildcardsSupported: false, yomitanVersion: '0.0.0.0'});
                    return {result: null, errors: [new Error('invalid styles')]};
                },
            })});
            expect(await env.installer.install(TERM, record)).toBe(false);
            expect(events.at(-1)?.error?.message).toContain('invalid styles');
            expect(await titlesInDatabase(env)).toStrictEqual([]);
        });

        test('P1: a stale interrupted import (importSuccess false) is replaced on the next first run', async () => {
            let stale = true;
            const env = await createEnvironment({overrides: ({database}) => ({
                // The importer only flags importSuccess false when it fails mid-way; present a complete import as such.
                getDictionaryInfo: async () => (await database.getDictionaryInfo()).map((info) => (stale && info.title === TERM.title ? {...info, importSuccess: false} : info)),
                deleteDictionary: async (title) => {
                    await database.deleteDictionary(title, 1000, () => {});
                    stale = false;
                },
            })});
            await new DictionaryImporter(new DictionaryImporterMediaLoader(), () => {}).importDictionary(env.database, await createFixtureArchive('ja-vi'), {prefixWildcardsSupported: false, yomitanVersion: '0.0.0.0'});
            await env.state.update((state) => { state.importing[TERM.id] = true; }); // an earlier first-run attempt started it
            expect(await env.installer.getInstalled()).toStrictEqual(new Map([['ja-vi', false], ['kanji-vi', false]]));

            expect(await env.installer.installFirstRun(record)).toBe(true);
            expect(stale).toBe(false); // it was deleted, then imported again
            expect((await env.state.load()).importing).toStrictEqual({});
            expect(env.getImportCalls()).toBe(2);
            expect(await titlesInDatabase(env)).toStrictEqual([TERM.title, KANJI.title].sort());
            expect(env.options.profiles[0].options.dictionaries.map(({name}) => name)).toStrictEqual([TERM.title, KANJI.title]);
        });

        test('P1: an attempt that died mid-import leaves a mark, and the next first run cleans up after it', async () => {
            let crash = true;
            const env = await createEnvironment({overrides: ({database}) => ({
                importArchive: async (archive, onProgress) => {
                    const importer = new DictionaryImporter(new DictionaryImporterMediaLoader(), onProgress);
                    const summary = await importer.importDictionary(database, archive, {prefixWildcardsSupported: false, yomitanVersion: '0.0.0.0'});
                    if (crash) { throw new Error('worker killed'); } // e.g. the tab was closed; nothing after this line runs
                    return summary;
                },
            })});
            expect(await env.installer.install(TERM, record)).toBe(false);
            expect((await env.state.load()).importing).toStrictEqual({[TERM.id]: true});

            crash = false;
            // Make the leftover look like what the importer leaves when interrupted.
            const complete = env.database.getDictionaryInfo.bind(env.database);
            vi.spyOn(env.database, 'getDictionaryInfo').mockImplementation(async () => (await complete()).map((info) => (info.title === TERM.title && crash === false && !deleted ? {...info, importSuccess: false} : info)));
            let deleted = false;
            const remove = env.database.deleteDictionary.bind(env.database);
            vi.spyOn(env.database, 'deleteDictionary').mockImplementation(async (...args) => {
                deleted = true;
                await remove(...args);
            });

            events = [];
            expect(await env.installer.installFirstRun(record)).toBe(true);
            expect(deleted).toBe(true);
            expect((await env.state.load()).importing).toStrictEqual({});
            expect(await titlesInDatabase(env)).toStrictEqual([TERM.title, KANJI.title].sort());
        });

        test('P1: an unfinished import that is not ours (e.g. running from Settings) is never deleted', async () => {
            let deletions = 0;
            const env = await createEnvironment({overrides: ({database}) => ({
                // The importer inserts the summary with importSuccess false while an import is running.
                getDictionaryInfo: async () => (await database.getDictionaryInfo()).map((info) => (info.title === TERM.title ? {...info, importSuccess: false} : info)),
                deleteDictionary: async () => { ++deletions; },
            })});
            await new DictionaryImporter(new DictionaryImporterMediaLoader(), () => {}).importDictionary(env.database, await createFixtureArchive('ja-vi'), {prefixWildcardsSupported: false, yomitanVersion: '0.0.0.0'});

            expect(await env.installer.installFirstRun(record)).toBe(false);
            expect(deletions).toBe(0);
            expect(env.getImportCalls()).toBe(1); // only the kanji dictionary was imported
            expect(events.filter(({spec, phase}) => spec.id === TERM.id && phase === 'error')).toHaveLength(1);
            expect(phases(events, KANJI.id).at(-1)).toBe('installed');
            expect((await env.state.load()).dictionaries).toStrictEqual({[KANJI.id]: true});
            expect((await env.state.load()).importing).toStrictEqual({});
            expect(await titlesInDatabase(env)).toContain(TERM.title);
        });

        test('P2: an archive with the wrong title is rejected before anything is imported', async () => {
            const wrong = await createFixtureArchive('ja-vi');
            const env = await createEnvironment({archives: new Map([[getDictionaryDownloadUrl(KANJI), wrong]])});
            expect(await env.installer.install(KANJI, record)).toBe(false);
            expect(events.at(-1)?.error?.message).toContain('Unexpected dictionary title');
            expect(env.getImportCalls()).toBe(0);
            expect(await titlesInDatabase(env)).toStrictEqual([]);
            expect((await env.state.load()).dictionaries).toStrictEqual({});
        });

        test('P2: Retry after a wrong archive runs clean once the asset is fixed', async () => {
            const served = new Map([[getDictionaryDownloadUrl(KANJI), await createFixtureArchive('ja-vi')]]);
            const env = await createEnvironment({archives: served});
            expect(await env.installer.install(KANJI, record)).toBe(false);
            served.set(getDictionaryDownloadUrl(KANJI), await createFixtureArchive('kanji-vi'));
            expect(await env.installer.install(KANJI, record)).toBe(true);
            expect(await titlesInDatabase(env)).toStrictEqual([KANJI.title]);
        });

        test('P2: if a wrong archive does get imported, it is deleted again', async () => {
            const served = new Map([[getDictionaryDownloadUrl(KANJI), await createFixtureArchive('ja-vi')]]);
            // The pre-import check is blind (e.g. an unexpected zip layout); the post-import check must catch it.
            const env = await createEnvironment({archives: served, overrides: {readArchiveTitle: async () => KANJI.title}});
            expect(await env.installer.install(KANJI, record)).toBe(false);
            expect(env.getImportCalls()).toBe(1);
            expect(events.at(-1)?.error?.message).toContain('Unexpected dictionary title');
            expect(await titlesInDatabase(env)).toStrictEqual([]);
            expect(env.options.profiles[0].options.dictionaries).toStrictEqual([]);
            expect((await env.state.load()).dictionaries).toStrictEqual({});
        });

        test('a failing cleanup is reported and nothing is recorded', async () => {
            const env = await createEnvironment({overrides: ({database}) => ({
                importArchive: async (archive) => {
                    await new DictionaryImporter(new DictionaryImporterMediaLoader(), () => {}).importDictionary(database, archive, {prefixWildcardsSupported: false, yomitanVersion: '0.0.0.0'});
                    return {result: null, errors: [new Error('boom')]};
                },
                deleteDictionary: async () => { throw new Error('delete failed'); },
            })});
            expect(await env.installer.install(TERM, record)).toBe(false);
            const message = events.at(-1)?.error?.message ?? '';
            expect(message).toContain('boom');
            expect(message).toContain('delete failed');
            expect((await env.state.load()).dictionaries).toStrictEqual({});
            expect((await env.state.load()).importing).toStrictEqual({[TERM.id]: true}); // still ours to clean up next time
            expect(env.options.profiles[0].options.dictionaries).toStrictEqual([]);
        });
    });
});
