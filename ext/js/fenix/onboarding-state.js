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
 * Persistent record of what the first-run setup has already done, so that it is not repeated against the user's
 * wishes (e.g. a dictionary that was installed and later deleted on purpose is not silently reinstalled).
 * Stored in `chrome.storage.local` under its own key; Yomitan's options are not touched.
 */

const STORAGE_KEY = 'fenixOnboarding';

/**
 * The part of `chrome.storage.StorageArea` that is used; narrow so tests can supply an in-memory implementation.
 * @typedef {object} StateStorage
 * @property {(key: string) => Promise<Record<string, unknown>>} get
 * @property {(items: Record<string, unknown>) => Promise<void>} set
 */

/**
 * @typedef {object} OnboardingState
 * @property {Record<string, boolean>} dictionaries Dictionary id → installed by the first-run setup.
 * @property {Record<string, boolean>} importing Dictionary id → an import started by the first-run setup has not finished.
 *   Only a dictionary marked here may be deleted as an abandoned partial import; one without the mark belongs to
 *   somebody else (e.g. an import running from the settings page) and is left alone.
 * @property {boolean} audioFallbackApplied The text-to-speech fallback has been added.
 */

/** @returns {OnboardingState} */
export function createEmptyState() {
    return {dictionaries: {}, importing: {}, audioFallbackApplied: false};
}

/**
 * @param {unknown} value
 * @returns {OnboardingState}
 */
export function normalizeState(value) {
    const state = createEmptyState();
    if (typeof value !== 'object' || value === null) { return state; }
    const {dictionaries, importing, audioFallbackApplied} = /** @type {Record<string, unknown>} */ (value);
    if (typeof dictionaries === 'object' && dictionaries !== null) {
        for (const [id, done] of Object.entries(dictionaries)) {
            if (done === true) { state.dictionaries[id] = true; }
        }
    }
    if (typeof importing === 'object' && importing !== null) {
        for (const [id, active] of Object.entries(importing)) {
            if (active === true) { state.importing[id] = true; }
        }
    }
    state.audioFallbackApplied = audioFallbackApplied === true;
    return state;
}

export class OnboardingStateStore {
    /**
     * @param {StateStorage} [storage]
     */
    constructor(storage = chrome.storage.local) {
        /** @type {StateStorage} */
        this._storage = storage;
    }

    /** @returns {Promise<OnboardingState>} */
    async load() {
        const result = await this._storage.get(STORAGE_KEY);
        return normalizeState(result[STORAGE_KEY]);
    }

    /**
     * Read-modify-write of the state.
     * @param {(state: OnboardingState) => void} update
     * @returns {Promise<OnboardingState>}
     */
    async update(update) {
        const state = await this.load();
        update(state);
        await this._storage.set({[STORAGE_KEY]: state});
        return state;
    }
}
