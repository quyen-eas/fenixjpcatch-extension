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

import {parseJson} from '../../dev/json.js';
import {FENIX_DICTIONARIES, getDictionaryDownloadUrl, getDictionaryIndexUrl} from '../../ext/js/fenix/dictionary-release.js';
import {createFixtureArchive, createFixtureFiles} from '../fenix/fixtures/dictionary-fixtures.js';
import {FENIX_RELEASE_URL_PATTERN, expect, test} from './playwright-util.js';

/**
 * Serves the fixture dictionaries in place of the GitHub Release and counts the requests.
 * @param {import('playwright').BrowserContext} context
 * @returns {Promise<{requests: string[]}>}
 */
async function serveFixtureRelease(context) {
    /** @type {Map<string, {body: Buffer, contentType: string}>} */
    const assets = new Map();
    for (const spec of FENIX_DICTIONARIES) {
        assets.set(getDictionaryDownloadUrl(spec), {body: Buffer.from(await createFixtureArchive(spec.id)), contentType: 'application/zip'});
        assets.set(getDictionaryIndexUrl(spec), {body: Buffer.from(JSON.stringify(createFixtureFiles(spec.id).get('index.json'))), contentType: 'application/json'});
    }
    /** @type {string[]} */
    const requests = [];
    await context.route(FENIX_RELEASE_URL_PATTERN, async (route) => {
        const url = route.request().url();
        const asset = assets.get(url);
        if (typeof asset === 'undefined') {
            await route.fulfill({status: 404, body: 'Not Found'});
            return;
        }
        requests.push(url);
        await route.fulfill({status: 200, body: asset.body, headers: {'content-type': asset.contentType, 'access-control-allow-origin': '*'}});
    });
    return {requests};
}

/**
 * @param {import('playwright').BrowserContext} context
 * @param {string} extensionId
 * @returns {Promise<import('playwright').Page>} The welcome tab that the extension opens on install.
 */
async function getWelcomePage(context, extensionId) {
    const url = `chrome-extension://${extensionId}/fenix-welcome.html`;
    const existing = context.pages().find((page) => page.url() === url);
    if (typeof existing !== 'undefined') { return existing; }
    const page = await context.waitForEvent('page');
    await page.waitForURL(url);
    return page;
}

test('first run installs the bundled dictionaries and they can be looked up', async ({context, extensionId}) => {
    const release = await serveFixtureRelease(context);
    const welcome = await getWelcomePage(context, `${extensionId}`);

    // The Vietnamese welcome page replaces the original one as the on-install page.
    await expect(welcome.locator('h1')).toHaveText('Chào mừng đến với FenixJpCatch');
    await expect(welcome.locator('html')).toHaveAttribute('data-fenix-setup', 'done', {timeout: 30000});
    const rows = welcome.locator('.fenix-dictionary-row');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('.fenix-dictionary-status')).toHaveText('Đã cài đặt');
    await expect(rows.nth(1).locator('.fenix-dictionary-status')).toHaveText('Đã cài đặt');
    await expect(welcome.locator('#fenix-dictionary-summary')).toContainText('Từ điển đã sẵn sàng');
    await expect(welcome.getByText('Shift + rê chuột')).toBeVisible();
    await expect(welcome.getByText('Sắp có nút ☆')).toBeVisible();

    // Both dictionaries are registered above everything else, enabled, term dictionary first.
    const optionsString = await welcome.evaluate(async () => {
        const {options} = /** @type {{options: string}} */ (await chrome.storage.local.get('options')); // stored as a JSON string
        return options;
    });
    const options = /** @type {import('settings').Options} */ (parseJson(optionsString));
    const {dictionaries, general} = options.profiles[options.profileCurrent].options;
    const names = {dictionaries: dictionaries.map(({name, enabled}) => [name, enabled]), main: general.mainDictionary};
    expect(names.dictionaries).toStrictEqual([['FenixJpCatch JA-VI', true], ['FenixJpCatch Kanji-VI', true]]);
    expect(names.main).toBe('FenixJpCatch JA-VI');
    expect(general.showGuide).toBe(false);

    // Lookup works against the imported data, including deinflection of a conjugated form.
    const search = await context.newPage();
    await search.goto(`chrome-extension://${extensionId}/search.html`);
    await search.locator('#search-textbox').fill('食べた');
    await search.locator('#search-textbox').press('Enter');
    await expect(search.locator('.entry').first()).toContainText('nghĩa mẫu của 食べる', {timeout: 15000});
    await search.close();

    // A second visit downloads nothing and shows the dictionaries as installed.
    const downloadCount = release.requests.length;
    expect(downloadCount).toBe(2);
    await welcome.reload();
    await expect(welcome.locator('html')).toHaveAttribute('data-fenix-setup', 'done', {timeout: 30000});
    await expect(welcome.locator('.fenix-dictionary-status').first()).toHaveText('Đã cài đặt');
    expect(release.requests).toHaveLength(downloadCount);

    // The original Yomitan setup page is still available, and so is the About page.
    await welcome.goto(`chrome-extension://${extensionId}/welcome.html`);
    // welcome.html has several <h1> (its modal titles appear once its scripts have run), so match by name, not by tag.
    await expect(welcome.getByRole('heading', {level: 1, name: 'Welcome to Yomitan!'})).toBeVisible();
    await welcome.goto(`chrome-extension://${extensionId}/fenix-about.html`);
    await expect(welcome.locator('h1')).toHaveText('FenixJpCatch');
    await expect(welcome.locator('body')).toContainText('Based on Yomitan');
    for (const source of ['JMdict', 'KANJIDIC2', 'KRADFILE', 'wordfreq']) {
        await expect(welcome.locator('body')).toContainText(source);
    }
    await expect(welcome.locator('a[href="https://github.com/quyen-eas/fenixjpcatch-extension"]')).toBeVisible();
});

test('a failed download shows a retry button and the next attempt succeeds', async ({context, extensionId}) => {
    // Default route from playwright-util aborts every release request.
    const welcome = await getWelcomePage(context, `${extensionId}`);
    await expect(welcome.locator('html')).toHaveAttribute('data-fenix-setup', 'done', {timeout: 30000});
    const rows = welcome.locator('.fenix-dictionary-row');
    await expect(rows.nth(0).locator('.fenix-dictionary-status')).toContainText('Không tải được từ điển');
    await expect(rows.nth(0).locator('.fenix-dictionary-action')).toHaveText('Thử lại');
    await expect(welcome.locator('#fenix-dictionary-summary')).toContainText('Chưa có đủ từ điển');

    await serveFixtureRelease(context);
    await rows.nth(0).locator('.fenix-dictionary-action').click();
    await expect(rows.nth(0).locator('.fenix-dictionary-status')).toHaveText('Đã cài đặt', {timeout: 30000});
});
