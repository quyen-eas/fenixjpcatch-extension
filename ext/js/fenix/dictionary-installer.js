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

import {FENIX_DICTIONARIES, getDictionaryDownloadUrl} from './dictionary-release.js';
import {FenixInstallError} from './dictionary-downloader.js';
import {buildDictionaryModifications} from './onboarding-settings.js';

/**
 * @typedef {object} InstallerDependencies
 * @property {(url: string, onProgress: (loaded: number, total: number) => void) => Promise<ArrayBuffer>} download
 * @property {(archive: ArrayBuffer, onProgress: import('dictionary-worker').ImportProgressCallback) => Promise<import('dictionary-importer').ImportResult>} importArchive
 * @property {() => Promise<import('dictionary-importer').Summary[]>} getDictionaryInfo
 * @property {() => Promise<import('settings').Options>} getOptionsFull
 * @property {() => number} getProfileIndex
 * @property {(targets: import('settings-modifications').Modification[]) => Promise<Error[]>} modifyGlobalSettings
 * @property {() => Promise<void>} notifyDatabaseUpdated
 * @property {import('./onboarding-state.js').OnboardingStateStore} state
 * @property {(name: string, enabled: boolean, styles?: string) => import('settings').DictionaryOptions} createDictionarySettings
 */

/**
 * @typedef {'checking'|'installed'|'missing'|'downloading'|'importing'|'error'} InstallPhase
 */

/**
 * @typedef {object} InstallEvent
 * @property {import('./dictionary-release.js').FenixDictionarySpec} spec
 * @property {InstallPhase} phase
 * @property {number} [loaded] Download progress (bytes) or import step progress (index).
 * @property {number} [total]
 * @property {number} [step] Import step number, starting at 1.
 * @property {FenixInstallError} [error]
 */

/**
 * Installs the dictionaries published in the FenixJpCatch release. All side effects are injected, so the whole
 * flow (download → import → register in the profiles) is testable without a browser.
 */
export class FenixDictionaryInstaller {
    /**
     * @param {InstallerDependencies} dependencies
     */
    constructor(dependencies) {
        /** @type {InstallerDependencies} */
        this._deps = dependencies;
    }

    /**
     * Reports, for each FenixJpCatch dictionary, whether it is installed.
     * @returns {Promise<Map<string, boolean>>} dictionary id → installed
     */
    async getInstalled() {
        const titles = new Set((await this._deps.getDictionaryInfo()).map(({title}) => title));
        return new Map(FENIX_DICTIONARIES.map(({id, title}) => [id, titles.has(title)]));
    }

    /**
     * First-run setup: installs every dictionary that is neither installed nor already handled by an earlier run.
     * @param {(event: InstallEvent) => void} onEvent
     * @returns {Promise<boolean>} True when every dictionary is installed afterwards.
     */
    async installFirstRun(onEvent) {
        const state = await this._deps.state.load();
        const summaries = new Map((await this._deps.getDictionaryInfo()).map((summary) => [summary.title, summary]));
        let allInstalled = true;
        for (const spec of FENIX_DICTIONARIES) {
            const summary = summaries.get(spec.title);
            if (typeof summary !== 'undefined') {
                // Also repairs the case where an earlier run imported the data but was interrupted before the
                // profile settings were written. Registering is a no-op when the dictionary is already listed.
                if (state.dictionaries[spec.id] !== true) { await this._register(spec, summary); }
                onEvent({spec, phase: 'installed'});
                await this._markInstalled(spec);
            } else if (state.dictionaries[spec.id] === true) {
                // Installed by an earlier run and removed by the user since: leave it alone.
                onEvent({spec, phase: 'missing'});
                allInstalled = false;
            } else if (!await this.install(spec, onEvent)) {
                allInstalled = false;
            }
        }
        return allInstalled;
    }

    /**
     * Downloads and imports one dictionary and registers it in the profiles.
     * Failures are reported through `onEvent` instead of being thrown.
     * @param {import('./dictionary-release.js').FenixDictionarySpec} spec
     * @param {(event: InstallEvent) => void} onEvent
     * @returns {Promise<boolean>}
     */
    async install(spec, onEvent) {
        try {
            onEvent({spec, phase: 'downloading', loaded: 0, total: 0});
            const archive = await this._deps.download(getDictionaryDownloadUrl(spec), (loaded, total) => {
                onEvent({spec, phase: 'downloading', loaded, total});
            });

            let step = 1;
            onEvent({spec, phase: 'importing', loaded: 0, total: 0, step});
            const {result, errors} = await this._deps.importArchive(archive, ({nextStep, index, count}) => {
                if (nextStep) { ++step; }
                onEvent({spec, phase: 'importing', loaded: index, total: count, step});
            });
            if (!result) {
                const detail = errors.map((e) => e.message).join('; ') || 'unknown error';
                throw new FenixInstallError('import', detail);
            }
            if (result.title !== spec.title) {
                throw new FenixInstallError('import', `Unexpected dictionary title "${result.title}" (expected "${spec.title}")`);
            }

            await this._register(spec, result);
            await this._deps.notifyDatabaseUpdated();
            await this._markInstalled(spec);
            onEvent({spec, phase: 'installed'});
            return true;
        } catch (e) {
            const error = e instanceof FenixInstallError ? e : new FenixInstallError('import', e instanceof Error ? e.message : String(e), e);
            onEvent({spec, phase: 'error', error});
            return false;
        }
    }

    // Private

    /**
     * @param {import('./dictionary-release.js').FenixDictionarySpec} spec
     * @param {import('dictionary-importer').Summary} summary
     */
    async _register(spec, summary) {
        const optionsFull = await this._deps.getOptionsFull();
        const targets = buildDictionaryModifications(optionsFull, summary, spec, this._deps.getProfileIndex(), this._deps.createDictionarySettings);
        if (targets.length === 0) { return; }
        const errors = await this._deps.modifyGlobalSettings(targets);
        if (errors.length > 0) {
            throw new FenixInstallError('settings', errors.map((e) => e.message).join('; '));
        }
    }

    /**
     * @param {import('./dictionary-release.js').FenixDictionarySpec} spec
     */
    async _markInstalled(spec) {
        await this._deps.state.update((state) => { state.dictionaries[spec.id] = true; });
    }
}
