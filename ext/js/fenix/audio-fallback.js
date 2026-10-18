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

import {buildAudioFallbackModifications, needsAudioFallback, pickJapaneseVoice} from './onboarding-settings.js';

/**
 * @typedef {'present'|'applied'|'declined'|'no-voice'|'nothing-to-do'|'failed'} AudioFallbackStatus
 * - `present`: a text-to-speech source is configured (added by an earlier run)
 * - `applied`: added now
 * - `declined`: it was added before and the user has removed it since; left alone
 * - `no-voice`: the browser has no Japanese voice yet; tried again on the next run
 * - `nothing-to-do`: no Japanese profile needs it
 * - `failed`: the settings could not be written; nothing is recorded, so the next run tries again
 */

/**
 * First-run audio default: adds the browser's text-to-speech as the last audio source.
 * `audioFallbackApplied` is persisted only after every settings modification succeeded.
 * @param {object} deps
 * @param {() => Promise<import('settings').Options>} deps.getOptionsFull
 * @param {(targets: import('settings-modifications').Modification[]) => Promise<Error[]>} deps.modifyGlobalSettings Resolves with the errors of the modifications that failed.
 * @param {import('./onboarding-state.js').OnboardingStateStore} deps.state
 * @param {() => Promise<import('./onboarding-settings.js').SpeechVoiceInfo[]>} deps.getVoices
 * @returns {Promise<AudioFallbackStatus>}
 */
export async function applyAudioFallback({getOptionsFull, modifyGlobalSettings, state, getVoices}) {
    const optionsFull = await getOptionsFull();
    const {audioFallbackApplied} = await state.load();
    if (!needsAudioFallback(optionsFull)) {
        return audioFallbackApplied ? 'present' : 'nothing-to-do';
    }
    if (audioFallbackApplied) { return 'declined'; }

    const voiceUri = pickJapaneseVoice(await getVoices());
    if (voiceUri === null) { return 'no-voice'; }
    const targets = buildAudioFallbackModifications(optionsFull, voiceUri);
    if (targets.length === 0) { return 'nothing-to-do'; }

    const errors = await modifyGlobalSettings(targets);
    if (errors.length > 0) { return 'failed'; }
    await state.update((s) => { s.audioFallbackApplied = true; });
    return 'applied';
}
