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
import {
    computeWordId,
    deleteSavedWordFromFirestore,
    exchangeGoogleTokenForFirebaseAuth,
    getFunctionsBaseUrl,
    isCloudConfigReady,
    launchGoogleWebAuthFlow,
    listSavedWordsFromFirestore,
    loadCloudConfig,
    refreshFirebaseIdToken,
    saveCloudConfig,
    saveWordToFirestore,
} from './firebase-auth.js';
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
 *   refreshToken?: string,
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
 *   jmdictSeq?: number | null,
 *   contextSentence?: string | null,
 *   sourceUrl?: string | null,
 *   sourceTitle?: string | null,
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
     * Loads the current cloud configuration and updates the CloudApi base URL if configured.
     * @returns {Promise<import('./firebase-auth.js').CloudConfig>}
     */
    async getCloudConfig() {
        const config = await loadCloudConfig();
        if (config.functionsBaseUrl !== '' || config.firebaseProjectId !== '') {
            this._cloudApi.baseUrl = getFunctionsBaseUrl(config);
        }
        return config;
    }

    /**
     * Saves runtime cloud configuration overrides and updates the CloudApi base URL.
     * @param {Partial<import('./firebase-auth.js').CloudConfig>} overrides
     * @returns {Promise<import('./firebase-auth.js').CloudConfig>}
     */
    async setCloudConfig(overrides) {
        const config = await saveCloudConfig(overrides);
        this._cloudApi.baseUrl = getFunctionsBaseUrl(config);
        return config;
    }

    /**
     * Performs interactive Google OAuth sign-in via `chrome.identity.launchWebAuthFlow`
     * and exchanges the Google ID token for a Firebase Auth session.
     * @returns {Promise<AuthState>}
     */
    async signInWithGoogle() {
        const config = await this.getCloudConfig();
        if (!isCloudConfigReady(config)) {
            throw new Error('CLOUD_CONFIG_MISSING');
        }
        const {googleIdToken, redirectUri} = await launchGoogleWebAuthFlow(config.googleOAuthClientId);
        const authState = await exchangeGoogleTokenForFirebaseAuth(googleIdToken, redirectUri, config.firebaseApiKey);
        await this.setAuthState(authState);
        await this.syncQueue();
        return authState;
    }

    /**
     * Returns a valid Firebase ID token, automatically refreshing it if expired.
     * @returns {Promise<?string>}
     */
    async getValidAuthToken() {
        const auth = await this.getAuthState();
        if (auth === null || !auth.token) {
            return null;
        }
        if (
            typeof auth.expiresAt === 'number' &&
            Date.now() >= auth.expiresAt - 60000 &&
            typeof auth.refreshToken === 'string' &&
            auth.refreshToken !== ''
        ) {
            try {
                const config = await this.getCloudConfig();
                if (config.firebaseApiKey !== '') {
                    const refreshed = await refreshFirebaseIdToken(auth.refreshToken, config.firebaseApiKey);
                    const updatedAuth = {
                        ...auth,
                        token: refreshed.token,
                        refreshToken: refreshed.refreshToken,
                        expiresAt: refreshed.expiresAt,
                    };
                    await this.setAuthState(updatedAuth);
                    return updatedAuth.token;
                }
            } catch {
                // Keep existing token if refresh fails due to transient offline state
            }
        }
        return auth.token;
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
     * Saves a word online via Cloud Functions (when explicitly configured) or directly via Cloud Firestore REST API.
     * @param {{
     *   expression: string,
     *   reading: string,
     *   jmdictSeq?: number | null,
     *   contextSentence?: string | null,
     *   sourceUrl?: string | null,
     *   sourceTitle?: string | null,
     * }} params
     * @param {string} token
     * @returns {Promise<{success: boolean, wordId: string, created: boolean, status: string, updatedAt: string}>}
     */
    async _saveWordOnline(params, token) {
        const auth = await this.getAuthState();
        const config = await this.getCloudConfig();
        const uid = auth?.user?.uid || '';
        const projectId = config.firebaseProjectId || 'fenixjpcatch';
        const hasRealFirebaseAuth = uid !== '' && typeof auth?.refreshToken === 'string' && auth.refreshToken !== '';

        if (hasRealFirebaseAuth && config.functionsBaseUrl === '') {
            return await saveWordToFirestore(params, projectId, uid, token);
        }
        try {
            return await this._cloudApi.saveWord(params, token);
        } catch (e) {
            if (uid !== '') {
                return await saveWordToFirestore(params, projectId, uid, token);
            }
            throw e;
        }
    }

    /**
     * Lists saved words online via Cloud Functions (when explicitly configured) or directly via Cloud Firestore REST API.
     * @param {{
     *   limit?: number,
     *   startAfter?: string | null,
     *   status?: string | null,
     * }} params
     * @param {string} token
     * @returns {Promise<{words: Array<Record<string, unknown>>, nextCursor: ?string}>}
     */
    async _listSavedWordsOnline(params, token) {
        const auth = await this.getAuthState();
        const config = await this.getCloudConfig();
        const uid = auth?.user?.uid || '';
        const projectId = config.firebaseProjectId || 'fenixjpcatch';
        const hasRealFirebaseAuth = uid !== '' && typeof auth?.refreshToken === 'string' && auth.refreshToken !== '';

        if (hasRealFirebaseAuth && config.functionsBaseUrl === '') {
            return await listSavedWordsFromFirestore(projectId, uid, token);
        }
        try {
            return await this._cloudApi.listSavedWords(params, token);
        } catch (e) {
            if (uid !== '') {
                return await listSavedWordsFromFirestore(projectId, uid, token);
            }
            throw e;
        }
    }

    /**
     * Soft-deletes a saved word online via Cloud Functions or directly via Cloud Firestore REST API.
     * @param {string} wordId
     * @param {string} expression
     * @param {string} reading
     * @param {string} token
     * @returns {Promise<{success: boolean, wordId: string, deleted: boolean}>}
     */
    async _deleteSavedWordOnline(wordId, expression, reading, token) {
        const resolvedWordId = wordId !== '' && !wordId.startsWith('opt_') ?
            wordId :
            await computeWordId(expression, reading);
        const auth = await this.getAuthState();
        const config = await this.getCloudConfig();
        const uid = auth?.user?.uid || '';
        const projectId = config.firebaseProjectId || 'fenixjpcatch';
        const hasRealFirebaseAuth = uid !== '' && typeof auth?.refreshToken === 'string' && auth.refreshToken !== '';

        if (hasRealFirebaseAuth && config.functionsBaseUrl === '') {
            return await deleteSavedWordFromFirestore(resolvedWordId, projectId, uid, token);
        }
        try {
            return await this._cloudApi.deleteSavedWord(resolvedWordId, token);
        } catch (e) {
            if (uid !== '') {
                return await deleteSavedWordFromFirestore(resolvedWordId, projectId, uid, token);
            }
            throw e;
        }
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
        const optimisticWordId = cache[key]?.wordId || await computeWordId(expression, reading, params.jmdictSeq);
        cache[key] = {
            wordId: optimisticWordId,
            status: 'new',
            updatedAt: nowIso,
            expression,
            reading,
            jmdictSeq: params.jmdictSeq ?? cache[key]?.jmdictSeq ?? null,
            contextSentence: params.contextSentence ?? cache[key]?.contextSentence ?? null,
            sourceUrl: params.sourceUrl ?? cache[key]?.sourceUrl ?? null,
            sourceTitle: params.sourceTitle ?? cache[key]?.sourceTitle ?? null,
        };
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({[CACHE_STORAGE_KEY]: cache});
        }

        const token = await this.getValidAuthToken();
        const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

        if (isOnline && token !== null) {
            try {
                const res = await this._saveWordOnline(params, token);
                cache[key] = {
                    ...cache[key],
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
        const token = await this.getValidAuthToken();
        const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

        if (isOnline && token !== null) {
            try {
                const res = await this._listSavedWordsOnline(params, token);
                // Update local cache with returned words
                if (Array.isArray(res.words)) {
                    const cache = await this.getSavedWordsCache();
                    for (const item of res.words) {
                        const expr = typeof item.expression === 'string' ? item.expression : '';
                        const read = typeof item.reading === 'string' ? item.reading : '';
                        if (expr !== '' && read !== '') {
                            const key = this.getWordKey(expr, read);
                            const contexts = Array.isArray(item.contexts) ?
                                /** @type {Array<Record<string, unknown>>} */ (item.contexts) :
                                [];
                            const firstCtx = contexts[0];
                            cache[key] = {
                                wordId: typeof item.id === 'string' ? item.id : '',
                                status: typeof item.status === 'string' ? item.status : 'new',
                                updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
                                expression: expr,
                                reading: read,
                                contextSentence: typeof firstCtx?.sentence === 'string' ? firstCtx.sentence : (cache[key]?.contextSentence ?? null),
                                sourceUrl: typeof firstCtx?.sourceUrl === 'string' ? firstCtx.sourceUrl : (cache[key]?.sourceUrl ?? null),
                                sourceTitle: typeof firstCtx?.sourceTitle === 'string' ? firstCtx.sourceTitle : (cache[key]?.sourceTitle ?? null),
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
            contexts: typeof item.contextSentence === 'string' && item.contextSentence !== '' ?
                [{
                    sentence: item.contextSentence,
                    sourceUrl: item.sourceUrl || '',
                    sourceTitle: item.sourceTitle || '',
                    createdAt: item.updatedAt,
                }] :
                [],
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

        const token = await this.getValidAuthToken();
        const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;

        if (isOnline && token !== null) {
            try {
                return await this._deleteSavedWordOnline(wordId, expression, reading, token);
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
            const token = await this.getValidAuthToken();
            if (token === null) {
                return {processed: 0, failed: 0};
            }

            const items = await this._offlineQueue.getItems();
            for (const item of items) {
                try {
                    if (item.action === 'saveWord') {
                        await this._saveWordOnline(/** @type {any} */ (item.params), token);
                    } else if (item.action === 'deleteSavedWord') {
                        const wordId = typeof item.params.wordId === 'string' ? item.params.wordId : '';
                        const expression = typeof item.params.expression === 'string' ? item.params.expression : '';
                        const reading = typeof item.params.reading === 'string' ? item.params.reading : '';
                        await this._deleteSavedWordOnline(wordId, expression, reading, token);
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
