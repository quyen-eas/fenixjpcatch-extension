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

import {BlobWriter, TextReader, ZipWriter} from '@zip.js/zip.js';
import {describe, expect, test} from 'vitest';
import {readArchiveTitle} from '../../ext/js/fenix/archive-index.js';
import {FenixInstallError} from '../../ext/js/fenix/dictionary-downloader.js';
import {createFixtureArchive} from './fixtures/dictionary-fixtures.js';

/**
 * @param {Record<string, string>} files
 * @returns {Promise<ArrayBuffer>}
 */
async function createZip(files) {
    const writer = new ZipWriter(new BlobWriter(), {level: 0});
    for (const [name, content] of Object.entries(files)) { await writer.add(name, new TextReader(content)); }
    return await (await writer.close()).arrayBuffer();
}

describe('readArchiveTitle', () => {
    test('returns the title of a fixture archive', async () => {
        expect(await readArchiveTitle(await createFixtureArchive('ja-vi'))).toBe('FenixJpCatch JA-VI');
        expect(await readArchiveTitle(await createFixtureArchive('kanji-vi'))).toBe('FenixJpCatch Kanji-VI');
    });

    test.each([
        ['not a zip', new TextEncoder().encode('not a zip').buffer],
    ])('rejects %s with an import error', async (_name, data) => {
        await expect(readArchiveTitle(data)).rejects.toBeInstanceOf(FenixInstallError);
    });

    test('rejects an archive without index.json, with broken JSON, or without a title', async () => {
        await expect(readArchiveTitle(await createZip({'term_bank_1.json': '[]'}))).rejects.toThrow('No dictionary index');
        await expect(readArchiveTitle(await createZip({'index.json': '{oops'}))).rejects.toMatchObject({code: 'import'});
        await expect(readArchiveTitle(await createZip({'index.json': '{"revision": "1"}'}))).rejects.toThrow('no title');
        await expect(readArchiveTitle(await createZip({'index.json': '{"title": ""}'}))).rejects.toMatchObject({code: 'import'});
    });

    test('does not look into sub-directories (the importer requires index.json at the root)', async () => {
        await expect(readArchiveTitle(await createZip({'folder/index.json': '{"title": "X"}'}))).rejects.toMatchObject({code: 'import'});
    });
});
