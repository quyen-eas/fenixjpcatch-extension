/*
 * Copyright (C) 2023-2026  Yomitan Authors
 * Copyright (C) 2020-2022  Yomichan Authors
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

import {Application} from '../application.js';
import {ExtensionError} from '../core/extension-error.js';
import {DictionaryWorker} from '../dictionary/dictionary-worker.js';
import {DocumentFocusController} from '../dom/document-focus-controller.js';
import {readArchiveTitle} from '../fenix/archive-index.js';
import {downloadWithProgress, FenixInstallError} from '../fenix/dictionary-downloader.js';
import {FenixDictionaryInstaller} from '../fenix/dictionary-installer.js';
import {reconcileFenixStateBeforeInstall} from '../fenix/onboarding-settings.js';
import {OnboardingStateStore} from '../fenix/onboarding-state.js';
import {HotkeyHandler} from '../input/hotkey-handler.js';
import {DictionaryController} from '../pages/settings/dictionary-controller.js';
import {SettingsController} from '../pages/settings/settings-controller.js';
import {DisplayAnki} from './display-anki.js';
import {DisplayAudio} from './display-audio.js';
import {DisplayProfileSelection} from './display-profile-selection.js';
import {DisplayResizer} from './display-resizer.js';
import {DisplaySavedWords} from './display-saved-words.js';
import {Display} from './display.js';

await Application.main(true, async (application) => {
    const documentFocusController = new DocumentFocusController();
    documentFocusController.prepare();

    const hotkeyHandler = new HotkeyHandler();
    hotkeyHandler.prepare(application.crossFrame);

    const display = new Display(application, 'popup', documentFocusController, hotkeyHandler);
    await display.prepare();

    const displayAudio = new DisplayAudio(display);
    displayAudio.prepare();

    const displayAnki = new DisplayAnki(display, displayAudio);
    displayAnki.prepare();

    const displaySavedWords = new DisplaySavedWords(display);
    displaySavedWords.prepare();

    const displayProfileSelection = new DisplayProfileSelection(display);
    void displayProfileSelection.prepare();

    const displayResizer = new DisplayResizer(display);
    displayResizer.prepare();

    display.initializeState();

    document.documentElement.dataset.loaded = 'true';

    if (!navigator.webdriver) {
        const settingsController = new SettingsController(application);
        await settingsController.prepare();

        /**
         * @param {import('settings-modifications').Modification[]} targets
         * @returns {Promise<Error[]>}
         */
        const modifyGlobalSettings = async (targets) => {
            const results = await settingsController.modifyGlobalSettings(targets);
            return results.flatMap(({error}) => (typeof error === 'undefined' ? [] : [ExtensionError.deserialize(error)]));
        };
        const state = new OnboardingStateStore();
        const installer = new FenixDictionaryInstaller({
            download: async (url, onProgress) => {
                const fileName = url.split('/').pop();
                if (typeof fileName === 'string' && fileName.endsWith('.zip')) {
                    try {
                        return await downloadWithProgress(`/data/dictionaries/${fileName}`, onProgress);
                    } catch {
                        // Fall back to remote release URL
                    }
                }
                return await downloadWithProgress(url, onProgress);
            },
            importArchive: async (archive, onProgress) => {
                const optionsFull = await settingsController.getOptionsFull();
                const importDetails = {
                    prefixWildcardsSupported: optionsFull.global.database.prefixWildcardsSupported,
                    yomitanVersion: chrome.runtime.getManifest().version,
                };
                try {
                    return await new DictionaryWorker().importDictionary(archive, importDetails, onProgress);
                } catch (e) {
                    throw new FenixInstallError('import', e instanceof Error ? e.message : String(e), e);
                }
            },
            getDictionaryInfo: () => settingsController.getDictionaryInfo(),
            getOptionsFull: () => settingsController.getOptionsFull(),
            getProfileIndex: () => settingsController.profileIndex,
            modifyGlobalSettings,
            readArchiveTitle,
            deleteDictionary: async (title) => { await new DictionaryWorker().deleteDictionary(title, null); },
            notifyDatabaseUpdated: () => application.api.triggerDatabaseUpdated('dictionary', 'import'),
            state,
            createDictionarySettings: (name, enabled, styles) => DictionaryController.createDefaultDictionarySettings(name, enabled, styles ?? ''),
        });
        let didInstall = false;
        const runInstall = async () => {
            const [dictionaryInfos, optionsFull] = await Promise.all([
                settingsController.getDictionaryInfo(),
                settingsController.getOptionsFull(),
            ]);
            const needsWork = await reconcileFenixStateBeforeInstall({
                dictionaryInfos,
                optionsFull,
                state,
                deleteDictionary: async (title) => { await new DictionaryWorker().deleteDictionary(title, null); },
            });
            if (!needsWork) { return; }
            didInstall = true;
            const noDictText = document.querySelector('#no-dictionaries .entry p');
            if (noDictText !== null) {
                noDictText.textContent = 'Đang tự động nạp bộ từ điển Nhật - Việt mặc định (vui lòng đợi vài giây)...';
            }
            const prevention = settingsController.preventPageExit();
            try {
                await installer.installFirstRun(({spec, phase, loaded = 0, total = 0}) => {
                    if (noDictText === null) { return; }
                    const pct = total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 0;
                    if (phase === 'downloading' || phase === 'importing') {
                        noDictText.textContent = `Đang tự động nạp bộ từ điển ${spec.title} (${pct}%)...`;
                    }
                });
            } finally {
                prevention.end();
            }
        };
        await (typeof navigator.locks !== 'undefined' ? navigator.locks.request('fenix-dictionary-install', runInstall) : runInstall());
        if (didInstall) {
            await display.updateOptions();
            display.initializeState();
        }
    }
});
