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

import {test as base, chromium} from '@playwright/test';
import path from 'path';
import {fileURLToPath} from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const root = path.join(dirname, '..', '..');

/** URLs of the FenixJpCatch dictionary release assets (see docs/dictionary-release.md). */
export const FENIX_RELEASE_URL_PATTERN = /^https:\/\/github\.com\/quyen-eas\/fenixjpcatch-extension\/releases\//;

export const test = base.extend({
    // eslint-disable-next-line no-empty-pattern
    context: async ({}, /** @type {(r: import('playwright').BrowserContext) => Promise<void>} */ use) => {
        const pathToExtension = path.join(root, 'ext');
        const context = await chromium.launchPersistentContext('', {
            // Disabled: headless: false,
            args: [
                '--headless=new',
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
            ],
        });
        // Modified by FenixJpCatch: the first-run welcome page downloads the bundled dictionaries from the GitHub Release;
        // tests must never depend on (or write data from) the network. fenix-onboarding.spec.js registers its own route on top of this one.
        await context.route(FENIX_RELEASE_URL_PATTERN, (route) => route.abort());
        await use(context);
        await context.close();
    },
    extensionId: async ({context}, use) => {
        let [background] = context.serviceWorkers();
        if (!background) {
            background = await context.waitForEvent('serviceworker');
        }

        const extensionId = background.url().split('/')[2];
        await use(extensionId);
    },
});

export const expect = test.expect;

/**
 * @returns {Map<string, string>}
 */
export function getMockModelFields() {
    return new Map([
        ['Word', '{expression}'],
        ['Reading', '{furigana-plain}'],
        ['Sentence', '{clipboard-text}'],
        ['Audio', '{audio}'],
    ]);
}

/**
 * @param {import('playwright').Route} route
 * @returns {Promise<void>}
 */
export async function mockAnkiRouteHandler(route) {
    try {
        /** @type {unknown} */
        const requestJson = route.request().postDataJSON();
        if (typeof requestJson !== 'object' || requestJson === null) {
            throw new Error(`Invalid request type: ${typeof requestJson}`);
        }
        const {action, params} = /** @type {import('core').SerializableObject} */ (requestJson);
        const body = getResponseBody(action, params);
        const responseJson = {
            status: 200,
            contentType: 'text/json',
            body: JSON.stringify(body),
        };
        await route.fulfill(responseJson);
    } catch {
        return await route.abort();
    }
}

/**
 * @param {import('playwright').Page} page
 * @param {string} text
 * @returns {Promise<void>}
 */
export const writeToClipboardFromPage = async (page, text) => {
    await page.evaluate(`navigator.clipboard.writeText('${text}')`);
};

/**
 * @returns {Record<string, unknown>}
 */
export function getExpectedAddNoteBody() {
    return {
        version: 2,
        action: 'addNote',
        params: {
            note: {
                fields: {
                    Word: '読む',
                    Reading: '読[よ]む',
                    Audio: '[sound:mock_audio.mp3]',
                    Sentence: '読むの例文',
                },
                tags: ['yomitan'],
                deckName: 'Mock Deck',
                modelName: 'Mock Model',
                options: {
                    allowDuplicate: true,
                    duplicateScope: 'collection',
                    duplicateScopeOptions: {
                        deckName: null,
                        checkChildren: false,
                        checkAllModels: false,
                    },
                },
            },
        },
    };
}

/**
 * @param {unknown} params
 * @returns {unknown[]} One placeholder per note of an Anki Connect request.
 */
function countNotes(params) {
    const notes = typeof params === 'object' && params !== null ? /** @type {Record<string, unknown>} */ (params).notes : null;
    return Array.isArray(notes) ? /** @type {unknown[]} */ (notes) : [];
}

/**
 * @param {unknown} action
 * @param {unknown} params
 * @returns {unknown}
 * @throws {Error}
 */
function getResponseBody(action, params) {
    switch (action) {
        case 'version': return 6;
        case 'deckNames': return ['Mock Deck'];
        case 'modelNames': return ['Mock Model'];
        case 'modelFieldNames': return [...getMockModelFields().keys()];
        // Modified by FenixJpCatch: answer once per submitted note. The mock used to return a fixed two entries, but Yomitan
        // rejects a reply whose length differs from the number of notes, so with one note the add-note button never showed
        // (integration.spec "anki add" failed identically on upstream's code at the fork base, locally and on CI).
        case 'canAddNotes': return countNotes(params).map(() => true);
        case 'canAddNotesWithErrorDetail': return countNotes(params).map(() => ({canAdd: true}));
        case 'storeMediaFile': return 'mock_audio.mp3';
        case 'addNote': return 102312488912;
        case 'multi': return [];
        default: throw new Error(`Unknown action: ${action}`);
    }
}
