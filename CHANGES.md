# Changes from upstream Yomitan

This file lists how FenixJpCatch differs from [Yomitan](https://github.com/yomidevs/yomitan), as required by GPL-3.0 §5(a). Upstream files that this fork modifies are listed with the reason; entirely new files are listed by directory.

Fork base: `yomidevs/yomitan` tag `26.9.8.0` (+2 commits, `06393468`).

Policy: the fork only **adds** to Yomitan; no upstream feature is removed or hidden. See [docs/upstream-sync.md](./docs/upstream-sync.md).

## Unreleased

### Modified upstream files

| File                                         | Change                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `dev/data/manifest-variants.json`            | Branding: extension name, description, action title, author                                       |
| `ext/images/icon{16,19,32,38,48,64,128}.png` | Placeholder icons                                                                                 |
| `package.json`, `package-lock.json`          | Package name, description, repository/bugs/homepage URLs                                          |
| `README.md`                                  | Rewritten for the fork (upstream README is linked); third-party library table kept                |
| `CODEOWNERS`, `SECURITY.md`                  | Point to this repository; support email                                                           |
| `.github/dependabot.yml`                     | GitHub Actions only, weekly, grouped; npm updates disabled                                        |
| `.github/actions/setup/action.yml`           | npm download cache; https rewrite for the `yomitan-handlebars` git+ssh dependency                 |
| `.github/workflows/ci.yml`                   | Default branch is `main`; removed the CodSpeed benchmark job                                      |
| `.github/workflows/playwright.yml`           | Default branch is `main`; baseline screenshots are taken from this repository instead of upstream |
| `.github/workflows/codeql.yml`               | Default branch is `main`                                                                          |
| `.github/workflows/broken-links.yml`         | Uses the shared setup action                                                                      |

### Removed upstream files

Upstream release/publishing automation that depends on upstream's store accounts and secrets:
`.github/workflows/{auto-approve-run,auto-approve,publish-chrome-development,publish-chrome,publish-edge,publish-firefox-development,publish-firefox,release,touch-google-refresh-token,create-prerelease-on-tag,delay,scorecard}.yml`

### Added files

- `CLAUDE.md`, `ATTRIBUTION.md`, `CHANGES.md`, `docs/upstream-sync.md`
