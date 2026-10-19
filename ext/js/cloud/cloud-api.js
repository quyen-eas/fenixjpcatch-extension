/*
 * Copyright (C) 2023-2026  Yomitan Authors
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

import {readResponseJson} from '../core/json.js';

/**
 * Client for FenixJpCatch Firebase Cloud Functions (Callable API).
 */
export class CloudApi {
    /**
     * @param {string} [baseUrl]
     */
    constructor(baseUrl = 'https://asia-northeast1-fenixjpcatch.cloudfunctions.net') {
        /** @type {string} */
        this._baseUrl = baseUrl.replace(/\/+$/, '');
    }

    /** @type {string} */
    get baseUrl() {
        return this._baseUrl;
    }

    set baseUrl(value) {
        this._baseUrl = value.replace(/\/+$/, '');
    }

    /**
     * Calls a Firebase Callable Function.
     * @template T
     * @param {string} functionName
     * @param {Record<string, unknown>} params
     * @param {?string} [authToken]
     * @returns {Promise<T>}
     */
    async call(functionName, params = {}, authToken = null) {
        const url = `${this._baseUrl}/${encodeURIComponent(functionName)}`;
        /** @type {Record<string, string>} */
        const headers = {
            'Content-Type': 'application/json',
        };
        if (authToken !== null && authToken !== '') {
            headers.Authorization = `Bearer ${authToken}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({data: params}),
        });

        let jsonRaw = null;
        try {
            jsonRaw = await readResponseJson(response);
        } catch {
            throw new Error(`Phản hồi không hợp lệ từ máy chủ (${response.status})`);
        }

        const json = /** @type {?import('core').UnknownObject} */ (
            typeof jsonRaw === 'object' && jsonRaw !== null ? jsonRaw : null
        );

        if (!response.ok) {
            const errObj = /** @type {?import('core').UnknownObject} */ (
                typeof json?.error === 'object' && json?.error !== null ? json.error : null
            );
            const message = typeof errObj?.message === 'string' ? errObj.message : `Lỗi máy chủ (${response.status})`;
            throw new Error(message);
        }

        if (typeof json?.error === 'object' && json?.error !== null) {
            const errObj = /** @type {import('core').UnknownObject} */ (json.error);
            const message = typeof errObj.message === 'string' ? errObj.message : 'Lỗi API';
            throw new Error(message);
        }

        return /** @type {T} */ (json !== null && typeof json.result !== 'undefined' ? json.result : null);
    }

    /**
     * Saves a word with context to the cloud notebook.
     * @param {{
     *   expression: string,
     *   reading: string,
     *   jmdictSeq?: number | null,
     *   contextSentence?: string | null,
     *   sourceUrl?: string | null,
     *   sourceTitle?: string | null,
     * }} params
     * @param {?string} [authToken]
     * @returns {Promise<{success: boolean, wordId: string, created: boolean, status: string, updatedAt: string}>}
     */
    saveWord(params, authToken = null) {
        return this.call('saveWord', params, authToken);
    }

    /**
     * Lists saved words for the authenticated user.
     * @param {{
     *   limit?: number,
     *   startAfter?: string | null,
     *   status?: string | null,
     * }} [params]
     * @param {?string} [authToken]
     * @returns {Promise<{words: Array<Record<string, unknown>>, nextCursor: ?string}>}
     */
    listSavedWords(params = {}, authToken = null) {
        return this.call('listSavedWords', params, authToken);
    }

    /**
     * Soft-deletes a saved word.
     * @param {string} wordId
     * @param {?string} [authToken]
     * @returns {Promise<{success: boolean, wordId: string, deleted: boolean}>}
     */
    deleteSavedWord(wordId, authToken = null) {
        return this.call('deleteSavedWord', {wordId}, authToken);
    }
}
