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

import {readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, test} from 'vitest';
import {FENIX_DICTIONARIES} from '../../ext/js/fenix/dictionary-release.js';
import {t} from '../../ext/js/fenix/i18n.js';
import {MESSAGES_VI} from '../../ext/js/fenix/messages-vi.js';

const extDir = join(fileURLToPath(new URL('.', import.meta.url)), '../../ext');

/**
 * @param {string} path
 * @returns {string}
 */
function read(path) {
    return readFileSync(join(extDir, path), 'utf8');
}

/** @returns {string[]} */
function getFenixPages() {
    return readdirSync(extDir).filter((name) => /^fenix-.*\.html$/.test(name));
}

describe('t()', () => {
    test('interpolates placeholders and leaves unknown ones intact', () => {
        const messages = {a: 'Xin chào {name}, {n} lần, {missing}'};
        expect(t('a', {name: 'Linh', n: 3}, messages)).toBe('Xin chào Linh, 3 lần, {missing}');
    });

    test('returns the key for unknown keys, never prototype properties', () => {
        expect(t('no.such.key', {}, {})).toBe('no.such.key');
        expect(t('constructor', {}, {})).toBe('constructor');
    });
});

describe('message table', () => {
    test('every key used in the pages exists', () => {
        const pages = getFenixPages();
        expect(pages.length).toBeGreaterThanOrEqual(2);
        for (const page of pages) {
            const html = read(page);
            for (const [, key] of html.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)) {
                expect.soft(MESSAGES_VI, `${page}: ${key}`).toHaveProperty([key]);
            }
        }
    });

    test('every key used from scripts exists', () => {
        const dir = join(extDir, 'js/fenix');
        for (const name of readdirSync(dir).filter((file) => file.endsWith('.js') && file !== 'messages-vi.js')) {
            const source = read(`js/fenix/${name}`);
            for (const [, key] of source.matchAll(/\bt\('([\w.]+)'/g)) {
                expect.soft(MESSAGES_VI, `${name}: ${key}`).toHaveProperty([key]);
            }
        }
        // Keys that are assembled at run time.
        for (const key of ['status.error.download', 'status.error.import', 'status.error.settings']) {
            expect(MESSAGES_VI).toHaveProperty([key]);
        }
        for (const {labelKey} of FENIX_DICTIONARIES) {
            expect(MESSAGES_VI).toHaveProperty([labelKey]);
            expect(MESSAGES_VI).toHaveProperty([labelKey.replace(/\.name$/, '.description')]);
        }
    });

    test('static <title> fallback matches the translated title', () => {
        for (const page of getFenixPages()) {
            const html = read(page);
            const match = /<title data-i18n="([^"]+)">([^<]*)<\/title>/.exec(html);
            expect(match, page).not.toBeNull();
            expect(match?.[2], page).toBe(MESSAGES_VI[match?.[1] ?? '']);
        }
    });

    test('placeholders used in messages are the ones the code supplies', () => {
        const allowed = new Set(['version', 'percent', 'step', 'steps', 'detail']);
        for (const [key, message] of Object.entries(MESSAGES_VI)) {
            for (const [, name] of message.matchAll(/\{(\w+)\}/g)) {
                expect.soft(allowed.has(name), `${key}: {${name}}`).toBe(true);
            }
        }
    });
});
