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

/**
 * Error with a machine-readable code, so the UI can show a Vietnamese message.
 */
export class FenixInstallError extends Error {
    /**
     * @param {'download'|'import'|'settings'} code
     * @param {string} message Technical detail (not translated).
     * @param {unknown} [cause]
     */
    constructor(code, message, cause) {
        super(message, {cause});
        /** @type {'download'|'import'|'settings'} */
        this.code = code;
        /** @type {string} */
        this.name = 'FenixInstallError';
    }
}

/**
 * Downloads a file with progress reporting.
 * The request is aborted when no data arrives for `idleTimeoutMs`, so a stalled connection does not leave the
 * welcome page waiting forever.
 * @param {string} url
 * @param {(loaded: number, total: number) => void} onProgress `total` is 0 when the server does not send a length.
 * @param {{idleTimeoutMs?: number, fetchImpl?: typeof fetch}} [options]
 * @returns {Promise<ArrayBuffer>}
 * @throws {FenixInstallError}
 */
export async function downloadWithProgress(url, onProgress, {idleTimeoutMs = 30000, fetchImpl = fetch} = {}) {
    const controller = new AbortController();
    /** @type {ReturnType<typeof setTimeout>|null} */
    let timer = null;
    /** */
    const resetTimer = () => {
        if (timer !== null) { clearTimeout(timer); }
        timer = setTimeout(() => { controller.abort(); }, idleTimeoutMs);
    };
    try {
        resetTimer();
        const response = await fetchImpl(url, {
            method: 'GET',
            cache: 'no-cache',
            credentials: 'omit',
            redirect: 'follow',
            referrerPolicy: 'no-referrer',
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new FenixInstallError('download', `HTTP ${response.status} for ${url}`);
        }
        const total = Number.parseInt(response.headers.get('content-length') ?? '', 10) || 0;
        const body = response.body;
        if (body === null) {
            const buffer = await response.arrayBuffer();
            onProgress(buffer.byteLength, buffer.byteLength);
            return buffer;
        }

        const reader = body.getReader();
        /** @type {Uint8Array[]} */
        const chunks = [];
        let loaded = 0;
        for (;;) {
            const {done, value} = await reader.read();
            if (done) { break; }
            resetTimer();
            chunks.push(value);
            loaded += value.byteLength;
            onProgress(loaded, total);
        }
        const result = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.byteLength;
        }
        onProgress(loaded, loaded);
        return result.buffer;
    } catch (e) {
        if (e instanceof FenixInstallError) { throw e; }
        throw new FenixInstallError('download', e instanceof Error ? e.message : String(e), e);
    } finally {
        if (timer !== null) { clearTimeout(timer); }
    }
}
