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

import {describe, expect, test, vi} from 'vitest';
import {OptionsUtil} from '../../ext/js/data/options-util.js';
import {FENIX_DICTIONARIES} from '../../ext/js/fenix/dictionary-release.js';
import {
    buildAudioFallbackModifications,
    buildDictionaryModifications,
    getInsertionIndex,
    needsAudioFallback,
    pickJapaneseVoice,
} from '../../ext/js/fenix/onboarding-settings.js';
import {chrome, fetch} from '../mocks/common.js';
import {applyModifications} from './fixtures/apply-modifications.js';

vi.stubGlobal('fetch', fetch);
vi.stubGlobal('chrome', chrome);

const [TERM, KANJI] = FENIX_DICTIONARIES;

/**
 * @returns {Promise<{optionsUtil: OptionsUtil, options: import('settings').Options}>}
 */
async function createOptions() {
    const optionsUtil = new OptionsUtil();
    await optionsUtil.prepare();
    return {optionsUtil, options: optionsUtil.getDefault()};
}

/**
 * @param {string} name
 * @param {boolean} enabled
 * @param {string} [styles]
 * @returns {import('settings').DictionaryOptions}
 */
function createDictionarySettings(name, enabled, styles) {
    return {name, alias: name, enabled, allowSecondarySearches: false, definitionsCollapsible: 'not-collapsible', partsOfSpeechFilter: true, useDeinflections: true, styles: styles ?? ''};
}

describe('getInsertionIndex', () => {
    test('is 0 when no FenixJpCatch dictionary is present', () => {
        expect(getInsertionIndex(['Other', 'JMdict'], TERM)).toBe(0);
        expect(getInsertionIndex(['Other', 'JMdict'], KANJI)).toBe(0);
    });

    test('keeps the canonical order whatever the install order', () => {
        expect(getInsertionIndex([KANJI.title, 'Other'], TERM)).toBe(0);
        expect(getInsertionIndex([TERM.title, 'Other'], KANJI)).toBe(1);
        expect(getInsertionIndex(['Other', TERM.title], KANJI)).toBe(2);
    });
});

describe('buildDictionaryModifications', () => {
    test('puts the dictionary first, enabled in the current profile only, and sets the main dictionary', async () => {
        const {options} = await createOptions();
        options.profiles.push(structuredClone(options.profiles[0]));
        options.profiles[0].options.dictionaries = [createDictionarySettings('Old', true)];
        options.profiles[1].options.dictionaries = [createDictionarySettings('Old', true)];

        applyModifications(options, buildDictionaryModifications(options, {title: TERM.title, sequenced: true, styles: ''}, TERM, 0, createDictionarySettings));

        for (const [i, profile] of options.profiles.entries()) {
            expect(profile.options.dictionaries.map(({name}) => name)).toStrictEqual([TERM.title, 'Old']);
            expect(profile.options.dictionaries[0].enabled).toBe(i === 0);
            expect(profile.options.general.mainDictionary).toBe(TERM.title);
        }
    });

    test('does not set the main dictionary for a non-sequenced dictionary or overwrite an existing one', async () => {
        const {options} = await createOptions();
        applyModifications(options, buildDictionaryModifications(options, {title: KANJI.title, sequenced: false}, KANJI, 0, createDictionarySettings));
        expect(options.profiles[0].options.general.mainDictionary).toBe('');
        options.profiles[0].options.general.mainDictionary = 'Mine';
        applyModifications(options, buildDictionaryModifications(options, {title: TERM.title, sequenced: true}, TERM, 0, createDictionarySettings));
        expect(options.profiles[0].options.general.mainDictionary).toBe('Mine');
    });

    test('is a no-op when the dictionary is already listed', async () => {
        const {options} = await createOptions();
        options.profiles[0].options.dictionaries = [createDictionarySettings(TERM.title, false)];
        const targets = buildDictionaryModifications(options, {title: TERM.title, sequenced: false}, TERM, 0, createDictionarySettings);
        expect(targets).toStrictEqual([]);
    });
});

describe('pickJapaneseVoice', () => {
    test('returns null without a Japanese voice', () => {
        expect(pickJapaneseVoice([])).toBeNull();
        expect(pickJapaneseVoice([{voiceURI: 'en', lang: 'en-US'}, {voiceURI: 'jam', lang: 'jam'}])).toBeNull();
    });

    test('prefers ja-JP, then local voices', () => {
        expect(pickJapaneseVoice([
            {voiceURI: 'remote-ja', lang: 'ja', localService: false},
            {voiceURI: 'local-ja-JP', lang: 'ja_JP', localService: true},
            {voiceURI: 'remote-ja-JP', lang: 'ja-JP', localService: false},
        ])).toBe('local-ja-JP');
        expect(pickJapaneseVoice([
            {voiceURI: 'a', lang: 'ja'},
            {voiceURI: 'b', lang: 'ja-JP'},
        ])).toBe('b');
    });
});

describe('buildAudioFallbackModifications', () => {
    test('keeps existing sources first and puts text-to-speech last, after the built-in sources', async () => {
        const {options, optionsUtil} = await createOptions();
        expect(options.profiles[0].options.general.language).toBe('ja');
        expect(options.profiles[0].options.audio.sources).toStrictEqual([]);
        expect(needsAudioFallback(options)).toBe(true);

        applyModifications(options, buildAudioFallbackModifications(options, 'voice-1'));

        const types = options.profiles[0].options.audio.sources.map(({type}) => type);
        expect(types).toStrictEqual(['jpod101', 'language-pod-101', 'jisho', 'text-to-speech-reading']);
        expect(options.profiles[0].options.audio.sources.at(-1)?.voice).toBe('voice-1');
        expect(options.profiles[0].options.audio.enableDefaultAudioSources).toBe(true);
        expect(() => { optionsUtil.validate(options); }).not.toThrow();
        expect(needsAudioFallback(options)).toBe(false);
    });

    test('does not duplicate a user-configured source and respects an existing text-to-speech source', async () => {
        const {options} = await createOptions();
        options.profiles[0].options.audio.sources = [{type: 'jisho', url: '', voice: ''}];
        applyModifications(options, buildAudioFallbackModifications(options, 'v'));
        expect(options.profiles[0].options.audio.sources.map(({type}) => type)).toStrictEqual(['jisho', 'jpod101', 'language-pod-101', 'text-to-speech-reading']);

        const {options: options2} = await createOptions();
        options2.profiles[0].options.audio.sources = [{type: 'text-to-speech', url: '', voice: 'mine'}];
        expect(needsAudioFallback(options2)).toBe(false);
        expect(buildAudioFallbackModifications(options2, 'v')).toStrictEqual([]);
    });

    test('skips non-Japanese profiles', async () => {
        const {options} = await createOptions();
        options.profiles[0].options.general.language = 'de';
        expect(needsAudioFallback(options)).toBe(false);
        expect(buildAudioFallbackModifications(options, 'v')).toStrictEqual([]);
    });
});
