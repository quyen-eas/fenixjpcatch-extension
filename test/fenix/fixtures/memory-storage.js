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
 * In-memory stand-in for `chrome.storage.local`, with the same copy-on-write semantics.
 * @returns {import('../../../ext/js/fenix/onboarding-state.js').StateStorage}
 */
export function createMemoryStorage() {
    /** @type {Map<string, unknown>} */
    const data = new Map();
    return {
        get: async (key) => ({[key]: structuredClone(data.get(key))}),
        set: async (items) => {
            for (const [key, value] of Object.entries(items)) { data.set(key, structuredClone(value)); }
        },
    };
}
