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
import {EventListenerCollection} from '../core/event-listener-collection.js';

export class DisplaySavedWords {
    /**
     * @param {import('./display.js').Display} display
     * @param {CloudController} [cloudController]
     */
    constructor(display, cloudController = new CloudController()) {
        /** @type {import('./display.js').Display} */
        this._display = display;
        /** @type {CloudController} */
        this._cloudController = cloudController;
        /** @type {EventListenerCollection} */
        this._eventListeners = new EventListenerCollection();
        /** @type {(event: MouseEvent) => void} */
        this._onSaveWordClickBind = this._onSaveWordClick.bind(this);
    }

    /** */
    prepare() {
        this._display.on('contentClear', this._onContentClear.bind(this));
        this._display.on('contentUpdateEntry', this._onContentUpdateEntry.bind(this));
    }

    /** */
    _onContentClear() {
        this._eventListeners.removeAllEventListeners();
    }

    /**
     * @param {import('display').EventArgument<'contentUpdateEntry'>} details
     */
    _onContentUpdateEntry({element}) {
        const buttons = element.querySelectorAll('.action-button[data-action=save-word]');
        for (const button of buttons) {
            this._eventListeners.addEventListener(button, 'click', /** @type {EventListener} */ (this._onSaveWordClickBind), false);
            void this._updateButtonState(/** @type {HTMLButtonElement} */ (button));
        }
    }

    /**
     * @param {HTMLButtonElement} button
     * @returns {number}
     */
    _getDictionaryEntryIndex(button) {
        const entry = button.closest('.entry');
        if (entry === null || !(entry instanceof HTMLElement)) { return -1; }
        return this._display.dictionaryEntryNodes.indexOf(entry);
    }

    /**
     * @param {HTMLButtonElement} button
     * @returns {Promise<void>}
     */
    async _updateButtonState(button) {
        const index = this._getDictionaryEntryIndex(button);
        if (index < 0 || index >= this._display.dictionaryEntries.length) { return; }
        const entry = this._display.dictionaryEntries[index];
        if (entry.type === 'kanji' || !entry.headwords || entry.headwords.length === 0) { return; }

        const headword = entry.headwords[0];
        const isSaved = await this._cloudController.isWordSaved(headword.term, headword.reading);
        const icon = button.querySelector('.action-icon');

        if (isSaved) {
            button.dataset.saved = 'true';
            button.title = 'Đã lưu trong sổ từ';
            if (icon !== null && icon instanceof HTMLElement) {
                icon.dataset.icon = 'star-fill';
            }
        } else {
            delete button.dataset.saved;
            button.title = 'Lưu từ vào sổ từ';
            if (icon !== null && icon instanceof HTMLElement) {
                icon.dataset.icon = 'star';
            }
        }
    }

    /**
     * @param {MouseEvent} event
     * @returns {Promise<void>}
     */
    async _onSaveWordClick(event) {
        event.preventDefault();
        event.stopPropagation();
        const button = /** @type {HTMLButtonElement} */ (event.currentTarget);
        const index = this._getDictionaryEntryIndex(button);
        if (index < 0 || index >= this._display.dictionaryEntries.length) { return; }
        const entry = this._display.dictionaryEntries[index];
        if (entry.type === 'kanji' || !entry.headwords || entry.headwords.length === 0) { return; }

        const headword = entry.headwords[0];
        const expression = headword.term;
        const reading = headword.reading;

        if (button.dataset.saved === 'true') {
            return;
        }

        button.dataset.saved = 'true';
        button.title = 'Đang lưu vào sổ từ...';
        const icon = button.querySelector('.action-icon');
        if (icon !== null && icon instanceof HTMLElement) {
            icon.dataset.icon = 'star-fill';
        }

        let jmdictSeq = null;
        if (entry.definitions) {
            for (const def of entry.definitions) {
                if (Array.isArray(def.sequences) && def.sequences.length > 0 && def.sequences[0] > 0) {
                    jmdictSeq = def.sequences[0];
                    break;
                }
            }
        }

        const {state} = this._display.history;
        /** @type {?string} */
        let contextSentence = null;
        /** @type {?string} */
        let sourceUrl = null;
        /** @type {?string} */
        let sourceTitle = null;

        if (typeof state === 'object' && state !== null) {
            const stateObj = /** @type {import('core').UnknownObject} */ (state);
            if (typeof stateObj.documentTitle === 'string') {
                sourceTitle = stateObj.documentTitle;
            }
            if (typeof stateObj.url === 'string') {
                sourceUrl = stateObj.url;
            }
            if (typeof stateObj.sentence === 'object' && stateObj.sentence !== null) {
                const sentenceObj = /** @type {import('core').UnknownObject} */ (stateObj.sentence);
                if (typeof sentenceObj.text === 'string') {
                    contextSentence = sentenceObj.text;
                }
            }
        }

        if (sourceTitle === null) { sourceTitle = document.title; }
        if (sourceUrl === null) { sourceUrl = window.location.href; }
        if (contextSentence === null) { contextSentence = this._display.fullQuery; }

        try {
            await this._cloudController.saveWord({
                expression,
                reading,
                jmdictSeq,
                contextSentence,
                sourceUrl,
                sourceTitle,
            });
            button.title = 'Đã lưu trong sổ từ';
        } catch {
            button.title = 'Đã lưu ngoại tuyến (chờ đồng bộ)';
        }
    }
}
