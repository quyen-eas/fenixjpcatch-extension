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

import {BlobWriter, TextReader, ZipWriter} from '@zip.js/zip.js';
import {FENIX_DICTIONARIES, getDictionaryDownloadUrl, getDictionaryIndexUrl} from '../../../ext/js/fenix/dictionary-release.js';

/**
 * Small, well-formed stand-ins for the real FenixJpCatch dictionaries (which are built in the platform repository).
 * They exist only to exercise download → import → registration; every gloss is marked as test data and none of the
 * content is meant to be correct dictionary material. Sequence numbers start at 9,000,001 so they can never be
 * mistaken for real JMdict `ent_seq` values.
 */

const FIXTURE_SEQUENCE_BASE = 9000000;

/** `expression|reading|rules|tags` */
const TERMS = [
    '食べる|たべる|v1|v1',
    '飲む|のむ|v5|v5',
    '行く|いく|v5|v5',
    '見る|みる|v1|v1',
    'する|する|vs|vs',
    '来る|くる|vk|vk',
    '言う|いう|v5|v5',
    '読む|よむ|v5|v5',
    '書く|かく|v5|v5',
    '勉強|べんきょう|vs|n',
    '日本語|にほんご||n',
    '学校|がっこう||n',
    '先生|せんせい||n',
    '学生|がくせい||n',
    '大きい|おおきい|adj-i|adj-i',
    '小さい|ちいさい|adj-i|adj-i',
    '新しい|あたらしい|adj-i|adj-i',
    '高い|たかい|adj-i|adj-i',
    '美しい|うつくしい|adj-i|adj-i',
    '水|みず||n',
    '火|ひ||n',
    '山|やま||n',
    '川|かわ||n',
    '本|ほん||n',
    '人|ひと||n',
    '時間|じかん||n',
    '電車|でんしゃ||n',
    '天気|てんき||n',
    '今日|きょう||n',
    '明日|あした||n',
].map((row) => row.split('|'));

/** `character|onyomi|kunyomi` */
const KANJI = [
    '日|ニチ ジツ|ひ か',
    '月|ゲツ ガツ|つき',
    '火|カ|ひ',
    '水|スイ|みず',
    '木|モク ボク|き',
    '金|キン コン|かね',
    '土|ド ト|つち',
    '山|サン|やま',
    '川|セン|かわ',
    '人|ジン ニン|ひと',
    '本|ホン|もと',
    '学|ガク|まな.ぶ',
    '校|コウ|',
    '先|セン|さき',
    '生|セイ ショウ|い.きる う.まれる',
    '大|ダイ タイ|おお.きい',
    '小|ショウ|ちい.さい',
    '新|シン|あたら.しい',
    '高|コウ|たか.い',
    '時|ジ|とき',
].map((row) => row.split('|'));

/**
 * @param {import('../../../ext/js/fenix/dictionary-release.js').FenixDictionarySpec} spec
 * @param {string} revision
 * @returns {import('dictionary-data').Index}
 */
function createIndex(spec, revision) {
    return {
        title: spec.title,
        format: 3,
        revision,
        sequenced: spec.kind === 'term',
        author: 'FenixJpCatch test fixture',
        description: 'Test fixture. Not real dictionary data.',
        isUpdatable: true,
        indexUrl: getDictionaryIndexUrl(spec),
        downloadUrl: getDictionaryDownloadUrl(spec),
        sourceLanguage: 'ja',
        targetLanguage: 'vi',
    };
}

/**
 * Returns the files (name → JSON-serializable content) of a fixture dictionary.
 * @param {string} id Dictionary id from FENIX_DICTIONARIES.
 * @param {string} [revision]
 * @returns {Map<string, unknown>}
 * @throws {Error} For an unknown dictionary id.
 */
export function createFixtureFiles(id, revision = 'fixture-1') {
    const spec = FENIX_DICTIONARIES.find((item) => item.id === id);
    if (typeof spec === 'undefined') { throw new Error(`Unknown dictionary id: ${id}`); }
    /** @type {Map<string, unknown>} */
    const files = new Map();
    files.set('index.json', createIndex(spec, revision));
    if (spec.kind === 'term') {
        files.set('tag_bank_1.json', [
            ['n', 'partOfSpeech', 0, 'noun', 0],
            ['v1', 'partOfSpeech', 0, 'ichidan verb', 0],
            ['v5', 'partOfSpeech', 0, 'godan verb', 0],
            ['vs', 'partOfSpeech', 0, 'suru verb', 0],
            ['vk', 'partOfSpeech', 0, 'kuru verb', 0],
            ['adj-i', 'partOfSpeech', 0, 'i-adjective', 0],
        ]);
        files.set('term_bank_1.json', TERMS.map(([expression, reading, rules, tags], i) => [
            expression, reading, tags, rules, 0, [`[dữ liệu thử] nghĩa mẫu của ${expression}`], FIXTURE_SEQUENCE_BASE + i + 1, '',
        ]));
    } else {
        files.set('kanji_bank_1.json', KANJI.map(([character, onyomi, kunyomi]) => [
            character, onyomi, kunyomi, '', [`[dữ liệu thử] nghĩa mẫu của ${character}`], {},
        ]));
    }
    return files;
}

/**
 * Builds the zip archive of a fixture dictionary.
 * @param {string} id Dictionary id from FENIX_DICTIONARIES.
 * @param {string} [revision]
 * @returns {Promise<ArrayBuffer>}
 */
export async function createFixtureArchive(id, revision) {
    const writer = new ZipWriter(new BlobWriter(), {level: 0}); // Level 0: no decompression support in Node (see dev/lib/zip.js).
    for (const [name, content] of createFixtureFiles(id, revision)) {
        await writer.add(name, new TextReader(JSON.stringify(content)));
    }
    return await (await writer.close()).arrayBuffer();
}


export const FIXTURE_TERM_COUNT = TERMS.length;

export const FIXTURE_KANJI_COUNT = KANJI.length;
