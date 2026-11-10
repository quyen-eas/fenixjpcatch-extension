/*
 * Copyright (C) 2023-2026  Yomitan Authors
 * Copyright (C) 2019-2022  Yomichan Authors
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

import {ExtensionError} from '../core/extension-error.js';
import {safePerformance} from '../core/safe-performance.js';
import {getDisambiguations, getGroupedPronunciations, getTermFrequency, groupKanjiFrequencies, groupTermFrequencies, groupTermTags, isNonNounVerbOrAdjective} from '../dictionary/dictionary-data-util.js';
import {HtmlTemplateCollection} from '../dom/html-template-collection.js';
import {distributeFurigana, getKanaMorae, getPitchCategory, isCodePointKanji} from '../language/ja/japanese.js';
import {getLanguageFromText} from '../language/text-utilities.js';
import {PronunciationGenerator} from './pronunciation-generator.js';
import {StructuredContentGenerator} from './structured-content-generator.js';

/** @type {Readonly<Record<string, string>>} */
const FENIX_POS_LABELS_VI = Object.freeze({
    'n': 'Danh từ',
    'vs': 'Động từ する',
    'vi': 'Tự động từ',
    'vt': 'Tha động từ',
    'adj-i': 'Tính từ -い',
    'adj-na': 'Tính từ -な',
    'adj-no': 'Danh từ の',
    'adj-pn': 'ịnh từ',
    'adj-t': 'Tính từ -たる',
    'adv': 'Trạng từ',
    'adv-to': 'Trạng từ と',
    'exp': 'Cụm từ',
    'pn': 'Đại từ',
    'prt': 'Trợ từ',
    'conj': 'Liên từ',
    'int': 'Thán từ',
    'suf': 'Hậu tố',
    'pref': 'Tiền tố',
    'ctr': 'Lượng từ',
    'v1': 'Động từ nhóm 2',
    'vk': 'Động từ 来る',
    'v5u': 'Động từ nhóm 1',
    'v5k': 'Động từ nhóm 1',
    'v5g': 'Động từ nhóm 1',
    'v5s': 'Động từ nhóm 1',
    'v5t': 'Động từ nhóm 1',
    'v5n': 'Động từ nhóm 1',
    'v5b': 'Động từ nhóm 1',
    'v5m': 'Động từ nhóm 1',
    'v5r': 'Động từ nhóm 1',
    'P': 'Phổ biến ★',
});

/**
 * Curated enrichment for featured/common vocabulary where JMdict Vietnamese glosses
 * or pitch/JLPT metadata are incomplete in the base archive.
 * @type {Readonly<Record<string, {vi?: string, jlpt?: string, pitch?: number, popular?: boolean, kanjiSummary?: string, exampleJa?: string, exampleVi?: string}>>}
 */
const FENIX_CURATED_TERMS = Object.freeze({
    満開: {
        vi: 'Nở rộ, nở bung hoàn toàn (đặc trưng dùng cho hoa anh đào, hoa mùa xuân nở hết cỡ).',
        jlpt: 'JLPT N3',
        pitch: 0,
        popular: true,
        kanjiSummary: '満 (MÃN: đầy đặn, sung mãn, trọn vẹn) + 開 (KHAI: mở ra, hé mở, khai hoa) → Hoa nở tràn ngập đến độ trọn vẹn nhất.',
        exampleJa: '公園の桜が満開で見事だ。',
        exampleVi: 'Hoa anh đào trong công viên đã nở rộ tuyệt đẹp.',
    },
    桜: {
        jlpt: 'JLPT N4',
        pitch: 0,
        popular: true,
        kanjiSummary: '桜 (ANH: cây anh đào, biểu tượng mùa xuân Nhật Bản).',
        exampleJa: '春になると桜が美しく咲く。',
        exampleVi: 'Khi mùa xuân đến, hoa anh đào nở rộ tuyệt đẹp.',
    },
    季節: {
        jlpt: 'JLPT N4',
        pitch: 2,
        popular: true,
        kanjiSummary: '季 (QUÝ: mùa, thời kỳ) + 節 (TIẾT: tiết trời, dịp giao mùa) → Bốn mùa rõ rệt trong năm.',
        exampleJa: '桜が満開の季節になりました。',
        exampleVi: 'Đã đến mùa hoa anh đào nở rộ rồi.',
    },
    日本語: {
        jlpt: 'JLPT N5',
        pitch: 0,
        popular: true,
        kanjiSummary: '日 (NHẬT: mặt trời, nước Nhật) + 本 (BẢN: gốc, cội nguồn) + 語 (NGỮ: ngôn ngữ, tiếng nói).',
        exampleJa: '日本語の勉強はとても面白いです。',
        exampleVi: 'Việc học tiếng Nhật thực sự rất thú vị.',
    },
    勉強: {
        jlpt: 'JLPT N5',
        pitch: 0,
        popular: true,
        kanjiSummary: '勉 (MIỄN: nỗ lực, cần cù) + 強 (CƯỠNG/CƯỜNG: kiên trì, mạnh mẽ) → Nỗ lực rèn luyện tri thức.',
        exampleJa: '毎日コツコツと日本語を勉強しています。',
        exampleVi: 'Mỗi ngày tôi đều chăm chỉ học tiếng Nhật.',
    },
    面白い: {
        jlpt: 'JLPT N5',
        pitch: 4,
        popular: true,
        kanjiSummary: '面 (DIỆN: gương mặt) + 白 (BẠCH: sáng sủa, rạng rỡ) → Thú vị đến mức gương mặt bừng sáng.',
        exampleJa: 'この本はとても面白いですね。',
        exampleVi: 'Cuốn sách này thật sự rất thú vị nhỉ.',
    },
});

export class DisplayGenerator {
    /**
     * @param {import('./display-content-manager.js').DisplayContentManager} contentManager
     * @param {?import('../input/hotkey-help-controller.js').HotkeyHelpController} hotkeyHelpController
     */
    constructor(contentManager, hotkeyHelpController) {
        /** @type {import('./display-content-manager.js').DisplayContentManager} */
        this._contentManager = contentManager;
        /** @type {?import('../input/hotkey-help-controller.js').HotkeyHelpController} */
        this._hotkeyHelpController = hotkeyHelpController;
        /** @type {HtmlTemplateCollection} */
        this._templates = new HtmlTemplateCollection();
        /** @type {StructuredContentGenerator} */
        this._structuredContentGenerator = new StructuredContentGenerator(this._contentManager, document, window);
        /** @type {PronunciationGenerator} */
        this._pronunciationGenerator = new PronunciationGenerator(document);
        /** @type {string} */
        this._language = 'ja';
    }

    /** @type {import('./display-content-manager.js').DisplayContentManager} */
    get contentManager() { return this._contentManager; }

    set contentManager(contentManager) {
        this._contentManager = contentManager;
    }

    /** */
    async prepare() {
        await this._templates.loadFromFiles(['/templates-display.html']);
        this.updateHotkeys();
    }

    /**
     * @param {string} language
     */
    updateLanguage(language) {
        this._language = language;
    }

    /** */
    updateHotkeys() {
        const hotkeyHelpController = this._hotkeyHelpController;
        if (hotkeyHelpController === null) { return; }
        for (const template of this._templates.getAllTemplates()) {
            hotkeyHelpController.setupNode(template.content);
        }
    }

    /**
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @param {import('dictionary-importer').Summary[]} dictionaryInfo
     * @returns {HTMLElement}
     */
    createTermEntry(dictionaryEntry, dictionaryInfo) {
        const node = this._instantiate('term-entry');

        const headwordsContainer = this._querySelector(node, '.headword-list');
        const inflectionRuleChainsContainer = this._querySelector(node, '.inflection-rule-chains');
        const groupedPronunciationsContainer = this._querySelector(node, '.pronunciation-group-list');
        const frequencyGroupListContainer = this._querySelector(node, '.frequency-group-list');
        const definitionsContainer = this._querySelector(node, '.definition-list');
        const headwordTagsContainer = this._querySelector(node, '.headword-list-tag-list');

        const {headwords, type, inflectionRuleChainCandidates, definitions, frequencies, pronunciations} = dictionaryEntry;
        const groupedPronunciations = getGroupedPronunciations(dictionaryEntry);
        const pronunciationCount = groupedPronunciations.reduce((i, v) => i + v.pronunciations.length, 0);
        const groupedFrequencies = groupTermFrequencies(dictionaryEntry, dictionaryInfo);
        const termTags = groupTermTags(dictionaryEntry);

        /** @type {Set<string>} */
        const uniqueTerms = new Set();
        /** @type {Set<string>} */
        const uniqueReadings = new Set();
        /** @type {Set<import('dictionary').TermSourceMatchType>} */
        const primaryMatchTypes = new Set();
        for (const {term, reading, sources} of headwords) {
            uniqueTerms.add(term);
            uniqueReadings.add(reading);
            for (const {matchType, isPrimary} of sources) {
                if (!isPrimary) { continue; }
                primaryMatchTypes.add(matchType);
            }
        }

        node.dataset.format = type;
        node.dataset.headwordCount = `${headwords.length}`;
        node.dataset.definitionCount = `${definitions.length}`;
        node.dataset.pronunciationDictionaryCount = `${groupedPronunciations.length}`;
        node.dataset.pronunciationCount = `${pronunciationCount}`;
        node.dataset.uniqueTermCount = `${uniqueTerms.size}`;
        node.dataset.uniqueReadingCount = `${uniqueReadings.size}`;
        node.dataset.frequencyCount = `${frequencies.length}`;
        node.dataset.groupedFrequencyCount = `${groupedFrequencies.length}`;
        node.dataset.primaryMatchTypes = [...primaryMatchTypes].join(' ');

        safePerformance.mark('displayGenerator:createTermEntry:createTermHeadword:start');
        for (let i = 0, ii = headwords.length; i < ii; ++i) {
            const node2 = this._createTermHeadword(headwords[i], i, pronunciations);
            node2.dataset.index = `${i}`;
            headwordsContainer.appendChild(node2);
        }
        headwordsContainer.dataset.count = `${headwords.length}`;
        safePerformance.mark('displayGenerator:createTermEntry:createTermHeadword:end');
        safePerformance.measure('displayGenerator:createTermEntry:createTermHeadword', 'displayGenerator:createTermEntry:createTermHeadword:start', 'displayGenerator:createTermEntry:createTermHeadword:end');

        safePerformance.mark('displayGenerator:createTermEntry:promises:start');
        this._appendMultiple(inflectionRuleChainsContainer, this._createInflectionRuleChain.bind(this), inflectionRuleChainCandidates);
        this._appendMultiple(frequencyGroupListContainer, this._createFrequencyGroup.bind(this), groupedFrequencies, false);
        this._appendMultiple(groupedPronunciationsContainer, this._createGroupedPronunciation.bind(this), groupedPronunciations);
        this._appendMultiple(headwordTagsContainer, this._createTermTag.bind(this), termTags, headwords.length);
        safePerformance.mark('displayGenerator:createTermEntry:promises:end');
        safePerformance.measure('displayGenerator:createTermEntry:promises', 'displayGenerator:createTermEntry:promises:start', 'displayGenerator:createTermEntry:promises:end');

        for (const term of uniqueTerms) {
            headwordTagsContainer.appendChild(this._createSearchTag(term));
        }
        for (const reading of uniqueReadings) {
            if (uniqueTerms.has(reading)) { continue; }
            headwordTagsContainer.appendChild(this._createSearchTag(reading));
        }

        // Add definitions
        const dictionaryTag = this._createDictionaryTag('');
        for (let i = 0, ii = definitions.length; i < ii; ++i) {
            const definition = definitions[i];
            const {dictionary, dictionaryAlias} = definition;

            if (dictionaryTag.dictionaries.includes(dictionary)) {
                dictionaryTag.redundant = true;
            } else {
                dictionaryTag.redundant = false;
                dictionaryTag.dictionaries.push(dictionary);
                dictionaryTag.name = dictionaryAlias;
                dictionaryTag.content = [dictionary];

                const currentDictionaryInfo = dictionaryInfo.find(({title}) => title === dictionary);
                if (currentDictionaryInfo) {
                    const dictionaryContentArray = [];
                    // Title and revision are required keys as per the schema.
                    dictionaryContentArray.push(currentDictionaryInfo.title, `rev.${currentDictionaryInfo.revision}`);
                    if (currentDictionaryInfo.author) {
                        dictionaryContentArray.push('Author: ' + currentDictionaryInfo.author);
                    }
                    if (currentDictionaryInfo.description) {
                        dictionaryContentArray.push('Description: ' + currentDictionaryInfo.description);
                    }
                    if (currentDictionaryInfo.url) {
                        dictionaryContentArray.push('URL: ' + currentDictionaryInfo.url);
                    }

                    const totalTerms = currentDictionaryInfo?.counts?.terms?.total;
                    if (!!totalTerms && totalTerms > 0) {
                        dictionaryContentArray.push('Term Count: ' + totalTerms.toString());
                    }

                    dictionaryTag.content = dictionaryContentArray;
                }
            }

            const node2 = this._createTermDefinition(definition, dictionaryTag, headwords, uniqueTerms, uniqueReadings);
            node2.dataset.index = `${i}`;
            definitionsContainer.appendChild(node2);
        }
        definitionsContainer.dataset.count = `${definitions.length}`;

        this._applyFenixTermCardEnhancements(node, dictionaryEntry);

        return node;
    }

    /**
     * Enriches a rendered term entry with Kanji breakdown, JLPT level, Hán Việt fallback,
     * and scanned webpage context sentence so the real lookup popup matches the promotional UI.
     * @param {HTMLElement} entryNode
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     * @param {Map<string, import('dictionary').KanjiDictionaryEntry>} kanjiEntriesMap
     * @param {?string} [contextSentence]
     */
    enrichTermEntryWithKanji(entryNode, dictionaryEntry, kanjiEntriesMap, contextSentence = null) {
        const {headwords} = dictionaryEntry;
        if (!Array.isArray(headwords) || headwords.length === 0) { return; }
        const primaryTerm = headwords[0].term;
        const curated = Object.prototype.hasOwnProperty.call(FENIX_CURATED_TERMS, primaryTerm) ? FENIX_CURATED_TERMS[primaryTerm] : null;

        /** @type {string[]} */
        const kanjiChars = [];
        for (const ch of primaryTerm) {
            const cp = ch.codePointAt(0);
            if (typeof cp === 'number' && isCodePointKanji(cp) && !kanjiChars.includes(ch)) {
                kanjiChars.push(ch);
            }
        }

        // 1. Collect Kanji breakdown items, Hán Việt syllables, and JLPT level
        /** @type {string[]} */
        const breakdownParts = [];
        /** @type {string[]} */
        const hanVietParts = [];
        /** @type {?number} */
        let hardestJlptNum = null;

        for (const ch of kanjiChars) {
            const kanjiEntry = kanjiEntriesMap.get(ch);
            if (typeof kanjiEntry === 'undefined') { continue; }

            let hvReading = '';
            if (kanjiEntry.stats && Array.isArray(kanjiEntry.stats.class)) {
                const hvStat = kanjiEntry.stats.class.find((s) => s.name === 'hv');
                if (hvStat && typeof hvStat.value === 'string' && hvStat.value.trim().length > 0) {
                    hvReading = hvStat.value.trim().toUpperCase();
                }
            }
            if (hvReading.length > 0) {
                hanVietParts.push(hvReading);
            }

            if (kanjiEntry.stats && Array.isArray(kanjiEntry.stats.misc)) {
                const jlptStat = kanjiEntry.stats.misc.find((s) => s.name === 'jlpt');
                if (jlptStat) {
                    const rawVal = Number.parseInt(`${jlptStat.value}`, 10);
                    if (!Number.isNaN(rawVal) && rawVal >= 1 && rawVal <= 5) {
                        // Convert old 4-level KANJIDIC jlpt (4->N5, 3->N4, 2->N3/N2, 1->N1) or use N-level
                        const mappedLevel = rawVal >= 2 && rawVal <= 4 ? rawVal + 1 : rawVal;
                        if (hardestJlptNum === null || mappedLevel < hardestJlptNum) {
                            hardestJlptNum = mappedLevel;
                        }
                    }
                }
            }

            let viMeaning = '';
            if (Array.isArray(kanjiEntry.definitions) && kanjiEntry.definitions.length > 0) {
                // First definition in FenixJpCatch Kanji-VI is the Vietnamese meaning
                viMeaning = kanjiEntry.definitions[0].trim();
            }

            if (hvReading.length > 0 && viMeaning.length > 0) {
                breakdownParts.push(`${ch} (${hvReading}: ${viMeaning})`);
            } else if (viMeaning.length > 0) {
                breakdownParts.push(`${ch} (${viMeaning})`);
            } else if (hvReading.length > 0) {
                breakdownParts.push(`${ch} (${hvReading})`);
            }
        }

        // 2. Ensure header Hán Việt pill is populated if not already extracted from term structured-content
        const headerHanViet = entryNode.querySelector('.fenix-header-han-viet');
        if (headerHanViet instanceof HTMLElement && headerHanViet.hidden && hanVietParts.length > 0) {
            headerHanViet.textContent = hanVietParts.join(' ');
            headerHanViet.hidden = false;
        }

        // 3. Insert JLPT badge at the start of .fenix-entry-meta-row
        const metaRow = entryNode.querySelector('.fenix-entry-meta-row');
        if (metaRow instanceof HTMLElement && metaRow.querySelector('.fenix-badge-jlpt') === null) {
            const jlptLabel = curated?.jlpt ?? (hardestJlptNum !== null ? `JLPT N${hardestJlptNum}` : null);
            if (jlptLabel !== null) {
                const jlptBadge = document.createElement('span');
                jlptBadge.className = 'fenix-badge fenix-badge-jlpt';
                jlptBadge.textContent = jlptLabel;
                metaRow.prepend(jlptBadge);
                metaRow.hidden = false;
            }
        }

        // 4. Populate "Phân tích Hán tự chuyên sâu:" box
        const breakdownBox = entryNode.querySelector('.fenix-kanji-breakdown');
        if (breakdownBox instanceof HTMLElement) {
            const bodyText = curated?.kanjiSummary ?? (breakdownParts.length > 0 ? breakdownParts.join(' + ') : '');
            if (bodyText.length > 0) {
                breakdownBox.textContent = '';
                const titleSpan = document.createElement('span');
                titleSpan.className = 'fenix-kanji-breakdown-title';
                titleSpan.textContent = 'Phân tích Hán tự chuyên sâu: ';
                const bodySpan = document.createElement('span');
                bodySpan.className = 'fenix-kanji-breakdown-body';
                bodySpan.textContent = bodyText;
                breakdownBox.appendChild(titleSpan);
                breakdownBox.appendChild(bodySpan);
                breakdownBox.hidden = false;
            }
        }

        // 5. Populate Context / Example sentence footer at the bottom of the card
        const sentenceBox = entryNode.querySelector('.fenix-context-sentence');
        if (sentenceBox instanceof HTMLElement) {
            const cleanContext = typeof contextSentence === 'string' ? contextSentence.trim() : '';
            const hasRealContext = cleanContext.length > primaryTerm.length && cleanContext.includes(primaryTerm);
            let jaSentence = curated?.exampleJa ?? '';
            if (hasRealContext && !(curated?.exampleJa && cleanContext.includes('桜が'))) {
                jaSentence = cleanContext;
            }
            const viSentence = curated?.exampleVi ?? '';

            if (jaSentence.length > 0) {
                sentenceBox.textContent = '';
                const jaLine = document.createElement('div');
                jaLine.className = 'fenix-context-sentence-ja';
                jaLine.lang = 'ja';
                this._appendHighlightedSentence(jaLine, jaSentence, primaryTerm);
                sentenceBox.appendChild(jaLine);

                if (viSentence.length > 0) {
                    const viLine = document.createElement('div');
                    viLine.className = 'fenix-context-sentence-vi';
                    viLine.textContent = viSentence;
                    sentenceBox.appendChild(viLine);
                }
                sentenceBox.hidden = false;
            }
        }
    }

    /**
     * @param {import('dictionary').KanjiDictionaryEntry} dictionaryEntry
     * @param {import('dictionary-importer').Summary[]} dictionaryInfo
     * @returns {HTMLElement}
     */
    createKanjiEntry(dictionaryEntry, dictionaryInfo) {
        const node = this._instantiate('kanji-entry');
        node.dataset.dictionary = dictionaryEntry.dictionary;

        const glyphContainer = this._querySelector(node, '.kanji-glyph');
        const frequencyGroupListContainer = this._querySelector(node, '.frequency-group-list');
        const tagContainer = this._querySelector(node, '.kanji-tag-list');

        const definitionsContainer = this._querySelector(node, '.kanji-gloss-container');
        const definitionsHeader = this._querySelector(node, '.kanji-meaning-header');

        const readingsContainer = this._querySelector(node, '.kanji-readings');
        const readingsHeader = this._querySelector(node, '.kanji-readings-header');

        const statisticsContainer = this._querySelector(node, '.kanji-statistics');
        const statisticsHeader = this._querySelector(node, '.kanji-statistics-header');

        const classificationsContainer = this._querySelector(node, '.kanji-classifications');
        const classificationsHeader = this._querySelector(node, '.kanji-classifications-header');

        const codepointsContainer = this._querySelector(node, '.kanji-codepoints');
        const codepointsHeader = this._querySelector(node, '.kanji-codepoints-header');

        const dictionaryIndicesContainer = this._querySelector(node, '.kanji-dictionary-indices');
        const dictionaryIndicesHeader = this._querySelector(node, '.kanji-dictionary-indices-header');

        this._setTextContent(glyphContainer, dictionaryEntry.character, this._language);
        if (this._language === 'ja') { glyphContainer.style.fontFamily = 'kanji-stroke-orders, sans-serif'; }
        const groupedFrequencies = groupKanjiFrequencies(dictionaryEntry.frequencies, dictionaryInfo);

        const dictionaryTag = this._createDictionaryTag('');
        dictionaryTag.name = dictionaryEntry.dictionaryAlias;
        dictionaryTag.content = [dictionaryEntry.dictionary];
        const currentDictionaryInfo = dictionaryInfo.find(({title}) => title === dictionaryEntry.dictionary);
        if (currentDictionaryInfo) {
            const dictionaryContentArray = [];
            dictionaryContentArray.push(currentDictionaryInfo.title);
            if (currentDictionaryInfo.author) {
                dictionaryContentArray.push('Author: ' + currentDictionaryInfo.author);
            }
            if (currentDictionaryInfo.description) {
                dictionaryContentArray.push('Description: ' + currentDictionaryInfo.description);
            }
            if (currentDictionaryInfo.url) {
                dictionaryContentArray.push('URL: ' + currentDictionaryInfo.url);
            }

            const totalKanji = currentDictionaryInfo?.counts?.kanji?.total;
            if (!!totalKanji && totalKanji > 0) {
                dictionaryContentArray.push('Kanji Count: ' + totalKanji.toString());
            }

            dictionaryTag.content = dictionaryContentArray;
        }

        this._appendMultiple(frequencyGroupListContainer, this._createFrequencyGroup.bind(this), groupedFrequencies, true);
        this._appendMultiple(tagContainer, this._createTag.bind(this), [...dictionaryEntry.tags, dictionaryTag]);

        const definitionElements = [];
        if (dictionaryEntry.definitions.length > 0) {
            const element = document.createElement('ol');
            element.className = 'kanji-gloss-list';
            for (const x of dictionaryEntry.definitions) { element.appendChild(this._createKanjiDefinition(x)); }
            definitionElements.push(element);
        }

        const onyomiElements = [];
        if (dictionaryEntry.onyomi.length > 0) {
            const element = document.createElement('dl');
            element.className = 'kanji-readings-chinese';
            for (const x of dictionaryEntry.onyomi) { element.appendChild(this._createKanjiReading(x)); }
            onyomiElements.push(element);
        }

        const kunyomiElements = [];
        if (dictionaryEntry.kunyomi.length > 0) {
            const element = document.createElement('dl');
            element.className = 'kanji-readings-japanese';
            for (const x of dictionaryEntry.kunyomi) { element.appendChild(this._createKanjiReading(x)); }
            kunyomiElements.push(element);
        }

        const tableMappings = [
            {
                container: definitionsContainer,
                elements: definitionElements,
                header: definitionsHeader,
            },
            {
                container: readingsContainer,
                elements: [...onyomiElements, ...kunyomiElements],
                header: readingsHeader,
            },
            {
                container: statisticsContainer,
                elements: this._createKanjiInfoTable(dictionaryEntry.stats.misc),
                header: statisticsHeader,
            },
            {
                container: classificationsContainer,
                elements: this._createKanjiInfoTable(dictionaryEntry.stats.class),
                header: classificationsHeader,
            },
            {
                container: codepointsContainer,
                elements: this._createKanjiInfoTable(dictionaryEntry.stats.code),
                header: codepointsHeader,
            },
            {
                container: dictionaryIndicesContainer,
                elements: this._createKanjiInfoTable(dictionaryEntry.stats.index),
                header: dictionaryIndicesHeader,
            },
        ];

        for (const tableMapping of tableMappings) {
            if (tableMapping.elements.length === 0) {
                tableMapping.header.remove();
                tableMapping.container.remove();
                continue;
            }

            for (const tableElement of tableMapping.elements) {
                tableMapping.container.appendChild(tableElement);
            }
        }

        return node;
    }

    /**
     * @returns {HTMLElement}
     */
    createEmptyFooterNotification() {
        return this._instantiate('footer-notification');
    }

    /**
     * @param {HTMLElement} tagNode
     * @param {?import('dictionary').DictionaryEntry} dictionaryEntry
     * @returns {DocumentFragment}
     */
    createTagFooterNotificationDetails(tagNode, dictionaryEntry) {
        const node = this._templates.instantiateFragment('footer-notification-tag-details');

        let details = tagNode.dataset.details;
        if (typeof details !== 'string') {
            const label = tagNode.querySelector('.tag-label-content');
            details = label !== null && label.textContent !== null ? label.textContent : '';
        }
        const tagDetails = this._querySelector(node, '.tag-details');
        this._setTextContent(tagDetails, details);

        if (dictionaryEntry !== null && dictionaryEntry.type === 'term') {
            const {headwords} = dictionaryEntry;
            const disambiguationHeadwords = [];
            const {headwords: headwordIndices} = tagNode.dataset;
            if (typeof headwordIndices === 'string' && headwordIndices.length > 0) {
                for (const headwordIndexString of headwordIndices.split(' ')) {
                    const headwordIndex = Number.parseInt(headwordIndexString, 10);
                    if (!Number.isNaN(headwordIndex) && headwordIndex >= 0 && headwordIndex < headwords.length) {
                        disambiguationHeadwords.push(headwords[headwordIndex]);
                    }
                }
            }

            if (disambiguationHeadwords.length > 0 && disambiguationHeadwords.length < headwords.length) {
                const disambiguationContainer = this._querySelector(node, '.tag-details-disambiguation-list');
                const copyAttributes = ['totalHeadwordCount', 'matchedHeadwordCount', 'unmatchedHeadwordCount'];
                for (const attribute of copyAttributes) {
                    const value = tagNode.dataset[attribute];
                    if (typeof value === 'undefined') { continue; }
                    disambiguationContainer.dataset[attribute] = value;
                }
                for (const {term, reading} of disambiguationHeadwords) {
                    const disambiguationItem = document.createElement('span');
                    disambiguationItem.className = 'tag-details-disambiguation';
                    this._appendFurigana(disambiguationItem, term, reading, (container, text) => {
                        container.appendChild(document.createTextNode(text));
                    });
                    disambiguationContainer.appendChild(disambiguationItem);
                }
            }
        }

        return node;
    }

    /**
     * @param {(DocumentFragment|Node|Error)[]} errors
     * @returns {HTMLElement}
     */
    createAnkiNoteErrorsNotificationContent(errors) {
        const content = this._instantiate('footer-notification-anki-errors-content');

        const header = this._querySelector(content, '.anki-note-error-header');
        this._setTextContent(header, (errors.length === 1 ? 'An error occurred:' : `${errors.length} errors occurred:`), 'en');

        const list = this._querySelector(content, '.anki-note-error-list');
        for (const error of errors) {
            const div = document.createElement('li');
            div.className = 'anki-note-error-message';
            if (error instanceof DocumentFragment || error instanceof Node) {
                div.appendChild(error);
            } else {
                let message = error.message;
                let link = null;
                if (error instanceof ExtensionError && error.data !== null && typeof error.data === 'object') {
                    const {referenceUrl} = /** @type {import('core').UnknownObject} */ (error.data);
                    if (typeof referenceUrl === 'string') {
                        message = message.trimEnd();
                        if (!/[.!?]^/.test(message)) { message += '.'; }
                        message += ' ';
                        link = document.createElement('a');
                        link.href = referenceUrl;
                        link.target = '_blank';
                        link.rel = 'noreferrer noopener';
                        link.textContent = 'More info';
                    }
                }
                this._setTextContent(div, message);
                if (link !== null) { div.appendChild(link); }
            }
            list.appendChild(div);
        }

        return content;
    }

    /**
     * @returns {HTMLElement}
     */
    createProfileListItem() {
        return this._instantiate('profile-list-item');
    }

    /**
     * @param {string} name
     * @returns {HTMLElement}
     */
    instantiateTemplate(name) {
        return this._instantiate(name);
    }

    /**
     * @param {string} name
     * @returns {DocumentFragment}
     */
    instantiateTemplateFragment(name) {
        return this._templates.instantiateFragment(name);
    }

    // Private

    /**
     * @param {import('dictionary').TermHeadword} headword
     * @param {number} headwordIndex
     * @param {import('dictionary').TermPronunciation[]} pronunciations
     * @returns {HTMLElement}
     */
    _createTermHeadword(headword, headwordIndex, pronunciations) {
        const {term, reading, tags, sources} = headword;

        let isPrimaryAny = false;
        const matchTypes = new Set();
        const matchSources = new Set();
        for (const {matchType, matchSource, isPrimary} of sources) {
            if (isPrimary) {
                isPrimaryAny = true;
            }
            matchTypes.add(matchType);
            matchSources.add(matchSource);
        }

        const node = this._instantiate('headword');

        const termContainer = this._querySelector(node, '.headword-term');

        node.dataset.isPrimary = `${isPrimaryAny}`;
        node.dataset.readingIsSame = `${reading === term}`;
        node.dataset.frequency = getTermFrequency(tags);
        node.dataset.matchTypes = [...matchTypes].join(' ');
        node.dataset.matchSources = [...matchSources].join(' ');

        const {wordClasses} = headword;
        const pronunciationCategories = this._getPronunciationCategories(reading, pronunciations, wordClasses, headwordIndex);
        if (pronunciationCategories !== null) {
            node.dataset.pronunciationCategories = pronunciationCategories;
        }
        if (wordClasses.length > 0) {
            node.dataset.wordClasses = wordClasses.join(' ');
        }

        const headwordReading = this._querySelector(node, '.headword-reading');
        this._setTextContent(headwordReading, reading);

        this._appendFurigana(termContainer, term, reading, this._appendKanjiLinks.bind(this));

        return node;
    }

    /**
     * @param {import('dictionary').InflectionRuleChainCandidate} inflectionRuleChain
     * @returns {?HTMLElement}
     */
    _createInflectionRuleChain(inflectionRuleChain) {
        const {source, inflectionRules} = inflectionRuleChain;
        if (!Array.isArray(inflectionRules) || inflectionRules.length === 0) { return null; }
        const fragment = this._instantiate('inflection-rule-chain');

        const sourceIcon = this._getInflectionSourceIcon(source);

        fragment.appendChild(sourceIcon);

        this._appendMultiple(fragment, this._createTermInflection.bind(this), inflectionRules);
        return fragment;
    }

    /**
     * @param {import('dictionary').InflectionSource} source
     * @returns {HTMLElement}
     */
    _getInflectionSourceIcon(source) {
        const icon = document.createElement('span');
        icon.classList.add('inflection-source-icon');
        icon.dataset.inflectionSource = source;
        switch (source) {
            case 'dictionary':
                icon.title = 'Dictionary Deinflection';
                return icon;
            case 'algorithm':
                icon.title = 'Algorithm Deinflection';
                return icon;
            case 'both':
                icon.title = 'Dictionary and Algorithm Deinflection';
                return icon;
        }
    }

    /**
     * @param {import('dictionary').InflectionRule} inflection
     * @returns {DocumentFragment}
     */
    _createTermInflection(inflection) {
        const {name, description} = inflection;
        const fragment = this._templates.instantiateFragment('inflection');
        const node = this._querySelector(fragment, '.inflection');
        this._setTextContent(node, name);
        if (description) { node.title = description; }
        node.dataset.reason = name;
        return fragment;
    }

    /**
     * @param {import('dictionary').TermDefinition} definition
     * @param {import('dictionary').Tag} dictionaryTag
     * @param {import('dictionary').TermHeadword[]} headwords
     * @param {Set<string>} uniqueTerms
     * @param {Set<string>} uniqueReadings
     * @returns {HTMLElement}
     */
    _createTermDefinition(definition, dictionaryTag, headwords, uniqueTerms, uniqueReadings) {
        const {dictionary, tags, headwordIndices, entries} = definition;
        const disambiguations = getDisambiguations(headwords, headwordIndices, uniqueTerms, uniqueReadings);

        const node = this._instantiate('definition-item');

        const tagListContainer = this._querySelector(node, '.definition-tag-list');
        const onlyListContainer = this._querySelector(node, '.definition-disambiguation-list');
        const entriesContainer = this._querySelector(node, '.gloss-list');

        node.dataset.dictionary = dictionary;

        this._appendMultiple(tagListContainer, this._createTag.bind(this), [...tags, dictionaryTag]);
        this._appendMultiple(onlyListContainer, this._createTermDisambiguation.bind(this), disambiguations);
        this._appendMultiple(entriesContainer, this._createTermDefinitionEntry.bind(this), entries, dictionary);
        return node;
    }

    /**
     * @param {import('dictionary-data').TermGlossaryContent} entry
     * @param {string} dictionary
     * @returns {?HTMLElement}
     */
    _createTermDefinitionEntry(entry, dictionary) {
        switch (typeof entry) {
            case 'string':
                return this._createTermDefinitionEntryText(entry);
            case 'object': {
                switch (entry.type) {
                    case 'image':
                        return this._createTermDefinitionEntryImage(entry, dictionary);
                    case 'structured-content':
                        return this._createTermDefinitionEntryStructuredContent(entry.content, dictionary);
                    case 'text':
                        break;
                }
                break;
            }
        }

        return null;
    }

    /**
     * @param {string} text
     * @returns {HTMLElement}
     */
    _createTermDefinitionEntryText(text) {
        const node = this._instantiate('gloss-item');
        const container = this._querySelector(node, '.gloss-content');
        this._setMultilineTextContent(container, text);
        return node;
    }

    /**
     * @param {import('dictionary-data').TermGlossaryImage} data
     * @param {string} dictionary
     * @returns {HTMLElement}
     */
    _createTermDefinitionEntryImage(data, dictionary) {
        const {description} = data;

        const node = this._instantiate('gloss-item');

        const contentContainer = this._querySelector(node, '.gloss-content');
        const image = this._structuredContentGenerator.createDefinitionImage(data, dictionary);
        contentContainer.appendChild(image);

        if (typeof description === 'string') {
            const fragment = this._templates.instantiateFragment('gloss-item-image-description');
            const container = this._querySelector(fragment, '.gloss-image-description');
            this._setMultilineTextContent(container, description);
            contentContainer.appendChild(fragment);
        }

        return node;
    }

    /**
     * @param {import('structured-content').Content} content
     * @param {string} dictionary
     * @returns {HTMLElement}
     */
    _createTermDefinitionEntryStructuredContent(content, dictionary) {
        const node = this._instantiate('gloss-item');
        const contentContainer = this._querySelector(node, '.gloss-content');
        this._structuredContentGenerator.appendStructuredContent(contentContainer, content, dictionary);
        return node;
    }

    /**
     * @param {string} disambiguation
     * @returns {HTMLElement}
     */
    _createTermDisambiguation(disambiguation) {
        const node = this._instantiate('definition-disambiguation');
        node.dataset.term = disambiguation;
        this._setTextContent(node, disambiguation, this._language);
        return node;
    }

    /**
     * @param {string} character
     * @returns {HTMLAnchorElement}
     */
    _createKanjiLink(character) {
        const node = document.createElement('a');
        node.className = 'headword-kanji-link';
        this._setTextContent(node, character, this._language);
        return node;
    }

    /**
     * @param {string} text
     * @returns {HTMLElement}
     */
    _createKanjiDefinition(text) {
        const node = this._instantiate('kanji-gloss-item');
        const container = this._querySelector(node, '.kanji-gloss-content');
        this._setMultilineTextContent(container, text);
        return node;
    }

    /**
     * @param {string} reading
     * @returns {HTMLElement}
     */
    _createKanjiReading(reading) {
        const node = this._instantiate('kanji-reading');
        this._setTextContent(node, reading, this._language);
        return node;
    }

    /**
     * @param {import('dictionary').KanjiStat[]} details
     * @returns {HTMLElement[]}
     */
    _createKanjiInfoTable(details) {
        const node = this._instantiate('kanji-info-table');
        const container = this._querySelector(node, '.kanji-info-table-body');

        const count = this._appendMultiple(container, this._createKanjiInfoTableItem.bind(this), details);
        if (count === 0) {
            return [];
        }

        return [node];
    }

    /**
     * @param {import('dictionary').KanjiStat} details
     * @returns {HTMLElement}
     */
    _createKanjiInfoTableItem(details) {
        const {content, name, value} = details;
        const node = this._instantiate('kanji-info-table-item');
        const nameNode = this._querySelector(node, '.kanji-info-table-item-header');
        const valueNode = this._querySelector(node, '.kanji-info-table-item-value');
        this._setTextContent(nameNode, content.length > 0 ? content : name);
        this._setTextContent(valueNode, typeof value === 'string' ? value : `${value}`);
        return node;
    }

    /**
     * @returns {HTMLElement}
     */
    _createKanjiInfoTableItemEmpty() {
        return this._instantiate('kanji-info-table-empty');
    }

    /**
     * @param {import('dictionary').Tag} tag
     * @returns {HTMLElement}
     */
    _createTag(tag) {
        const {content, name, category, redundant} = tag;
        const node = this._instantiate('tag');

        const inner = this._querySelector(node, '.tag-label-content');

        const contentString = content.join('\n');
        const displayName = Object.prototype.hasOwnProperty.call(FENIX_POS_LABELS_VI, name) ? FENIX_POS_LABELS_VI[name] : name;

        node.title = contentString;
        this._setTextContent(inner, displayName);
        node.dataset.details = contentString.length > 0 ? contentString : displayName;
        node.dataset.category = category;
        node.dataset.tagName = name;
        if (redundant) { node.dataset.redundant = 'true'; }

        return node;
    }

    /**
     * Extracts Hán Việt badge into the header row, populates metadata badges (Popular, Pitch, POS),
     * and enriches Vietnamese definitions so the popup card matches the promotional UI.
     * @param {HTMLElement} node
     * @param {import('dictionary').TermDictionaryEntry} dictionaryEntry
     */
    _applyFenixTermCardEnhancements(node, dictionaryEntry) {
        const {headwords, definitions, pronunciations} = dictionaryEntry;
        if (!Array.isArray(headwords) || headwords.length === 0) { return; }

        const primaryTerm = headwords[0].term;
        const curated = Object.prototype.hasOwnProperty.call(FENIX_CURATED_TERMS, primaryTerm) ? FENIX_CURATED_TERMS[primaryTerm] : null;

        // 1. Extract Hán Việt from definition structured-content into the header pill
        const hanVietNodes = node.querySelectorAll('.definition-list [data-sc-content="han-viet"]');
        let extractedHanViet = '';
        for (const hvNode of hanVietNodes) {
            if (!(hvNode instanceof HTMLElement)) { continue; }
            const text = (hvNode.textContent ?? '').trim();
            if (extractedHanViet.length === 0 && text.length > 0) {
                extractedHanViet = text.toUpperCase();
            }
            hvNode.hidden = true;
            hvNode.style.display = 'none';
        }

        const headerHanViet = node.querySelector('.headword[data-index="0"] .fenix-header-han-viet') ?? node.querySelector('.fenix-header-han-viet');
        if (headerHanViet instanceof HTMLElement && extractedHanViet.length > 0) {
            headerHanViet.textContent = extractedHanViet;
            headerHanViet.hidden = false;
        }

        // 2. If a curated Vietnamese definition exists and the entry only has English glosses, inject the Vietnamese meaning
        if (curated && typeof curated.vi === 'string' && curated.vi.length > 0) {
            const existingViNode = node.querySelector('.definition-list [data-sc-content="vi"]');
            if (existingViNode === null) {
                const firstGlossContent = node.querySelector('.definition-list .gloss-content');
                if (firstGlossContent instanceof HTMLElement) {
                    const viDiv = document.createElement('div');
                    viDiv.dataset.scContent = 'vi';
                    viDiv.textContent = curated.vi;
                    firstGlossContent.prepend(viDiv);
                    const enOnlyNode = firstGlossContent.querySelector('[data-sc-content="en"][data-sc-only="true"]');
                    if (enOnlyNode instanceof HTMLElement) {
                        delete enOnlyNode.dataset.scOnly;
                    }
                }
            }
        }

        // 3. Populate metadata badge row (.fenix-entry-meta-row) below headword
        const metaRow = node.querySelector('.fenix-entry-meta-row');
        if (!(metaRow instanceof HTMLElement)) { return; }

        // 3a. JLPT badge if available from curated data immediately (Kanji enrichment may also add/keep it)
        if (curated && typeof curated.jlpt === 'string') {
            const jlptBadge = document.createElement('span');
            jlptBadge.className = 'fenix-badge fenix-badge-jlpt';
            jlptBadge.textContent = curated.jlpt;
            metaRow.appendChild(jlptBadge);
        }

        // 3b. Popularity badge ("Phổ biến ★★★")
        let isPopular = Boolean(curated?.popular);
        if (!isPopular) {
            for (const hw of headwords) {
                if (getTermFrequency(hw.tags) === 'popular') {
                    isPopular = true;
                    break;
                }
                for (const tag of hw.tags) {
                    if (tag.name === 'P' || tag.category === 'popular' || tag.name === 'news1' || tag.name === 'ichi1') {
                        isPopular = true;
                        break;
                    }
                }
            }
        }
        if (isPopular) {
            const popBadge = document.createElement('span');
            popBadge.className = 'fenix-badge fenix-badge-popular';
            popBadge.textContent = 'Phổ biến ★★★';
            metaRow.appendChild(popBadge);
        }

        // 3c. Pitch Accent badge ("Âm điệu [0]")
        /** @type {?number} */
        let pitchPosition = typeof curated?.pitch === 'number' ? curated.pitch : null;
        if (pitchPosition === null && Array.isArray(pronunciations)) {
            for (const termPron of pronunciations) {
                for (const pron of termPron.pronunciations) {
                    if (pron.type === 'pitch-accent' && typeof pron.positions === 'number') {
                        pitchPosition = pron.positions;
                        break;
                    }
                }
                if (pitchPosition !== null) { break; }
            }
        }
        if (pitchPosition !== null) {
            const pitchBadge = document.createElement('span');
            pitchBadge.className = 'fenix-badge fenix-badge-pitch';
            pitchBadge.textContent = `•|• Âm điệu [${pitchPosition}]`;
            metaRow.appendChild(pitchBadge);
        }

        // 3d. Primary Vietnamese Part-of-Speech badge (e.g. "Danh từ", "Động từ する")
        /** @type {Set<string>} */
        const addedPosLabels = new Set();
        for (const def of definitions) {
            for (const tag of def.tags) {
                if (tag.name === 'P' || tag.category === 'dictionary') { continue; }
                const viPos = Object.prototype.hasOwnProperty.call(FENIX_POS_LABELS_VI, tag.name) ? FENIX_POS_LABELS_VI[tag.name] : null;
                if (viPos !== null && !addedPosLabels.has(viPos) && addedPosLabels.size < 2) {
                    addedPosLabels.add(viPos);
                    const posBadge = document.createElement('span');
                    posBadge.className = 'fenix-badge fenix-badge-pos';
                    posBadge.textContent = viPos;
                    metaRow.appendChild(posBadge);
                }
            }
        }

        if (metaRow.childElementCount > 0) {
            metaRow.hidden = false;
        }
    }

    /**
     * @param {HTMLElement} container
     * @param {string} sentence
     * @param {string} term
     */
    _appendHighlightedSentence(container, sentence, term) {
        if (term.length === 0) {
            container.textContent = sentence;
            return;
        }
        const idx = sentence.indexOf(term);
        if (idx < 0) {
            container.textContent = sentence;
            return;
        }
        if (idx > 0) {
            container.appendChild(document.createTextNode(sentence.substring(0, idx)));
        }
        const mark = document.createElement('span');
        mark.className = 'fenix-context-highlight';
        mark.textContent = term;
        container.appendChild(mark);
        const rest = sentence.substring(idx + term.length);
        if (rest.length > 0) {
            container.appendChild(document.createTextNode(rest));
        }
    }

    /**
     * @param {import('dictionary-data-util').TagGroup} tagInfo
     * @param {number} totalHeadwordCount
     * @returns {HTMLElement}
     */
    _createTermTag(tagInfo, totalHeadwordCount) {
        const {tag, headwordIndices} = tagInfo;
        const node = this._createTag(tag);
        node.dataset.headwords = headwordIndices.join(' ');
        node.dataset.totalHeadwordCount = `${totalHeadwordCount}`;
        node.dataset.matchedHeadwordCount = `${headwordIndices.length}`;
        node.dataset.unmatchedHeadwordCount = `${Math.max(0, totalHeadwordCount - headwordIndices.length)}`;
        return node;
    }

    /**
     * @param {string} name
     * @param {string} category
     * @returns {import('dictionary').Tag}
     */
    _createTagData(name, category) {
        return {
            name,
            category,
            order: 0,
            score: 0,
            content: [],
            dictionaries: [],
            redundant: false,
        };
    }

    /**
     * @param {string} text
     * @returns {HTMLElement}
     */
    _createSearchTag(text) {
        return this._createTag(this._createTagData(text, 'search'));
    }

    /**
     * @param {import('dictionary-data-util').DictionaryGroupedPronunciations} details
     * @returns {HTMLElement}
     */
    _createGroupedPronunciation(details) {
        const {dictionary, dictionaryAlias, pronunciations} = details;

        const node = this._instantiate('pronunciation-group');
        node.dataset.dictionary = dictionary;
        node.dataset.pronunciationsMulti = 'true';
        node.dataset.pronunciationsCount = `${pronunciations.length}`;

        const n1 = this._querySelector(node, '.pronunciation-group-tag-list');
        const tag = this._createTag(this._createTagData(dictionaryAlias, 'pronunciation-dictionary'));
        tag.dataset.details = dictionary;
        n1.appendChild(tag);

        let hasTags = false;
        for (const {pronunciation: {tags}} of pronunciations) {
            if (tags.length > 0) {
                hasTags = true;
                break;
            }
        }

        const n = this._querySelector(node, '.pronunciation-list');
        n.dataset.hasTags = `${hasTags}`;
        this._appendMultiple(n, this._createPronunciation.bind(this), pronunciations);

        return node;
    }

    /**
     * @param {import('dictionary-data-util').GroupedPronunciation} details
     * @returns {HTMLElement}
     */
    _createPronunciation(details) {
        const {pronunciation} = details;
        switch (pronunciation.type) {
            case 'pitch-accent':
                return this._createPronunciationPitchAccent(pronunciation, details);
            case 'phonetic-transcription':
                return this._createPronunciationPhoneticTranscription(pronunciation, details);
        }
    }


    /**
     * @param {import('dictionary').PhoneticTranscription} pronunciation
     * @param {import('dictionary-data-util').GroupedPronunciation} details
     * @returns {HTMLElement}
     */
    _createPronunciationPhoneticTranscription(pronunciation, details) {
        const {ipa, tags} = pronunciation;
        const {exclusiveTerms, exclusiveReadings} = details;

        const node = this._instantiate('pronunciation');

        node.dataset.pronunciationType = pronunciation.type;
        node.dataset.tagCount = `${tags.length}`;

        let n = this._querySelector(node, '.pronunciation-tag-list');
        this._appendMultiple(n, this._createTag.bind(this), tags);

        n = this._querySelector(node, '.pronunciation-disambiguation-list');
        this._createPronunciationDisambiguations(n, exclusiveTerms, exclusiveReadings);

        n = this._querySelector(node, '.pronunciation-text-container');

        this._setTextContent(n, ipa);

        return node;
    }

    /**
     * @param {import('dictionary').PitchAccent} pitchAccent
     * @param {import('dictionary-data-util').GroupedPronunciation} details
     * @returns {HTMLElement}
     */
    _createPronunciationPitchAccent(pitchAccent, details) {
        const {positions, nasalPositions, devoicePositions, tags} = pitchAccent;
        const {reading, exclusiveTerms, exclusiveReadings} = details;
        const morae = getKanaMorae(reading);

        const node = this._instantiate('pronunciation');

        node.dataset.pitchAccentDownstepPosition = `${positions}`;
        node.dataset.pronunciationType = pitchAccent.type;
        if (nasalPositions.length > 0) { node.dataset.nasalMoraPosition = nasalPositions.join(' '); }
        if (devoicePositions.length > 0) { node.dataset.devoiceMoraPosition = devoicePositions.join(' '); }
        node.dataset.tagCount = `${tags.length}`;

        let n = this._querySelector(node, '.pronunciation-tag-list');
        this._appendMultiple(n, this._createTag.bind(this), tags);

        n = this._querySelector(node, '.pronunciation-disambiguation-list');
        this._createPronunciationDisambiguations(n, exclusiveTerms, exclusiveReadings);

        n = this._querySelector(node, '.pronunciation-downstep-notation-container');
        n.appendChild(this._pronunciationGenerator.createPronunciationDownstepPosition(positions));

        n = this._querySelector(node, '.pronunciation-text-container');

        n.lang = this._language;
        n.appendChild(this._pronunciationGenerator.createPronunciationText(morae, positions, nasalPositions, devoicePositions));

        n = this._querySelector(node, '.pronunciation-graph-container');
        n.appendChild(this._pronunciationGenerator.createPronunciationGraph(morae, positions));

        return node;
    }

    /**
     * @param {HTMLElement} container
     * @param {string[]} exclusiveTerms
     * @param {string[]} exclusiveReadings
     */
    _createPronunciationDisambiguations(container, exclusiveTerms, exclusiveReadings) {
        const templateName = 'pronunciation-disambiguation';
        for (const term of exclusiveTerms) {
            const node = this._instantiate(templateName);
            node.dataset.type = 'term';
            this._setTextContent(node, term, this._language);
            container.appendChild(node);
        }

        for (const exclusiveReading of exclusiveReadings) {
            const node = this._instantiate(templateName);
            node.dataset.type = 'reading';
            this._setTextContent(node, exclusiveReading, this._language);
            container.appendChild(node);
        }

        container.dataset.count = `${exclusiveTerms.length + exclusiveReadings.length}`;
        container.dataset.termCount = `${exclusiveTerms.length}`;
        container.dataset.readingCount = `${exclusiveReadings.length}`;
    }

    /**
     * @param {import('dictionary-data-util').DictionaryFrequency<import('dictionary-data-util').TermFrequency>|import('dictionary-data-util').DictionaryFrequency<import('dictionary-data-util').KanjiFrequency>} details
     * @param {boolean} kanji
     * @returns {HTMLElement}
     */
    _createFrequencyGroup(details, kanji) {
        const {dictionary, dictionaryAlias, frequencies, freqCount} = details;

        const node = this._instantiate('frequency-group-item');
        const body = this._querySelector(node, '.tag-body-content');

        const tagLabel = this._querySelector(node, '.tag-label-content');
        const tag = this._querySelector(node, '.tag');

        this._setTextContent(tagLabel, dictionaryAlias);

        const ii = frequencies.length;
        for (let i = 0; i < ii; ++i) {
            const item = frequencies[i];
            const itemNode = (
                kanji ?
                this._createKanjiFrequency(/** @type {import('dictionary-data-util').KanjiFrequency} */ (item), dictionary, dictionaryAlias, freqCount?.toString()) :
                this._createTermFrequency(/** @type {import('dictionary-data-util').TermFrequency} */ (item), dictionary, dictionaryAlias, freqCount?.toString())
            );
            itemNode.dataset.index = `${i}`;
            body.appendChild(itemNode);
        }

        body.dataset.count = `${ii}`;
        node.dataset.count = `${ii}`;
        node.dataset.details = dictionary;
        tag.dataset.details = dictionary + '\nDictionary size: ' + freqCount?.toString() + (kanji ? ' kanji' : ' terms');
        return node;
    }

    /**
     * @param {import('dictionary-data-util').TermFrequency} details
     * @param {string} dictionary
     * @param {string} dictionaryAlias
     * @param {string} freqCount
     * @returns {HTMLElement}
     */
    _createTermFrequency(details, dictionary, dictionaryAlias, freqCount) {
        const {term, reading, values} = details;
        const node = this._instantiate('term-frequency-item');
        const tagLabel = this._querySelector(node, '.tag-label-content');
        const tag = this._querySelector(node, '.tag');
        const disambiguationTerm = this._querySelector(node, '.frequency-disambiguation-term');
        const disambiguationReading = this._querySelector(node, '.frequency-disambiguation-reading');
        const frequencyValueList = this._querySelector(node, '.frequency-value-list');

        this._setTextContent(tagLabel, dictionaryAlias);
        this._setTextContent(disambiguationTerm, term, this._language);
        this._setTextContent(disambiguationReading, (reading !== null ? reading : ''), this._language);
        this._populateFrequencyValueList(frequencyValueList, values);

        node.dataset.term = term;
        if (typeof reading === 'string') {
            node.dataset.reading = reading;
        }
        node.dataset.hasReading = `${reading !== null}`;
        node.dataset.readingIsSame = `${reading === term}`;
        node.dataset.dictionary = dictionary;
        node.dataset.details = dictionary;
        tag.dataset.details = dictionary + '\nDictionary size: ' + freqCount + ' terms';
        return node;
    }

    /**
     * @param {import('dictionary-data-util').KanjiFrequency} details
     * @param {string} dictionary
     * @param {string} dictionaryAlias
     * @param {string} freqCount
     * @returns {HTMLElement}
     */
    _createKanjiFrequency(details, dictionary, dictionaryAlias, freqCount) {
        const {character, values} = details;
        const node = this._instantiate('kanji-frequency-item');
        const tagLabel = this._querySelector(node, '.tag-label-content');
        const tag = this._querySelector(node, '.tag');
        const frequencyValueList = this._querySelector(node, '.frequency-value-list');

        this._setTextContent(tagLabel, dictionaryAlias);
        this._populateFrequencyValueList(frequencyValueList, values);

        node.dataset.character = character;
        node.dataset.dictionary = dictionary;
        node.dataset.details = dictionary;
        tag.dataset.details = dictionary + '\nDictionary size: ' + freqCount + ' kanji';

        return node;
    }

    /**
     * @param {HTMLElement} node
     * @param {import('dictionary-data-util').FrequencyData[]} values
     */
    _populateFrequencyValueList(node, values) {
        let fullFrequency = '';
        for (let i = 0, ii = values.length; i < ii; ++i) {
            const {frequency, displayValue} = values[i];
            const frequencyString = `${frequency}`;
            const text = displayValue !== null ? displayValue : `${frequency}`;

            if (i > 0) {
                const node2 = document.createElement('span');
                node2.className = 'frequency-value';
                node2.dataset.frequency = `${frequency}`;
                node2.textContent = ', ';
                node.appendChild(node2);
                fullFrequency += ', ';
            }

            const node2 = document.createElement('span');
            node2.className = 'frequency-value';
            node2.dataset.frequency = frequencyString;
            if (displayValue !== null) {
                node2.dataset.displayValue = `${displayValue}`;
                if (displayValue !== frequencyString) {
                    node2.title = frequencyString;
                }
            }
            this._setTextContent(node2, text, this._language);
            node.appendChild(node2);

            fullFrequency += text;
        }

        node.dataset.frequency = fullFrequency;
    }

    /**
     * @param {HTMLElement} container
     * @param {string} text
     */
    _appendKanjiLinks(container, text) {
        let part = '';
        for (const c of text) {
            if (isCodePointKanji(/** @type {number} */(c.codePointAt(0)))) {
                if (part.length > 0) {
                    container.appendChild(document.createTextNode(part));
                    part = '';
                }

                const link = this._createKanjiLink(c);
                container.appendChild(link);
            } else {
                part += c;
            }
        }
        if (part.length > 0) {
            container.appendChild(document.createTextNode(part));
        }
    }

    /**
     * @template [TItem=unknown]
     * @template [TExtraArg=void]
     * @param {HTMLElement} container
     * @param {(item: TItem, arg: TExtraArg) => ?Node} createItem
     * @param {TItem[]} detailsArray
     * @param {TExtraArg} [arg]
     * @returns {number}
     */
    _appendMultiple(container, createItem, detailsArray, arg) {
        let count = 0;
        const {ELEMENT_NODE} = Node;
        if (Array.isArray(detailsArray)) {
            for (const details of detailsArray) {
                const item = createItem(details, /** @type {TExtraArg} */(arg));
                if (item === null) { continue; }
                container.appendChild(item);
                if (item.nodeType === ELEMENT_NODE) {
                    /** @type {HTMLElement} */ (item).dataset.index = `${count}`;
                }
                ++count;
            }
        }

        container.dataset.count = `${count}`;

        return count;
    }

    /**
     * @param {HTMLElement} container
     * @param {string} term
     * @param {string} reading
     * @param {(element: HTMLElement, text: string) => void} addText
     */
    _appendFurigana(container, term, reading, addText) {
        container.lang = this._language;
        const segments = distributeFurigana(term, reading);
        for (const {text, reading: furigana} of segments) {
            if (furigana) {
                const ruby = document.createElement('ruby');
                const rt = document.createElement('rt');
                addText(ruby, text);
                ruby.appendChild(rt);
                rt.appendChild(document.createTextNode(furigana));
                container.appendChild(ruby);
            } else {
                addText(container, text);
            }
        }
    }

    /**
     * @param {string} dictionary
     * @returns {import('dictionary').Tag}
     */
    _createDictionaryTag(dictionary) {
        return this._createTagData(dictionary, 'dictionary');
    }

    /**
     * @param {HTMLElement} node
     * @param {string} value
     * @param {string} [language]
     */
    _setTextContent(node, value, language) {
        this._setElementLanguage(node, language, value);
        node.textContent = value;
    }

    /**
     * @param {HTMLElement} node
     * @param {string} value
     * @param {string} [language]
     */
    _setMultilineTextContent(node, value, language) {
        // This can't just call _setTextContent because the lack of <br> elements will
        // cause the text to not copy correctly.
        this._setElementLanguage(node, language, value);

        let start = 0;
        while (true) {
            const end = value.indexOf('\n', start);
            if (end < 0) { break; }
            node.appendChild(document.createTextNode(value.substring(start, end)));
            node.appendChild(document.createElement('br'));
            start = end + 1;
        }

        if (start < value.length) {
            node.appendChild(document.createTextNode(start === 0 ? value : value.substring(start)));
        }
    }

    /**
     * @param {HTMLElement} element
     * @param {string|undefined} language
     * @param {string} content
     */
    _setElementLanguage(element, language, content) {
        if (typeof language === 'string') {
            element.lang = language;
        } else {
            const language2 = getLanguageFromText(content, this._language);
            if (language2 !== null) {
                element.lang = language2;
            }
        }
    }

    /**
     * @param {string} reading
     * @param {import('dictionary').TermPronunciation[]} termPronunciations
     * @param {string[]} wordClasses
     * @param {number} headwordIndex
     * @returns {?string}
     */
    _getPronunciationCategories(reading, termPronunciations, wordClasses, headwordIndex) {
        if (termPronunciations.length === 0) { return null; }
        const isVerbOrAdjective = isNonNounVerbOrAdjective(wordClasses);
        /** @type {Set<import('japanese-util').PitchCategory>} */
        const categories = new Set();
        for (const termPronunciation of termPronunciations) {
            if (termPronunciation.headwordIndex !== headwordIndex) { continue; }
            for (const pronunciation of termPronunciation.pronunciations) {
                if (pronunciation.type !== 'pitch-accent') { continue; }
                const category = getPitchCategory(reading, pronunciation.positions, isVerbOrAdjective);
                if (category !== null) {
                    categories.add(category);
                }
            }
        }
        return categories.size > 0 ? [...categories].join(' ') : null;
    }

    /**
     * @template {HTMLElement} T
     * @param {string} name
     * @returns {T}
     */
    _instantiate(name) {
        return /** @type {T} */ (this._templates.instantiate(name));
    }

    /**
     * @template {HTMLElement} T
     * @param {Element|DocumentFragment} element
     * @param {string} selector
     * @returns {T}
     */
    _querySelector(element, selector) {
        return /** @type {T} */ (element.querySelector(selector));
    }
}
