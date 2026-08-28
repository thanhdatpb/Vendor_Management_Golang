# R2-only media cutover

Runbook chuyển runtime media khỏi local disk mà không xoá dữ liệu hiện hữu.

## Nguyên tắc không mất dữ liệu

- Migration chỉ **copy**, không xoá file local.
- Backup DB và `storage/app` trước mọi thao tác ghi.
- Không deploy bản R2-only cho đến khi audit gate trả exit code `0`.
- Giữ backup local ít nhất 1–2 tuần sau cutover.
- Ảnh Vendor Library tiếp tục qua route xác thực Laravel; không đổi sang URL raw.
- Dùng `r2.dev`; chưa đổi nameserver/custom domain trong đợt này.

## 0. Audit trước cutover (read-only)

Trên VPS production, tại thư mục `backend`:

```bash
php artisan config:clear
php artisan app:audit-media-storage --disk=s3
```

Ghi lại toàn bộ số liệu: URL local, object thiếu trên R2, file trong
`storage/app/public` và `storage/app/vendors`. Không dựa vào số liệu cũ trong tài
liệu vì dữ liệu production có thể đã thay đổi.

## 1. Backup bắt buộc

Thay `DB_USER`, `DB_NAME` bằng giá trị production và lưu backup ngoài thư mục deploy:

```bash
mkdir -p ../backups
tar czf ../backups/media-before-r2-$(date +%F-%H%M%S).tar.gz storage/app
mysqldump --single-transaction -u DB_USER -p DB_NAME \
  > ../backups/db-before-r2-$(date +%F-%H%M%S).sql
```

Kiểm tra hai file backup tồn tại và có dung lượng lớn hơn 0 trước khi tiếp tục.

## 2. Chuẩn bị cấu hình R2, chưa deploy code R2-only

Điền biến theo `backend/.env.r2.example`. Dùng `AWS_URL=https://pub-....r2.dev`.
Trên phiên bản code cũ còn hỗ trợ chuyển tiếp, giữ `MEDIA_DISK=public` trong lúc
migrate, sau đó:

```bash
php artisan config:clear
php artisan app:migrate-media-to-object-storage --dry-run --fail-on-missing
```

Nếu có bất kỳ dòng `không thấy file`, dừng lại và khôi phục/đối chiếu file nguồn.

## 3. Copy thật lên R2

```bash
php artisan app:migrate-media-to-object-storage --fail-on-missing
```

Lệnh có tính idempotent và không xoá bản gốc. Chạy lại audit trên chính release
chứa lệnh audit:

```bash
php artisan app:audit-media-storage --disk=s3 --require-r2-ready
```

### Gate bắt buộc

Chỉ tiếp tục khi lệnh trên exit `0`, đồng thời:

- `URL local cần migrate = 0`;
- `Object thiếu trên s3 = 0`;
- số file backup local vẫn giữ nguyên.

## 4. Deploy release R2-only

```bash
git pull
cd backend
composer install --no-dev --optimize-autoloader
# đảm bảo .env có MEDIA_DISK=s3 và đủ AWS_*
php artisan config:clear
php artisan app:audit-media-storage --disk=s3 --require-r2-ready
```

Nếu audit sau deploy không pass, rollback code ngay; không xoá local backup.

Sau khi gate pass, gỡ **symlink phục vụ public** nếu còn. Trước tiên phải xác nhận
đây đúng là symlink, không phải thư mục/file thật:

```bash
test ! -e public/storage || test -L public/storage
test -L public/storage && readlink public/storage
test -L public/storage && unlink public/storage
```

Không chạy `rm -rf`; thư mục nguồn `storage/app/public` phải còn nguyên.

## 5. Smoke test

1. Mở ảnh Product, Vendor và Vendor Library cũ.
2. Upload một ảnh Product và một ảnh Vendor mới.
3. Xác nhận URL Product/Vendor bắt đầu bằng `AWS_URL`.
4. Xác nhận ảnh Vendor Library vẫn có URL `/api/vendor-library/images/...` và yêu cầu đăng nhập.
5. Xác nhận object mới xuất hiện trên R2.
6. Xóa ảnh test và xác nhận chỉ object R2 bị xóa; backup local không đổi.
7. Chạy lại audit gate.
8. Xác nhận `storage/app/public` và `storage/app/vendors` không sinh file runtime mới.

## 6. Rollback

Release này không còn runtime local. Rollback đúng cách:

1. Deploy lại commit/tag ngay trước cutover.
2. Restore database backup nếu migration DB cần hoàn tác.
3. Đặt `MEDIA_DISK=public` trên release cũ và chạy `php artisan config:clear`.
4. Kiểm tra ảnh từ backup local.

Không xóa object R2 khi rollback; chúng không ảnh hưởng dữ liệu local.

## 7. Dọn local sau thời gian ổn định

Chỉ sau ít nhất 1–2 tuần chạy ổn định, audit gate luôn pass và backup đã được
chép ra nơi độc lập mới lập ticket riêng để xóa file local. Không gộp thao tác
xóa vào deploy cutover này.
