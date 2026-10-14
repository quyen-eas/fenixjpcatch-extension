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

import {
    TextWriter as TextWriter0,
    Uint8ArrayReader as Uint8ArrayReader0,
    ZipReader as ZipReader0,
    configure,
} from '../../lib/zip.js';
import {parseJson} from '../core/json.js';
import {FenixInstallError} from './dictionary-downloader.js';

// Same typing workaround as dictionary-importer.js: the bundled zip.js has no declarations of its own.
const TextWriter = /** @type {typeof import('@zip.js/zip.js').TextWriter} */ (/** @type {unknown} */ (TextWriter0));
const Uint8ArrayReader = /** @type {typeof import('@zip.js/zip.js').Uint8ArrayReader} */ (/** @type {unknown} */ (Uint8ArrayReader0));
const ZipReader = /** @type {typeof import('@zip.js/zip.js').ZipReader} */ (/** @type {unknown} */ (ZipReader0));

/**
 * Reads `title` from the `index.json` at the root of a dictionary archive, without importing anything.
 * Lets the installer reject a wrong archive before it touches the database.
 * @param {ArrayBuffer} archive
 * @returns {Promise<string>}
 * @throws {FenixInstallError} When the archive is unreadable or has no usable index.
 */
export async function readArchiveTitle(archive) {
    configure({
        workerScripts: {
            deflate: ['../../lib/z-worker.js'],
            inflate: ['../../lib/z-worker.js'],
        },
    });
    try {
        const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(archive)));
        const entries = await reader.getEntries();
        const index = entries.find(({filename}) => filename === 'index.json');
        if (typeof index === 'undefined' || typeof index.getData === 'undefined') {
            throw new Error('No dictionary index found in archive');
        }
        const parsed = /** @type {unknown} */ (parseJson(await index.getData(new TextWriter())));
        const title = typeof parsed === 'object' && parsed !== null ? /** @type {Record<string, unknown>} */ (parsed).title : null;
        if (typeof title !== 'string' || title.length === 0) {
            throw new Error('The dictionary index has no title');
        }
        return title;
    } catch (e) {
        if (e instanceof FenixInstallError) { throw e; }
        throw new FenixInstallError('import', e instanceof Error ? e.message : String(e), e);
    }
}
