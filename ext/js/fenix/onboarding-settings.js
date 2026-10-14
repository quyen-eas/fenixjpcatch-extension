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

import {getRequiredAudioSources} from '../media/audio-downloader.js';
import {FENIX_DICTIONARIES} from './dictionary-release.js';

/**
 * Pure helpers that turn the current options into settings modifications for the first-run setup.
 * Nothing here touches the DOM or the extension APIs, so it can be unit tested directly.
 */

/**
 * @typedef {object} SpeechVoiceInfo
 * @property {string} voiceURI
 * @property {string} lang
 * @property {boolean} [localService]
 */

const TTS_SOURCE_TYPES = new Set(['text-to-speech', 'text-to-speech-reading']);

/**
 * Position at which a FenixJpCatch dictionary is inserted so that the FenixJpCatch dictionaries sit at the
 * top of the list in canonical order, regardless of the order they were installed in.
 * @param {string[]} dictionaryNames Names currently in the profile, in priority order.
 * @param {import('./dictionary-release.js').FenixDictionarySpec} spec
 * @returns {number}
 */
export function getInsertionIndex(dictionaryNames, spec) {
    const specIndex = FENIX_DICTIONARIES.findIndex(({id}) => id === spec.id);
    let index = 0;
    for (let i = 0; i < specIndex; ++i) {
        const position = dictionaryNames.indexOf(FENIX_DICTIONARIES[i].title);
        if (position >= 0) { index = Math.max(index, position + 1); }
    }
    return index;
}

/**
 * Registers a freshly imported dictionary in every profile: enabled in the current profile (like a regular
 * import) and placed above all non-FenixJpCatch dictionaries.
 * @param {import('settings').Options} optionsFull
 * @param {{title: string, sequenced: boolean, styles?: string}} summary
 * @param {import('./dictionary-release.js').FenixDictionarySpec} spec
 * @param {number} currentProfileIndex
 * @param {(name: string, enabled: boolean, styles?: string) => import('settings').DictionaryOptions} createDictionarySettings
 * @returns {import('settings-modifications').Modification[]}
 */
export function buildDictionaryModifications(optionsFull, summary, spec, currentProfileIndex, createDictionarySettings) {
    /** @type {import('settings-modifications').Modification[]} */
    const targets = [];
    const {title, sequenced, styles} = summary;
    const profiles = optionsFull.profiles;
    for (let i = 0; i < profiles.length; ++i) {
        const {dictionaries, general} = profiles[i].options;
        const names = dictionaries.map(({name}) => name);
        if (!names.includes(title)) {
            targets.push({
                action: 'splice',
                path: `profiles[${i}].options.dictionaries`,
                start: getInsertionIndex(names, spec),
                deleteCount: 0,
                items: [createDictionarySettings(title, i === currentProfileIndex, styles)],
            });
        }
        // Same rule as a regular import: the first sequenced dictionary becomes the "main" one used for merging.
        if (sequenced && general.mainDictionary === '') {
            targets.push({action: 'set', path: `profiles[${i}].options.general.mainDictionary`, value: title});
        }
    }
    return targets;
}

/**
 * @param {import('./onboarding-settings.js').SpeechVoiceInfo[]} voices
 * @returns {string|null} `voiceURI` of the best Japanese voice, or null when the browser has none.
 */
export function pickJapaneseVoice(voices) {
    const japanese = voices.filter(({lang}) => /^ja([-_]|$)/i.test(lang));
    if (japanese.length === 0) { return null; }
    const score = (/** @type {{lang: string, localService?: boolean}} */ voice) => (
        (/^ja[-_]jp$/i.test(voice.lang) ? 2 : 0) + (voice.localService === true ? 1 : 0)
    );
    let best = japanese[0];
    for (const voice of japanese) {
        if (score(voice) > score(best)) { best = voice; }
    }
    return best.voiceURI;
}

/**
 * Adds the browser's text-to-speech as the *last* audio source of every Japanese profile that has none.
 *
 * Default audio sources are appended after the sources listed in the options, so adding only the TTS entry would
 * make it the first choice. The built-in sources are therefore written out explicitly in front of it; this keeps
 * their order and does not disable anything.
 * @param {import('settings').Options} optionsFull
 * @param {string} voiceUri
 * @returns {import('settings-modifications').Modification[]}
 */
export function buildAudioFallbackModifications(optionsFull, voiceUri) {
    /** @type {import('settings-modifications').Modification[]} */
    const targets = [];
    const profiles = optionsFull.profiles;
    for (let i = 0; i < profiles.length; ++i) {
        const {audio, general} = profiles[i].options;
        if (general.language !== 'ja') { continue; }
        if (audio.sources.some(({type}) => TTS_SOURCE_TYPES.has(type))) { continue; }
        const existing = audio.sources.map(({type, url, voice}) => ({type, url, voice}));
        const builtIn = audio.enableDefaultAudioSources ? getRequiredAudioSources(general.language, existing) : [];
        targets.push({
            action: 'set',
            path: `profiles[${i}].options.audio.sources`,
            // 'text-to-speech-reading' speaks the kana reading, which is correct for kanji headwords.
            value: [...existing, ...builtIn, {type: 'text-to-speech-reading', url: '', voice: voiceUri}],
        });
    }
    return targets;
}

/**
 * @param {import('settings').Options} optionsFull
 * @returns {boolean} True when some Japanese profile still lacks a text-to-speech source.
 */
export function needsAudioFallback(optionsFull) {
    return optionsFull.profiles.some(({options: {audio, general}}) => (
        general.language === 'ja' && !audio.sources.some(({type}) => TTS_SOURCE_TYPES.has(type))
    ));
}
