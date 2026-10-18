# Public Release Checklist — FenixJpCatch Extension

Checklist for switching the repository `quyen-eas/fenixjpcatch-extension` from private to public.

---

## 1. Licensing & Attribution Compliance (GPL-3.0 & CC BY-SA 4.0)

- [x] Root `LICENSE` file is GPL-3.0-or-later (inherited from Yomitan).
- [x] All upstream source headers preserved; modified upstream files carry modification notes per GPL-3.0 §5a.
- [x] All new files created by Fenix Labs carry standard GPL-3.0 copyright headers ("Copyright (C) 2026 Fenix Labs").
- [x] `CHANGES.md` documents all differences and additions compared to upstream Yomitan base commit.
- [x] `ATTRIBUTION.md` attributes Yomitan authors, Yomichan authors, JMdict, KANJIDIC2, audio assets, and third-party libraries.
- [x] `README.md` and `PRIVACY-POLICY.md` include explicit disclaimers:
  > _FenixJpCatch is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Yomitan, Yomichan, or their development teams._

---

## 2. Secrets & Internal Information Scrubbing

- [x] **No Secrets**: Git history and working tree scanned with `gitleaks` (0 secrets detected).
- [x] **No Private Architecture Leaks**:
  - No internal backend repository names mentioned.
  - No internal Gemini API keys, budget alerts, quotas, or cloud architecture details leaked.
  - Internal Phase 2 knowhow moved out of public repo.
- [x] `.env.example` provides guidance for any required local dev variables without real credentials.
- [ ] Author rewrite applied to fork commit history if desired (`Fenix Labs <support@fenixlabs.app>`). _(Requires owner confirmation before force-push)_.

---

## 3. Bilingual Documentation & Privacy

- [x] `README.md` is fully bilingual (English & Tiếng Việt), including feature overviews, installation instructions, and dictionary release explanations.
- [x] `PRIVACY-POLICY.md` is fully bilingual (English & Tiếng Việt), explicitly documenting:
  - 100% offline text lookup.
  - Zero telemetry or tracking.
  - Network egress disclosure for downloading static dictionary archives from GitHub Releases via `dict-latest`.

---

## 4. Dictionary Release Infrastructure

- [x] Extension onboarding references the dedicated rolling tag `dict-latest` (and immutable tags `dict-<revision>`) on `quyen-eas/fenixjpcatch-extension`.
- [x] Platform dictionary release workflow is configured to publish:
  - `fenixjpcatch-ja-vi.zip` + `.index.json`
  - `fenixjpcatch-kanji-vi.zip` + `.index.json`
  - `SHA256SUMS`
- [x] Initial dictionary release published to GitHub Releases before making extension public, ensuring new users immediately receive working dictionaries on first run.

---

## 5. Automated Tests & CI Validation

- [x] Unit test suite (`npm run test:unit`) passing (vitest).
- [x] JS linting (`npm run test:js`) and TypeScript check (`npm run test:ts:main`) passing.
- [x] CSS linting (`npm run test:css`) and HTML validation (`npm run test:html`) passing.
- [x] Extension build (`npm run test:build`) passes for all variants.
- [x] Playwright integration and visual onboarding tests passing.

---

## 6. GitHub Repository Settings (Manual Steps for Repository Owner)

1. Go to repository **Settings** → **General** → **Danger Zone** → **Change repository visibility** → **Change to public**.
2. Set repository **About**:
   - **Description:** `Japanese–Vietnamese pop-up dictionary for your browser (Chrome). Fork of Yomitan.`
   - **Topics:** `japanese-dictionary`, `vietnamese`, `chrome-extension`, `popup-dictionary`, `yomitan-fork`
3. Verify **Branch Protection Rules** for `main`:
   - Require a pull request before merging.
   - Require status checks to pass before merging (`ci`, `playwright`).
