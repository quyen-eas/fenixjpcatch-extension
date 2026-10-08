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

import {ObjectPropertyAccessor} from '../../../ext/js/general/object-property-accessor.js';

/**
 * Applies settings modifications the way Backend._modifySetting does (only the actions the onboarding uses).
 * @param {import('settings').Options} options
 * @param {import('settings-modifications').Modification[]} targets
 * @throws {Error} For an action other than `set` and `splice`.
 */
export function applyModifications(options, targets) {
    const accessor = new ObjectPropertyAccessor(options);
    for (const target of targets) {
        if (target.action === 'set') {
            const pathArray = ObjectPropertyAccessor.getPathArray(target.path);
            accessor.set(pathArray, target.value);
        } else if (target.action === 'splice') {
            const pathArray = ObjectPropertyAccessor.getPathArray(target.path);
            const array = /** @type {unknown[]} */ (accessor.get(pathArray));
            array.splice(target.start, target.deleteCount, ...target.items);
        } else {
            throw new Error(`Unexpected action ${target.action}`);
        }
    }
}
