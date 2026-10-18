# CLAUDE.md — FenixJpCatch extension (fork of Yomitan)

Technical notes for working in this repo. Language rules: code, comments, commit messages in English; any **new** user-facing UI text in Vietnamese.

- Upstream: https://github.com/yomidevs/yomitan (remote `upstream`). Fork base: `06393468` (`26.9.8.0-2-g06393468`, 2026-09).
- License: GPL-3.0-or-later (inherited). Keep `LICENSE` and all original copyright headers. Any upstream file we modify must carry a "modified" note (GPL-3.0 §5a) and be listed in `CHANGES.md`.
- Golden rule: **keep every Yomitan feature; only add**. Prefer new modules + existing extension points; minimize diff against upstream so `git merge upstream/master` stays cheap.
- No secrets in this repo. Firebase web config is public; anything else goes through `.env.example`.

> Status: Phase 2.1 completed (onboarding, dictionary release via dict-latest, action popup integration, public readiness). Next in this repo: Phase 3 (cloud/☆).

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
- **Service worker lifetime:** SW is killed when idle; anything long-lived/stateful (DB, clipboard) lives in the offscreen document. The offscreen doc is created in `background/offscreen-proxy.js:80` with **`reasons: ['CLIPBOARD']` only**, and Chrome allows **one offscreen document per profile** → do not touch it for our features (decision 6.3); if something ever must run there it has to extend this same document, never create a second one.
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

**Yomitan has no UI localisation**: no `_locales/`, no `chrome.i18n`, all UI strings are hard-coded English in `*.html`, `templates-*.html` and JS. (`chrome.i18n` hits in the repo are unrelated.) Decision 6.4: only our new UI is Vietnamese, through a small i18n layer in our own module; upstream pages and templates stay English and untouched.

## 6. Decisions

Decided 2026-10-08 (owner review of Phase 0). These replace any conflicting statement in earlier planning notes.

### 6.1 Repo & branches

- Repo name: `fenixjpcatch-extension` (this repo). Default branch: `main` (CI is configured for it). `upstream` remote = Yomitan.
- **Workflow from Phase 1 on:** each phase is developed on its own branch and merged into `main` through a PR; finish each phase with a report and wait for confirmation. (Phase 0 was committed directly; `main` was created from the Phase 0 branch.)
- A separate private repo holds the backend and dictionary tooling. **Nothing from this repo's Yomitan code is copied there.** The extension talks to the backend only through the callable API documented in `docs/api.md` (written in Phase 3).

### 6.2 Branding (placeholders)

- Display name `FenixJpCatch`, author `Fenix Labs`, description "Từ điển Nhật–Việt dạng popup, tra nhanh khi đọc web. Based on Yomitan" (no trailing period: the `*-dev` variants append ". This is a development build.").
- Contact/support email: `support@fenixlabs.app` (used in `SECURITY.md`; not in the manifest, where `author` is a plain string; set it in the store listing). Icons in `ext/images/icon*.png` are generated placeholders. Build zip file names (`yomitan-*.zip`) are intentionally unchanged to keep the diff small and Playwright/CI paths working.
- Upstream pages (welcome, info, settings…) still say "Yomitan" until Phase 2 adds our own welcome/About pages.

### 6.3 Authentication (replaces the earlier plan to use `firebase/auth/web-extension` popup flow)

- **Google only** in the extension. Flow: `chrome.identity.launchWebAuthFlow` (not `getAuthToken`) → Google OAuth → ID token/credential → Firebase `signInWithCredential`.
- **Do not modify upstream's offscreen document** (no extra reasons, no auth iframe).
- Needs the `identity` permission (add in Phase 3) and a **stable extension ID**, because the redirect URI is `https://<extension-id>.chromiumapp.org/`. Dev builds must pin the ID with a `key` in the manifest (public key only; the matching private key is kept by the owner, never committed). Store builds get their ID from the store; register both redirect URIs in the OAuth client.
- Email-link sign-in is **dropped** from the extension.
- Backlog (Phase 4, backend-driven): sign-in with a 6-digit pairing code issued by another signed-in client and exchanged by a backend function for a custom token, for users who register with Apple/email elsewhere. Not implemented in the extension until then.
- Auth state and network calls live in the Backend (service worker). Popup/search/settings pages go through `application.api.*`; never load the Firebase SDK in the injected popup iframe. Bundle with esbuild into `ext/lib/` via a new `dev/lib/*.js` entry.

### 6.4 Localization (replaces the earlier plan to localize the main screens)

- **Only new UI is Vietnamese**: our welcome page, sign-in, ☆ button + tooltips, "Từ đã lưu" page, About. Original Yomitan pages stay English.
- A small i18n layer inside our own module (`ext/js/cloud/` or a sibling `ext/js/fenix/`), **no edits to upstream templates** for translation purposes.

### 6.5 ☆ save-word button

- Shown on **every** term entry (tooltip and sign-in prompt per the signed-out state).
- `jmdictSeq` = `sequence` of the matching entry from the `FenixJpCatch JA-VI` dictionary, matched by `expression` + `reading`. If there is no such entry, the word is still saved with `jmdictSeq = null`. Never use the `sequence` of other dictionaries.
- Our dictionary **must** set `sequence = JMdict ent_seq` on every term row.
- Backend document ID: `"{seq}_{reading}"` when `seq` exists, else `"x_{hash(expression|reading)}"`. The hash function and normalization are **decided**: `hash = first 16 hex chars of SHA-256( NFC(trim(expression)) + "|" + NFC(trim(reading)) )` (UTF-8). It is computed **only by the server**; clients never send or choose IDs. Written into `docs/api.md` in Phase 3.
- Payload fields (`expression`, `reading`, `contextSentence`, `sourceUrl`, `sourceTitle`) come from `display.history.state` (see 4.5), never from the popup frame's own URL/title.

### 6.6 Dictionaries & updates

- Bundled dictionaries are auto-installed from an extension **page** (welcome/install page), reusing `DictionaryWorker`; they are placed first in the profile `dictionaries[]` (priority = array order). Users can still install others.
- Auto-update: only `isUpdatable`/`indexUrl`/`downloadUrl` in `index.json` (Yomitan's manual "Check updates"). **No `chrome.alarms`** for now; revisit in Phase 8.

### 6.7 Module layout & libraries

- New code in `ext/js/cloud/`. Upstream files touched only at integration points: `backend.js` `_apiMap`, `api.js`, `types/ext/api.d.ts`, `templates-display.html`, `popup-main.js`/`search-main.js`, `manifest-variants.json` (permissions), new page HTML. Every touched upstream file is listed in `CHANGES.md` and carries a "modified by FenixJpCatch" note where the format allows comments.
- Offline save queue: `chrome.storage.local` (`unlimitedStorage` already granted); retry on `online` event and service-worker wake.
- Libraries must be GPL-3.0-compatible (Apache-2.0 Firebase SDK is OK). Record name/version/license/reason here when added and regenerate `ext/legal-npm.html` (`npm run license-report:html`).

### 6.8 CI

- Kept: `ci.yml`, `codeql.yml`, `dependency-review.yml`; also kept `actionlint.yml`, `broken-links.yml`, `playwright.yml`, `playwright_comment.yml`.
- Removed: upstream publish/release/auto-approve/CodSpeed/scorecard/delay/touch-token workflows (see `CHANGES.md`).
- `.github/actions/setup`: npm cache + `git config url.https://github.com/.insteadOf ssh://git@github.com/` so `npm ci` can fetch the `yomitan-handlebars` git+ssh dependency.
- Playwright visual baselines now come from this repo's `main` (upstream's baselines no longer match our branding). The first run on `main` creates them; the merged `playwright-screenshots` artifact of that run (and the `playwright-report` artifact) is what the owner reviews.
- `dependabot.yml`: GitHub Actions only, weekly, one grouped PR. npm updates are off (manual).

### 6.9 Privacy

- `PRIVACY-POLICY.md` still describes upstream behavior. Phase 3 updates it together with the consent step before sending data (reuse `DataTransmissionConsentController`). Lookup stays 100% offline; data leaves the device only on ☆.

### 6.10 Merging upstream

See `docs/upstream-sync.md`. Keep branding diffs confined to: `dev/data/manifest-variants.json`, `package.json` metadata, `ext/images/icon*`, README, and (Phase 2) welcome/info/About.

## 7. Repo hygiene notes

- `.github/workflows/` was trimmed for the fork, see 6.8 and `CHANGES.md`. Workflows we kept still contain upstream conventions (e.g. Playwright pulls the test `dictionaries` branch from `yomidevs/yomitan`).
- `.env` (tracked) only contains `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1` for Playwright — not a secret.
- `PRIVACY-POLICY.md` states Yomitan sends no data externally; it must be updated when the save-word feature lands (data is sent only when the user presses ☆).
- Husky/lint-staged are set up (`npm ci --ignore-scripts` skips the hook install in automation).

## 8. Phase 2 — onboarding (implemented)

Code lives in `ext/js/fenix/` (sibling of the future `ext/js/cloud/`); entirely new files carry the fork header "Copyright (C) 2026 Fenix Labs" (separate `header/header` block at the end of `eslint.config.js`).

- **Entry point:** `Backend._openWelcomeGuidePage` opens `/fenix-welcome.html` (the only functional edit in upstream code). Yomitan's `/welcome.html` is untouched and linked from ours; `showGuide` keeps its upstream meaning (page opens once per browser session while it is on), which doubles as the retry trigger for a failed install.
- **First-run installer** (`dictionary-installer.js`, DI so it is testable): per dictionary of `FENIX_DICTIONARIES` (`dictionary-release.js`) → `downloadWithProgress` (fetch, idle timeout) → `DictionaryWorker.importDictionary` (same as the settings page) → splice into every profile's `dictionaries[]` at the top (`onboarding-settings.js`, canonical order `ja-vi`, `kanji-vi`) → `triggerDatabaseUpdated`. State in `chrome.storage.local['fenixOnboarding']` (`onboarding-state.js`): a dictionary the user deleted later is not reinstalled; a failed one is not recorded, so it is retried. Web Locks (`fenix-dictionary-install`) serialize concurrent welcome tabs. The archive's `index.json` title (`archive-index.js`) must equal the documented one (`docs/dictionary-release.md`) and is checked **before** importing. Any importer error (the importer swallows row-write failures and still returns a summary) or a null result means a partial import: it is deleted again, not registered, not recorded, so the next run starts clean; a leftover summary with `importSuccess === false` is treated as not installed. Such a leftover is deleted **only if the first-run setup itself started it** (`importing[id]` in the state, set before the import and cleared on success, after a successful cleanup, or when the importer rejected before writing anything; the install Web Lock guarantees that an earlier marked attempt is dead). An unmarked unfinished import may be a live import from the settings page (the importer writes the summary with `importSuccess:false` before the data) and is never touched: the welcome page reports an error for that dictionary until it finishes or the user removes it.
- **Audio:** TTS fallback is applied from the welcome page, not via schema defaults (no options migration): the built-in `ja` sources are written out explicitly followed by `text-to-speech-reading` with the best `ja` voice (voices only exist in a page context). Default sources are otherwise appended _after_ configured ones, so adding only TTS would make it primary. No Japanese voice → nothing added, retried on the next welcome open. `audioFallbackApplied` (`audio-fallback.js`) is written only after every settings modification succeeded.
- **i18n:** `i18n.js` (`t(key, params)`, `data-i18n*` attributes) + `messages-vi.js`. A unit test checks that every key used in the HTML/JS exists. Upstream pages stay English.
- **Tests:** `test/fenix/*` (vitest, fixture dictionaries built in memory by `test/fenix/fixtures/dictionary-fixtures.js`, real importer on fake-indexeddb) and `test/playwright/fenix-onboarding.spec.js` (real Chromium; release URL served from fixtures). `playwright-util.js` aborts the release URL by default so no test hits the network. The installed Chromium in cloud sandboxes may not match Playwright's expected revision; symlink it into `/opt/pw-browsers/chromium-<rev>/chrome-linux/chrome` locally (not in the repo).
- **Phase 2.1 updates:** About/welcome pages are now accessible directly from the action popup menu; `showGuide` is automatically turned off once all dictionaries are installed so the guide does not re-open every session; dictionary releases use the dedicated rolling tag `dict-latest` (plus `dict-<revision>`) instead of `releases/latest` to avoid collision with extension builds.

### 8.1 CI notes (Phase 2 follow-up)

- **Node is pinned to 22** in `.github/actions/setup` (package.json only says `>=22`, which resolves to the newest Node). Playwright 1.49.1 hangs forever at test discovery on Node 24 (`npx playwright test --list` never returns; reproduced with 24.21.0). Drop the pin after upgrading `@playwright/test`.
- **Private repo:** `CodeQL` and `dependency-review` run only when `github.event.repository.private == false` (they need GitHub Advanced Security). `playwright.yml` has `actions: read` for the baseline download. `.lycheeignore` has temporary entries for this repo's Releases/issues/pulls (TODO remove when public).
- **Playwright baseline:** upstream skips every PR test while `main` has no successful run with screenshots. We run them in update mode instead, so PR runs execute the functional tests but compare no screenshots; the first successful push run on `main` creates the baseline. PR runs are non-blocking by upstream design (`|| true`), so read the shard logs (the `list` reporter is on in CI) rather than the check colour.
- **Link checker:** concurrency 10, retries, and transient 408/429/502/503/504 accepted; `gnu.org/licenses` skipped (rate limits/timeouts).
- `test/playwright/playwright-util.js`: the Anki mock answers `canAddNotes*` once per submitted note (it returned a fixed pair, which made `integration.spec › anki add` fail on upstream code at the fork base).

### 8.2 Known issues

- **Race: a Settings import slipping in between the onboarding title check and the onboarding import (accepted, not fixed).** `FenixDictionaryInstaller.install` checks `getDictionaryInfo()` for the title, then calls the importer. The importer's own "already imported" check and its summary insert are not atomic with that, and nothing locks the dictionary database against the Settings importer (only welcome tabs share the `fenix-dictionary-install` Web Lock). If the user starts importing the _same_ title from Settings inside that window, the onboarding importer returns `result: null` ("already imported"), and the failure path then deletes the title, which removes the Settings import that is still running. Effect: that one manual import ends up missing or half-written; the user can import it again, and the next welcome visit installs the bundled one. Not fixed on purpose: closing it needs a lock shared with the upstream importer (edits to `dictionary-importer.js`/`dictionary-controller.js`), which conflicts with the minimal-diff rule. The window is milliseconds long and needs a manual import of the exact same title at the same time, so it is not expected in practice. The earlier, wider variant (Settings import _already running_ when the welcome page opens) is handled: an unfinished import that the first-run setup did not start is never deleted (§8, `importing[id]`).
  - **How to reproduce:** in a unit test, wrap `importArchive` in `test/fenix/dictionary-installer.test.js` so that it first imports the same fixture archive through a second `DictionaryImporter` (the "Settings" import) and then calls the real importer; the second call returns `result: null` and the installer's cleanup deletes the first import. By hand this is practically not reproducible; the nearest approximation is to open the welcome page with the dictionaries missing and, in the same second, import `fenixjpcatch-ja-vi.zip` from Settings › Dictionaries › Import.
  - **Revisit when:** upstream's importer gets a database-level lock, or if we ever carry a patch to it anyway.
- **Orphaned ownership mark (accepted, not fixed).** `install()` persists `importing[id]` _before_ the importer inserts its summary (reading and validating the archive in between takes seconds). If the welcome tab is killed in that window the mark survives without a row of ours. It stays harmless until a Settings import of the same title is running when the next welcome page opens: its unfinished summary is then taken for the abandoned onboarding import and deleted (same effect as the race above: the manual import has to be started again). Needs three coincidences (tab closed during the first install, a manual import of a title the setup would install anyway, and a welcome page opening mid-import). Fixing it properly means binding ownership to the actual row (impossible without a field the importer lets us set) or dropping automatic cleanup of leftovers in favour of an explicit "delete and retry" button; both are bigger than the problem. **How to reproduce:** in `test/fenix/dictionary-installer.test.js` call `install()` with an `importArchive` that never settles, leave the mark in the state, then import the same fixture archive as an unfinished summary (override `getDictionaryInfo` to report `importSuccess: false`) and run `installFirstRun`: the summary is deleted.
