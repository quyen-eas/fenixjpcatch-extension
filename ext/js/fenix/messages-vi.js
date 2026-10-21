/*
 * Copyright (C) 2026  Fenix Labs
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Vietnamese UI strings of the pages added by FenixJpCatch.
 * Placeholders are written as `{name}`. Upstream Yomitan pages are not translated (see CLAUDE.md, decision 6.4).
 * @type {Readonly<Record<string, string>>}
 */
export const MESSAGES_VI = Object.freeze({
    // Shared
    'app.name': 'FenixJpCatch',
    'common.version': 'Phiên bản {version}',

    // Action popup
    'popup.fenix.title': 'FenixJpCatch',
    'popup.fenix.welcome': 'Hướng dẫn',
    'popup.fenix.about': 'Giới thiệu',
    'popup.fenix.savedWords': 'Từ đã lưu',
    'popup.fenix.savedWordsSoon': 'Từ đã lưu (sắp có)',
    'popup.fenix.login': 'Đăng nhập',
    'popup.fenix.loginSoon': 'Đăng nhập (sắp có)',

    // Welcome page
    'welcome.pageTitle': 'Chào mừng đến với FenixJpCatch',
    'welcome.heading': 'Chào mừng đến với FenixJpCatch',
    'welcome.subtitle': 'Từ điển Nhật–Việt dạng popup. Rê chuột lên chữ tiếng Nhật khi đọc web để tra nhanh.',

    'welcome.dictionaries.heading': 'Từ điển đang được cài đặt',
    'welcome.dictionaries.description': 'Hai từ điển Nhật–Việt được tải và cài tự động ở lần đầu sử dụng, với mức ưu tiên cao nhất. Bạn vẫn có thể cài thêm hoặc xóa từ điển khác trong Cài đặt như bình thường.',
    'dictionary.jaVi.name': 'Từ điển Nhật–Việt',
    'dictionary.jaVi.description': 'Từ vựng, cách đọc, loại từ và nghĩa tiếng Việt.',
    'dictionary.kanjiVi.name': 'Từ điển Hán tự Nhật–Việt',
    'dictionary.kanjiVi.description': 'Âm On/Kun, âm Hán Việt, nghĩa và số nét của Hán tự.',

    'status.checking': 'Đang kiểm tra…',
    'status.installed': 'Đã cài đặt',
    'status.missing': 'Chưa cài đặt',
    'status.waiting': 'Đang chờ một tab khác cài xong…',
    'status.downloading': 'Đang tải xuống… {percent}',
    'status.downloadingUnknown': 'Đang tải xuống…',
    'status.importing': 'Đang nhập dữ liệu (bước {step}/{steps})… {percent}',
    'status.error.download': 'Không tải được từ điển. Hãy kiểm tra kết nối mạng rồi thử lại.',
    'status.error.import': 'Không nhập được từ điển.',
    'status.error.settings': 'Đã nhập từ điển nhưng chưa ghi được cài đặt.',
    'status.errorDetail': 'Chi tiết: {detail}',
    'button.install': 'Cài đặt',
    'button.retry': 'Thử lại',

    'summary.installing': 'Đang cài đặt từ điển. Hãy giữ trang này mở cho đến khi hoàn tất.',
    'summary.allInstalled': 'Từ điển đã sẵn sàng. Bạn có thể bắt đầu tra từ ngay.',
    'summary.someMissing': 'Chưa có đủ từ điển. Hãy kết nối mạng và bấm “Thử lại”.',
    'summary.removedByUser': 'Một số từ điển đã bị gỡ khỏi máy. Bấm “Cài đặt” nếu bạn muốn cài lại.',

    'usage.heading': 'Cách tra từ',
    'usage.hover.title': 'Shift + rê chuột',
    'usage.hover.description': 'Giữ phím Shift và rê chuột lên chữ tiếng Nhật trên trang web. Cửa sổ nhỏ sẽ hiện nghĩa tiếng Việt, cách đọc và thông tin Hán tự.',
    'usage.audio.title': 'Nghe phát âm',
    'usage.audio.description': 'Bấm biểu tượng loa cạnh từ để nghe. Nếu các nguồn âm thanh trực tuyến không có từ đó, giọng đọc của trình duyệt sẽ được dùng thay thế.',
    'usage.search.title': 'Tra thủ công',
    'usage.search.description': 'Bấm biểu tượng FenixJpCatch trên thanh công cụ của trình duyệt, rồi chọn kính lúp để mở trang tìm kiếm.',
    'usage.customize.title': 'Đổi phím tra từ',
    'usage.customize.description': 'Bạn có thể đổi phím, dùng chuột giữa hoặc chỉnh giao diện trong trang Cài đặt (tiếng Anh, mục Scanning).',

    'permissions.heading': 'Quyền truy cập',
    'permissions.sites.label': 'Cho phép tra từ trên mọi trang web',
    'permissions.sites.description': 'FenixJpCatch cần đọc văn bản trên trang để hiện cửa sổ tra từ. Việc tra từ được xử lý hoàn toàn trên máy của bạn.',
    'permissions.optional.label': 'Cho phép đọc clipboard và kết nối chương trình bên ngoài (tùy chọn)',
    'permissions.optional.description': 'Chỉ cần nếu bạn dùng theo dõi clipboard, Anki hoặc MeCab. Có thể bỏ qua.',
    'permissions.status.disabled': 'Một số tính năng sẽ bị hạn chế nếu chưa cấp quyền truy cập các trang web.',
    'permissions.status.recommended': 'Các tính năng thiết yếu đã sẵn sàng.',
    'permissions.status.full': 'Tất cả tính năng đã sẵn sàng.',

    'audio.heading': 'Âm thanh',
    'audio.fallbackAdded': 'Đã thêm giọng đọc của trình duyệt làm nguồn âm thanh dự phòng (sau các nguồn trực tuyến).',
    'audio.fallbackPresent': 'Giọng đọc của trình duyệt đã được dùng làm nguồn âm thanh dự phòng.',
    'audio.fallbackFailed': 'Chưa ghi được nguồn âm thanh dự phòng vào cài đặt; lần mở sau sẽ thử lại.',
    'audio.noJapaneseVoice': 'Trình duyệt chưa có giọng đọc tiếng Nhật nên chưa thêm nguồn âm thanh dự phòng. Hãy cài giọng tiếng Nhật trong hệ điều hành, lần mở sau sẽ tự thêm.',

    'soon.heading': 'Sắp ra mắt',
    'soon.save.title': 'Lưu từ (☆)',
    'soon.save.description': 'Sắp có nút ☆ để lưu từ đang tra cùng câu ngữ cảnh vào tài khoản của bạn (đăng nhập bằng Google) và ôn tập sau. Tra từ vẫn hoạt động hoàn toàn ngoại tuyến; dữ liệu chỉ rời khỏi máy khi bạn chủ động bấm lưu.',

    'links.heading': 'Liên kết',
    'links.yomitanSetup.title': 'Thiết lập nâng cao',
    'links.yomitanSetup.description': 'Bản tiếng Anh: nhập từ điển khác, chọn ngôn ngữ, tùy chỉnh chi tiết.',
    'links.settings.title': 'Cài đặt',
    'links.settings.description': 'Toàn bộ tùy chọn nâng cao (tiếng Anh).',
    'links.about.title': 'Giới thiệu và ghi công',
    'links.about.description': 'Nguồn dữ liệu, giấy phép và mã nguồn.',
    'showGuide.label': 'Hiện trang chào mừng mỗi khi mở trình duyệt',

    // About page
    'about.pageTitle': 'Giới thiệu FenixJpCatch',
    'about.heading': 'FenixJpCatch',
    'about.tagline': 'Từ điển Nhật–Việt dạng popup, tra nhanh khi đọc web.',
    'about.basedOn.heading': 'Thông tin phát triển & Bản quyền',
    'about.basedOn.text': 'FenixJpCatch được phát triển kế thừa từ dự án mã nguồn mở Yomitan theo giấy phép GNU GPL v3.0+. Toàn bộ mã nguồn phát hành tự do theo giấy phép GPL-3.0.',
    'about.basedOn.link.yomitan': 'Mã nguồn dự án gốc (Yomitan)',
    'about.basedOn.link.changes': 'Danh sách thay đổi (CHANGES.md)',
    'about.basedOn.link.license': 'Giấy phép GPL-3.0',
    'about.basedOn.link.thirdParty': 'Thư viện bên thứ ba',
    'about.source.heading': 'Mã nguồn',
    'about.source.text': 'Mã nguồn của tiện ích được công bố theo giấy phép GPL-3.0.',
    'about.source.link': 'Mã nguồn trên GitHub',
    'about.data.heading': 'Nguồn dữ liệu từ điển',
    'about.data.text': 'Dữ liệu từ điển được tổng hợp từ các nguồn dưới đây và được phát hành theo giấy phép CC BY-SA 4.0 (ghi công – chia sẻ tương tự).',
    'about.data.jmdict': 'JMdict — từ vựng, cách đọc, loại từ. © Electronic Dictionary Research and Development Group (EDRDG), CC BY-SA 4.0.',
    'about.data.kanjidic2': 'KANJIDIC2 — âm đọc, nghĩa và số nét của Hán tự. © EDRDG, CC BY-SA 4.0.',
    'about.data.kradfile': 'KRADFILE — thành phần cấu tạo của Hán tự. © EDRDG, CC BY-SA 4.0.',
    'about.data.wordfreq': 'wordfreq — tần suất sử dụng từ. © Robyn Speer và cộng sự, dữ liệu theo CC BY-SA 4.0.',
    'about.data.jmdictFurigana': 'JmdictFurigana — căn chỉnh furigana. © Doublevil, CC BY-SA.',
    'about.data.edrdgNotice': 'Sản phẩm này dùng các tệp JMdict, KANJIDIC2 và KRADFILE. Các tệp này thuộc sở hữu của EDRDG và được sử dụng theo giấy phép của nhóm.',
    'about.data.link.edrdg': 'Giấy phép EDRDG',
    'about.data.link.ccbysa': 'Giấy phép CC BY-SA 4.0',
    'about.data.link.attribution': 'Chi tiết ghi công',
    'about.back': 'Quay lại trang chào mừng',
});
