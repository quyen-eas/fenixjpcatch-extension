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

            const logoutBtn = document.createElement('button');
            logoutBtn.type = 'button';
            logoutBtn.className = 'sw-auth-btn';
            logoutBtn.id = 'sw-logout-btn';
            logoutBtn.style.marginLeft = '8px';
            logoutBtn.textContent = 'Đăng xuất';
            logoutBtn.addEventListener('click', async () => {
                await this._controller.logout();
                await this._renderAuthState();
                await this._loadWords();
            });

            profileWrap.append(avatar, nameSpan, logoutBtn);
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
            const loginBtn = document.createElement('button');
            loginBtn.type = 'button';
            loginBtn.className = 'sw-auth-btn';
            loginBtn.id = 'sw-login-btn';
            loginBtn.textContent = 'Đăng nhập Google';
            loginBtn.addEventListener('click', async () => {
                await this._handleLogin();
            });
            container.append(loginBtn);

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
        const mockAuth = {
            token: `token_${Date.now()}`,
            user: {
                uid: 'usr_demo123',
                displayName: 'Fenix Learner',
                email: 'learner@fenixjpcatch.local',
            },
            expiresAt: Date.now() + 86400000,
        };
        await this._controller.setAuthState(mockAuth);
        await this._renderAuthState();
        await this._handleSync();
    }

    /**
     * Handles manual sync.
     */
    async _handleSync() {
        const syncText = document.querySelector('#sw-sync-text');
        if (syncText !== null) { syncText.textContent = 'Đang đồng bộ...'; }

        try {
            const {processed} = await this._controller.syncQueue();
            await this._loadWords();
            if (syncText !== null) {
                syncText.textContent = processed > 0 ? `Đã đồng bộ (${processed} mới)` : 'Đã đồng bộ';
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
