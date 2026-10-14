# Dictionary release convention

FenixJpCatch installs two dictionaries on first run by downloading them from the **latest GitHub Release of this repository** (`quyen-eas/fenixjpcatch-extension`). The private platform repository (`fenixjpcatch-platform`) builds the archives and must follow this convention exactly. The extension side lives in `ext/js/fenix/dictionary-release.js`; a unit test keeps this document and that file in sync.

## Assets

Every Release that can be "latest" must carry **all four** assets, with these exact names:

| Asset                              | Content                                       | Dictionary title (`index.json`) |
| ---------------------------------- | --------------------------------------------- | ------------------------------- |
| `fenixjpcatch-ja-vi.zip`           | Term dictionary (Yomitan format 3 archive)    | `FenixJpCatch JA-VI`            |
| `fenixjpcatch-ja-vi.index.json`    | Copy of the `index.json` inside the zip above |                                 |
| `fenixjpcatch-kanji-vi.zip`        | Kanji dictionary (Yomitan format 3 archive)   | `FenixJpCatch Kanji-VI`         |
| `fenixjpcatch-kanji-vi.index.json` | Copy of the `index.json` inside the zip above |                                 |

Download URLs (stable, they always redirect to the newest Release):

- `https://github.com/quyen-eas/fenixjpcatch-extension/releases/latest/download/fenixjpcatch-ja-vi.zip`
- `https://github.com/quyen-eas/fenixjpcatch-extension/releases/latest/download/fenixjpcatch-ja-vi.index.json`
- `https://github.com/quyen-eas/fenixjpcatch-extension/releases/latest/download/fenixjpcatch-kanji-vi.zip`
- `https://github.com/quyen-eas/fenixjpcatch-extension/releases/latest/download/fenixjpcatch-kanji-vi.index.json`

Rules:

- GitHub resolves `latest` to the most recent **published, non-draft, non-prerelease** Release of the repository, whatever it contains. If extension releases and dictionary releases are ever separate, only one of them may be "latest" and it would then lack the other's assets; therefore either every Release carries all four assets, or extension-only Releases are marked pre-release.
- The repository must be **public** for anonymous clients to download release assets (a private repository answers 404).
- Asset names are lowercase and never versioned; the version lives in `revision`.

## `index.json` of each archive

| Field                                  | Term dictionary (`ja-vi`)                                               | Kanji dictionary (`kanji-vi`)   |
| -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------- |
| `title`                                | `FenixJpCatch JA-VI` (exact; the extension rejects any other title)     | `FenixJpCatch Kanji-VI` (exact) |
| `format`                               | `3`                                                                     | `3`                             |
| `revision`                             | `YYYY.MM.DD.N`, dot-separated integers (see below)                      | same                            |
| `sequenced`                            | `true`                                                                  | `false` or omitted              |
| `isUpdatable`                          | `true`                                                                  | `true`                          |
| `indexUrl`                             | the `.index.json` URL above                                             | the `.index.json` URL above     |
| `downloadUrl`                          | the `.zip` URL above                                                    | the `.zip` URL above            |
| `sourceLanguage`/`targetLanguage`      | `ja` / `vi`                                                             | `ja` / `vi`                     |
| `author`, `description`, `attribution` | free text; `attribution` should name JMdict/KANJIDIC2/KRADFILE/wordfreq | free text                       |

- `revision` must be 4 dot-separated integers (e.g. `2026.10.08.1`). Yomitan's "Check updates" compares it numerically (`compareRevisions`); when the number of parts differs it falls back to string comparison. Increase it on every published build.
- `isUpdatable`, `indexUrl` and `downloadUrl` must appear together (upstream schema rule). They make Yomitan's manual **Check updates** button work; there is no background updater.
- Term rows: `[expression, reading, definitionTags, rules, score, glossary, sequence, termTags]`. **`sequence` must be the JMdict `ent_seq` on every row** (decision 6.5: the ☆ feature identifies words by it). `rules` must use the standard deinflection identifiers (`v1`, `v5`, `vs`, `vk`, `adj-i`, …) or conjugated forms will not be found.
- Kanji rows follow the standard `kanji_bank_N.json` v3 layout.
- Compression: deflate is fine for the browser; the zip may be stored uncompressed (level 0) only for Node-based tooling that cannot decompress.

## How the extension uses it

1. The welcome page (`fenix-welcome.html`) opens on first install (Yomitan's `general.showGuide`).
2. For each dictionary that is not installed and was never installed before, it downloads `<name>.zip` with a progress bar, imports it with Yomitan's `DictionaryWorker`, and registers it at the **top** of every profile's dictionary list (`ja-vi` first, then `kanji-vi`); the term dictionary also becomes `general.mainDictionary` when that is empty.
3. A dictionary that was installed and later removed by the user is not installed again automatically; the page offers an "Cài đặt" button.
4. A failed download or import is shown with a "Thử lại" button. The archive's `index.json` title is checked before importing; an import that reports any error is deleted again, so a failure never leaves a half-imported dictionary behind. Nothing is recorded on failure, so the next welcome page opens retries automatically.
5. Later updates: Yomitan's manual "Check updates" in the dictionary settings (uses `indexUrl`/`revision`/`downloadUrl`).

## Testing without the real files

This repository ships no real dictionary. `test/fenix/fixtures/dictionary-fixtures.js` builds two tiny archives (30 terms, 20 kanji, every gloss marked as test data, sequences from 9,000,001) in the same format, and `test/fenix/dictionary-installer.test.js` runs the whole download → import → registration flow against them with an in-memory IndexedDB.
