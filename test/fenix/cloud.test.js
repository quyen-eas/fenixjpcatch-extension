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

import {describe, expect, it, beforeEach, vi} from 'vitest';
import {CloudApi} from '../../ext/js/cloud/cloud-api.js';
import {
    buildGoogleOAuthUrl,
    computeWordId,
    deleteSavedWordFromFirestore,
    exchangeGoogleTokenForFirebaseAuth,
    extractIdTokenFromRedirectUrl,
    getFunctionsBaseUrl,
    isCloudConfigReady,
    listSavedWordsFromFirestore,
    refreshFirebaseIdToken,
    saveWordToFirestore,
} from '../../ext/js/cloud/firebase-auth.js';
import {OfflineQueue} from '../../ext/js/cloud/offline-queue.js';
import {CloudController} from '../../ext/js/cloud/cloud-controller.js';

describe('CloudApi', () => {
    it('initializes with default or custom baseUrl', () => {
        const defaultApi = new CloudApi();
        expect(defaultApi.baseUrl).toBe('https://asia-northeast1-fenixjpcatch.cloudfunctions.net');

        const customApi = new CloudApi('http://127.0.0.1:5001/fenixjpcatch/asia-northeast1/');
        expect(customApi.baseUrl).toBe('http://127.0.0.1:5001/fenixjpcatch/asia-northeast1');
    });

    it('sends POST request with auth header and body', async () => {
        const api = new CloudApi('http://localhost:5001');
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({result: {success: true, wordId: '123_taberu'}}),
        });
        globalThis.fetch = mockFetch;

        const res = await api.saveWord({
            expression: '食べる',
            reading: 'たべる',
            jmdictSeq: 123,
        }, 'test-token');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:5001/saveWord', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token',
            },
            body: JSON.stringify({
                data: {
                    expression: '食べる',
                    reading: 'たべる',
                    jmdictSeq: 123,
                },
            }),
        });
        expect(res).toEqual({success: true, wordId: '123_taberu'});
    });
});

describe('OfflineQueue', () => {
    /** @type {Record<string, unknown>} */
    let mockStorage = {};

    beforeEach(() => {
        mockStorage = {};
        globalThis.chrome = /** @type {any} */ ({
            storage: {
                local: {
                    get: vi.fn(async (key) => ({[key]: mockStorage[key] || []})),
                    set: vi.fn(async (obj) => {
                        Object.assign(mockStorage, obj);
                    }),
                    remove: vi.fn(async (key) => {
                        delete mockStorage[key];
                    }),
                },
            },
        });
    });

    it('enqueues items and checks pending status', async () => {
        const queue = new OfflineQueue();
        const item = await queue.enqueue('saveWord', {
            expression: '飲む',
            reading: 'のむ',
        });

        expect(item.id).toBeDefined();
        expect(item.action).toBe('saveWord');

        const isPending = await queue.hasPendingSave('飲む', 'のむ');
        expect(isPending).toBe(true);

        const isNotPending = await queue.hasPendingSave('食べる', 'たべる');
        expect(isNotPending).toBe(false);
    });

    it('removes item and increments retry', async () => {
        const queue = new OfflineQueue();
        const item = await queue.enqueue('saveWord', {expression: '本', reading: 'ほん'});

        await queue.incrementRetry(item.id, 'Network error');
        let items = await queue.getItems();
        expect(items[0].retryCount).toBe(1);
        expect(items[0].lastError).toBe('Network error');

        const removed = await queue.remove(item.id);
        expect(removed).toBe(true);

        items = await queue.getItems();
        expect(items.length).toBe(0);
    });
});

describe('CloudController', () => {
    /** @type {Record<string, unknown>} */
    let mockStorage = {};

    beforeEach(() => {
        mockStorage = {};
        globalThis.chrome = /** @type {any} */ ({
            storage: {
                local: {
                    get: vi.fn(async (key) => ({[key]: mockStorage[key] || (key === 'fenix_cloud_offline_queue' ? [] : {})})),
                    set: vi.fn(async (obj) => {
                        Object.assign(mockStorage, obj);
                    }),
                    remove: vi.fn(async (key) => {
                        delete mockStorage[key];
                    }),
                },
            },
        });
    });

    it('computes word keys and checks saved status', async () => {
        const controller = new CloudController();
        const key = controller.getWordKey(' 食べる ', ' たべる ');
        expect(key).toBe('食べる_たべる');

        const isSavedInitial = await controller.isWordSaved('食べる', 'たべる');
        expect(isSavedInitial).toBe(false);

        await controller.saveWord({
            expression: '食べる',
            reading: 'たべる',
        });

        const isSavedAfter = await controller.isWordSaved('食べる', 'たべる');
        expect(isSavedAfter).toBe(true);
    });

    it('builds Google OAuth URL and extracts id_token from redirect hash', () => {
        const authUrl = buildGoogleOAuthUrl('client-123.apps.googleusercontent.com', 'https://abcdef.chromiumapp.org/', 'nonce-xyz');
        expect(authUrl).toContain('client_id=client-123.apps.googleusercontent.com');
        expect(authUrl).toContain('response_type=id_token');
        expect(authUrl).toContain('nonce=nonce-xyz');

        const token = extractIdTokenFromRedirectUrl('https://abcdef.chromiumapp.org/#id_token=eyJhbGciOiJSUzI1NiJ9.test&authuser=0');
        expect(token).toBe('eyJhbGciOiJSUzI1NiJ9.test');
    });

    it('throws CLOUD_CONFIG_MISSING when signing in without Firebase config, and signs in when configured', async () => {
        const controller = new CloudController();
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('no build env'));

        await expect(controller.signInWithGoogle()).rejects.toThrow('CLOUD_CONFIG_MISSING');

        const savedConfig = await controller.setCloudConfig({
            firebaseApiKey: 'AIzaSyTestKey',
            googleOAuthClientId: '12345-test.apps.googleusercontent.com',
            firebaseProjectId: 'fenix-prod',
            functionsRegion: 'asia-northeast1',
        });
        expect(isCloudConfigReady(savedConfig)).toBe(true);
        expect(getFunctionsBaseUrl(savedConfig)).toBe('https://asia-northeast1-fenix-prod.cloudfunctions.net');

        globalThis.chrome.identity = {
            getRedirectURL: () => 'https://ext123.chromiumapp.org/',
            launchWebAuthFlow: (_details, callback) => {
                callback('https://ext123.chromiumapp.org/#id_token=google_jwt_123');
            },
        };
        globalThis.fetch = vi.fn().mockImplementation(async (url) => {
            if (String(url).includes('identitytoolkit.googleapis.com')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        idToken: 'firebase_jwt_abc',
                        refreshToken: 'firebase_refresh_xyz',
                        expiresIn: '3600',
                        localId: 'uid_999',
                        email: 'quyen@fenixlabs.app',
                        displayName: 'Quyen',
                    }),
                };
            }
            return {ok: false, status: 404, json: async () => ({})};
        });

        const authState = await controller.signInWithGoogle();
        expect(authState.token).toBe('firebase_jwt_abc');
        expect(authState.refreshToken).toBe('firebase_refresh_xyz');
        expect(authState.user.uid).toBe('uid_999');
        expect(authState.user.email).toBe('quyen@fenixlabs.app');
    });

    it('automatically refreshes an expired Firebase ID token using refreshToken', async () => {
        const controller = new CloudController();
        await controller.setCloudConfig({
            firebaseApiKey: 'AIzaSyTestKey',
            googleOAuthClientId: '12345-test.apps.googleusercontent.com',
        });
        await controller.setAuthState({
            token: 'expired_jwt',
            refreshToken: 'refresh_token_1',
            expiresAt: Date.now() - 10000,
            user: {uid: 'uid_999', email: 'quyen@fenixlabs.app'},
        });

        globalThis.fetch = vi.fn().mockImplementation(async (url) => {
            if (String(url).includes('securetoken.googleapis.com')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        id_token: 'fresh_firebase_jwt',
                        refresh_token: 'refresh_token_2',
                        expires_in: '3600',
                    }),
                };
            }
            return {ok: false, status: 404, json: async () => ({})};
        });

        const validToken = await controller.getValidAuthToken();
        expect(validToken).toBe('fresh_firebase_jwt');
        const updatedState = await controller.getAuthState();
        expect(updatedState?.token).toBe('fresh_firebase_jwt');
        expect(updatedState?.refreshToken).toBe('refresh_token_2');
    });

    it('exchanges Google token and refreshes Firebase token directly via helpers', async () => {
        globalThis.fetch = vi.fn().mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                idToken: 'id_tok_1',
                refreshToken: 'ref_tok_1',
                expiresIn: '3600',
                localId: 'u1',
            }),
        }).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                id_token: 'id_tok_2',
                refresh_token: 'ref_tok_2',
                expires_in: '3600',
            }),
        });

        const exchanged = await exchangeGoogleTokenForFirebaseAuth('g_tok', 'https://ext.chromiumapp.org/', 'api_key');
        expect(exchanged.token).toBe('id_tok_1');
        const refreshed = await refreshFirebaseIdToken('ref_tok_1', 'api_key');
        expect(refreshed.token).toBe('id_tok_2');
    });

    it('saves, lists, and deletes words directly via Cloud Firestore REST API on Spark plan', async () => {
        const seqId = await computeWordId('食べる', 'たべる', 1358280);
        expect(seqId).toBe('1358280_たべる');
        const hashId = await computeWordId('日本', 'にほん', null);
        expect(hashId).toMatch(/^x_[0-9a-f]{16}$/);

        const controller = new CloudController();
        await controller.setCloudConfig({
            firebaseApiKey: 'AIzaSyTestKey',
            googleOAuthClientId: '12345-test.apps.googleusercontent.com',
            firebaseProjectId: 'fenix-spark-proj',
            functionsBaseUrl: '',
        });
        await controller.setAuthState({
            token: 'valid_firebase_jwt',
            refreshToken: 'valid_refresh_token',
            expiresAt: Date.now() + 3600 * 1000,
            user: {uid: 'user_abc', email: 'quyen@fenixlabs.app'},
        });

        /** @type {Array<{url: string}>} */
        const calls = [];
        globalThis.fetch = vi.fn().mockImplementation(async (url) => {
            calls.push({url: String(url)});
            if (String(url).includes('/documents/users/user_abc/words?pageSize=100')) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        documents: [
                            {
                                name: 'projects/fenix-spark-proj/databases/(default)/documents/users/user_abc/words/1358280_たべる',
                                fields: {
                                    expression: {stringValue: '食べる'},
                                    reading: {stringValue: 'たべる'},
                                    jmdictSeq: {integerValue: '1358280'},
                                    status: {stringValue: 'new'},
                                    deleted: {booleanValue: false},
                                    updatedAt: {timestampValue: '2026-04-12T00:00:00.000Z'},
                                    latestSentence: {stringValue: '毎日野菜を食べる。'},
                                    latestSourceUrl: {stringValue: 'https://nhk.or.jp'},
                                    latestSourceTitle: {stringValue: 'NHK News'},
                                },
                            },
                        ],
                    }),
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({}),
            };
        });

        const saveRes = await controller.saveWord({
            expression: '食べる',
            reading: 'たべる',
            jmdictSeq: 1358280,
            contextSentence: '毎日野菜を食べる。',
            sourceUrl: 'https://nhk.or.jp',
            sourceTitle: 'NHK News',
        });
        expect(saveRes.success).toBe(true);
        expect(saveRes.wordId).toBe('1358280_たべる');
        expect(calls.some((c) => c.url.includes('firestore.googleapis.com/v1/projects/fenix-spark-proj/databases/(default)/documents/users/user_abc/words/1358280_%E3%81%9F%E3%81%B9%E3%82%8B'))).toBe(true);

        const listRes = await controller.listSavedWords();
        expect(listRes.words.length).toBe(1);
        expect(listRes.words[0].expression).toBe('食べる');

        const delRes = await controller.deleteSavedWord('1358280_たべる', '食べる', 'たべる');
        expect(delRes.deleted).toBe(true);

        // Direct helpers check
        const directSave = await saveWordToFirestore({expression: '飲む', reading: 'のむ'}, 'fenix-spark-proj', 'user_abc', 'valid_firebase_jwt');
        expect(directSave.success).toBe(true);
        const directList = await listSavedWordsFromFirestore('fenix-spark-proj', 'user_abc', 'valid_firebase_jwt');
        expect(directList.words.length).toBe(1);
        const directDel = await deleteSavedWordFromFirestore(directSave.wordId, 'fenix-spark-proj', 'user_abc', 'valid_firebase_jwt');
        expect(directDel.deleted).toBe(true);
    });
});
