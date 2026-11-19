# Hướng Dẫn Phát Hành FenixJpCatch Lên Chrome Web Store

> **Phiên bản:** v0.2.6  
> **Cập nhật:** 10/11/2026  
> **Dự án:** FenixJpCatch (`fenixjpcatch-extension`)

Tài liệu này hướng dẫn chi tiết từng bước để đưa tiện ích **FenixJpCatch** lên **Chrome Web Store**, cấu hình xác thực Google OAuth / Firebase Cloud Sync và hoàn thiện các biểu mẫu xét duyệt quyền riêng tư.

---

## 1. Gói Cài Đặt Sẵn Sàng (Package)

File zip chuyên dụng dành riêng cho Chrome Web Store đã được build và đóng gói sẵn tại:
```
D:\Projects\Fenix\FenixCatch\fenixjpcatch-extension\builds\fenixjpcatch-chrome-v0.2.6-store.zip
```

> [!IMPORTANT]
> **Tại sao dùng bản `-store.zip` thay vì `.zip` thường?**  
> Chrome Web Store quy định **không cho phép trường `"key"` trong `manifest.json`**. Bản `-store.zip` đã được strip tự động trường `"key"` để Store tự cấp Store ID cố định và không bị từ chối khi upload. Toàn bộ thông số Firebase và Google OAuth Client ID đã được nhúng sẵn vào gói (`ext/lib/fenix-cloud-env.json`).

---

## 2. Bước 1: Tải File Lên Chrome Web Store Developer Dashboard

1. Mở trình duyệt và truy cập [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
   *(Nếu chưa có tài khoản Developer, Google thu phí đăng ký tài khoản 1 lần duy nhất là $5 qua thẻ thanh toán quốc tế).*
2. Ở góc trên bên phải màn hình, bấm nút **New item** (Mục mới).
3. Chọn file `fenixjpcatch-chrome-v0.2.6-store.zip` từ đường dẫn trên máy tính để tải lên.
4. Quá trình tải lên hoàn tất, hệ thống sẽ tự động tạo một mục ở trạng thái **Bản nháp (Draft)**.

---

## 3. Bước 2: Lấy Store Extension ID & Cấu Hình Google Cloud Console

1. **Lấy Store Extension ID:**
   - Ngay trên thanh địa chỉ URL của trình duyệt, bạn sẽ thấy đường link có dạng:
     ```
     https://chrome.google.com/webstore/devconsole/<developer_id>/<STORE_EXTENSION_ID>/edit
     ```
   - Copy chuỗi **32 ký tự** chữ cái thường này (ví dụ: `abcdefghijklmnop...`). Đây chính là Extension ID cố định vĩnh viễn của app trên Store.
2. **Cập nhật Authorized Redirect URI:**
   - Truy cập [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials).
   - Bấm vào tên OAuth 2.0 Client ID: `1068581722173-ctjcrkr79rnukkaihr0bkllnj8ju3pn7.apps.googleusercontent.com`.
   - Tìm đến mục **Authorized redirect URIs**, bấm **+ Add URI** và thêm:
     ```
     https://<STORE_EXTENSION_ID>.chromiumapp.org/
     ```
   - Bấm nút **Save** (Lưu) ở cuối trang.
   - *(Lưu ý: Bạn có thể giữ song song URI của bản test local `https://<local-id>.chromiumapp.org/` để test trên máy mà không bị xung đột).*

---

## 4. Bước 3: Điền Thông Tin Cửa Hàng (Tab Store Listing)

Ở menu bên trái của Developer Console, chọn tab **Store Listing**:

### 4.1. Thông tin cơ bản
- **Language (Ngôn ngữ):** `Tiếng Việt` (hoặc English).
- **Category (Danh mục):** `Education` (Giáo dục) hoặc `Productivity` (Năng suất).
- **Summary (Mô tả ngắn gọn):**
  ```text
  Từ điển Nhật–Việt dạng popup thông minh, tra cứu nhanh khi đọc báo, xem web.
  ```

### 4.2. Detailed Description (Mô tả chi tiết)
Copy và dán nguyên văn đoạn dưới đây vào ô mô tả:

```text
FenixJpCatch là tiện ích từ điển Nhật–Việt dạng popup thông minh dành cho trình duyệt, giúp bạn tra cứu tức thì từ vựng và Hán tự (Kanji) ngay khi đang đọc báo, tài liệu hoặc lướt web tiếng Nhật.

TÍNH NĂNG NỔI BẬT:
• Tra từ tức thì (Hover + Shift): Giữ phím Shift (hoặc phím tắt tuỳ chỉnh) và di chuột vào từ tiếng Nhật bất kỳ để xem nghĩa tiếng Việt, cách đọc Hiragana/Katakana, âm Hán Việt và ngữ pháp.
• Từ điển Nhật–Việt & Hán tự tích hợp sẵn (Offline-first): Đi kèm sẵn bộ từ điển Từ vựng Nhật–Việt và Hán tự (Kanji + thứ tự nét viết) hoạt động 100% ngoại tuyến với tốc độ phản hồi siêu nhanh dưới 50ms.
• Lưu từ vựng & Ngữ cảnh thực tế (☆): Bấm ngôi sao trên popup để lưu từ mới kèm câu ngữ cảnh gốc và đường dẫn bài viết vào Sổ Từ cá nhân.
• Đồng bộ đám mây (Google Sign-In): Tuỳ chọn đăng nhập Google để đồng bộ Sổ Từ giữa các thiết bị và ôn tập hiệu quả.
• Hỗ trợ tích hợp Anki: Kết nối với phần mềm học thẻ Anki (thông qua AnkiConnect).

Bản quyền & Mã nguồn mở:
FenixJpCatch là dự án mã nguồn mở phát triển độc lập bởi Fenix Labs (phát hành theo giấy phép GPL-3.0, kế thừa nền tảng từ Yomitan).
```

### 4.3. Hình ảnh & Đồ hoạ
- **Store Icon (128x128 PNG):**
  `D:\Projects\Fenix\FenixCatch\fenixjpcatch-extension\ext\images\icon128.png`
- **Screenshots (Ảnh chụp màn hình):** Tải lên ít nhất 1 ảnh chụp màn hình (kích thước chuẩn `1280x800` hoặc `640x400`, chụp giao diện popup đang tra từ hoặc trang Sổ Từ).

---

## 5. Bước 4: Khai Báo Quyền Riêng Tư (Tab Privacy Practices)

Chuyển sang tab **Privacy practices**. Đây là phần quan trọng nhất để Google duyệt qua nhanh:

### 5.1. Single purpose description (Mục đích duy nhất)
```text
Cung cấp từ điển Nhật–Việt dạng popup ngay trên trang web để hỗ trợ người học tiếng Nhật tra cứu từ vựng, Hán tự và lưu từ vựng cần học.
```

### 5.2. Permission justifications (Giải trình từng quyền)
Copy từng dòng dưới đây dán vào ô giải trình của quyền tương ứng:

| Tên quyền (Permission) | Nội dung giải trình dán vào Store |
|---|---|
| **`<all_urls>` (Host) & `scripting`** | `Cần thiết để quét văn bản tiếng Nhật dưới con trỏ chuột và hiển thị khung popup tra cứu từ điển trực tiếp trên mọi trang web tiếng Nhật mà người dùng đang đọc.` |
| **`storage` & `unlimitedStorage`** | `Cần thiết để lưu trữ dữ liệu từ điển Nhật–Việt và Hán tự ngoại tuyến dung lượng lớn trong IndexedDB của trình duyệt, cũng như lưu cấu hình và sổ từ cục bộ của người dùng.` |
| **`identity`** | `Cần thiết để người dùng tùy chọn đăng nhập bằng tài khoản Google (OAuth 2.0) nhằm đồng bộ danh sách từ vựng đã lưu lên sổ từ đám mây cá nhân.` |
| **`clipboardWrite`** | `Cho phép người dùng sao chép nhanh từ vựng, câu ví dụ hoặc ngữ nghĩa từ khung từ điển vào bộ nhớ tạm khi nhấn nút Copy.` |
| **`contextMenus`** | `Thêm mục tra cứu nhanh bằng FenixJpCatch vào menu chuột phải khi người dùng bôi đen văn bản trên trang web.` |
| **`declarativeNetRequest`** | `Hỗ trợ xử lý header mạng cục bộ khi người dùng kích hoạt tính năng phát âm thanh từ vựng hoặc kết nối với AnkiConnect trên máy tính.` |
| **`offscreen`** | `Cần thiết trên Manifest V3 để xử lý phát âm thanh phát âm từ vựng và xử lý clipboard thông qua tài liệu Offscreen.` |

### 5.3. Data usage (Khai báo dữ liệu thu thập)
- **Tick chọn 2 mục:**
  1. `[x] Personally identifiable information` *(Giải thích: Chỉ gồm Email và Tên hiển thị khi người dùng chủ động bấm Đăng nhập Google để đồng bộ sổ từ)*.
  2. `[x] Authentication information` *(Giải thích: Mã token OAuth/Firebase khi đăng nhập đồng bộ)*.
- **Cam kết:** Kéo xuống cuối trang, tick chọn **cả 3 ô xác nhận**:
  - `[x] I certify that this extension doesn't sell user data...`
  - `[x] I certify that this extension doesn't use or transfer user data for purposes unrelated to the item's single purpose...`
  - `[x] I certify that this extension doesn't use or transfer user data to determine creditworthiness or for lending purposes.`
- **Privacy policy URL:** Dán chính xác link sau:
  ```text
  https://github.com/quyen-eas/fenixjpcatch-extension/blob/main/PRIVACY-POLICY.md
  ```

---

## 6. Bước 5: Gửi Xét Duyệt (Submit For Review)

1. Bấm nút **Submit for review** ở góc trên cùng bên phải màn hình.
2. Tại hộp thoại xác nhận, trong ô **Notes for the reviewer** (Ghi chú cho người duyệt), bạn dán đoạn tiếng Anh này:
   ```text
   This extension provides an offline Japanese-Vietnamese popup dictionary. Google Sign-In via chrome.identity is an optional feature used solely for syncing saved vocabulary words to Cloud Firestore.
   ```
3. Bấm **Submit**.
4. Thời gian xét duyệt thông thường từ **1 đến 3 ngày làm việc**. Bạn sẽ nhận được email thông báo ngay khi extension được xuất bản thành công lên Store.

---

## 7. Quy Trình Cập Nhật Phiên Bản Mới Trong Tương Lai

Khi có code mới hoặc sửa lỗi, quy trình build và cập nhật như sau:

1. Chạy lệnh build (bắt buộc truyền `--version` lớn hơn bản đã xuất bản trên Store, ví dụ `0.2.7`, để không bị gán mặc định `0.0.0.0`):
   ```powershell
   $env:Path = "$env:LOCALAPPDATA\node-v22\node-v22.14.0-win-x64;" + $env:Path
   Set-Location D:\Projects\Fenix\FenixCatch\fenixjpcatch-extension
   node.exe dev/bin/build.js --target chrome --version 0.2.7
   ```
2. Đóng gói bản Store (tự động loại bỏ `key`):
   ```powershell
   & "C:\Users\NTQJ-\AppData\Roaming\uv\python\cpython-3.12-windows-x86_64-none\python.exe" -c "import zipfile, shutil, json, os; dist='builds'; src=os.path.join(dist,'yomitan-chrome.zip'); tgt_dir=os.path.join(dist,'fenixjpcatch-chrome-v0.2.7'); store_zip=os.path.join(dist,'fenixjpcatch-chrome-v0.2.7-store.zip'); shutil.rmtree(tgt_dir,ignore_errors=True); zipfile.ZipFile(src,'r').extractall(tgt_dir); m_path=os.path.join(tgt_dir,'manifest.json'); m=json.load(open(m_path,'r',encoding='utf-8')); m.pop('key',None); json.dump(m,open(m_path,'w',encoding='utf-8'),indent=4,ensure_ascii=False); z=zipfile.ZipFile(store_zip,'w',zipfile.ZIP_DEFLATED); [z.write(os.path.join(r,f),os.path.relpath(os.path.join(r,f),tgt_dir)) for r,_,files in os.walk(tgt_dir) for f in files]; z.close(); print('UPDATE_PACKAGE_READY')"
   ```
3. Vào trang Developer Dashboard > Bấm vào FenixJpCatch > Tab **Package** > Bấm **Upload new package** và chọn file `-store.zip` mới > Bấm **Submit for review**.
