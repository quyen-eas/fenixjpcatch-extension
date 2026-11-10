# Privacy Policy for FenixJpCatch

[English](#english) | [Tiếng Việt](#tiếng-việt)

---

## English

> **Disclaimer:** FenixJpCatch is an independent open-source project and is **not affiliated with, endorsed by, or sponsored by Yomitan, Yomichan, or their development teams**.

### Core Privacy Principle

FenixJpCatch is designed with a strict **offline-first and privacy-respecting** architecture:

- **Offline Lookups:** Looking up words, scanning web text, and viewing dictionary definitions occurs entirely on your device inside your browser's local IndexedDB. No web text, searched words, or browsing history is ever transmitted to any external server.
- **No Telemetry or Tracking:** FenixJpCatch does not collect telemetry, does not use analytics, and does not sell or share any user data.

### External Network Requests

The extension only makes network requests in the following specific scenarios:

#### 1. Dictionary Downloads and Updates (GitHub Releases)

- On the first run (or when manually checking for updates in Settings), FenixJpCatch downloads static dictionary archive files from GitHub Releases:
  - Repository: `https://github.com/quyen-eas/fenixjpcatch-extension/`
  - Release tag: `dict-latest` (or `dict-<revision>`)
  - Files: `fenixjpcatch-ja-vi.zip` and `fenixjpcatch-kanji-vi.zip`
- These requests are plain HTTPS GET requests for static files hosted on GitHub. No personally identifiable information (PII), device identifiers, or search queries are sent.

#### 2. Pronunciation Audio Sources (Optional)

- Playing pronunciation audio sends the term and reading to the configured audio source (e.g., JPod101, LanguagePod101, Jisho, Lingua Libre, Wiktionary, or custom user-defined audio URLs).
- Personally identifying information is never sent.

#### 3. Anki Integration (Optional, disabled by default)

- Anki connectivity operates locally through [AnkiConnect](https://foosoft.net/projects/anki-connect/) on your local machine (`http://127.0.0.1:8765`). No data is sent to external servers.

#### 4. Optional Cloud Word Synchronization (Google Sign-In & Firebase)

- If you choose to sign in with your Google account in the Saved Words notebook (`saved-words.html`), FenixJpCatch uses `chrome.identity` (Google OAuth 2.0) and Google Firebase Authentication / Cloud Firestore to sync your saved vocabulary (`expression`, `reading`, `jmdictSeq`, learning `status`, and the example `contextSentence` / `sourceUrl` where you saved the word) to your personal cloud notebook (`users/{uid}/words`).
- Cloud sync is **100% optional** and only activates when you explicitly click "Sign in with Google". Your saved words are strictly isolated to your authenticated user ID (`uid`) via Firestore Security Rules and are never shared with third parties.
- Offline dictionary lookups and web page text scanning always remain strictly offline.

---

## Tiếng Việt

> **Tuyên bố:** FenixJpCatch là dự án mã nguồn mở độc lập, **không liên kết, không được bảo trợ hoặc xác nhận bởi Yomitan, Yomichan hoặc nhóm phát triển của họ**.

### Nguyên tắc quyền riêng tư cốt lõi

FenixJpCatch được xây dựng với nguyên tắc **ưu tiên ngoại tuyến (offline-first) và tôn trọng quyền riêng tư**:

- **Tra từ ngoại tuyến:** Toàn bộ quá trình tra từ, quét văn bản trên trang web và hiển thị định nghĩa diễn ra 100% trên thiết bị của bạn (lưu trữ trong IndexedDB cục bộ của trình duyệt). Nội dung trang web bạn đọc hoặc từ bạn tra cứu không bao giờ bị gửi ra bất kỳ máy chủ bên ngoài nào.
- **Không thu thập dữ liệu & Telemetry:** FenixJpCatch không thu thập số liệu phân tích (telemetry), không theo dõi hành vi duyệt web và không bán hay chia sẻ bất kỳ dữ liệu nào của người dùng.

### Các kết nối mạng phát sinh

Tiện ích chỉ thực hiện kết nối mạng trong các trường hợp cụ thể sau:

#### 1. Tải và cập nhật từ điển (GitHub Releases)

- Trong lần khởi chạy đầu tiên (hoặc khi người dùng chủ động bấm kiểm tra cập nhật trong mục Cài đặt), FenixJpCatch sẽ tải tệp dữ liệu từ điển tĩnh từ GitHub Releases:
  - Địa chỉ: `https://github.com/quyen-eas/fenixjpcatch-extension/`
  - Tag phát hành: `dict-latest` (hoặc `dict-<revision>`)
  - Tệp: `fenixjpcatch-ja-vi.zip` và `fenixjpcatch-kanji-vi.zip`
- Đây là các yêu cầu tải tệp tĩnh qua HTTPS từ máy chủ của GitHub. Tuyệt đối không gửi kèm thông tin nhận dạng cá nhân, thông tin thiết bị hay lịch sử tra từ.

#### 2. Nguồn phát âm (Tùy chọn)

- Khi bạn nhấn nút nghe phát âm, từ và cách đọc sẽ được gửi tới nguồn âm thanh tương ứng (ví dụ JPod101, LanguagePod101, Jisho, Lingua Libre, Wiktionary hoặc nguồn do người dùng tùy biến).
- Không có dữ liệu cá nhân nào được gửi đi.

#### 3. Kết nối Anki (Tùy chọn, mặc định tắt)

- Kết nối Anki hoạt động cục bộ thông qua AnkiConnect trên máy tính của bạn (`http://127.0.0.1:8765`). Không truyền dữ liệu qua Internet.

#### 4. Đồng bộ Sổ Từ Đám Mây (Tùy chọn qua Google Sign-In & Firebase)

- Nếu bạn chủ động chọn "Đăng nhập Google" trong trang Sổ Từ (`saved-words.html`), FenixJpCatch sử dụng `chrome.identity` (Google OAuth 2.0) cùng Firebase Authentication / Cloud Firestore để đồng bộ danh sách từ vựng bạn đã bấm lưu (`☆`) (bao gồm từ vựng, cách đọc, trạng thái thuộc từ và câu ngữ cảnh nơi bạn lưu từ) vào sổ từ cá nhân của riêng bạn (`users/{uid}/words`).
- Tính năng đồng bộ đám mây là **hoàn toàn tùy chọn** và chỉ kích hoạt khi bạn chủ động đăng nhập. Dữ liệu sổ từ chỉ thuộc quyền truy cập của chính tài khoản `uid` của bạn và không bao giờ bị chia sẻ cho bên thứ ba.
- Tính năng tra từ điển và quét văn bản cơ bản luôn hoạt động hoàn toàn ngoại tuyến (offline).
