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

import {CloudController} from '../cloud/cloud-controller.js';
import {getExtensionRedirectUri} from '../cloud/firebase-auth.js';

/**
 * @typedef {{
 *   id?: string,
 *   expression: string,
 *   reading: string,
 *   status?: string,
 *   updatedAt?: string,
 *   contexts?: Array<{
 *     sentence?: string,
 *     sourceUrl?: string,
 *     sourceTitle?: string,
 *     createdAt?: string,
 *   }>,
 * }} WordItem
 */

class SavedWordsDashboard {
    constructor() {
        /** @type {CloudController} */
        this._controller = new CloudController();
        /** @type {WordItem[]} */
        this._words = [];
        /** @type {string} */
        this._activeFilter = 'all';
        /** @type {string} */
        this._searchQuery = '';
    }

    /**
     * Prepares and initializes the dashboard.
     */
    async prepare() {
        this._bindEvents();
        await this._renderAuthState();
        await this._loadWords();
    }

    /**
     * Binds DOM event listeners.
     */
    _bindEvents() {
        const searchInput = document.querySelector('#sw-search-input');
        if (searchInput !== null && searchInput instanceof HTMLInputElement) {
            searchInput.addEventListener('input', () => {
                this._searchQuery = searchInput.value.trim().toLowerCase();
                this._renderWordCards();
            });
        }

        const chips = document.querySelectorAll('.sw-chip');
        for (const chip of chips) {
            chip.addEventListener('click', (e) => {
                const target = /** @type {HTMLButtonElement} */ (e.currentTarget);
                for (const c of chips) { c.classList.remove('active'); }
                target.classList.add('active');
                this._activeFilter = target.dataset.filter || 'all';
                this._renderWordCards();
            });
        }

        const syncBtn = document.querySelector('#sw-sync-btn');
        if (syncBtn !== null) {
            syncBtn.addEventListener('click', () => {
                void this._handleSync();
            });
        }

        const exportAnkiBtn = document.querySelector('#sw-btn-export-anki');
        if (exportAnkiBtn !== null) {
            exportAnkiBtn.addEventListener('click', () => {
                this._exportAnki();
            });
        }

        const exportCsvBtn = document.querySelector('#sw-btn-export-csv');
        if (exportCsvBtn !== null) {
            exportCsvBtn.addEventListener('click', () => {
                this._exportCsv();
            });
        }
    }

    /**
     * Renders authentication state in the header.
     */
    async _renderAuthState() {
        const auth = await this._controller.getAuthState();
        const container = document.querySelector('#sw-auth-container');
        const userSummary = document.querySelector('#sw-user-summary');
        if (container === null) { return; }

        container.textContent = '';
        if (auth !== null && auth.user) {
            const name = auth.user.displayName || auth.user.email || 'Học viên Fenix';
            const initial = name.charAt(0).toUpperCase();

            const profileWrap = document.createElement('div');
            profileWrap.className = 'sw-user-profile';

            const avatar = document.createElement('div');
            avatar.className = 'sw-avatar';
            avatar.textContent = initial;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = name;

            const configBtn = document.createElement('button');
            configBtn.type = 'button';
            configBtn.className = 'sw-auth-btn';
            configBtn.style.marginLeft = '8px';
            configBtn.textContent = 'Cấu hình Cloud';
            configBtn.addEventListener('click', () => {
                void this._openCloudConfigModal();
            });

            const logoutBtn = document.createElement('button');
            logoutBtn.type = 'button';
            logoutBtn.className = 'sw-auth-btn';
            logoutBtn.id = 'sw-logout-btn';
            logoutBtn.style.marginLeft = '6px';
            logoutBtn.textContent = 'Đăng xuất';
            logoutBtn.addEventListener('click', async () => {
                await this._controller.logout();
                await this._renderAuthState();
                await this._loadWords();
            });

            profileWrap.append(avatar, nameSpan, configBtn, logoutBtn);
            container.append(profileWrap);

            if (userSummary !== null) {
                userSummary.textContent = '';
                const summaryRow = document.createElement('div');
                summaryRow.style.display = 'flex';
                summaryRow.style.alignItems = 'center';
                summaryRow.style.gap = '10px';

                const summaryAvatar = document.createElement('div');
                summaryAvatar.className = 'sw-avatar';
                summaryAvatar.textContent = initial;

                const textCol = document.createElement('div');
                const nameDiv = document.createElement('div');
                nameDiv.style.fontWeight = '600';
                nameDiv.textContent = name;

                const statusDiv = document.createElement('div');
                statusDiv.style.fontSize = '0.75em';
                statusDiv.style.color = 'var(--sw-text-muted)';
                statusDiv.textContent = 'Tài khoản Cloud Đã Kết Nối';

                textCol.append(nameDiv, statusDiv);
                summaryRow.append(summaryAvatar, textCol);
                userSummary.append(summaryRow);
            }
        } else {
            const configBtn = document.createElement('button');
            configBtn.type = 'button';
            configBtn.className = 'sw-auth-btn';
            configBtn.style.marginRight = '8px';
            configBtn.textContent = 'Cấu hình Cloud';
            configBtn.addEventListener('click', () => {
                void this._openCloudConfigModal();
            });

            const loginBtn = document.createElement('button');
            loginBtn.type = 'button';
            loginBtn.className = 'sw-auth-btn';
            loginBtn.id = 'sw-login-btn';
            loginBtn.textContent = 'Đăng nhập Google';
            loginBtn.addEventListener('click', async () => {
                await this._handleLogin();
            });
            container.append(configBtn, loginBtn);

            if (userSummary !== null) {
                userSummary.textContent = '';
                const summaryRow = document.createElement('div');
                summaryRow.style.display = 'flex';
                summaryRow.style.alignItems = 'center';
                summaryRow.style.gap = '10px';

                const summaryAvatar = document.createElement('div');
                summaryAvatar.className = 'sw-avatar';
                summaryAvatar.textContent = 'F';

                const textCol = document.createElement('div');
                const nameDiv = document.createElement('div');
                nameDiv.style.fontWeight = '600';
                nameDiv.textContent = 'Chế độ Ngoại Tuyến';

                const statusDiv = document.createElement('div');
                statusDiv.style.fontSize = '0.75em';
                statusDiv.style.color = 'var(--sw-text-muted)';
                statusDiv.textContent = 'Lưu trữ cục bộ trên máy';

                textCol.append(nameDiv, statusDiv);
                summaryRow.append(summaryAvatar, textCol);
                userSummary.append(summaryRow);
            }
        }
    }

    /**
     * Handles Google login.
     */
    async _handleLogin() {
        const syncText = document.querySelector('#sw-sync-text');
        if (syncText !== null) {
            syncText.textContent = 'Đang kết nối Google...';
        }
        try {
            await this._controller.signInWithGoogle();
            await this._renderAuthState();
            await this._handleSync();
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            if (message === 'CLOUD_CONFIG_MISSING') {
                if (syncText !== null) {
                    syncText.textContent = 'Chưa cấu hình Cloud';
                }
                await this._openCloudConfigModal();
                return;
            }
            if (syncText !== null) {
                syncText.textContent = 'Đăng nhập chưa hoàn tất';
            }
        }
    }

    /**
     * Opens a dialog allowing runtime configuration of Firebase & Google OAuth or offline demo mode.
     */
    async _openCloudConfigModal() {
        const existing = document.querySelector('#sw-cloud-config-modal');
        if (existing !== null) {
            existing.remove();
        }

        const config = await this._controller.getCloudConfig();
        const redirectUri = getExtensionRedirectUri();

        const overlay = document.createElement('div');
        overlay.id = 'sw-cloud-config-modal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,8,18,0.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:9999;padding:16px;';

        const card = document.createElement('div');
        card.style.cssText = 'background:#1c192b;border:1px solid rgba(255,255,255,0.12);border-radius:16px;max-width:520px;width:100%;padding:24px;color:#ede9fe;box-shadow:0 20px 50px rgba(0,0,0,0.5);font-family:inherit;';

        const title = document.createElement('h3');
        title.style.cssText = 'margin:0 0 8px 0;font-size:1.15rem;font-weight:700;color:#fff;';
        title.textContent = 'Cấu hình kết nối Firebase & Google OAuth';

        const desc = document.createElement('p');
        desc.style.cssText = 'margin:0 0 16px 0;font-size:0.85rem;color:#a59ec1;line-height:1.5;';
        desc.textContent = 'Nhập thông số Firebase Project của bạn (lưu cục bộ trên trình duyệt này hoặc đặt trong file .env.local khi build).';

        const redirectBox = document.createElement('div');
        redirectBox.style.cssText = 'background:#13111c;border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:0.78rem;';
        const redirectLabel = document.createElement('div');
        redirectLabel.style.cssText = 'color:#a59ec1;margin-bottom:4px;';
        redirectLabel.textContent = 'Authorized Redirect URI (thêm vào Google Cloud Console):';
        const redirectValue = document.createElement('code');
        redirectValue.style.cssText = 'color:#f5b787;word-break:break-all;user-select:all;';
        redirectValue.textContent = redirectUri;
        redirectBox.append(redirectLabel, redirectValue);

        /**
         * @param {string} labelText
         * @param {string} placeholder
         * @param {string} initialValue
         * @returns {{wrapper: HTMLElement, input: HTMLInputElement}}
         */
        const createField = (labelText, placeholder, initialValue) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'margin-bottom:12px;';
            const lbl = document.createElement('label');
            lbl.style.cssText = 'display:block;font-size:0.8rem;color:#cbd5e1;margin-bottom:4px;font-weight:500;';
            lbl.textContent = labelText;
            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = placeholder;
            input.value = initialValue;
            input.style.cssText = 'width:100%;box-sizing:border-box;padding:9px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.14);background:#13111c;color:#fff;font-size:0.85rem;outline:none;';
            wrapper.append(lbl, input);
            return {wrapper, input};
        };

        const apiKeyField = createField('Firebase Web API Key *', 'AIzaSy...', config.firebaseApiKey);
        const clientIdField = createField('Google OAuth Client ID *', '123456789-xxx.apps.googleusercontent.com', config.googleOAuthClientId);
        const projectField = createField('Firebase Project ID', 'fenixjpcatch', config.firebaseProjectId);
        const baseUrlField = createField('Functions Base URL (tuỳ chọn / Emulator)', 'https://asia-northeast1-fenixjpcatch.cloudfunctions.net', config.functionsBaseUrl);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;margin-top:18px;flex-wrap:wrap;';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'sw-auth-btn';
        cancelBtn.textContent = 'Đóng';
        cancelBtn.addEventListener('click', () => {
            overlay.remove();
        });

        const copyEnvBtn = document.createElement('button');
        copyEnvBtn.type = 'button';
        copyEnvBtn.className = 'sw-auth-btn';
        copyEnvBtn.textContent = 'Copy .env.local';
        copyEnvBtn.addEventListener('click', async () => {
            const envLines = [
                `FENIX_FIREBASE_API_KEY=${apiKeyField.input.value.trim()}`,
                `FENIX_FIREBASE_PROJECT_ID=${projectField.input.value.trim() || 'fenixjpcatch'}`,
                'FENIX_FIREBASE_FUNCTIONS_REGION=asia-northeast1',
                `FENIX_FIREBASE_FUNCTIONS_BASE_URL=${baseUrlField.input.value.trim()}`,
                `FENIX_GOOGLE_OAUTH_CLIENT_ID=${clientIdField.input.value.trim()}`,
            ].join('\n');
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(envLines);
                copyEnvBtn.textContent = 'Đã copy!';
            }
        });

        const saveOnlyBtn = document.createElement('button');
        saveOnlyBtn.type = 'button';
        saveOnlyBtn.className = 'sw-auth-btn';
        saveOnlyBtn.textContent = 'Lưu cấu hình';
        saveOnlyBtn.addEventListener('click', async () => {
            await this._controller.setCloudConfig({
                firebaseApiKey: apiKeyField.input.value.trim(),
                googleOAuthClientId: clientIdField.input.value.trim(),
                firebaseProjectId: projectField.input.value.trim() || 'fenixjpcatch',
                functionsBaseUrl: baseUrlField.input.value.trim(),
            });
            overlay.remove();
            await this._handleSync();
        });

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'sw-auth-btn';
        saveBtn.style.cssText = 'background:#713455;color:#ffd8ec;border-color:#9b4d77;';
        saveBtn.textContent = 'Lưu & Đăng nhập Google';
        saveBtn.addEventListener('click', async () => {
            await this._controller.setCloudConfig({
                firebaseApiKey: apiKeyField.input.value.trim(),
                googleOAuthClientId: clientIdField.input.value.trim(),
                firebaseProjectId: projectField.input.value.trim() || 'fenixjpcatch',
                functionsBaseUrl: baseUrlField.input.value.trim(),
            });
            overlay.remove();
            await this._handleLogin();
        });

        actions.append(cancelBtn, copyEnvBtn, saveOnlyBtn, saveBtn);
        card.append(
            title,
            desc,
            redirectBox,
            apiKeyField.wrapper,
            clientIdField.wrapper,
            projectField.wrapper,
            baseUrlField.wrapper,
            actions,
        );
        overlay.append(card);
        document.body.append(overlay);
    }

    /**
     * Handles manual sync.
     */
    async _handleSync() {
        const syncText = document.querySelector('#sw-sync-text');
        if (syncText !== null) { syncText.textContent = 'Đang đồng bộ...'; }

        try {
            const {processed, failed} = await this._controller.syncQueue();
            await this._loadWords();
            if (syncText !== null) {
                if (failed > 0) {
                    syncText.textContent = 'Chờ đồng bộ (kiểm tra Firestore Rules)';
                } else {
                    syncText.textContent = processed > 0 ? `Đã đồng bộ (${processed} mới)` : 'Đã đồng bộ';
                }
            }
        } catch {
            if (syncText !== null) { syncText.textContent = 'Đang ngoại tuyến'; }
        }
    }

    /**
     * Loads words from controller and updates UI.
     */
    async _loadWords() {
        const res = await this._controller.listSavedWords();
        this._words = /** @type {WordItem[]} */ (res.words || []);

        this._updateMetrics();
        this._renderWordCards();
    }

    /**
     * Updates statistics in the left panel.
     */
    _updateMetrics() {
        const total = this._words.length;
        let mastered = 0;
        for (const w of this._words) {
            if (w.status === 'checked') { mastered++; }
        }

        const totalEl = document.querySelector('#sw-stat-total');
        const masteredEl = document.querySelector('#sw-stat-mastered');
        const ratioEl = document.querySelector('#sw-stat-ratio');
        const barEl = document.querySelector('#sw-stat-bar');

        if (totalEl !== null) { totalEl.textContent = String(total); }
        if (masteredEl !== null) { masteredEl.textContent = String(mastered); }

        const ratio = total > 0 ? Math.round((mastered / total) * 100) : 0;
        if (ratioEl !== null) { ratioEl.textContent = `${ratio}%`; }
        if (barEl !== null && barEl instanceof HTMLElement) {
            barEl.style.width = `${ratio}%`;
        }
    }

    /**
     * Renders filtered and searched word cards into container.
     */
    _renderWordCards() {
        const container = document.querySelector('#sw-words-container');
        const emptyState = document.querySelector('#sw-empty-state');
        if (container === null) { return; }

        const filtered = this._words.filter((w) => {
            if (this._activeFilter === 'checked' && w.status !== 'checked') { return false; }
            if (this._activeFilter === 'new' && w.status === 'checked') { return false; }
            if (this._activeFilter === 'has-context') {
                const hasCtx = Array.isArray(w.contexts) && w.contexts.length > 0 && Boolean(w.contexts[0].sentence);
                if (!hasCtx) { return false; }
            }

            if (this._searchQuery !== '') {
                const expr = w.expression.toLowerCase();
                const read = w.reading.toLowerCase();
                const ctx = w.contexts?.[0]?.sentence?.toLowerCase() || '';
                return expr.includes(this._searchQuery) || read.includes(this._searchQuery) || ctx.includes(this._searchQuery);
            }
            return true;
        });

        container.textContent = '';
        if (filtered.length === 0) {
            if (emptyState !== null) { emptyState.removeAttribute('hidden'); }
            return;
        }

        if (emptyState !== null) { emptyState.setAttribute('hidden', ''); }

        for (const word of filtered) {
            const cardEl = this._createWordCardElement(word);
            container.append(cardEl);
        }
    }

    /**
     * Generates a card element safely using DOM API.
     * @param {WordItem} word
     * @returns {HTMLElement}
     */
    _createWordCardElement(word) {
        const isChecked = word.status === 'checked';
        const card = document.createElement('article');
        card.className = 'sw-word-card';
        card.dataset.wordId = word.id || '';
        card.dataset.expression = word.expression;
        card.dataset.reading = word.reading;

        // Header
        const header = document.createElement('div');
        header.className = 'sw-card-header';

        const headwordWrap = document.createElement('div');
        headwordWrap.className = 'sw-headword-wrap';

        const headwordLine = document.createElement('div');
        headwordLine.className = 'sw-headword-line';

        const ruby = document.createElement('ruby');
        ruby.className = 'sw-ruby-term';
        ruby.append(document.createTextNode(word.expression));

        const rt = document.createElement('rt');
        rt.textContent = word.reading;
        ruby.append(rt);

        const hanvietTag = document.createElement('span');
        hanvietTag.className = 'sw-hanviet-tag';
        hanvietTag.textContent = 'TỪ VỰNG';

        headwordLine.append(ruby, hanvietTag);
        headwordWrap.append(headwordLine);

        // Actions
        const actions = document.createElement('div');
        actions.className = 'sw-card-actions';

        const audioBtn = document.createElement('button');
        audioBtn.type = 'button';
        audioBtn.className = 'sw-icon-btn sw-btn-audio';
        audioBtn.title = 'Phát âm';
        const audioIcon = document.createElement('span');
        audioIcon.className = 'icon';
        audioIcon.dataset.icon = 'speaker';
        audioBtn.append(audioIcon);
        audioBtn.addEventListener('click', () => {
            this._playAudio(word.expression, word.reading);
        });

        const checkBtn = document.createElement('button');
        checkBtn.type = 'button';
        checkBtn.className = 'sw-icon-btn sw-btn-check';
        checkBtn.title = isChecked ? 'Đã thuộc' : 'Đánh dấu đã thuộc';
        if (isChecked) {
            checkBtn.style.color = 'var(--sw-peach)';
        }
        const checkIcon = document.createElement('span');
        checkIcon.className = 'icon';
        checkIcon.dataset.icon = 'checkmark';
        checkBtn.append(checkIcon);
        checkBtn.addEventListener('click', () => {
            this._toggleStatus(word.id || '', word.expression, word.reading);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'sw-icon-btn danger sw-btn-delete';
        deleteBtn.title = 'Xóa từ khỏi sổ từ';
        const deleteIcon = document.createElement('span');
        deleteIcon.className = 'icon';
        deleteIcon.dataset.icon = 'cross';
        deleteBtn.append(deleteIcon);
        deleteBtn.addEventListener('click', () => {
            void this._deleteWord(word.id || '', word.expression, word.reading, card);
        });

        actions.append(audioBtn, checkBtn, deleteBtn);
        header.append(headwordWrap, actions);
        card.append(header);

        // Context box
        const context = word.contexts?.[0];
        const sentence = context?.sentence;
        if (typeof sentence === 'string' && sentence !== '') {
            const contextBox = document.createElement('div');
            contextBox.className = 'sw-context-box';

            const contextHeader = document.createElement('div');
            contextHeader.className = 'sw-context-header';

            const labelSpan = document.createElement('span');
            labelSpan.textContent = 'Ngữ cảnh thực tế';

            const tagSpan = document.createElement('span');
            tagSpan.textContent = '#Báo_Chí_Web';

            contextHeader.append(labelSpan, tagSpan);

            const sentenceP = document.createElement('p');
            sentenceP.className = 'sw-context-sentence';

            if (sentence.includes(word.expression)) {
                const parts = sentence.split(word.expression);
                for (let i = 0; i < parts.length; i++) {
                    if (parts[i] !== '') {
                        sentenceP.append(document.createTextNode(parts[i]));
                    }
                    if (i < parts.length - 1) {
                        const hl = document.createElement('span');
                        hl.className = 'sw-context-highlight';
                        hl.textContent = word.expression;
                        sentenceP.append(hl);
                    }
                }
            } else {
                sentenceP.textContent = sentence;
            }

            contextBox.append(contextHeader, sentenceP);
            card.append(contextBox);
        }

        // Footer with source link
        const sourceUrl = context?.sourceUrl;
        if (typeof sourceUrl === 'string' && sourceUrl !== '') {
            const footer = document.createElement('div');
            footer.className = 'sw-card-footer';

            const sourceLink = document.createElement('a');
            sourceLink.href = sourceUrl;
            sourceLink.target = '_blank';
            sourceLink.rel = 'noopener';
            sourceLink.className = 'sw-source-link';
            sourceLink.textContent = context?.sourceTitle || sourceUrl;

            const savedBadge = document.createElement('span');
            savedBadge.textContent = 'Đã lưu';

            footer.append(sourceLink, savedBadge);
            card.append(footer);
        }

        return card;
    }

    /**
     * Plays Japanese audio pronunciation using SpeechSynthesis.
     * @param {string} expression
     * @param {string} reading
     */
    _playAudio(expression, reading) {
        if (typeof window === 'undefined' || !('speechSynthesis' in window)) { return; }
        window.speechSynthesis.cancel();
        const textToSpeak = reading || expression;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.lang = 'ja-JP';
        window.speechSynthesis.speak(utterance);
    }

    /**
     * Toggles word mastery status.
     * @param {string} wordId
     * @param {string} expression
     * @param {string} reading
     */
    _toggleStatus(wordId, expression, reading) {
        for (const w of this._words) {
            if (w.expression === expression && w.reading === reading) {
                w.status = w.status === 'checked' ? 'new' : 'checked';
                break;
            }
        }
        this._updateMetrics();
        this._renderWordCards();
    }

    /**
     * Deletes a word from cache and cloud.
     * @param {string} wordId
     * @param {string} expression
     * @param {string} reading
     * @param {HTMLElement} cardEl
     */
    async _deleteWord(wordId, expression, reading, cardEl) {
        cardEl.style.opacity = '0.3';
        await this._controller.deleteSavedWord(wordId, expression, reading);
        this._words = this._words.filter((w) => !(w.expression === expression && w.reading === reading));
        this._updateMetrics();
        cardEl.remove();
        if (this._words.length === 0) {
            const emptyState = document.querySelector('#sw-empty-state');
            if (emptyState !== null) { emptyState.removeAttribute('hidden'); }
        }
    }

    /**
     * Exports words to Anki TSV format.
     */
    _exportAnki() {
        if (this._words.length === 0) { return; }
        const lines = this._words.map((w) => {
            const ctx = w.contexts?.[0]?.sentence || '';
            return `${w.expression}\t${w.reading}\t${ctx}`;
        });
        const content = lines.join('\n');
        this._downloadFile(content, 'fenixjpcatch-saved-words-anki.txt', 'text/plain;charset=utf-8');
    }

    /**
     * Exports words to CSV format.
     */
    _exportCsv() {
        if (this._words.length === 0) { return; }
        const header = 'Expression,Reading,Status,Context,SourceURL\n';
        const rows = this._words.map((w) => {
            const ctx = (w.contexts?.[0]?.sentence || '').replaceAll('"', '""');
            const url = (w.contexts?.[0]?.sourceUrl || '').replaceAll('"', '""');
            return `"${w.expression}","${w.reading}","${w.status || 'new'}","${ctx}","${url}"`;
        });
        const content = header + rows.join('\n');
        this._downloadFile(content, 'fenixjpcatch-saved-words.csv', 'text/csv;charset=utf-8');
    }

    /**
     * Helper to download file in browser.
     * @param {string} content
     * @param {string} filename
     * @param {string} mimeType
     */
    _downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], {type: mimeType});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }
}

const dashboard = new SavedWordsDashboard();
void dashboard.prepare();
