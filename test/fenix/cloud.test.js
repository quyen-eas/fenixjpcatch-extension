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
});
