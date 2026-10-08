# FenixJpCatch

Japanese–Vietnamese pop-up dictionary for your browser (Chrome). Hold **Shift** and hover over Japanese text to look a word up, offline, with Vietnamese meanings and Sino-Vietnamese (Hán Việt) readings.

**FenixJpCatch is a fork of [Yomitan](https://github.com/yomidevs/yomitan)** and keeps all of its features (multiple dictionaries, profiles, Anki integration, audio, search page, clipboard monitor, …). Based on Yomitan, © Yomitan Authors / Yomichan Authors, licensed under GPL-3.0-or-later. See [ATTRIBUTION.md](./ATTRIBUTION.md) and [CHANGES.md](./CHANGES.md) for the list of differences from upstream.

> Status: early development (pre-release). Branding, icons and store listing are placeholders.

## Differences from upstream

See [CHANGES.md](./CHANGES.md). In short: Vietnamese branding, a bundled Japanese–Vietnamese dictionary, and an optional "save word" (☆) feature. Looking words up never leaves your device; data is only sent when you press ☆ (see [PRIVACY-POLICY.md](./PRIVACY-POLICY.md)).

## Documentation

- Upstream usage documentation: [yomitan.wiki](https://yomitan.wiki)
- Making dictionaries: [Making Yomitan Dictionaries](./docs/making-yomitan-dictionaries.md)
- Anki templates: [Anki handlebar templates](./docs/templates.md)
- Known browser bugs: [docs/browser-bugs.md](./docs/browser-bugs.md)
- Keeping this fork in sync with upstream: [docs/upstream-sync.md](./docs/upstream-sync.md)
- Developer setup: [CONTRIBUTING.md](./CONTRIBUTING.md#setup)

## Building

1. Install [Node.js](https://nodejs.org/) (>= 22) and [npm](https://www.npmjs.com/).
2. Run `npm ci` to set up the environment.
3. Run `npm run license-report:html` to generate any missing or changed license information.
4. Run `npm run build` for a plain testing build or `npm run-script build -- --all --version {version}` for a release build (replacing `{version}` with a version number).
5. The builds for each browser and release branch can be found in the `builds` directory.

For more information, see [CONTRIBUTING.md](./CONTRIBUTING.md#setup).

## License

GPL-3.0-or-later (see [LICENSE](./LICENSE)), inherited from Yomitan. Dictionary data distributed with the extension is derived from JMdict, KANJIDIC2 and related EDRDG projects under CC BY-SA; see [ATTRIBUTION.md](./ATTRIBUTION.md).

## Third-Party Libraries

FenixJpCatch (like Yomitan) uses several third-party libraries to function.

<!-- The following table is generated using the command `npm run license-report:markdown`. -->

| Name                | License type | Link                                                                   |
| :------------------ | :----------- | :--------------------------------------------------------------------- |
| @resvg/resvg-wasm   | MPL-2.0      | git+ssh://git@github.com/yisibl/resvg-js.git                           |
| @zip.js/zip.js      | BSD-3-Clause | git+https://github.com/gildas-lormeau/zip.js.git                       |
| dexie               | Apache-2.0   | git+https://github.com/dexie/Dexie.js.git                              |
| dexie-export-import | Apache-2.0   | git+https://github.com/dexie/Dexie.js.git                              |
| hangul-js           | MIT          | git://github.com/e-/Hangul.js.git                                      |
| kanji-processor     | n/a          | https://registry.npmjs.org/kanji-processor/-/kanji-processor-1.0.2.tgz |
| parse5              | MIT          | git://github.com/inikulin/parse5.git                                   |
| yomitan-handlebars  | MIT          | n/a                                                                    |
| linkedom            | ISC          | git+https://github.com/WebReflection/linkedom.git                      |

## Attribution

`fallback-bloop.mp3` is provided by [UNIVERSFIELD](https://pixabay.com/sound-effects/error-8-206492/) and licensed under the [Pixabay Content License](https://pixabay.com/service/license-summary/).
