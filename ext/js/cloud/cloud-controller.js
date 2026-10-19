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

import {CloudApi} from './cloud-api.js';
import {OfflineQueue} from './offline-queue.js';

const AUTH_STORAGE_KEY = 'fenix_cloud_auth';
const CACHE_STORAGE_KEY = 'fenix_saved_words_cache';

/**
 * @typedef {{
 *   uid: string,
 *   email?: string,
 *   displayName?: string,
 *   photoUrl?: string,
 * }} UserProfile
 */

/**
 * @typedef {{
 *   token: string,
 *   user: UserProfile,
 *   expiresAt?: number,
 * }} AuthState
 */

/**
 * @typedef {{
 *   wordId: string,
 *   status: string,
 *   updatedAt: string,
 *   expression?: string,
 *   reading?: string,
 * }} SavedWordCacheEntry
 */

/**
 * Coordinates Cloud API calls, offline caching, and queue synchronization.
 */
export class CloudController {
    /**
     * @param {CloudApi} [cloudApi]
     * @param {OfflineQueue} [offlineQueue]
     */
    constructor(cloudApi = new CloudApi(), offlineQueue = new OfflineQueue()) {
        /** @type {CloudApi} */
        this._cloudApi = cloudApi;
        /** @type {OfflineQueue} */
        this._offlineQueue = offlineQueue;
        /** @type {boolean} */
        this._syncing = false;
    }

    /** @type {CloudApi} */
    get cloudApi() {
        return this._cloudApi;
    }

    /** @type {OfflineQueue} */
    get offlineQueue() {
        return this._offlineQueue;
    }

    /**
     * @returns {Promise<?AuthState>}
     */
    async getAuthState() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            return null;
        }
        const data = await chrome.storage.local.get(AUTH_STORAGE_KEY);
        const auth = /** @type {?import('core').UnknownObject} */ (
            typeof data[AUTH_STORAGE_KEY] === 'object' ? data[AUTH_STORAGE_KEY] : null
        );
        if (auth !== null && typeof auth.token === 'string') {
            return /** @type {AuthState} */ (auth);
        }
        return null;
    }

    /**
     * Sets or updates authentication state.
     * @param {?AuthState} authState
     * @returns {Promise<void>}
     */
    async setAuthState(authState) {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) { return; }
        await (authState === null ?
            chrome.storage.local.remove(AUTH_STORAGE_KEY) :
            chrome.storage.local.set({[AUTH_STORAGE_KEY]: authState}));
    }

    /**
     * Logs out the user.
     * @returns {Promise<void>}
     */
    async logout() {
        await this.setAuthState(null);
    }

    /**
     * @returns {Promise<Record<string, SavedWordCacheEntry>>}
     */
    async getSavedWordsCache() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            return {};
        }
        const data = await chrome.storage.local.get(CACHE_STORAGE_KEY);
        const cache = /** @type {?Record<string, SavedWordCacheEntry>} */ (
            typeof data[CACHE_STORAGE_KEY] === 'object' && data[CACHE_STORAGE_KEY] !== null ?
                data[CACHE_STORAGE_KEY] :
                null
        );
        return cache !== null ? cache : {};
    }

    /**
     * Generates a cache key for expression and reading.
     * @param {string} expression
     * @param {string} reading
     * @returns {string}
     */
    getWordKey(expression, reading) {
        return `${expression.trim().normalize('NFC')}_${reading.trim().normalize('NFC')}`;
    }

    /**
     * Checks if a word is marked as saved.
     * @param {string} expression
     * @param {string} reading
     * @returns {Promise<boolean>}
     */
    async isWordSaved(expression, reading) {
        const cache = await this.getSavedWordsCache();
        const key = this.getWordKey(expression, reading);
        if (typeof cache[key] !== 'undefined') {
            return true;
        }
        return this._offlineQueue.hasPendingSave(expression, reading);
    }

    /**
     * Saves a word to the user notebook.
     * @param {{
     *   expression: string,
     *   reading: string,
     *   jmdictSeq?: number | null,
     *   contextSentence?: string | null,
     *   sourceUrl?: string | null,
     *   sourceTitle?: string | null,
     * }} params
     * @returns {Promise<{success: boolean, wordId: string, created: boolean, status: string, updatedAt: string, queued?: boolean}>}
     */
    async saveWord(params) {
        const expression = params.expression.trim().normalize('NFC');
        const reading = params.reading.trim().normalize('NFC');
        const key = this.getWordKey(expression, reading);

        // Optimistic local cache update
        const cache = await this.getSavedWordsCache();
        const nowIso = new Date().toISOString();
        cache[key] = {
            wordId: cache[key]?.wordId || `opt_${Date.now()}`,
            status: 'new',
            updatedAt: nowIso,
            expression,
            reading,
        };
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({[CACHE_STORAGE_KEY]: cache});
        }

        const auth = await this.getAuthState();
        const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

        if (isOnline && auth !== null && auth.token) {
            try {
                const res = await this._cloudApi.saveWord(params, auth.token);
                cache[key] = {
                    wordId: res.wordId,
                    status: res.status,
                    updatedAt: res.updatedAt,
                    expression,
                    reading,
                };
                if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                    await chrome.storage.local.set({[CACHE_STORAGE_KEY]: cache});
                }
                return res;
            } catch {
                // If network failure, enqueue for background retry
                await this._offlineQueue.enqueue('saveWord', params);
                return {
                    success: true,
                    wordId: cache[key].wordId,
                    created: true,
                    status: 'new',
                    updatedAt: nowIso,
                    queued: true,
                };
            }
        } else {
            await this._offlineQueue.enqueue('saveWord', params);
            return {
                success: true,
                wordId: cache[key].wordId,
                created: true,
                status: 'new',
                updatedAt: nowIso,
                queued: true,
            };
        }
    }

    /**
     * Lists saved words, merging cloud response with offline cache when needed.
     * @param {{
     *   limit?: number,
     *   startAfter?: string | null,
     *   status?: string | null,
     * }} [params]
     * @returns {Promise<{words: Array<Record<string, unknown>>, nextCursor: ?string}>}
     */
    async listSavedWords(params = {}) {
        const auth = await this.getAuthState();
        const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

        if (isOnline && auth !== null && auth.token) {
            try {
                const res = await this._cloudApi.listSavedWords(params, auth.token);
                // Update local cache with returned words
                if (Array.isArray(res.words)) {
                    const cache = await this.getSavedWordsCache();
                    for (const item of res.words) {
                        const expr = typeof item.expression === 'string' ? item.expression : '';
                        const read = typeof item.reading === 'string' ? item.reading : '';
                        if (expr !== '' && read !== '') {
                            const key = this.getWordKey(expr, read);
                            cache[key] = {
                                wordId: typeof item.id === 'string' ? item.id : '',
                                status: typeof item.status === 'string' ? item.status : 'new',
                                updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
                                expression: expr,
                                reading: read,
                            };
                        }
                    }
                    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                        await chrome.storage.local.set({[CACHE_STORAGE_KEY]: cache});
                    }
                }
                return res;
            } catch {
                // Fallback to cache
            }
        }

        // Return from cache
        const cache = await this.getSavedWordsCache();
        const words = Object.values(cache).map((item) => ({
            id: item.wordId,
            expression: item.expression,
            reading: item.reading,
            status: item.status,
            updatedAt: item.updatedAt,
            contexts: [],
        }));
        return {words, nextCursor: null};
    }

    /**
     * Soft-deletes a saved word.
     * @param {string} wordId
     * @param {string} expression
     * @param {string} reading
     * @returns {Promise<{success: boolean, wordId: string, deleted: boolean}>}
     */
    async deleteSavedWord(wordId, expression, reading) {
        const key = this.getWordKey(expression, reading);
        const cache = await this.getSavedWordsCache();
        delete cache[key];
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({[CACHE_STORAGE_KEY]: cache});
        }

        const auth = await this.getAuthState();
        const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

        if (isOnline && auth !== null && auth.token) {
            try {
                return await this._cloudApi.deleteSavedWord(wordId, auth.token);
            } catch {
                await this._offlineQueue.enqueue('deleteSavedWord', {wordId, expression, reading});
                return {success: true, wordId, deleted: true};
            }
        } else {
            await this._offlineQueue.enqueue('deleteSavedWord', {wordId, expression, reading});
            return {success: true, wordId, deleted: true};
        }
    }

    /**
     * Flushes and synchronizes all offline queue items.
     * @returns {Promise<{processed: number, failed: number}>}
     */
    async syncQueue() {
        if (this._syncing) {
            return {processed: 0, failed: 0};
        }
        this._syncing = true;
        let processed = 0;
        let failed = 0;

        try {
            const auth = await this.getAuthState();
            if (auth === null || !auth.token) {
                return {processed: 0, failed: 0};
            }

            const items = await this._offlineQueue.getItems();
            for (const item of items) {
                try {
                    if (item.action === 'saveWord') {
                        await this._cloudApi.saveWord(/** @type {any} */ (item.params), auth.token);
                    } else if (item.action === 'deleteSavedWord') {
                        const wordId = typeof item.params.wordId === 'string' ? item.params.wordId : '';
                        if (wordId !== '') {
                            await this._cloudApi.deleteSavedWord(wordId, auth.token);
                        }
                    }
                    await this._offlineQueue.remove(item.id);
                    processed++;
                } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    await this._offlineQueue.incrementRetry(item.id, msg);
                    failed++;
                    break; // Stop on first network error to preserve order
                }
            }
        } finally {
            this._syncing = false;
        }

        return {processed, failed};
    }
}
