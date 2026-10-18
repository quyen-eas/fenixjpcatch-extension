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

import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, test} from 'vitest';
import {
    FENIX_DICTIONARIES,
    RELEASE_DOWNLOAD_BASE_URL,
    RELEASE_REPOSITORY,
    getDictionaryDownloadUrl,
    getDictionaryIndexUrl,
} from '../../ext/js/fenix/dictionary-release.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '../..');

describe('Dictionary release convention', () => {
    test('URLs point at the rolling dict-latest release of this repository', () => {
        expect(RELEASE_REPOSITORY).toBe('quyen-eas/fenixjpcatch-extension');
        expect(RELEASE_DOWNLOAD_BASE_URL).toBe('https://github.com/quyen-eas/fenixjpcatch-extension/releases/download/dict-latest');
        const [term, kanji] = FENIX_DICTIONARIES;
        expect(getDictionaryDownloadUrl(term)).toBe('https://github.com/quyen-eas/fenixjpcatch-extension/releases/download/dict-latest/fenixjpcatch-ja-vi.zip');
        expect(getDictionaryDownloadUrl(kanji)).toBe('https://github.com/quyen-eas/fenixjpcatch-extension/releases/download/dict-latest/fenixjpcatch-kanji-vi.zip');
        expect(getDictionaryIndexUrl(term)).toBe('https://github.com/quyen-eas/fenixjpcatch-extension/releases/download/dict-latest/fenixjpcatch-ja-vi.index.json');
    });

    test('term dictionary has the highest priority and the documented title', () => {
        expect(FENIX_DICTIONARIES.map(({id, kind}) => [id, kind])).toStrictEqual([['ja-vi', 'term'], ['kanji-vi', 'kanji']]);
        expect(FENIX_DICTIONARIES.map(({title}) => title)).toStrictEqual(['FenixJpCatch JA-VI', 'FenixJpCatch Kanji-VI']);
    });

    test('docs/dictionary-release.md documents every file name, title and URL', () => {
        const doc = readFileSync(join(root, 'docs/dictionary-release.md'), 'utf8');
        for (const spec of FENIX_DICTIONARIES) {
            expect.soft(doc).toContain(spec.fileName);
            expect.soft(doc).toContain(spec.title);
            expect.soft(doc).toContain(getDictionaryDownloadUrl(spec));
            expect.soft(doc).toContain(getDictionaryIndexUrl(spec));
        }
    });
});
