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

const STORAGE_KEY = 'fenix_cloud_offline_queue';

/**
 * @typedef {{
 *   id: string,
 *   action: 'saveWord' | 'deleteSavedWord',
 *   params: Record<string, unknown>,
 *   createdAt: string,
 *   retryCount: number,
 *   lastError: ?string,
 * }} QueueItem
 */

/**
 * Manages an offline queue in chrome.storage.local for syncing saved words.
 */
export class OfflineQueue {
    /**
     * @returns {Promise<QueueItem[]>}
     */
    async getItems() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            return [];
        }
        const data = await chrome.storage.local.get(STORAGE_KEY);
        const list = data[STORAGE_KEY];
        return Array.isArray(list) ? list : [];
    }

    /**
     * @param {'saveWord' | 'deleteSavedWord'} action
     * @param {Record<string, unknown>} params
     * @returns {Promise<QueueItem>}
     */
    async enqueue(action, params) {
        const id = `queue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        /** @type {QueueItem} */
        const item = {
            id,
            action,
            params,
            createdAt: new Date().toISOString(),
            retryCount: 0,
            lastError: null,
        };
        const items = await this.getItems();
        items.push(item);
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({[STORAGE_KEY]: items});
        }
        return item;
    }

    /**
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async remove(id) {
        const items = await this.getItems();
        const nextItems = items.filter((item) => item.id !== id);
        if (nextItems.length !== items.length) {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await chrome.storage.local.set({[STORAGE_KEY]: nextItems});
            }
            return true;
        }
        return false;
    }

    /**
     * @param {string} id
     * @param {string} errorMessage
     * @returns {Promise<void>}
     */
    async incrementRetry(id, errorMessage) {
        const items = await this.getItems();
        for (const item of items) {
            if (item.id === id) {
                item.retryCount = (item.retryCount || 0) + 1;
                item.lastError = errorMessage;
                break;
            }
        }
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({[STORAGE_KEY]: items});
        }
    }

    /**
     * @returns {Promise<void>}
     */
    async clear() {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.remove(STORAGE_KEY);
        }
    }

    /**
     * @param {string} expression
     * @param {string} reading
     * @returns {Promise<boolean>}
     */
    async hasPendingSave(expression, reading) {
        const items = await this.getItems();
        const normExpr = expression.trim();
        const normReading = reading.trim();
        return items.some((item) => (
            item.action === 'saveWord' &&
            item.params?.expression === normExpr &&
            item.params?.reading === normReading
        ));
    }
}
