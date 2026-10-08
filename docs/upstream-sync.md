# Syncing with upstream Yomitan

FenixJpCatch is a fork of [yomidevs/yomitan](https://github.com/yomidevs/yomitan). To keep merges cheap, our changes are additive: new code lives in new files/directories (e.g. `ext/js/cloud/`), and upstream files are only touched at a small number of integration points (listed in [CHANGES.md](../CHANGES.md)).

## Setup (once)

```sh
git remote add upstream https://github.com/yomidevs/yomitan.git
git fetch upstream --tags
```

## Routine merge (monthly, or when upstream tags a release)

Upstream uses calendar versions (`26.9.8.0`) and releases from `master`.

1. Work on a branch: `git switch -c sync/upstream-<tag> main`
2. `git fetch upstream --tags`, then see what is coming: `git log --oneline HEAD..upstream/master` and `git diff --stat HEAD...upstream/master`.
3. Prefer merging a release tag: `git merge <tag>` (use `upstream/master` only if a needed fix is unreleased). **Merge, don't rebase** — history stays linear to upstream and conflict resolutions are recorded.
4. Resolve conflicts (see hotspots below). Never resolve by dropping upstream behavior.
5. `npm ci && npm run build:libs`, then run the full suite: `npm test` (and Playwright if visual/UI code changed). Upstream's tests must stay green.
6. Update the fork base line in [CHANGES.md](../CHANGES.md), [ATTRIBUTION.md](../ATTRIBUTION.md) and [CLAUDE.md](../CLAUDE.md).
7. Open a PR titled `Sync upstream <tag>`; merge with a merge commit (no squash).

## Conflict hotspots

| File                                                                                                                                 | What to do                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev/data/manifest-variants.json`                                                                                                    | Keep our name/description/author/title; take upstream's other changes. Re-check permissions we added.                                                     |
| `package.json`, `package-lock.json`                                                                                                  | Keep our metadata fields. For the lockfile: take upstream's, then re-apply our added dependencies with `npm install` (never hand-merge).                  |
| `README.md`                                                                                                                          | Ours is rewritten; keep ours, skim upstream's for new docs worth linking.                                                                                 |
| `.github/workflows/*`                                                                                                                | Upstream may modify files we deleted (publish/release/…): keep them deleted. Re-apply the `main` branch name in files we kept.                            |
| `.github/actions/setup/action.yml`                                                                                                   | Keep our https rewrite and npm cache.                                                                                                                     |
| `ext/data/schemas/options-schema.json`, `ext/js/data/options-util.js`                                                                | If we add options, our migration must run **after** upstream's: renumber our version step on conflict and re-run `npm run test:unit:options`.             |
| `ext/templates-display.html`, `ext/js/display/*-main.js`, `ext/js/background/backend.js`, `ext/js/comm/api.js`, `types/ext/api.d.ts` | Our integration points: re-apply our few added lines/entries.                                                                                             |
| `eslint.config.js`, `test/playwright/playwright-util.js`                                                                             | Ours are one appended config block (fork header for new files) and one added `context.route` (aborts release downloads in tests): re-apply after merging. |
| `ext/images/icon*.png`                                                                                                               | Keep ours.                                                                                                                                                |

## After merging

- `npm run license-report:html` if dependencies changed.
- Check that new upstream features did not add anything we must adapt (new `chrome.*` permissions, new API-map entries we mirror, changes to the entry header markup or sentence extraction used by the cloud module).
- Smoke test: build `chrome-dev`, load unpacked, look up a word on a Japanese page (Shift+hover).

## Contributing back

Bug fixes that are not specific to FenixJpCatch should be proposed upstream as separate PRs from a branch based on `upstream/master`, so our fork benefits from them on the next sync.
