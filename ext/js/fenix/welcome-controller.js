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

import {log} from '../core/log.js';
import {querySelectorNotNull} from '../dom/query-selector.js';
import {FENIX_DICTIONARIES} from './dictionary-release.js';
import {applyAudioFallback} from './audio-fallback.js';
import {applyTranslations, t} from './i18n.js';

/** Number of steps reported by the dictionary importer (see ImportProgressTracker in dictionary-import-controller.js). */
const IMPORT_STEP_COUNT = 6;

/**
 * Drives the Vietnamese welcome page: installs the bundled dictionaries on first run, shows their state with a
 * progress bar and applies the first-run defaults.
 */
export class WelcomeController {
    /**
     * @param {object} details
     * @param {import('./dictionary-installer.js').FenixDictionaryInstaller} details.installer
     * @param {import('./onboarding-state.js').OnboardingStateStore} details.state
     * @param {import('../pages/settings/settings-controller.js').SettingsController} details.settingsController
     * @param {(targets: import('settings-modifications').Modification[]) => Promise<Error[]>} details.modifyGlobalSettings Resolves with the errors of failed modifications.
     * @param {() => Promise<import('./onboarding-settings.js').SpeechVoiceInfo[]>} details.getVoices
     */
    constructor({installer, state, settingsController, modifyGlobalSettings, getVoices}) {
        /** @type {import('./dictionary-installer.js').FenixDictionaryInstaller} */
        this._installer = installer;
        /** @type {import('./onboarding-state.js').OnboardingStateStore} */
        this._state = state;
        /** @type {import('../pages/settings/settings-controller.js').SettingsController} */
        this._settingsController = settingsController;
        /** @type {(targets: import('settings-modifications').Modification[]) => Promise<Error[]>} */
        this._modifyGlobalSettings = modifyGlobalSettings;
        /** @type {() => Promise<import('./onboarding-settings.js').SpeechVoiceInfo[]>} */
        this._getVoices = getVoices;
        /** @type {HTMLElement} */
        this._list = querySelectorNotNull(document, '#fenix-dictionary-list');
        /** @type {HTMLElement} */
        this._summary = querySelectorNotNull(document, '#fenix-dictionary-summary');
        /** @type {HTMLElement} */
        this._audioNote = querySelectorNotNull(document, '#fenix-audio-note');
        /** @type {Map<string, HTMLElement>} */
        this._rows = new Map();
    }

    /** */
    prepare() {
        applyTranslations(document);
        this._createRows();
    }

    /**
     * Runs the first-run setup. Resolves when it is finished; the page is usable while it runs.
     */
    async run() {
        document.documentElement.dataset.fenixSetup = 'running';
        const prevention = this._settingsController.preventPageExit();
        try {
            await this._run();
        } finally {
            prevention.end();
            document.documentElement.dataset.fenixSetup = 'done';
        }
    }

    // Private

    /** */
    _createRows() {
        const template = /** @type {HTMLTemplateElement} */ (querySelectorNotNull(document, '#fenix-dictionary-row-template'));
        for (const spec of FENIX_DICTIONARIES) {
            const row = /** @type {HTMLElement} */ (/** @type {DocumentFragment} */ (template.content.cloneNode(true)).firstElementChild);
            querySelectorNotNull(row, '.fenix-dictionary-name').textContent = t(spec.labelKey);
            querySelectorNotNull(row, '.fenix-dictionary-description').textContent = t(spec.labelKey.replace(/\.name$/, '.description'));
            const button = /** @type {HTMLButtonElement} */ (querySelectorNotNull(row, '.fenix-dictionary-action'));
            button.addEventListener('click', () => { void this._installOne(spec); });
            this._rows.set(spec.id, row);
            this._list.append(row);
            this._render({spec, phase: 'checking'});
        }
    }

    /** */
    async _run() {
        this._summary.textContent = t('summary.installing');
        let allInstalled = false;
        // Web Locks serialize concurrent welcome tabs: the second tab waits, then finds everything installed.
        await this._withLock(async () => {
            allInstalled = await this._installer.installFirstRun(this._render.bind(this));
        });
        await this._applyAudioFallback();
        this._updateSummary(allInstalled);
    }

    /**
     * @param {import('./dictionary-release.js').FenixDictionarySpec} spec
     */
    async _installOne(spec) {
        this._summary.textContent = t('summary.installing');
        const prevention = this._settingsController.preventPageExit();
        try {
            await this._withLock(async () => {
                await this._installer.install(spec, this._render.bind(this));
            });
        } finally {
            prevention.end();
        }
        const installed = await this._installer.getInstalled();
        this._updateSummary([...installed.values()].every(Boolean));
    }

    /**
     * @param {() => Promise<void>} callback
     */
    async _withLock(callback) {
        if (typeof navigator.locks === 'undefined') {
            await callback();
            return;
        }
        let waiting = true;
        const waitingTimer = setTimeout(() => {
            if (waiting) {
                for (const row of this._rows.values()) {
                    /** @type {HTMLElement} */ (querySelectorNotNull(row, '.fenix-dictionary-status')).textContent = t('status.waiting');
                }
            }
        }, 300);
        await navigator.locks.request('fenix-dictionary-install', async () => {
            waiting = false;
            clearTimeout(waitingTimer);
            await callback();
        });
    }

    /**
     * @param {boolean} allInstalled
     */
    _updateSummary(allInstalled) {
        const rows = [...this._rows.values()];
        if (allInstalled) {
            this._summary.textContent = t('summary.allInstalled');
        } else if (rows.some((row) => row.dataset.phase === 'error')) {
            this._summary.textContent = t('summary.someMissing');
        } else {
            this._summary.textContent = t('summary.removedByUser');
        }
    }

    /**
     * Updates the row of one dictionary from an installer event.
     * @param {import('./dictionary-installer.js').InstallEvent} event
     */
    _render({spec, phase, loaded = 0, total = 0, step = 1, error}) {
        const row = this._rows.get(spec.id);
        if (typeof row === 'undefined') { return; }
        row.dataset.phase = phase;

        const status = /** @type {HTMLElement} */ (querySelectorNotNull(row, '.fenix-dictionary-status'));
        const progress = /** @type {HTMLElement} */ (querySelectorNotNull(row, '.fenix-dictionary-progress'));
        const bar = /** @type {HTMLElement} */ (querySelectorNotNull(progress, '.progress-bar'));
        const errorNode = /** @type {HTMLElement} */ (querySelectorNotNull(row, '.fenix-dictionary-error'));
        const button = /** @type {HTMLButtonElement} */ (querySelectorNotNull(row, '.fenix-dictionary-action'));

        const percent = total > 0 ? Math.min(100, Math.floor(loaded / total * 100)) : 0;
        status.classList.remove('success-text', 'danger-text');
        progress.hidden = phase !== 'downloading' && phase !== 'importing';
        errorNode.hidden = true;
        button.hidden = true;
        button.disabled = false;

        switch (phase) {
            case 'checking':
                status.textContent = t('status.checking');
                break;
            case 'downloading':
                status.textContent = total > 0 ? t('status.downloading', {percent: `${percent}%`}) : t('status.downloadingUnknown');
                bar.style.width = `${percent}%`;
                break;
            case 'importing':
                status.textContent = t('status.importing', {step: Math.min(step, IMPORT_STEP_COUNT), steps: IMPORT_STEP_COUNT, percent: total > 0 ? `${percent}%` : ''}).trim();
                bar.style.width = `${percent}%`;
                break;
            case 'installed':
                status.textContent = t('status.installed');
                status.classList.add('success-text');
                break;
            case 'missing':
                status.textContent = t('status.missing');
                button.textContent = t('button.install');
                button.hidden = false;
                break;
            case 'error':
                status.textContent = t(`status.error.${error?.code ?? 'import'}`);
                status.classList.add('danger-text');
                if (error) {
                    errorNode.textContent = t('status.errorDetail', {detail: error.message});
                    errorNode.hidden = false;
                }
                button.textContent = t('button.retry');
                button.hidden = false;
                break;
        }
    }

    /**
     * Adds the browser's text-to-speech as the last audio source (first run only).
     */
    async _applyAudioFallback() {
        try {
            const status = await applyAudioFallback({
                getOptionsFull: () => this._settingsController.getOptionsFull(),
                modifyGlobalSettings: this._modifyGlobalSettings,
                state: this._state,
                getVoices: this._getVoices,
            });
            /** @type {Partial<Record<import('./audio-fallback.js').AudioFallbackStatus, string>>} */
            const notes = {
                'applied': 'audio.fallbackAdded',
                'present': 'audio.fallbackPresent',
                'no-voice': 'audio.noJapaneseVoice',
                'failed': 'audio.fallbackFailed',
            };
            const key = notes[status];
            if (typeof key !== 'undefined') { this._showAudioNote(key); }
        } catch (e) {
            // Audio defaults are a convenience; never let them break the welcome page.
            log.warn(e);
        }
    }

    /**
     * @param {string} key
     */
    _showAudioNote(key) {
        this._audioNote.textContent = t(key);
        this._audioNote.hidden = false;
    }
}
