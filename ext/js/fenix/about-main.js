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
import {DocumentFocusController} from '../dom/document-focus-controller.js';
import {querySelectorNotNull} from '../dom/query-selector.js';
import {ExtensionContentController} from '../pages/common/extension-content-controller.js';
import {SettingsController} from '../pages/settings/settings-controller.js';
import {applyTranslations, t} from './i18n.js';

await Application.main(true, async (application) => {
    const settingsController = new SettingsController(application);
    await settingsController.prepare();

    const themeController = new ThemeController(document.documentElement);
    themeController.prepare();
    const {popupTheme} = (await settingsController.getOptions()).general;
    themeController.theme = popupTheme;
    themeController.siteOverride = true;
    themeController.updateTheme();

    applyTranslations(document);
    querySelectorNotNull(document, '#fenix-version').textContent = t('common.version', {version: chrome.runtime.getManifest().version});

    document.body.hidden = false;

    const documentFocusController = new DocumentFocusController();
    documentFocusController.prepare();

    const extensionContentController = new ExtensionContentController();
    extensionContentController.prepare();

    document.documentElement.dataset.loaded = 'true';
});
