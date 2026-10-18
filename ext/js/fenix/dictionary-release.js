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

/**
 * Naming convention of the dictionaries that FenixJpCatch installs on first run.
 * Must stay in sync with docs/dictionary-release.md (the dictionary build pipeline builds the
 * archives to exactly this convention).
 */

/** GitHub repository whose releases host the dictionary archives. */
export const RELEASE_REPOSITORY = 'quyen-eas/fenixjpcatch-extension';

/** Rolling tag that always points to the latest dictionary release. */
export const DICTIONARY_LATEST_TAG = 'dict-latest';

/** Base URL; points to the rolling Release tag dict-latest instead of releases/latest. */
export const RELEASE_DOWNLOAD_BASE_URL = `https://github.com/${RELEASE_REPOSITORY}/releases/download/${DICTIONARY_LATEST_TAG}`;

/**
 * @typedef {object} FenixDictionarySpec
 * @property {string} id Stable identifier, used in the onboarding state.
 * @property {'term'|'kanji'} kind
 * @property {string} fileName Release asset name of the zip archive.
 * @property {string} title `title` in the archive's index.json; this is the dictionary name inside Yomitan.
 * @property {string} labelKey i18n key of the display name.
 */

/**
 * In priority order: the first entry gets the highest priority in the profile's dictionary list.
 * @type {FenixDictionarySpec[]}
 */
export const FENIX_DICTIONARIES = [
    {id: 'ja-vi', kind: 'term', fileName: 'fenixjpcatch-ja-vi.zip', title: 'FenixJpCatch JA-VI', labelKey: 'dictionary.jaVi.name'},
    {id: 'kanji-vi', kind: 'kanji', fileName: 'fenixjpcatch-kanji-vi.zip', title: 'FenixJpCatch Kanji-VI', labelKey: 'dictionary.kanjiVi.name'},
];

/**
 * @param {FenixDictionarySpec} spec
 * @returns {string}
 */
export function getDictionaryDownloadUrl(spec) {
    return `${RELEASE_DOWNLOAD_BASE_URL}/${spec.fileName}`;
}

/**
 * URL of the standalone index.json of the latest revision, for Yomitan's "Check updates".
 * @param {FenixDictionarySpec} spec
 * @returns {string}
 */
export function getDictionaryIndexUrl(spec) {
    return `${RELEASE_DOWNLOAD_BASE_URL}/${spec.fileName.replace(/\.zip$/, '')}.index.json`;
}
