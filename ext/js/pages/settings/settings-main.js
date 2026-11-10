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

import {Application} from '../../application.js';
import {ExtensionError} from '../../core/extension-error.js';
import {DictionaryWorker} from '../../dictionary/dictionary-worker.js';
import {DocumentFocusController} from '../../dom/document-focus-controller.js';
import {querySelectorNotNull} from '../../dom/query-selector.js';
import {readArchiveTitle} from '../../fenix/archive-index.js';
import {downloadWithProgress, FenixInstallError} from '../../fenix/dictionary-downloader.js';
import {FenixDictionaryInstaller} from '../../fenix/dictionary-installer.js';
import {reconcileFenixStateBeforeInstall} from '../../fenix/onboarding-settings.js';
import {OnboardingStateStore} from '../../fenix/onboarding-state.js';
import {ExtensionContentController} from '../common/extension-content-controller.js';
import {AnkiController} from './anki-controller.js';
import {AnkiDeckGeneratorController} from './anki-deck-generator-controller.js';
import {AnkiTemplatesController} from './anki-templates-controller.js';
import {AudioController} from './audio-controller.js';
import {BackupController} from './backup-controller.js';
import {CollapsibleDictionaryController} from './collapsible-dictionary-controller.js';
import {DictionaryController} from './dictionary-controller.js';
import {DictionaryImportController} from './dictionary-import-controller.js';
import {ExtensionKeyboardShortcutController} from './extension-keyboard-shortcuts-controller.js';
import {GenericSettingController} from './generic-setting-controller.js';
import {KeyboardShortcutController} from './keyboard-shortcuts-controller.js';
import {LanguagesController} from './languages-controller.js';
import {MecabController} from './mecab-controller.js';
import {ModalController} from './modal-controller.js';
import {NestedPopupsController} from './nested-popups-controller.js';
import {PermissionsToggleController} from './permissions-toggle-controller.js';
import {PersistentStorageController} from './persistent-storage-controller.js';
import {PopupPreviewController} from './popup-preview-controller.js';
import {PopupWindowController} from './popup-window-controller.js';
import {ProfileController} from './profile-controller.js';
import {RecommendedSettingsController} from './recommended-settings-controller.js';
import {ScanInputsController} from './scan-inputs-controller.js';
import {ScanInputsSimpleController} from './scan-inputs-simple-controller.js';
import {SecondarySearchDictionaryController} from './secondary-search-dictionary-controller.js';
import {SentenceTerminationCharactersController} from './sentence-termination-characters-controller.js';
import {SettingsController} from './settings-controller.js';
import {SettingsDisplayController} from './settings-display-controller.js';
import {SortFrequencyDictionaryController} from './sort-frequency-dictionary-controller.js';
import {StatusFooter} from './status-footer.js';
import {StorageController} from './storage-controller.js';
import {TranslationTextReplacementsController} from './translation-text-replacements-controller.js';
import {YomitanApiController} from './yomitan-api-controller.js';

/**
 * @param {GenericSettingController} genericSettingController
 */
async function setupGenericSettingController(genericSettingController) {
    await genericSettingController.prepare();
    await genericSettingController.refresh();
}

await Application.main(true, async (application) => {
    const documentFocusController = new DocumentFocusController();
    documentFocusController.prepare();

    const extensionContentController = new ExtensionContentController();
    extensionContentController.prepare();

    /** @type {HTMLElement} */
    const statusFooterElement = querySelectorNotNull(document, '.status-footer-container');
    const statusFooter = new StatusFooter(statusFooterElement);
    statusFooter.prepare();

    /** @type {?number} */
    let prepareTimer = window.setTimeout(() => {
        prepareTimer = null;
        document.documentElement.dataset.loadingStalled = 'true';
    }, 1000);

    if (prepareTimer !== null) {
        clearTimeout(prepareTimer);
        prepareTimer = null;
    }
    delete document.documentElement.dataset.loadingStalled;

    const preparePromises = [];

    const modalController = new ModalController(['shared-modals', 'settings-modals']);
    await modalController.prepare();

    const settingsController = new SettingsController(application);
    await settingsController.prepare();

    const settingsDisplayController = new SettingsDisplayController(settingsController, modalController);
    await settingsDisplayController.prepare();

    document.body.hidden = false;

    const popupPreviewController = new PopupPreviewController(settingsController);
    popupPreviewController.prepare();

    const persistentStorageController = new PersistentStorageController(application);
    preparePromises.push(persistentStorageController.prepare());

    const storageController = new StorageController(persistentStorageController);
    storageController.prepare();

    const dictionaryController = new DictionaryController(settingsController, modalController, statusFooter);
    preparePromises.push(dictionaryController.prepare());

    const dictionaryImportController = new DictionaryImportController(settingsController, modalController, statusFooter);
    dictionaryImportController.prepare();

    const genericSettingController = new GenericSettingController(settingsController);
    preparePromises.push(setupGenericSettingController(genericSettingController));

    const audioController = new AudioController(settingsController, modalController);
    preparePromises.push(audioController.prepare());

    const profileController = new ProfileController(settingsController, modalController);
    preparePromises.push(profileController.prepare());

    const settingsBackup = new BackupController(settingsController, modalController);
    preparePromises.push(settingsBackup.prepare());

    const ankiController = new AnkiController(settingsController, application, modalController);
    preparePromises.push(ankiController.prepare());

    const ankiDeckGeneratorController = new AnkiDeckGeneratorController(application, settingsController, modalController, ankiController);
    preparePromises.push(ankiDeckGeneratorController.prepare());

    const ankiTemplatesController = new AnkiTemplatesController(application, settingsController, modalController, ankiController);
    preparePromises.push(ankiTemplatesController.prepare());

    const scanInputsController = new ScanInputsController(settingsController);
    preparePromises.push(scanInputsController.prepare());

    const simpleScanningInputController = new ScanInputsSimpleController(settingsController);
    preparePromises.push(simpleScanningInputController.prepare());

    const nestedPopupsController = new NestedPopupsController(settingsController);
    preparePromises.push(nestedPopupsController.prepare());

    const permissionsToggleController = new PermissionsToggleController(settingsController);
    preparePromises.push(permissionsToggleController.prepare());

    const secondarySearchDictionaryController = new SecondarySearchDictionaryController(settingsController);
    preparePromises.push(secondarySearchDictionaryController.prepare());

    const languagesController = new LanguagesController(settingsController);
    preparePromises.push(languagesController.prepare());

    const translationTextReplacementsController = new TranslationTextReplacementsController(settingsController);
    preparePromises.push(translationTextReplacementsController.prepare());

    const sentenceTerminationCharactersController = new SentenceTerminationCharactersController(settingsController);
    preparePromises.push(sentenceTerminationCharactersController.prepare());

    const keyboardShortcutController = new KeyboardShortcutController(settingsController);
    preparePromises.push(keyboardShortcutController.prepare());

    const extensionKeyboardShortcutController = new ExtensionKeyboardShortcutController(settingsController);
    preparePromises.push(extensionKeyboardShortcutController.prepare());

    const popupWindowController = new PopupWindowController(application.api);
    popupWindowController.prepare();

    const mecabController = new MecabController(application.api);
    mecabController.prepare();

    const yomitanApiController = new YomitanApiController(application.api);
    yomitanApiController.prepare();

    const collapsibleDictionaryController = new CollapsibleDictionaryController(settingsController);
    preparePromises.push(collapsibleDictionaryController.prepare());

    const sortFrequencyDictionaryController = new SortFrequencyDictionaryController(settingsController);
    preparePromises.push(sortFrequencyDictionaryController.prepare());

    const recommendedSettingsController = new RecommendedSettingsController(settingsController);
    preparePromises.push(recommendedSettingsController.prepare());

    await Promise.all(preparePromises);

    document.documentElement.dataset.loaded = 'true';

    if (!navigator.webdriver) {
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
            const prevention = settingsController.preventPageExit();
            try {
                await installer.installFirstRun(() => {});
            } finally {
                prevention.end();
            }
        };
        await (typeof navigator.locks !== 'undefined' ? navigator.locks.request('fenix-dictionary-install', runInstall) : runInstall());
    }
});
