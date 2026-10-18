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

import {describe, expect, test} from 'vitest';
import {createMemoryStorage} from './fixtures/memory-storage.js';
import {OnboardingStateStore, createEmptyState, normalizeState} from '../../ext/js/fenix/onboarding-state.js';

describe('normalizeState', () => {
    test('falls back to an empty state for garbage', () => {
        for (const value of [void 0, null, 1, 'x', []]) {
            expect(normalizeState(value)).toStrictEqual(createEmptyState());
        }
    });

    test('keeps only well-formed entries', () => {
        expect(normalizeState({dictionaries: {a: true, b: false, c: 'yes'}, audioFallbackApplied: 'true'})).toStrictEqual({dictionaries: {a: true}, importing: {}, audioFallbackApplied: false});
        expect(normalizeState({dictionaries: {a: true}, audioFallbackApplied: true})).toStrictEqual({dictionaries: {a: true}, importing: {}, audioFallbackApplied: true});
        expect(normalizeState({importing: {a: true, b: false, c: 1}}).importing).toStrictEqual({a: true});
    });
});

describe('OnboardingStateStore', () => {
    test('persists updates', async () => {
        const store = new OnboardingStateStore(createMemoryStorage());
        expect(await store.load()).toStrictEqual(createEmptyState());
        await store.update((state) => { state.dictionaries['ja-vi'] = true; });
        await store.update((state) => { state.audioFallbackApplied = true; });
        expect(await store.load()).toStrictEqual({dictionaries: {'ja-vi': true}, importing: {}, audioFallbackApplied: true});
    });
});
