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
import {applyAudioFallback} from '../../ext/js/fenix/audio-fallback.js';
import {OnboardingStateStore} from '../../ext/js/fenix/onboarding-state.js';
import {chrome, fetch} from '../mocks/common.js';
import {applyModifications} from './fixtures/apply-modifications.js';
import {createMemoryStorage} from './fixtures/memory-storage.js';

vi.stubGlobal('fetch', fetch);
vi.stubGlobal('chrome', chrome);

const JAPANESE_VOICE = {voiceURI: 'ja-voice', lang: 'ja-JP', localService: true};

/**
 * @param {{voices?: import('../../ext/js/fenix/onboarding-settings.js').SpeechVoiceInfo[], failWith?: Error[]}} [config]
 * @returns {Promise<{options: import('settings').Options, state: OnboardingStateStore, run: () => Promise<import('../../ext/js/fenix/audio-fallback.js').AudioFallbackStatus>, config: {failWith: Error[]}}>}
 */
async function createSetup({voices = [JAPANESE_VOICE], failWith = []} = {}) {
    const optionsUtil = new OptionsUtil();
    await optionsUtil.prepare();
    const options = optionsUtil.getDefault();
    const state = new OnboardingStateStore(createMemoryStorage());
    const config = {failWith};
    const run = () => applyAudioFallback({
        getOptionsFull: async () => options,
        modifyGlobalSettings: async (targets) => {
            if (config.failWith.length > 0) { return config.failWith; }
            applyModifications(options, targets);
            return [];
        },
        state,
        getVoices: async () => voices,
    });
    return {options, state, run, config};
}

/**
 * @param {import('settings').Options} options
 * @returns {string[]}
 */
function sourceTypes(options) {
    return options.profiles[0].options.audio.sources.map(({type}) => type);
}

describe('applyAudioFallback', () => {
    test('adds text-to-speech last and records it', async () => {
        const {options, state, run} = await createSetup();
        expect(await run()).toBe('applied');
        expect(sourceTypes(options)).toStrictEqual(['jpod101', 'language-pod-101', 'jisho', 'text-to-speech-reading']);
        expect((await state.load()).audioFallbackApplied).toBe(true);
        expect(await run()).toBe('present'); // idempotent
    });

    test('P2: nothing is recorded when the settings could not be written, and the next run retries', async () => {
        const {options, state, run, config} = await createSetup({failWith: [new Error('profile changed concurrently')]});
        expect(await run()).toBe('failed');
        expect((await state.load()).audioFallbackApplied).toBe(false);
        expect(sourceTypes(options)).toStrictEqual([]);

        config.failWith = [];
        expect(await run()).toBe('applied');
        expect(sourceTypes(options).at(-1)).toBe('text-to-speech-reading');
        expect((await state.load()).audioFallbackApplied).toBe(true);
    });

    test('a failed run does not turn a later removal into a "declined" state', async () => {
        const {options, state, run, config} = await createSetup({failWith: [new Error('x')]});
        expect(await run()).toBe('failed');
        config.failWith = [];
        expect(await run()).toBe('applied');
        // The user removes it afterwards: from now on it is left alone.
        options.profiles[0].options.audio.sources = options.profiles[0].options.audio.sources.filter(({type}) => type !== 'text-to-speech-reading');
        expect(await run()).toBe('declined');
        expect(sourceTypes(options)).not.toContain('text-to-speech-reading');
        expect((await state.load()).audioFallbackApplied).toBe(true);
    });

    test('without a Japanese voice nothing is changed or recorded', async () => {
        const {options, state, run} = await createSetup({voices: [{voiceURI: 'en', lang: 'en-US'}]});
        expect(await run()).toBe('no-voice');
        expect(sourceTypes(options)).toStrictEqual([]);
        expect((await state.load()).audioFallbackApplied).toBe(false);
    });

    test('respects an existing text-to-speech source', async () => {
        const {options, state, run} = await createSetup();
        options.profiles[0].options.audio.sources = [{type: 'text-to-speech', url: '', voice: 'mine'}];
        expect(await run()).toBe('nothing-to-do');
        expect((await state.load()).audioFallbackApplied).toBe(false);
    });
});
