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

import {describe, expect, test} from 'vitest';
import {FenixInstallError, downloadWithProgress} from '../../ext/js/fenix/dictionary-downloader.js';

/**
 * @param {Uint8Array[]} chunks
 * @param {{status?: number, contentLength?: boolean, hang?: boolean}} [options]
 * @returns {typeof fetch}
 */
function createFetch(chunks, {status = 200, contentLength = true, hang = false} = {}) {
    return /** @type {typeof fetch} */ (async (_url, init) => {
        const stream = new ReadableStream({
            start(controller) {
                for (const chunk of chunks) { controller.enqueue(chunk); }
                if (!hang) { controller.close(); }
                init?.signal?.addEventListener('abort', () => { controller.error(new Error('aborted')); });
            },
        });
        const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
        return new Response(stream, {status, headers: contentLength ? {'content-length': `${total}`} : {}});
    });
}

describe('downloadWithProgress', () => {
    test('concatenates chunks and reports progress up to 100%', async () => {
        const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])];
        /** @type {[number, number][]} */
        const progress = [];
        const result = await downloadWithProgress('https://example.test/a.zip', (loaded, total) => { progress.push([loaded, total]); }, {fetchImpl: createFetch(chunks)});
        expect([...new Uint8Array(result)]).toStrictEqual([1, 2, 3, 4, 5]);
        expect(progress).toStrictEqual([[3, 5], [5, 5], [5, 5]]);
    });

    test('reports total 0 when the server sends no length', async () => {
        /** @type {[number, number][]} */
        const progress = [];
        await downloadWithProgress('https://example.test/a.zip', (loaded, total) => { progress.push([loaded, total]); }, {fetchImpl: createFetch([new Uint8Array([1])], {contentLength: false})});
        expect(progress[0]).toStrictEqual([1, 0]);
        expect(progress.at(-1)).toStrictEqual([1, 1]);
    });

    test('turns HTTP errors into FenixInstallError("download")', async () => {
        const promise = downloadWithProgress('https://example.test/a.zip', () => {}, {fetchImpl: createFetch([], {status: 404})});
        await expect(promise).rejects.toBeInstanceOf(FenixInstallError);
        await expect(promise).rejects.toMatchObject({code: 'download'});
        await expect(promise).rejects.toThrow('404');
    });

    test('turns network failures into FenixInstallError("download")', async () => {
        const fetchImpl = /** @type {typeof fetch} */ (async () => { throw new TypeError('Failed to fetch'); });
        await expect(downloadWithProgress('https://example.test/a.zip', () => {}, {fetchImpl})).rejects.toMatchObject({code: 'download', message: 'Failed to fetch'});
    });

    test('aborts a stalled download', async () => {
        const promise = downloadWithProgress('https://example.test/a.zip', () => {}, {idleTimeoutMs: 20, fetchImpl: createFetch([new Uint8Array([1])], {hang: true})});
        await expect(promise).rejects.toMatchObject({code: 'download', message: 'aborted'});
    });
});
