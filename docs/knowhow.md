# Know-how: FenixJpCatch, Phase 2 (onboarding), CI và việc còn lại

Cập nhật: 2026-10-18. Tài liệu nội bộ cho người phụ trách dự án. Quy ước kỹ thuật vẫn nằm trong `CLAUDE.md`, đây là bản tổng hợp "đã làm gì, vì sao, còn gì".

## 1. Trạng thái hiện tại

| Hạng mục                                                             | Trạng thái                                                                                                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 2 (tự cài từ điển, trang chào mừng, About)                     | Đã merge vào `main` qua PR #13 (merge commit `58e1f76`)                                                                                                        |
| CI của `main` sau khi merge #13                                      | Lần chạy push đầu tiên xanh (CI, Playwright, actionlint). CodeQL bị skip vì repo private                                                                       |
| PR #14 (sửa các finding của Codex)                                   | **Đang mở**, head `3f50672`, `mergeable_state: clean`, mọi check xanh, Codex review commit này: "Didn't find any major issues". Chờ owner quyết định rồi merge |
| Thread Codex còn mở trên #14                                         | 1 thread (dấu sở hữu `importing[id]` bị mồ côi), cố ý chưa sửa bằng code, xem mục 4.A                                                                          |
| PR #15 (dependabot, "Bump the github-actions group with 12 updates") | **Chưa xem xét**                                                                                                                                               |
| Release thật của từ điển                                             | Chưa có. Extension bản thật sẽ báo lỗi tải ở lần chạy đầu cho tới khi repo có Release đủ 2 file zip                                                            |

## 2. Đã làm

### 2.1 Phase 2, PR #13

- **Tự cài từ điển lần đầu.** `Backend._openWelcomeGuidePage` mở `/fenix-welcome.html` (đây là thay đổi chức năng duy nhất trong code upstream, 1 dòng). Trang tải `fenixjpcatch-ja-vi.zip` và `fenixjpcatch-kanji-vi.zip` từ Release latest của repo, import bằng `DictionaryWorker`, đặt lên đầu danh sách từ điển của mọi profile. Từ điển người dùng đã xóa sẽ không bị cài lại. Lỗi thì hiện nút "Thử lại" và lần mở trang sau tự thử lại.
- **Quy ước tên file, title, URL** nằm trong `docs/dictionary-release.md`, có unit test đối chiếu với code. Repo platform build zip theo đúng quy ước đó.
- **Trang chào mừng tiếng Việt, About.** Trang gốc `/welcome.html` của Yomitan vẫn mở được qua link. About có "Based on Yomitan" và attribution JMdict, KANJIDIC2, KRADFILE, wordfreq.
- **Âm thanh.** TTS trình duyệt (giọng `ja`) được thêm vào cuối danh sách nguồn audio. Ba nguồn `ja` có sẵn được ghi rõ ràng đứng trước, vì nguồn mặc định vốn được nối sau nguồn người dùng cấu hình; nếu chỉ thêm TTS thì nó thành nguồn ưu tiên số một. Không cần migration options.
- **i18n** nhỏ trong `ext/js/fenix/` (`i18n.js`, `messages-vi.js`), chỉ cho UI mới. Test kiểm tra mọi key dùng trong HTML/JS đều tồn tại.
- **Fixture** từ điển nhỏ (30 từ, 20 kanji) dựng trong bộ nhớ, mọi nghĩa ghi "[dữ liệu thử]", `sequence` bắt đầu từ 9.000.001 để không lẫn với `ent_seq` thật.
- Mọi file upstream đã sửa đều ghi trong `CHANGES.md`.

### 2.2 CI trên PR #13 (đã xanh)

| Job                                  | Nguyên nhân                                                                                               | Cách xử lý                                                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| CodeQL, dependency-review            | Repo private, thiếu GitHub Advanced Security                                                              | `if: github.event.repository.private == false`, giữ job, tự chạy lại khi repo public                                |
| JSON                                 | Test kiểm tra kiểu chạy lâu hơn mốc timeout 5 giây của vitest trên runner                                 | `testTimeout: 120000` trong `test/data/vitest.json.config.json`                                                     |
| JavaScript, Unit Tests ("cancelled") | Bị hủy hàng loạt vì job JSON đỏ (fail-fast của matrix)                                                    | `fail-fast: false` trong `ci.yml`                                                                                   |
| link-checker                         | Rate limit và timeout ngẫu nhiên (429, 503) vì lychee gọi nhiều request song song                         | Concurrency 10, retry, `--timeout 30`, chấp nhận 408/429/502/503/504, bỏ qua `gnu.org/licenses`                     |
| URL chưa công khai                   | Không gây lỗi, nhưng sẽ gây lỗi khi repo đổi trạng thái                                                   | Ignore tạm Releases/issues/pulls trong `.lycheeignore`, kèm `TODO(public)`                                          |
| Playwright (treo 30–60 phút)         | **Node 24 cộng Playwright 1.49.1 treo vô hạn ở bước liệt kê test.** `package.json` chỉ ghi `engines >=22` | Ghim Node 22 trong `.github/actions/setup`. Thêm `actions: read`. PR chạy ở chế độ `-u` khi `main` chưa có baseline |
| `integration.spec › anki add`        | Mock Anki trả cố định 2 phần tử, Yomitan loại câu trả lời có độ dài khác số note gửi lên                  | Sửa mock trả đúng một phần tử cho mỗi note (sửa, không skip). Trên `main` nguyên bản test này cũng fail             |

### 2.3 Vòng review Codex thứ nhất (3 comment trên #13), sửa trong PR #14

Vì #13 được merge trước khi commit sửa được push, phần sửa phải đi qua một PR mới (#14, nhánh `phase-2/onboarding` dựng lại từ `main`).

| Finding                                                                                      | Cách sửa                                                                                                                                               | Test                                                                                                                                      |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| P1: importer ghi lỗi từng dòng nhưng vẫn trả summary, từ điển import dở bị ghi nhận "đã cài" | `errors` khác rỗng, `result` null hoặc `importSuccess:false` đều là import lỗi. Xóa phần đã import dở, không đăng ký, không ghi nhận, lần sau thử lại  | Lỗi ghi dòng, dữ liệu sai bị importer chặn trước khi ghi, kết quả null để lại dữ liệu, summary cũ `importSuccess:false`, cleanup thất bại |
| P2: title sai vẫn bị import                                                                  | Đọc `title` trong `index.json` của zip trước khi import (`archive-index.js`). Sai thì dừng, không đụng DB. Nếu đã lỡ import thì xóa để Retry chạy sạch | Title sai trước và sau import, Retry sau khi sửa asset                                                                                    |
| P2: `audioFallbackApplied` được ghi mà không kiểm tra kết quả `modifyGlobalSettings`         | Tách `audio-fallback.js`, chỉ ghi cờ khi mọi thay đổi cài đặt thành công. Lỗi thì báo bằng tiếng Việt và thử lại lần mở sau                            | `test/fenix/audio-fallback.test.js`                                                                                                       |

### 2.4 Vòng review Codex thứ hai (5 finding, toàn bộ nằm trong dấu `importing[id]`)

Bản sửa P1 ở trên có một rủi ro: summary `importSuccess:false` cũng là dạng của một import đang chạy từ trang Settings. Nếu onboarding xóa nó là xóa nhầm. Giải pháp: ghi dấu `importing[id]` vào state **trước** khi import, và chỉ xóa phần import dở khi dấu này còn. Năm finding tiếp theo đều là các trạng thái cạnh của chính cơ chế này.

| Commit    | Finding                                                            | Cách sửa                                                                                                   |
| --------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `011fc98` | P1: không được xóa import đang chạy từ Settings                    | Thêm dấu `importing[id]`. Import dở không có dấu thì không đụng, báo lỗi trên trang chào mừng              |
| `a618a26` | P2: xóa lỗi nhưng vẫn xóa dấu, phần còn sót không bao giờ được dọn | Chỉ xóa dấu khi xóa thành công. `install()` báo lỗi dọn thay vì import đè                                  |
| `02c9eb3` | P1: importer từ chối trước khi chèn summary, dấu còn lại           | Sau khi bị từ chối, xóa dấu nếu DB không có gì dưới tên đó (không bao giờ ném lỗi, tra DB lỗi thì giữ dấu) |
| `6111258` | P2: xóa thành công nhưng thông báo cập nhật DB lỗi, dấu vẫn bị giữ | `_discard` trả `{removed, failures}`. Chỉ lỗi xóa mới giữ dấu                                              |
| `3f50672` | P1: tab bị tắt trước khi importer chèn summary, dấu mồ côi         | **Không sửa bằng code.** Ghi vào `CLAUDE.md` §8.2 kèm cách tái hiện. Thread để mở chờ owner                |

Ngoài ra: `439e519` sửa một test Playwright của chính mình (xem 3.3) và ghi known issue về race với import từ Settings.

### 2.5 Kiểm chứng

- `test/fenix/`: 56 test trong 8 file (chạy cục bộ), eslint và `tsc` (main, test) sạch. Job `Unit Tests` trên CI xanh.
- Playwright trên head `3f50672` (đã đọc log cả 5 shard): `fenix-onboarding.spec.js` 2/2 pass ngay lần đầu, `integration.spec.js` 2/2, `visual.spec.js` welcome và settings pass, popup test1 đến test16 pass (test7 và test8 flaky: lần đầu lệch khoảng 2% điểm ảnh so với baseline, retry pass).
- Mỗi test mới cho một bản sửa đều đã được kiểm bằng **đột biến**: hoàn nguyên dòng sửa thì test phải fail.

## 3. Know-how kỹ thuật

### 3.1 Importer của Yomitan (`dictionary-importer.js`)

- Validate các file dữ liệu **trước** khi ghi, dòng sai làm ném lỗi trước mọi lần ghi.
- Lỗi ghi từng dòng (`bulkAdd`) bị nuốt vào `errors`, importer vẫn trả summary và `importSuccess` vẫn có thể là true. Vì vậy `errors` khác rỗng phải được coi là lỗi.
- Summary được chèn với `importSuccess:false` **trước** khi ghi dữ liệu, rồi cập nhật thành true ở cuối. Một import đang chạy từ Settings nhìn giống hệt một import bị bỏ dở.
- Tên đã tồn tại thì trả `result: null` và lỗi "already imported", không ghi gì.
- `result: null` vẫn có thể để lại dữ liệu (ví dụ CSS không hợp lệ sau khi summary đã được thêm).

### 3.2 Dấu sở hữu `importing[id]`

- Nằm trong `chrome.storage.local['fenixOnboarding']` (`onboarding-state.js`). Chỉ phần import dở có dấu mới bị onboarding xóa tự động.
- Web Lock `fenix-dictionary-install` chỉ khóa giữa các tab welcome, không khóa importer của Settings.
- Hai known issue chấp nhận (`CLAUDE.md` §8.2): race giữa lúc onboarding kiểm tra tên và lúc importer chạy, và dấu mồ côi khi tab bị tắt đúng khoảng đó. Cả hai cần trùng nhiều điều kiện và hậu quả chỉ là phải import tay lại một lần.
- Nếu cần triệt để: bỏ dấu và bỏ tự xóa phần còn sót từ lần chạy trước, thay bằng nút "Xóa và thử lại" do người dùng bấm. Phần dọn dẹp ngay trong cùng một lần gọi (khi chính lần import đó thất bại) vẫn giữ nguyên. Tốn thêm nút, chuỗi i18n và test.

### 3.3 Playwright và CI

- **PR chạy Playwright không chặn merge** (`|| true`, thiết kế của upstream). Màu xanh của check không phải bằng chứng. Phải đọc log shard (reporter `list` đã bật trong CI) và tìm dòng `flaky` hoặc `retry`.
- `flaky` nghĩa là fail lần đầu rồi pass ở retry. Playwright vẫn tính là pass. Một test của mình (`welcome.locator('h1')`) bị lỗi strict mode vì `welcome.html` có nhiều `<h1>` (tiêu đề modal xuất hiện sau khi script chạy). Cách đúng là `getByRole('heading', {level: 1, name: ...})`.
- `playwright test --repeat-each=4 --retries=0` là cách kiểm một test có thật sự ổn định hay không.
- Node phải ghim 22 cho tới khi nâng `@playwright/test` (hiện 1.49.1, treo trên Node 24).
- Baseline ảnh lấy từ lần chạy thành công gần nhất trên `main` (artifact `playwright-screenshots`). Các ảnh này là của test upstream chạy trên Chromium của CI, không có ảnh cho trang tiếng Việt.
- `visual.spec.js` in `unexpected popup state` là `console.warn` trong code upstream, không phải lỗi.
- Trong sandbox, Playwright cần Chromium đúng revision: symlink `/opt/pw-browsers/chromium-<rev>/chrome-linux/chrome` tới bản đang có (ngoài repo).

### 3.4 Quy trình với PR và Codex

- Khi PR đã merge thì **không push thêm** vào nhánh đó. Dựng lại nhánh từ `main` (`git checkout -B <nhánh> origin/main`), cherry-pick, mở PR mới. Mình đã mắc lỗi này một lần ở #13.
- Codex review khi PR mở hoặc khi có comment `@codex review`; nó review commit mới nhất tại thời điểm đó. Mỗi lần push sửa xong cần comment lại để nó review head mới.
- Sau mỗi bản sửa: trả lời từng thread kèm commit và test, rồi resolve. Thread mà quyết định thuộc về owner thì để mở.
- Test cho một bản sửa phải quan sát được trạng thái **ngay sau bước cần kiểm**, nếu không đột biến sẽ không làm test fail (bản đầu của test "thông báo lỗi sau khi xóa" mắc lỗi này vì lần cài sau tự xóa dấu).
- Log job trên GitHub rất dài: dùng `tail_lines` và đọc phần liệt kê `✓`/`✘`/`flaky` của từng shard.
- Commit message và PR viết tiếng Anh, kèm dòng attribution theo hướng dẫn của phiên.

### 3.5 Lệnh hay dùng

```bash
npx vitest run test/fenix                       # test của fork
npx eslint ext/js/fenix test/fenix              # lint
npm run test:ts:main && npm run test:ts:test    # kiểu
npx prettier --check CLAUDE.md docs             # markdown
CI=1 npx playwright test fenix-onboarding --repeat-each=4 --retries=0 --reporter=list
```

## 4. Việc còn lại

### 4.A Quyết định của owner cho PR #14

1. **Merge ngay (khuyến nghị).** Rủi ro còn lại cần trùng cả ba điều: tắt tab giữa lần cài đầu, tự import tay đúng từ điển mà onboarding sẽ cài, và trang chào mừng mở lúc import đang chạy.
2. **Thiết kế lại** theo hướng nút "Xóa và thử lại" (mục 3.2). Loại cả họ finding kiểu này, đổi lại thêm một vòng việc.
3. Thread Codex còn mở (comment về dấu mồ côi) cần được resolve sau khi chọn.

### 4.B Sau khi merge #14

- [ ] Theo dõi lần chạy push đầu tiên trên `main`, báo ngay nếu đỏ.
- [ ] Nếu lần chạy đó tạo baseline ảnh mới, tải artifact `playwright-screenshots` và liệt kê lại cho owner kiểm tra. Baseline hiện có: artifact id 11871684879, hết hạn 2027-01-12, 20 ảnh trong `visual.spec.js/`: `doc2-test1` đến `doc2-test16`, `settings-fresh`, `settings-jmdict-loaded`, `settings-fresh-full-advanced`, `welcome-page`.
- [ ] Theo dõi `visual.spec.js` popup test7 và test8 (flaky 2% điểm ảnh). Nếu chập chờn lặp lại trên `main` thì xử lý riêng.

### 4.C PR #15 (dependabot, 12 bản cập nhật GitHub Actions)

- [ ] Chưa xem. Cần đọc changelog từng action, đảm bảo workflow vẫn đúng (đặc biệt `.github/actions/setup` đang ghim Node 22, và các action đang cảnh báo Node 20 sắp bị loại).
- [ ] Chạy CI và đọc log Playwright trước khi merge.

### 4.D Quyết định sản phẩm còn treo

- [ ] **`showGuide`:** mặc định vẫn bật như Yomitan, nên trang chào mừng mở mỗi lần khởi động trình duyệt cho đến khi người dùng tắt. Có nên tự tắt sau lần cài thành công không?
- [ ] **Lối vào About và trang chào mừng:** hiện chỉ vào được từ chính trang chào mừng. Có muốn thêm lối vào từ popup của extension không?

### 4.E Cơ chế đưa zip từ repo platform sang Release (đề xuất, chưa làm)

| Cách                                                                         | Ưu                             | Nhược                                                             |
| ---------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------- |
| A. Fine-grained PAT làm secret ở repo platform, workflow `gh release create` | Nhanh nhất, ít bước            | Hết hạn tối đa 1 năm, gắn với tài khoản cá nhân                   |
| B. GitHub App, token sống 1 giờ                                              | Không gắn cá nhân, quyền hẹp   | Tốn công setup, private key vẫn là secret dài hạn                 |
| C. Pull: workflow repo extension kéo artifact từ platform                    | Bước publish nằm ở repo public | Phải cấp quyền đọc vào repo private chứa backend, rủi ro lớn nhất |
| D. Thủ công `gh release upload`                                              | Không cần secret               | Dễ sai, không lặp lại được                                        |

Khuyến nghị: làm A trước, chuyển sang B khi PAT sắp hết hạn. Dù chọn cách nào, workflow nên:

- Tạo release dạng draft, upload đủ 4 file rồi mới publish (`latest` luôn phải có đủ asset, nếu không máy mới sẽ báo 404).
- Chặn `revision` thụt lùi, kiểm tra `title` đúng quy ước, tính `SHA256SUMS`.
- Chạy qua GitHub Environment có người duyệt ở repo platform.
- Lưu ý `releases/latest` là release mới nhất của cả repo: mọi Release phải chứa đủ asset, hoặc release extension-only phải đánh dấu pre-release (đã ghi trong `docs/dictionary-release.md`).

### 4.F Việc cần làm trước khi chuyển repo sang public

- [ ] Có ít nhất một Release với đủ asset (repo private trả 404 cho người dùng ẩn danh).
- [ ] Quét secret trên toàn bộ lịch sử bằng `gitleaks` hoặc `trufflehog`, bật secret scanning và push protection.
- [ ] Quyết định lịch sử commit: giữ lịch sử để còn merge upstream và giữ nguồn gốc GPL. Nếu muốn đổi author của các commit của fork thì rewrite và force-push **trước** khi public.
- [ ] Rà `CLAUDE.md` và tài liệu nội bộ (tên repo platform, quyết định nội bộ): lược bớt hoặc chuyển sang repo private.
- [ ] Sửa `PRIVACY-POLICY.md` (vẫn là bản của Yomitan; Phase 2 đã thêm một egress là lần tải đầu từ github.com, không gửi dữ liệu người dùng). Phải sửa trước khi lên store.
- [ ] README: hiện ghi "bundled dictionary" trong khi từ điển được tải về. Thêm hướng dẫn cài, ảnh chụp, phần tiếng Việt, đổi dòng "early development".
- [ ] License: giữ `LICENSE` và header gốc, `CHANGES.md` đầy đủ, chạy `npm run license-report:html`. Dữ liệu từ điển (CC BY-SA 4.0) ghi riêng trong release notes và `ATTRIBUTION.md`. Thêm disclaimer không liên kết với Yomitan. Thay icon placeholder.
- [ ] Cài đặt repo: branch protection cho `main` (required checks và review), `GITHUB_TOKEN` mặc định chỉ đọc, yêu cầu duyệt workflow từ first-time contributor, bật private vulnerability reporting, rà issue template còn nội dung upstream.
- [ ] Bỏ các ignore tạm trong `.lycheeignore` (Releases, issues, pulls). CodeQL và dependency-review sẽ tự chạy khi repo public và bật code scanning.

### 4.G Kỹ thuật dài hạn

- [ ] Nâng `@playwright/test` rồi bỏ ghim Node 22 (đang cố ý chưa nâng).
- [ ] Kiểm lại hai known issue ở `CLAUDE.md` §8.2 nếu importer của upstream có khóa DB, hoặc nếu fork có patch importer.
- [ ] Phase 3 (cloud và nút ☆): theo `CLAUDE.md` §6.3 đến §6.9 (đăng nhập Google qua `chrome.identity.launchWebAuthFlow`, `identity` permission, extension ID cố định, ghi `docs/api.md`, cập nhật chính sách riêng tư kèm bước đồng ý trước khi gửi dữ liệu).
- [ ] Từ điển thật do repo platform build: `sequence` phải là `ent_seq` của JMdict ở mọi dòng term, title đúng quy ước trong `docs/dictionary-release.md`.
