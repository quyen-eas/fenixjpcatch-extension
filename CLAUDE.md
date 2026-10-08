# CLAUDE.md — FenixJpCatch extension (fork of Yomitan)

Technical notes for working in this repo. Language rules: code, comments, commit messages in English; any **new** user-facing UI text in Vietnamese.

- Upstream: https://github.com/yomidevs/yomitan (remote `upstream`). Fork base: `06393468` (`26.9.8.0-2-g06393468`, 2026-09).
- License: GPL-3.0-or-later (inherited). Keep `LICENSE` and all original copyright headers. Any upstream file we modify must carry a "modified" note (GPL-3.0 §5a) and be listed in `CHANGES.md`.
- Golden rule: **keep every Yomitan feature; only add**. Prefer new modules + existing extension points; minimize diff against upstream so `git merge upstream/master` stays cheap.
- No secrets in this repo. Firebase web config is public; anything else goes through `.env.example`.

> Status: Phase 0 — architecture notes only. No functional change has been made yet.

---

## 1. Toolchain & commands

Node >= 22 (checked with 22.22 / npm 10.9). Plain ES modules, **no bundler for `ext/js`** (files are served as-is; JSDoc + `tsc --noEmit` provides typing). `esbuild` is used only for `ext/lib/*` (`dev/build-libs.js`: bundles `dev/lib/*.js` into `ext/lib/`, generates the Ajv standalone validator `ext/lib/validate-schemas.js`, copies `resvg.wasm`).

| Command                                              | What                                                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm ci`                                             | Install. (`yomitan-handlebars` is a git dependency pinned by commit, resolved via `git+ssh` in the lockfile — needs git/ssh→https rewrite in sandboxed envs; first install is slow.) |
| `npm run build:libs`                                 | Build `ext/lib/` (required before tests/build; gitignored)                                                                                                                           |
| `npm run build`                                      | `dev/bin/build.js` → `builds/*.zip` for every variant in `dev/data/manifest-variants.json` (`--target chrome-dev` for one). `--dryRun --all` = `test:build`                          |
| `npm run test:unit`                                  | vitest (4839 pass / 46 skipped at fork base)                                                                                                                                         |
| `npm run test:unit:options`                          | options-upgrade tests                                                                                                                                                                |
| `npm run test:js` / `test:ts:main`                   | eslint / tsc (JSDoc types in `types/ext/*.d.ts`)                                                                                                                                     |
| `npm run test:css` `test:html` `test:md` `test:json` | stylelint / html-validate / prettier / eslint-json + schema types                                                                                                                    |
| `npm test`                                           | all of the above (CI runs them as a matrix, see `.github/workflows/ci.yml`)                                                                                                          |
| Playwright (`test/playwright`)                       | integration + visual; needs `builds/yomitan-chrome-playwright.zip`                                                                                                                   |

**Baseline at fork base (verified):** `build:libs`, `test:unit` (4839 passed), `test:js` (0 errors, 1 pre-existing warning in `anki-note-builder.js:272`), `test:ts:main`, `build` (all variants), `test:unit:options` all green. Working tree stays clean after build (`ext/lib`, `builds` are ignored).

Test rule for us: Yomitan's suite must stay green; new code ships with new tests under `test/` (vitest, `test/mocks`, `test/fixtures` exist).

## 2. Runtime topology (MV3)

```
web page ── content script (js/app/content-script-main.js → Frontend, TextScanner)
   │            └─ iframe popup.html (web_accessible; extension origin) ← Display (js/display/popup-main.js)
   │
service worker sw.js → js/background/background-main.js → Backend (3k lines, the hub)
   │      └─ offscreen.html (js/background/offscreen*.js): DictionaryDatabase + Translator + clipboard
   │             (Chrome only; Firefox/Safari builds use background.html and run everything in-page)
   ├─ extension pages: settings.html, welcome.html, info.html, search.html, action-popup.html, permissions.html …
   └─ sandbox page template-renderer.html (Handlebars for Anki, `unsafe-eval` only here)
```

- **Messaging:** every page talks to the background through `js/comm/api.js` (`API._invoke(action, params)`), dispatched in `Backend._apiMap` (`createApiMap([...])`, ~45 actions at `backend.js:146-192`; types in `types/ext/api.d.ts`). Adding a backend capability = new entry in `_apiMap` + method in `API` + types. This is the designated extension point for our cloud features.
- **Cross-frame:** `js/comm/cross-frame-api.js`, `frame-*` for iframe/nested-popup plumbing. Popups are created by `js/app/popup-factory.js`/`popup.js` (iframe injected into the page) or `popup-window.js`.
- **Service worker lifetime:** SW is killed when idle; anything long-lived/stateful (DB, clipboard) lives in the offscreen document. The offscreen doc is created in `background/offscreen-proxy.js:80` with **`reasons: ['CLIPBOARD']` only**, and Chrome allows **one offscreen document per profile** → any extra need (e.g. Firebase popup auth iframe) must extend this same document (add reason + handler), not create a second one.
- **CSP** (`dev/data/manifest-variants.json`): `extension_pages: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; …; connect-src *`. Remote scripts are forbidden → SDKs must be bundled; outbound `fetch`/XHR to any host is already allowed (`connect-src *`). Sandbox page has `unsafe-eval`.
- **Manifest** is generated, not committed: `dev/data/manifest-variants.json` (base + variants `chrome`, `chrome-dev`, `chrome-playwright`, `firefox*`, `edge`, `safari`; version injected via `$YOMITAN_VERSION`). Name/description/icons/author live here → single place for branding, but also a recurring merge-conflict hotspot. Permissions today: `storage, clipboardWrite, unlimitedStorage, declarativeNetRequest, scripting, offscreen, contextMenus`; optional `clipboardRead, nativeMessaging`; host `<all_urls>`.

## 3. Directory map (`ext/`)

| Path                              | Role                                                                                                                                                                                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/application.js`               | `Application.main(isPage, fn)` bootstrap used by every page/script entry; owns `api`, `crossFrame`                                                                                                                                                                                                                           |
| `js/background/`                  | `backend.js` (hub), `offscreen*.js`, `request-builder.js` (header rewriting for fetches), `script-manager.js`, `profile-conditions-util.js`                                                                                                                                                                                  |
| `js/app/`                         | content-script side: `frontend.js` (scan→popup orchestration), `popup*.js`, `theme-controller.js`                                                                                                                                                                                                                            |
| `js/language/`                    | `translator.js` (lookup/merge/group, 2.5k lines), `text-scanner.js` (hover/click scanning + sentence extraction), `language-descriptors.js`, per-language dirs (`ja/` has deinflection `japanese-transforms.js`, kana utils; `vi/` is Vietnamese-as-_target language_ text preprocessing, **not UI i18n**)                   |
| `js/dictionary/`                  | `dictionary-importer.js` (zip → DB, validates with Ajv schemas), `dictionary-database.js` (Dexie/IndexedDB), `dictionary-worker*.js` (import runs in a Web Worker), `dictionary-data-util.js`                                                                                                                                |
| `js/display/`                     | the dictionary UI used in popup / search page / settings preview: `display.js` (entry rendering, history, hotkeys), `display-generator.js` (DOM from `templates-display.html`), `display-anki.js`, `display-audio.js`, `structured-content-generator.js`, `query-parser.js`, entry points `popup-main.js` / `search-main.js` |
| `js/pages/`                       | settings (`pages/settings/*-controller.js`, one controller per section), welcome, info, permissions, action-popup                                                                                                                                                                                                            |
| `js/data/`                        | `options-util.js` (options defaults + versioned migrations), `anki-*`, `database.js`, `json-schema.js`                                                                                                                                                                                                                       |
| `js/comm/`                        | API wrappers: `api.js`, `anki-connect.js`, `mecab.js`, `yomitan-api.js`, clipboard                                                                                                                                                                                                                                           |
| `js/media/`                       | audio sources / TTS (`audio-system.js`, `text-to-speech-audio.js`, `audio-downloader.js`)                                                                                                                                                                                                                                    |
| `data/`                           | `schemas/*.json` (options + dictionary format JSON-schemas), `recommended-dictionaries.json`, `recommended-settings.json`, `templates/` (Anki Handlebars + upgrade templates), `structured-content-style.json`                                                                                                               |
| `*.html`                          | pages; `templates-display.html`, `templates-settings.html`, `templates-modals.html` are `<template>` libraries instantiated by JS                                                                                                                                                                                            |
| `lib/`                            | **build output** (esbuild bundles + wasm) — gitignored                                                                                                                                                                                                                                                                       |
| `types/ext/` (repo root `types/`) | `.d.ts` for every module; `tsc` runs over JSDoc, so new JS needs JSDoc types                                                                                                                                                                                                                                                 |

## 4. Core flows relevant to our additions

### 4.1 Lookup

`TextScanner` (in content script) → `api.termsFind` → `Backend._onApiTermsFind` → `Translator` (deinflect via language transforms → DB queries → group/merge → sort) → `DictionaryEntry[]` back to `Frontend` → `Popup` iframe → `Display.setContent()` renders with `DisplayGenerator`. Lookup is fully local (IndexedDB in the offscreen doc). Default trigger: Shift+hover (configurable under scanning inputs).

### 4.2 Dictionary format & import

- Standard Yomitan zip (`index.json`, `term_bank_N.json`, `tag_bank`, `kanji_bank`, `*_meta_bank`, media). Schemas in `ext/data/schemas/dictionary-*`.
- Term row = `[expression, reading, definitionTags, rules, score, glossary, sequence, termTags]`. **`sequence`** (int, `-1`=none) groups entries for merge mode; for JMdict-derived dictionaries it can carry the JMdict `ent_seq`. `DictionaryEntry.definitions[].sequences: number[]` exposes it to the UI (`types/ext/dictionary.d.ts:367`). `rules` (`v1`, `v5k`, `vs`, `adj-i`…) must be valid for the deinflection engine to apply conjugation.
- `index.json` supports `isUpdatable`, `indexUrl`, `downloadUrl` (+ `revision`), required together (`index-schema` lines 49-58, 123).
- **Import runs in a page context** (Worker spawned by `DictionaryWorker` from a page; code: `pages/settings/dictionary-import-controller.js` → `dictionary-worker.js`), _not_ in the service worker. Supports import from File and from URL (`fetch` → ArrayBuffer → worker; progress steps defined in `_getFileImportSteps/_getUrlImportSteps`).
- **Update check is manual only**: `DictionaryController._checkForUpdates()` is triggered by the "Check updates" button in settings; it fetches `indexUrl`, compares `revision`, then re-imports from `downloadUrl`. There is no `chrome.alarms` / background updater in the codebase.
- Per-profile dictionary list lives in options: `profiles[i].options.dictionaries[] = {name, alias, enabled, allowSecondarySearches, definitionsCollapsible, partsOfSpeechFilter, useDeinflections}`; **array order = priority**. `ext/data/recommended-dictionaries.json` (keyed by language code; has a `ja` entry) feeds the "recommended dictionaries" modal (imports by `downloadUrl`).

### 4.3 Options & profiles

Options JSON is validated by `ext/data/schemas/options-schema.json` and migrated by version in `js/data/options-util.js` (`_getVersionUpdates`; every schema change needs an upgrade step + `test:unit:options`). Defaults are derived from the schema `default`s. `general.showGuide` → Backend opens `welcome.html` once per session on startup (`backend.js:337-341`, `_openWelcomeGuidePageOnce`). `ext/data/recommended-settings.json` has per-language "recommended settings" offered in the welcome page (`recommended-settings-controller.js`). `_onInstalled` currently only requests persistent storage.

### 4.4 Entry header actions (where a ☆ button fits)

- Markup: `templates-display.html` → `#term-entry-template` → `.entry-header .actions` contains `.note-actions-container` (filled at runtime by `DisplayAnki._createSaveButtons`, `display-anki.js:~312`), then `.action-button-container` (play-audio + `menu` kebab). Kanji entries have their own template.
- Buttons are `<button class="action-button" data-action="…">` with `.action-icon[data-icon]` (SVG sprite via CSS, `ext/images/*.svg`) and optional `data-hotkey`. Wiring pattern: feature classes constructed in `popup-main.js` and `search-main.js` (`DisplayAudio`, `DisplayAnki`, …), each listening to display events and decorating entry nodes (`display.dictionaryEntryNodes`, `getElementDictionaryEntryIndex`). A `DisplayCloud` class following the same pattern is the natural, low-diff integration.
- Both `popup.html` (iframe in arbitrary pages) and `search.html` instantiate `Display`, so any new button/logic must run in both.

### 4.5 Context sentence (the `{sentence}` source)

`TextScanner` → `TextSourceGenerator.extractSentence(...)` (`js/dom/text-source-generator.js:65`) using profile `sentenceParsing` options (scan extent, terminators, quotes). Result `{text, offset}` is passed with the search result into `Display.setContent({state: {sentence, url, documentTitle, …}})` (`display.js ~2178`). Consumers read it from `display.history.state`; `DisplayAnki._getNoteContext()` (`display-anki.js:~362`) is the reference implementation (falls back to `fullQuery`; page title/url fall back to `document.title`/`location.href` of the popup frame — i.e. `state` must be preferred, or the popup's own URL leaks in). **Reuse this accessor for any "save word" payload.**

### 4.6 Anki integration (must remain untouched)

`AnkiConnect` (`comm/anki-connect.js`) in the Backend; note building in `data/anki-note-builder.js` + sandboxed Handlebars renderer (`templates/`); UI in `display-anki.js` and `pages/settings/anki-*`. Large (1.6k lines in display-anki alone) — do not refactor.

## 5. i18n status (important)

**Yomitan has no UI localisation**: no `_locales/`, no `chrome.i18n`, all UI strings are hard-coded English in `*.html`, `templates-*.html` and JS. (`chrome.i18n` hits in the repo are unrelated.) A Vietnamese UI therefore needs a new, additive mechanism (e.g. a `data-i18n` attribute pass + a dictionary of strings applied at page/Display load, shipped as a new module) — scope and merge-cost to be decided; upstreaming is unlikely to be accepted as-is.

## 6. Design decisions for the planned additions (to be confirmed)

1. **Module location:** `ext/js/cloud/` for everything new (auth, API client, save queue, UI glue); touch upstream files only at integration points: `backend.js` `_apiMap`, `api.js`, `types/ext/api.d.ts`, `templates-display.html`, `popup-main.js`/`search-main.js`, `offscreen-proxy.js`/`offscreen.js`, `manifest-variants.json`, new page HTML for "Saved words".
2. **Where the SDK lives:** auth state and network calls in Backend/offscreen only; popup/search/settings pages call `application.api.*` (never load the Firebase SDK in the injected popup iframe). Bundle with esbuild into `ext/lib/` via a new `dev/lib/*.js` entry (existing mechanism).
3. **Auth:** Firebase `firebase/auth/web-extension`; Google popup flow needs the offscreen iframe (extend the single existing offscreen doc with reason `IFRAME_SCRIPTING`) or alternatively `chrome.identity` + `signInWithCredential`; email-link needs a hosted landing page. Pending decision.
4. **Offline queue:** `chrome.storage.local` (`unlimitedStorage` already granted); retry on `online` event / SW wake (no alarms permission yet).
5. **Auto-install of bundled dictionaries:** must run in an extension _page_ (welcome page or a dedicated install page), reusing `DictionaryWorker` + the import controller logic; then prepend to the profile `dictionaries[]` for priority.
6. **Libraries:** must be GPL-3.0-compatible (Apache-2.0 Firebase SDK is OK). Record name/version/license/reason in this file when added, and regenerate `ext/legal-npm.html` (`npm run license-report:html`).
7. **Merge hygiene:** see `docs/upstream-sync.md` (to be written). Keep branding diffs confined to `dev/data/manifest-variants.json`, `package.json` metadata, `ext/images/icon*`, and welcome/info/about HTML.

## 7. CI & repo hygiene notes

- `.github/workflows/` is upstream's: `ci.yml` (lint/tsc/unit/build/manifest-schema/bench), `playwright*.yml`, `codeql`, `scorecard`, and **publish/release workflows that target upstream's store accounts/secrets** (`publish-chrome*.yml`, `publish-edge.yml`, `publish-firefox*.yml`, `release.yml`, `touch-google-refresh-token.yml`, `create-prerelease-on-tag.yml`). For the fork: keep `ci.yml`/`codeql`/`dependency-review`; disable or rewrite the publishing, auto-approve and CodSpeed jobs.
- `.env` (tracked) only contains `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` for Playwright — not a secret.
- `PRIVACY-POLICY.md` states Yomitan sends no data externally; it must be updated when the save-word feature lands (data is sent only when the user presses ☆).
- Husky/lint-staged are set up (`npm ci --ignore-scripts` skips the hook install in automation).
