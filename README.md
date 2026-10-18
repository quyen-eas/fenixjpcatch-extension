# FenixJpCatch

Japanese–Vietnamese pop-up dictionary for your browser (Chrome). Hold **Shift** and hover over Japanese text to look up words offline, with Vietnamese definitions and Sino-Vietnamese (Hán Việt) readings.

> **Disclaimer:** FenixJpCatch is an independent open-source project and is **not affiliated with, endorsed by, or sponsored by Yomitan, Yomichan, or their development teams**. FenixJpCatch is a fork of [Yomitan](https://github.com/yomidevs/yomitan) and is licensed under the GNU General Public License v3.0 or later (GPL-3.0-or-later).

---

[English](#english) | [Tiếng Việt](#tiếng-việt)

---

## English

### Features

- **Instant Hover Lookup**: Hold **Shift** and hover over Japanese text on any webpage to see dictionary definitions.
- **Vietnamese Meanings & Hán Việt**: Built-in Japanese–Vietnamese term dictionary and Kanji dictionary with Sino-Vietnamese readings.
- **Automated Onboarding**: On first launch, the extension automatically downloads and installs the latest dictionaries from GitHub Releases (`dict-latest`).
- **100% Offline Lookup**: Dictionary data is stored locally in your browser's IndexedDB. No text or lookups leave your machine.
- **All Yomitan Features Maintained**: Multiple custom dictionaries, Anki integration, audio pronunciations, search page, clipboard monitor, and customizable profiles.

### Installation

1. Download the latest release `.zip` from [Releases](https://github.com/quyen-eas/fenixjpcatch-extension/releases) (or build from source).
2. Unzip the file into a local folder.
3. Open `chrome://extensions/` in Chrome or Chromium-based browsers.
4. Toggle **Developer mode** in the top right corner.
5. Click **Load unpacked** and select the extension directory (e.g. `builds/chrome`).
6. The FenixJpCatch Welcome page will open automatically and download the latest dictionaries.

### Dictionary Releases

FenixJpCatch dictionaries are distributed separately via GitHub Releases under a dedicated rolling tag:

- **Rolling latest tag:** `dict-latest` (always points to the newest dictionary release)
- **Historical tags:** `dict-<revision>` (immutable versioned releases)

The extension downloads:

- `fenixjpcatch-ja-vi.zip` (Japanese–Vietnamese Term Dictionary)
- `fenixjpcatch-kanji-vi.zip` (Kanji & Sino-Vietnamese Readings)

### Building from Source

1. Install [Node.js](https://nodejs.org/) (pinned to Node 22 for test discovery stability) and [npm](https://www.npmjs.com/).
2. Run `npm ci` to install dependencies.
3. Run `npm run build:libs` to build libraries in `ext/lib/`.
4. Run `npm run build` for a test build or `npm test` to run the test suite.
5. The output builds can be found in the `builds/` directory.

### Privacy

Looking up words is completely offline and never transmits data to any external server. Network access occurs only when:

- Downloading dictionaries from GitHub Releases during first-run onboarding or manual update checks.
- Playing audio pronunciation from configured external audio services.

See [PRIVACY-POLICY.md](./PRIVACY-POLICY.md) for full details.

### Documentation & Attribution

- Differences from upstream: [CHANGES.md](./CHANGES.md)
- Third-party attributions: [ATTRIBUTION.md](./ATTRIBUTION.md)
- Upstream Yomitan documentation: [yomitan.wiki](https://yomitan.wiki)
- Dictionary release specification: [docs/dictionary-release.md](./docs/dictionary-release.md)

### License

- Extension source code: GPL-3.0-or-later (see [LICENSE](./LICENSE)), inherited from Yomitan © Yomitan Authors / Yomichan Authors.
- Dictionary data: Derived from JMdict, KANJIDIC2 and related EDRDG projects under CC BY-SA 4.0; see [ATTRIBUTION.md](./ATTRIBUTION.md).

---

## Tiếng Việt

### Giới thiệu

FenixJpCatch là tiện ích mở rộng tra từ điển Nhật–Việt dạng pop-up dành cho trình duyệt (Chrome/Chromium). Chỉ cần giữ phím **Shift** và rê chuột lên văn bản tiếng Nhật để xem nghĩa tiếng Việt và âm Hán Việt ngay tức thì.

> **Tuyên bố:** FenixJpCatch là dự án mã nguồn mở độc lập, **không liên kết, không được tài trợ hoặc bảo trợ bởi Yomitan, Yomichan hoặc nhóm phát triển của họ**. FenixJpCatch được fork từ [Yomitan](https://github.com/yomidevs/yomitan) và tuân thủ giấy phép GNU General Public License v3.0 trở lên (GPL-3.0-or-later).

### Tính năng nổi bật

- **Tra từ tức thì**: Giữ **Shift** và di chuột qua từ tiếng Nhật trên bất kỳ trang web nào để mở popup giải nghĩa.
- **Dữ liệu tiếng Việt & Hán Việt**: Tích hợp sẵn từ điển Nhật–Việt và từ điển Kanji kèm âm Hán Việt chuẩn hóa.
- **Tự động cài từ điển**: Khi mở lần đầu, trang chào mừng sẽ tự động tải và nạp bộ từ điển mới nhất từ GitHub Releases (tag `dict-latest`).
- **Tra từ 100% ngoại tuyến (Offline)**: Dữ liệu từ điển được lưu trữ cục bộ trong IndexedDB của trình duyệt. Không có dữ liệu trang web hay từ tra cứu nào bị gửi ra ngoài.
- **Kế thừa toàn diện Yomitan**: Hỗ trợ thêm nhiều từ điển khác, đồng bộ Anki, phát âm âm thanh, trang tìm kiếm độc lập và theo dõi bộ nhớ tạm (clipboard).

### Hướng dẫn cài đặt

1. Tải bản release `.zip` mới nhất từ [Releases](https://github.com/quyen-eas/fenixjpcatch-extension/releases) (hoặc tự build từ mã nguồn).
2. Giải nén file zip vào một thư mục trên máy tính.
3. Truy cập `chrome://extensions/` trên Chrome hoặc trình duyệt nhân Chromium.
4. Bật chế độ dành cho nhà phát triển (**Developer mode**) ở góc trên bên phải.
5. Nhấn **Load unpacked** (Tải tiện ích đã giải nén) và chọn thư mục tiện ích đã giải nén (ví dụ `builds/chrome`).
6. Trang hướng dẫn FenixJpCatch sẽ tự động mở và tiến hành nạp từ điển lần đầu.

### Cơ chế phát hành từ điển

Từ điển FenixJpCatch được phân phối độc lập qua GitHub Releases với cấu trúc tag:

- **Tag mới nhất (rolling):** `dict-latest` (luôn trỏ vào bản phát hành từ điển mới nhất)
- **Tag phiên bản lịch sử:** `dict-<revision>` (bản phát hành cố định theo số hiệu bản sửa đổi)

Gồm 2 tệp từ điển chính:

- `fenixjpcatch-ja-vi.zip` (Từ điển Nhật–Việt)
- `fenixjpcatch-kanji-vi.zip` (Từ điển Kanji & âm Hán Việt)

### Quyền riêng tư

Thao tác tra từ diễn ra hoàn toàn trên thiết bị của bạn và không truyền dữ liệu ra bất kỳ máy chủ nào. Kết nối mạng chỉ diễn ra khi:

- Tải tệp từ điển từ GitHub Releases trong lần cài đặt đầu tiên hoặc khi người dùng bấm kiểm tra cập nhật.
- Phát âm thanh từ các nguồn phát âm trực tuyến được cấu hình.

Xem chi tiết tại [PRIVACY-POLICY.md](./PRIVACY-POLICY.md).

### Giấy phép & Bản quyền

- Mã nguồn tiện ích: GPL-3.0-or-later (xem [LICENSE](./LICENSE)), kế thừa từ Yomitan © Yomitan Authors / Yomichan Authors.
- Dữ liệu từ điển: Dẫn xuất từ JMdict, KANJIDIC2 và các dự án của EDRDG theo giấy phép CC BY-SA 4.0; xem chi tiết tại [ATTRIBUTION.md](./ATTRIBUTION.md).
