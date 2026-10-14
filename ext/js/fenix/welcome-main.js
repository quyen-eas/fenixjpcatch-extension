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

import {ThemeController} from '../app/theme-controller.js';
import {Application} from '../application.js';
import {ExtensionError} from '../core/extension-error.js';
import {DictionaryWorker} from '../dictionary/dictionary-worker.js';
import {DocumentFocusController} from '../dom/document-focus-controller.js';
import {ExtensionContentController} from '../pages/common/extension-content-controller.js';
import {DictionaryController} from '../pages/settings/dictionary-controller.js';
import {GenericSettingController} from '../pages/settings/generic-setting-controller.js';
import {RecommendedPermissionsController} from '../pages/settings/recommended-permissions-controller.js';
import {SettingsController} from '../pages/settings/settings-controller.js';
import {readArchiveTitle} from './archive-index.js';
import {downloadWithProgress, FenixInstallError} from './dictionary-downloader.js';
import {FenixDictionaryInstaller} from './dictionary-installer.js';
import {OnboardingStateStore} from './onboarding-state.js';
import {WelcomeController} from './welcome-controller.js';

/**
 * Resolves with the speech synthesis voices; they load asynchronously in most browsers.
 * @returns {Promise<SpeechSynthesisVoice[]>}
 */
function getSpeechVoices() {
    return new Promise((resolve) => {
        try {
            const synth = window.speechSynthesis;
            const voices = synth.getVoices();
            if (voices.length > 0) {
                resolve(voices);
                return;
            }
            const done = () => { resolve(synth.getVoices()); };
            synth.addEventListener('voiceschanged', done, {once: true});
            setTimeout(done, 3000);
        } catch (e) {
            resolve([]);
        }
    });
}

await Application.main(true, async (application) => {
    const settingsController = new SettingsController(application);
    await settingsController.prepare();

    const themeController = new ThemeController(document.documentElement);
    themeController.prepare();
    const {popupTheme} = (await settingsController.getOptions()).general;
    themeController.theme = popupTheme;
    themeController.siteOverride = true;
    themeController.updateTheme();

    /**
     * @param {import('settings-modifications').Modification[]} targets
     * @returns {Promise<Error[]>} The errors of the modifications that failed.
     */
    const modifyGlobalSettings = async (targets) => {
        const results = await settingsController.modifyGlobalSettings(targets);
        return results.flatMap(({error}) => (typeof error === 'undefined' ? [] : [ExtensionError.deserialize(error)]));
    };

    const state = new OnboardingStateStore();
    const installer = new FenixDictionaryInstaller({
        download: (url, onProgress) => downloadWithProgress(url, onProgress),
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

    const welcomeController = new WelcomeController({installer, state, settingsController, modifyGlobalSettings, getVoices: getSpeechVoices});
    welcomeController.prepare();

    document.body.hidden = false;

    const documentFocusController = new DocumentFocusController();
    documentFocusController.prepare();

    const extensionContentController = new ExtensionContentController();
    extensionContentController.prepare();

    const genericSettingController = new GenericSettingController(settingsController);
    await genericSettingController.prepare();
    await genericSettingController.refresh();

    const recommendedPermissionsController = new RecommendedPermissionsController(settingsController);
    await recommendedPermissionsController.prepare();

    document.documentElement.dataset.loaded = 'true';

    await welcomeController.run();
});
