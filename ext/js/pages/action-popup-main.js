/*
 * Copyright (C) 2023-2026  Yomitan Authors
 * Copyright (C) 2017-2022  Yomichan Authors
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
import {getAllPermissions, hasRequiredPermissionsForOptions} from '../data/permissions-util.js';
import {applyTranslations} from '../fenix/i18n.js';
import {HotkeyHelpController} from '../input/hotkey-help-controller.js';
import {HotkeyUtil} from '../input/hotkey-util.js';

class DisplayController {
    /**
     * @param {import('../comm/api.js').API} api
     * @param {Application} application
     */
    constructor(api, application) {
        /** @type {import('../comm/api.js').API} */
        this._api = api;
        /** @type {Application} */
        this._application = application;
        /** @type {?import('settings').Options} */
        this._optionsFull = null;
        /** @type {ThemeController} */
        this._themeController = new ThemeController(document.documentElement);
        /** @type {HotkeyUtil} */
        this._hotkeyUtil = new HotkeyUtil();
    }

    /** */
    async prepare() {
        this._themeController.prepare();

        const manifest = chrome.runtime.getManifest();

        const {platform: {os}} = await this._api.getEnvironmentInfo();
        this._hotkeyUtil.os = os;

        this._showExtensionInfo(manifest);
        void this._setupEnvironment();
        this._setupButtonEvents('.action-open-search', 'openSearchPage', chrome.runtime.getURL('/search.html'), this._onSearchClick.bind(this));
        this._setupButtonEvents('.action-open-info', 'openInfoPage', chrome.runtime.getURL('/fenix-about.html'));
        applyTranslations(document);
        this._setupFenixLinks();

        const optionsFull = await this._api.optionsGetFull();
        this._optionsFull = optionsFull;

        void this._setupHotkeys();

        const optionsPageUrl = (
            typeof manifest.options_ui === 'object' &&
            manifest.options_ui !== null &&
            typeof manifest.options_ui.page === 'string' ?
            manifest.options_ui.page :
            ''
        );
        this._setupButtonEvents('.action-open-settings', 'openSettingsPage', chrome.runtime.getURL(optionsPageUrl));

        const {profiles, profileCurrent} = optionsFull;
        const defaultProfile = (profileCurrent >= 0 && profileCurrent < profiles.length) ? profiles[profileCurrent] : null;
        if (defaultProfile !== null) {
            this._setupOptions(defaultProfile);
        }

        /** @type {NodeListOf<HTMLElement>} */
        const profileSelect = document.querySelectorAll('.action-select-profile');
        for (let i = 0; i < profileSelect.length; i++) {
            profileSelect[i].hidden = (profiles.length <= 1);
        }

        this._updateProfileSelect(profiles, profileCurrent);

        this._application.on('databaseUpdated', () => { void this._refreshDictionaryStatus(); });
        this._application.on('optionsUpdated', () => { void this._refreshDictionaryStatus(); });
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
            chrome.storage.onChanged.addListener((changes, areaName) => {
                if (areaName === 'local' && Object.prototype.hasOwnProperty.call(changes, 'fenixOnboarding')) {
                    void this._refreshDictionaryStatus();
                }
            });
        }

        setTimeout(() => {
            document.body.dataset.loaded = 'true';
        }, 10);
    }

    // Private

    /** */
    _updateDisplayModifierKey() {
        const {profiles, profileCurrent} = /** @type {import('settings').Options} */ (this._optionsFull);
        /** @type {NodeListOf<HTMLElement>} */
        const modifierKeyHint = document.querySelectorAll('.tooltip');

        const currentModifierKey = profiles[profileCurrent].options.scanning.inputs[0].include;

        /** @type {{ [key: string]: string }} */
        const modifierKeys = {};
        for (const value of /** @type {import('input').ModifierKey[]} */ (['alt', 'ctrl', 'shift', 'meta'])) {
            const name = this._hotkeyUtil.getModifierDisplayValue(value);
            modifierKeys[value] = name;
        }

        for (let i = 0; i < modifierKeyHint.length; i++) {
            modifierKeyHint[i].textContent = currentModifierKey ? 'Hold ' : 'Hover over text to scan';
            if (currentModifierKey) {
                const em = document.createElement('em');
                em.textContent = modifierKeys[currentModifierKey];
                modifierKeyHint[i].appendChild(em);
                modifierKeyHint[i].appendChild(document.createTextNode(' to scan'));
            }
        }
    }

    /**
     * @param {MouseEvent} e
     */
    _onSearchClick(e) {
        if (!e.shiftKey) { return; }
        e.preventDefault();
        location.href = '/search.html?action-popup=true';
    }

    /**
     * @param {chrome.runtime.Manifest} manifest
     */
    _showExtensionInfo(manifest) {
        const node = document.getElementById('extension-info');
        if (node === null) { return; }

        node.textContent = `${manifest.name} v${manifest.version}`;
    }

    /**
     * @param {string} selector
     * @param {?string} command
     * @param {string} url
     * @param {(event: MouseEvent) => void} [customHandler]
     */
    _setupButtonEvents(selector, command, url, customHandler) {
        /** @type {NodeListOf<HTMLAnchorElement>} */
        const nodes = document.querySelectorAll(selector);
        for (const node of nodes) {
            if (typeof command === 'string') {
                /**
                 * @param {MouseEvent} e
                 */
                const onClick = (e) => {
                    if (e.button !== 0) { return; }
                    if (typeof customHandler === 'function') {
                        const result = customHandler(e);
                        if (typeof result !== 'undefined') { return; }
                    }

                    let mode = 'existingOrNewTab';
                    if (e.ctrlKey) {
                        mode = 'newTab';
                    } else if (e.shiftKey) {
                        mode = 'popup';
                    }

                    void this._api.commandExec(command, {mode: mode});
                    e.preventDefault();
                };
                /**
                 * @param {MouseEvent} e
                 */
                const onAuxClick = (e) => {
                    if (e.button !== 1) { return; }
                    void this._api.commandExec(command, {mode: 'newTab'});
                    e.preventDefault();
                };
                node.addEventListener('click', onClick, false);
                node.addEventListener('auxclick', onAuxClick, false);
            }

            if (typeof url === 'string') {
                node.href = url;
                node.target = '_blank';
                node.rel = 'noopener';
            }
        }
    }

    // Added by Fenix Labs for FenixJpCatch (Phase 2.1)
    /** */
    _setupFenixLinks() {
        const welcome = document.querySelector('.action-open-fenix-welcome');
        if (welcome !== null) {
            welcome.addEventListener('click', (e) => {
                e.preventDefault();
                void this._openOrFocusWelcomeTab();
            });
        }
        const about = document.querySelector('.action-open-fenix-about');
        if (about !== null) {
            about.addEventListener('click', (e) => {
                e.preventDefault();
                void chrome.tabs.create({url: chrome.runtime.getURL('/fenix-about.html')});
            });
        }
    }

    /**
     * Focuses an already-open Fenix welcome tab if present, or opens a new one.
     * @returns {Promise<void>}
     */
    async _openOrFocusWelcomeTab() {
        const welcomeUrl = chrome.runtime.getURL('/fenix-welcome.html');
        try {
            const tabs = await chrome.tabs.query({});
            const existing = tabs.find((tab) => typeof tab.url === 'string' && tab.url.startsWith(welcomeUrl));
            if (existing && typeof existing.id === 'number') {
                await chrome.tabs.update(existing.id, {active: true});
                if (typeof existing.windowId === 'number' && typeof chrome.windows === 'object' && chrome.windows !== null) {
                    await chrome.windows.update(existing.windowId, {focused: true});
                }
                return;
            }
        } catch {
            // Fall back to opening a new tab
        }
        await chrome.tabs.create({url: welcomeUrl});
    }

    /** @returns {Promise<void>} */
    async _refreshDictionaryStatus() {
        try {
            const optionsFull = await this._api.optionsGetFull();
            this._optionsFull = optionsFull;
            const {profiles, profileCurrent} = optionsFull;
            const defaultProfile = (profileCurrent >= 0 && profileCurrent < profiles.length) ? profiles[profileCurrent] : null;
            if (defaultProfile !== null) {
                await this._updateDictionariesEnabledWarnings(defaultProfile.options);
            }
        } catch {
            // Ignore transient refresh errors
        }
    }

    /** */
    async _setupEnvironment() {
        const urlSearchParams = new URLSearchParams(location.search);
        let mode = urlSearchParams.get('mode');
        switch (mode) {
            case 'full':
            case 'mini':
                break;
            default:
                {
                    let tab;
                    try {
                        tab = await this._getCurrentTab();
                        // Safari assigns a tab object to the popup, other browsers do not
                        if (tab && await this._isSafari()) {
                            tab = void 0;
                        }
                    } catch (e) {
                        // NOP
                    }
                    mode = (tab ? 'full' : 'mini');
                }
                break;
        }

        document.documentElement.dataset.mode = mode;
    }

    /**
     * @returns {Promise<chrome.tabs.Tab|undefined>}
     */
    _getCurrentTab() {
        return new Promise((resolve, reject) => {
            chrome.tabs.getCurrent((result) => {
                const e = chrome.runtime.lastError;
                if (e) {
                    reject(new Error(e.message));
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * @param {import('settings').Profile} profile
     */
    _setupOptions({options}) {
        const extensionEnabled = options.general.enable;
        const onToggleChanged = () => this._api.commandExec('toggleTextScanning');
        for (const toggle of /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('.enable-search,.enable-search2'))) {
            if (toggle.checked !== extensionEnabled) {
                toggle.checked = extensionEnabled;
            }
            toggle.addEventListener('change', onToggleChanged, false);
        }
        void this._updateDisplayModifierKey();
        void this._updateDictionariesEnabledWarnings(options);
        void this._updatePermissionsWarnings(options);

        this._themeController.theme = options.general.popupTheme;
        this._themeController.siteOverride = true;
        this._themeController.updateTheme();
    }

    /** */
    async _setupHotkeys() {
        const hotkeyHelpController = new HotkeyHelpController();
        await hotkeyHelpController.prepare(this._api);

        const {profiles, profileCurrent} = /** @type {import('settings').Options} */ (this._optionsFull);
        const defaultProfile = (profileCurrent >= 0 && profileCurrent < profiles.length) ? profiles[profileCurrent] : null;
        if (defaultProfile !== null) {
            hotkeyHelpController.setOptions(defaultProfile.options);
        }

        hotkeyHelpController.setupNode(document.documentElement);
    }

    /**
     * @param {import('settings').Profile[]} profiles
     * @param {number} profileCurrent
     */
    _updateProfileSelect(profiles, profileCurrent) {
        /** @type {NodeListOf<HTMLSelectElement>} */
        const selects = document.querySelectorAll('.profile-select');
        /** @type {NodeListOf<HTMLElement>} */
        for (let i = 0; i < Math.min(selects.length); i++) {
            const fragment = document.createDocumentFragment();
            for (let j = 0, jj = profiles.length; j < jj; ++j) {
                const {name} = profiles[j];
                const option = document.createElement('option');
                option.textContent = name;
                option.value = `${j}`;
                fragment.appendChild(option);
            }
            selects[i].textContent = '';
            selects[i].appendChild(fragment);
            selects[i].value = `${profileCurrent}`;

            selects[i].addEventListener('change', this._onProfileSelectChange.bind(this), false);
        }
    }

    /**
     * @param {Event} event
     */
    _onProfileSelectChange(event) {
        const node = /** @type {HTMLInputElement} */ (event.currentTarget);
        const value = Number.parseInt(node.value, 10);
        if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < /** @type {import('settings').Options} */ (this._optionsFull).profiles.length) {
            const optionsFull = this._optionsFull;
            if (optionsFull && value < optionsFull.profiles.length) {
                void this._setDefaultProfileIndex(value);
                optionsFull.profileCurrent = value;
                const defaultProfile = optionsFull.profiles[optionsFull.profileCurrent];
                if (defaultProfile !== null) {
                    this._setupOptions(defaultProfile);
                }
            }
        }
    }

    /**
     * @param {number} value
     */
    async _setDefaultProfileIndex(value) {
        /** @type {import('settings-modifications').ScopedModificationSet} */
        const modification = {
            action: 'set',
            path: 'profileCurrent',
            value,
            scope: 'global',
            optionsContext: null,
        };
        await this._api.modifySettings([modification], 'action-popup');
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    async _updateDictionariesEnabledWarnings(options) {
        const tooltip = document.querySelectorAll('.tooltip');
        const hintCard = document.getElementById('fenix-popup-hint-card');
        const offlineStatusCard = document.getElementById('fenix-popup-offline-status');
        const statusDot = document.getElementById('fenix-popup-status-dot');
        const statusLabel = document.getElementById('fenix-popup-status-label');
        const statusCount = document.getElementById('fenix-popup-status-count');
        const dictionaries = await this._api.getDictionaryInfo();

        const enabledDictionaries = new Set();
        for (const {name, enabled} of options.dictionaries) {
            if (enabled) {
                enabledDictionaries.add(name);
            }
        }

        let enabledCount = 0;
        for (const {title, importSuccess} of dictionaries) {
            if (importSuccess !== false && enabledDictionaries.has(title)) {
                ++enabledCount;
            }
        }

        if (enabledCount === 0) {
            let isImporting = dictionaries.some((d) => d.importSuccess === false);
            try {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    const stored = await chrome.storage.local.get(['fenixOnboarding']);
                    const onboarding = /** @type {{importing?: Record<string, boolean>}|undefined} */ (stored.fenixOnboarding);
                    if (onboarding && onboarding.importing && Object.values(onboarding.importing).some(Boolean)) {
                        isImporting = true;
                    }
                }
            } catch {
                // Ignore storage read failure
            }

            if (hintCard !== null) {
                hintCard.classList.add('fenix-hint-warning');
                hintCard.onclick = (e) => {
                    e.preventDefault();
                    void this._openOrFocusWelcomeTab();
                };
            }
            if (offlineStatusCard !== null) {
                offlineStatusCard.classList.add('fenix-offline-status-warning');
                offlineStatusCard.onclick = (e) => {
                    e.preventDefault();
                    void this._openOrFocusWelcomeTab();
                };
            }
            if (statusDot !== null) {
                statusDot.classList.remove('fenix-status-dot-ready');
                statusDot.classList.add('fenix-status-dot-warning');
            }
            if (statusLabel !== null) {
                statusLabel.textContent = isImporting ? 'Đang nạp từ điển...' : 'Chưa có dữ liệu từ điển';
            }
            if (statusCount !== null) {
                statusCount.textContent = isImporting ? 'Giữ tab Hướng dẫn mở đến 100%' : 'Nhấn phía trên để nạp ngay';
            }

            for (let i = 0; i < tooltip.length; i++) {
                const link = document.createElement('a');
                link.href = '/fenix-welcome.html';
                link.className = 'action-open-fenix-welcome-progress';
                link.style.color = 'inherit';
                link.style.fontWeight = 'bold';
                link.style.textDecoration = isImporting ? 'none' : 'underline';
                link.textContent = isImporting ?
                    '⏳ Đang tự động nạp bộ từ điển... Nhấn để xem tiến trình' :
                    '⚠️ Chưa nạp xong từ điển — Nhấn để mở trang nạp tự động';
                tooltip[i].replaceChildren(link);
                tooltip[i].classList.add('enable-dictionary-tooltip');
            }
        } else {
            if (hintCard !== null) {
                hintCard.classList.remove('fenix-hint-warning');
                hintCard.onclick = null;
            }
            if (offlineStatusCard !== null) {
                offlineStatusCard.classList.remove('fenix-offline-status-warning');
                offlineStatusCard.onclick = null;
            }
            if (statusDot !== null) {
                statusDot.classList.remove('fenix-status-dot-warning');
                statusDot.classList.add('fenix-status-dot-ready');
            }
            if (statusLabel !== null) {
                statusLabel.textContent = 'Từ điển ngoại tuyến (Sẵn sàng)';
            }
            if (statusCount !== null) {
                statusCount.textContent = '180,000+ từ & ví dụ đối soát';
            }
            for (let i = 0; i < tooltip.length; i++) {
                tooltip[i].classList.remove('enable-dictionary-tooltip');
            }
            this._updateDisplayModifierKey();
        }
    }

    /**
     * @param {import('settings').ProfileOptions} options
     */
    async _updatePermissionsWarnings(options) {
        const permissions = await getAllPermissions();
        if (hasRequiredPermissionsForOptions(permissions, options)) { return; }

        const tooltip = document.querySelectorAll('.tooltip');
        for (let i = 0; i < tooltip.length; i++) {
            tooltip[i].innerHTML = '<a class="action-open-permissions">Please enable permissions</a>';
        }
        this._setupButtonEvents('.action-open-permissions', null, chrome.runtime.getURL('/permissions.html'));
    }

    /** @returns {Promise<boolean>} */
    async _isSafari() {
        const {browser} = await this._api.getEnvironmentInfo();
        return browser === 'safari';
    }
}

await Application.main(true, async (application) => {
    void application.api.logIndicatorClear();

    const displayController = new DisplayController(application.api, application);
    await displayController.prepare();
});
