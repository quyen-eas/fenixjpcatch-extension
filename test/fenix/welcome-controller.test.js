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

import path from 'path';
import {fileURLToPath} from 'url';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {setupDomTest} from '../fixtures/dom-test.js';
import {WelcomeController} from '../../ext/js/fenix/welcome-controller.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const welcomeHtmlPath = path.join(dirname, '..', '..', 'ext', 'fenix-welcome.html');

describe('WelcomeController showGuide handling', () => {
    /** @type {(() => Promise<void>)|null} */
    let teardown = null;

    beforeEach(async () => {
        const dom = await setupDomTest(welcomeHtmlPath);
        teardown = () => Promise.resolve(dom.teardown(global));
    });

    afterEach(async () => {
        if (teardown) {
            await teardown();
            teardown = null;
        }
    });

    test('_disableShowGuide sets general.showGuide to false', async () => {
        /** @type {unknown[]} */
        const recorded = [];
        /**
         * @param {unknown} targets
         * @returns {Promise<Error[]>}
         */
        const modifyGlobalSettings = vi.fn(async (targets) => {
            if (Array.isArray(targets)) {
                for (const target of targets) {
                    recorded.push(target);
                }
            }
            return [];
        });

        const controller = /** @type {any} */ (new WelcomeController({
            installer: /** @type {any} */ ({}),
            state: /** @type {any} */ ({}),
            settingsController: /** @type {any} */ ({}),
            modifyGlobalSettings,
            getVoices: async () => [],
        }));

        // eslint-disable-next-line no-underscore-dangle
        await controller._disableShowGuide();

        expect(modifyGlobalSettings).toHaveBeenCalledTimes(1);
        expect(recorded).toEqual([{action: 'set', path: 'general.showGuide', value: false}]);
    });

    test('_disableShowGuide gracefully catches errors without throwing', async () => {
        /**
         * @returns {Promise<Error[]>}
         */
        const modifyGlobalSettings = vi.fn(async () => {
            throw new Error('Storage write failed');
        });

        const controller = /** @type {any} */ (new WelcomeController({
            installer: /** @type {any} */ ({}),
            state: /** @type {any} */ ({}),
            settingsController: /** @type {any} */ ({}),
            modifyGlobalSettings,
            getVoices: async () => [],
        }));

        // eslint-disable-next-line no-underscore-dangle
        await expect(controller._disableShowGuide()).resolves.toBeUndefined();
    });
});
