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

import {MESSAGES_VI} from './messages-vi.js';

/**
 * Minimal i18n layer for the pages added by FenixJpCatch. There is a single locale (Vietnamese); the lookup goes
 * through a table so that strings stay out of the markup and out of the logic.
 *
 * Markup attributes (resolved by `applyTranslations`):
 * - `data-i18n="key"`: sets `textContent`
 * - `data-i18n-title="key"`, `data-i18n-aria-label="key"`: set the matching attribute
 */

/**
 * @param {string} key
 * @param {Record<string, string|number>} [params] Values for `{name}` placeholders.
 * @param {Readonly<Record<string, string>>} [messages]
 * @returns {string} The message, or the key itself when it is unknown (a missing key is then visible in the UI).
 */
export function t(key, params = {}, messages = MESSAGES_VI) {
    const message = Object.hasOwn(messages, key) ? messages[key] : key;
    return message.replaceAll(/\{(\w+)\}/g, (/** @type {string} */ match, /** @type {string} */ name) => (Object.hasOwn(params, name) ? String(params[name]) : match));
}

/**
 * Translates every annotated element below `root`.
 * @param {ParentNode} [root]
 */
export function applyTranslations(root = document) {
    for (const node of root.querySelectorAll('[data-i18n]')) {
        node.textContent = t(/** @type {HTMLElement} */ (node).dataset.i18n ?? '');
    }
    for (const attribute of ['title', 'aria-label']) {
        const dataAttribute = `data-i18n-${attribute}`;
        for (const node of root.querySelectorAll(`[${dataAttribute}]`)) {
            node.setAttribute(attribute, t(node.getAttribute(dataAttribute) ?? ''));
        }
    }
}
