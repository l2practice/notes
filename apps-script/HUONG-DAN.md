# Giữ kết nối Google Drive lâu dài bằng Google Apps Script

Mục đích: app tự lấy mã truy cập Drive mới mỗi khi cần, không bắt bạn bấm Reconnect mỗi giờ.
Một đoạn Apps Script nhỏ (miễn phí, chạy trên tài khoản Google của bạn) giữ "refresh token". Làm một lần duy nhất.

## A. Chuẩn bị ở Google Cloud (dự án bạn đã dùng cho Client ID)

1. Vào https://console.cloud.google.com → chọn đúng dự án đang chứa OAuth Client ID của app.
2. Menu ☰ → **APIs & Services** → **OAuth consent screen** (hoặc **Google Auth platform → Audience**).
   Nếu đang ở trạng thái **Testing** hãy bấm **Publish app / In production**.
   Lý do: ở chế độ Testing, Google tự hủy refresh token sau 7 ngày. Quyền `drive.file` không cần Google xác minh.
3. **APIs & Services → Credentials** → bấm vào OAuth client kiểu **Web application** đang dùng.
   Chép lại **Client ID** và **Client secret** (nếu không thấy secret, bấm *Add secret* / *Reset secret*).
   Cứ để tab này mở, bước C quay lại.

## B. Tạo Apps Script

1. Vào https://script.google.com → **New project**, đặt tên `Notes token keeper`.
2. Xóa code mẫu, dán toàn bộ nội dung file `apps-script/Code.gs`. Bấm 💾 Save.
3. Bánh răng **Project Settings** → cuộn xuống **Script properties** → **Add script property**, thêm 3 dòng:
   | Property | Giá trị |
   |---|---|
   | `GOOGLE_CLIENT_ID` | Client ID ở bước A3 |
   | `GOOGLE_CLIENT_SECRET` | Client secret ở bước A3 |
   | `APP_KEY` | một chuỗi dài ngẫu nhiên (20 ký tự trở lên), coi như mật khẩu thứ hai. Ghi lại để dán vào app |
4. **Deploy → New deployment** → biểu tượng bánh răng → **Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
   Bấm **Deploy**, rồi **Authorize access** → chọn tài khoản của bạn → nếu có cảnh báo "Google hasn't verified this app" bấm **Advanced → Go to Notes token keeper (unsafe) → Allow**
   (đây là script của chính bạn nên an toàn).
5. Chép **Web app URL** (dạng `https://script.google.com/macros/s/…/exec`).

## C. Báo cho Google biết địa chỉ quay về

Quay lại tab Google Cloud (bước A3) → mục **Authorized redirect URIs** → **Add URI** → dán đúng Web app URL ở B5 (kể cả đuôi `/exec`) → **Save**. Đợi 1–2 phút.

## D. Nối vào app

1. Mở app → **Settings → Always-on connection**.
2. Dán **Web app URL** và **APP_KEY** → **Save and check**. Nhãn hiện *Not linked* là đúng.
3. Bấm **Link Google Drive** → chọn tài khoản Google → **Allow** → thấy trang "Google Drive linked".
4. Quay lại app. Nhãn đổi thành **On**. Xong.

Từ giờ khi mở app, trước cả lúc bạn nhập mật khẩu, app đã tự lấy mã Drive mới ở nền, và cứ 50 phút nó tự gia hạn.
Bạn không còn thấy bảng Reconnect nữa (trừ khi bạn thu hồi quyền ở https://myaccount.google.com/permissions).

## Thiết bị khác

Trên mỗi thiết bị (iPad, điện thoại, máy tính khác) chỉ cần làm bước D1–D2 (dán cùng URL và APP_KEY). Không cần Link lại.

## Gỡ rối

- **Wrong key**: APP_KEY trong app khác với Script properties. Dán lại cho khớp từng ký tự.
- **Unreachable**: sai URL, hoặc chưa Deploy với *Who has access = Anyone*.
- **redirect_uri_mismatch** khi Link: URL ở bước C không khớp tuyệt đối. Chép lại đúng địa chỉ Google báo trong trang lỗi.
- **Sau khi sửa Code.gs**: Deploy → Manage deployments → ✏️ → *Version: New version* → Deploy (URL giữ nguyên).
- **Muốn tắt hẳn**: Settings → Always-on connection → Remove (app thu hồi quyền ở Google và xóa cấu hình trên thiết bị này).

## Bảo mật

- Refresh token nằm trong Script properties của bạn, không bao giờ gửi cho trình duyệt. App chỉ nhận mã truy cập sống 1 giờ.
- Ai có URL **và** APP_KEY mới lấy được mã truy cập. Giữ APP_KEY như mật khẩu; nghi lộ thì đổi trong Script properties và dán lại vào app.
- Quyền chỉ là `drive.file`: app chỉ thấy những file do chính nó tạo.
