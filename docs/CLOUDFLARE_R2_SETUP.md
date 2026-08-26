# Chuyển lưu trữ ảnh/video sang Cloudflare R2

Runbook bật object storage cho media (ảnh/video của Product, Vendor, Vendor Library).
Mục tiêu: file không còn nằm trên đĩa VPS → đổi/chuyển server không mất ảnh.

**Nguyên tắc an toàn xuyên suốt:** mặc định `MEDIA_DISK=public` (giữ nguyên hành vi cũ).
Chỉ khi đổi sang `s3` thì upload mới đi lên R2. Lệnh migrate **copy chứ không xoá**
bản gốc trên đĩa → luôn có đường lùi.

---

## 0. Bối cảnh — quy mô thực tế

Đo ngày 2026-07-23 trên production: media trên đĩa chỉ **640KB** (13 file PNG trong
`storage/app/public/vendor-library/`, là ảnh nhúng trích từ file Excel import).
Không có thư mục `products/` hay `vendors/`, không có video.

Nghĩa là **gần như toàn bộ ảnh trong app là URL ngoài lưu dạng text trong MySQL**,
không phải file trên đĩa. Hệ quả:

- R2 free tier 10GB **dư sức** (dùng 0,006%).
- Việc migrate lần này rất nhẹ và rủi ro thấp.
- R2 giải quyết bài toán *tương lai* (khi app upload nhiều ảnh/video thật), chứ hiện
  tại đĩa server chưa phải điểm đau. Rủi ro lớn hơn vẫn là **link ảnh ngoài chết**.

---
    
## 1. Phần code — đã xong

| Thành phần | Trạng thái |
|---|---|
| `config/filesystems.php` — disk `s3` + công tắc `MEDIA_DISK` | ✅ |
| `app/Support/HandlesMediaStorage.php` — trait lưu/xoá/sinh URL | ✅ |
| `app:migrate-media-to-object-storage` — chuyển dữ liệu cũ | ✅ |
| Wire vào ProductController / VendorController / VendorLibraryController | ✅ |
| Driver `league/flysystem-aws-s3-v3` + `aws/aws-sdk-php` | ✅ đã cài |

Không cần sửa code thêm. Các bước dưới đây thuần cấu hình + vận hành.

---

## 2. Phía Cloudflare

### 2.1. Kích hoạt R2

Dashboard → **R2** → nút **"Add R2 subscription to my account"**.

Free tier: 10GB lưu trữ, 1M Class A ops, 10M Class B ops mỗi tháng. **Zero egress fee**
(đây là lợi thế lớn nhất của R2 so với S3 — tải ảnh về không mất phí băng thông).
Chỉ bị tính tiền khi vượt hạn mức; hiện tại còn rất xa.

### 2.2. Tạo bucket

**Create bucket** → tên gợi ý: `happc-hub-media` → Location: **Automatic**.

Ghi lại tên bucket → điền vào `AWS_BUCKET`.

### 2.3. Mở truy cập công khai (chọn 1 trong 2)

Browser phải tải được ảnh, nên bucket cần có URL công khai.

**Cách (a) — r2.dev dev URL (khuyến nghị để bắt đầu)**

Bucket → **Settings** → **Public Development URL** → Enable.
Nhận URL dạng `https://pub-xxxxxxxxxxxxx.r2.dev` → điền vào `AWS_URL`.

- Ưu: miễn phí, tức thì, **không đụng gì tới DNS**.
- Nhược: Cloudflare rate-limit và khuyến cáo không dùng cho traffic production lớn.
  Với internal tool ~10 user và 13 ảnh thì hoàn toàn đủ.

**Cách (b) — Custom domain (vd `media.viehana.com`)**

Chỉ làm khi thật cần CDN/hiệu năng cao. Yêu cầu domain đã trỏ nameserver về Cloudflare.

> ⚠️ **CẢNH BÁO EMAIL — đọc trước khi làm cách (b)**
>
> `viehana.com` đang dùng **Google Workspace** cho email. Nếu chuyển nameserver của
> domain về Cloudflare mà **không copy đủ bản ghi MX (và SPF/DKIM/DMARC)** sang
> Cloudflare DNS trước, **toàn bộ email công ty sẽ chết**.
>
> Nếu chọn cách này: export toàn bộ DNS record hiện tại, tạo lại đầy đủ trong
> Cloudflare, xác nhận MX đúng, **rồi mới** đổi nameserver. Hoặc đơn giản hơn —
> dùng cách (a) và bỏ qua rủi ro này hoàn toàn.

### 2.4. Tạo API token

R2 → **Manage R2 API Tokens** → **Create API Token**:

- Permission: **Object Read & Write** (không phải read-only, nếu không migrate sẽ fail)
- Scope: chỉ bucket vừa tạo (nguyên tắc least-privilege)

Nhận **Access Key ID** + **Secret Access Key** → điền vào `.env`.
Secret chỉ hiện **một lần** — lưu ngay vào password manager.

Trang token cũng hiện **endpoint** dạng `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
→ điền vào `AWS_ENDPOINT`.

---

## 3. Cấu hình `.env`

Copy khối dưới vào cuối `backend/.env` rồi điền giá trị thật
(bản gốc cũng có ở [`backend/.env.r2.example`](../backend/.env.r2.example)):

```env
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET=happc-hub-media
AWS_DEFAULT_REGION=auto
AWS_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_USE_PATH_STYLE_ENDPOINT=true
AWS_URL=https://pub-xxxxxxxxxxxxx.r2.dev

# Giữ public ở bước này. Chỉ đổi thành s3 sau khi migrate + smoke test xong.
MEDIA_DISK=public
```

Lưu ý 3 điểm hay sai:

| Biến | Giá trị đúng cho R2 | Sai thường gặp |
|---|---|---|
| `AWS_DEFAULT_REGION` | `auto` | Điền `us-east-1` kiểu AWS |
| `AWS_USE_PATH_STYLE_ENDPOINT` | `true` | Để `false` → R2 từ chối |
| `AWS_URL` | URL công khai (r2.dev / custom domain) | **Để trống** → xem dưới |

> `AWS_URL` để trống là lỗi nguy hiểm nhất: code nhận diện "URL này thuộc object
> storage" bằng cách so với base URL. Trống → URL R2 bị hiểu nhầm là đường dẫn nội bộ
> trên đĩa server → ảnh hỏng. Lệnh migrate sẽ chặn nếu phát hiện trống.

Sau khi sửa `.env`, **bắt buộc**:

```bash
php artisan config:clear
```

Giữ `MEDIA_DISK=public` ở bước này — chưa bật.

---

## 4. Migrate dữ liệu cũ

### 4.1. Xem trước (không ghi gì)

```bash
php artisan app:migrate-media-to-object-storage --dry-run
```

Lệnh sẽ tự kiểm tra ghi/đọc/xoá được lên R2 trước khi làm gì khác. Nếu credential
sai, nó dừng ngay và in checklist chẩn đoán — **không ghi DB**.

Kết quả kỳ vọng trên production: ~13 file trong `vendor-library/`, 0 products, 0 vendors.

### 4.2. Chạy thật

```bash
php artisan app:migrate-media-to-object-storage
```

Việc lệnh này làm:
- Copy file từ `storage/app/public` lên R2, **giữ nguyên key** (`vendor-library/x.png`).
- Cập nhật URL trong DB (bảng `products`, `vendors`, và blob JSON `vendor_library.data`).
- **KHÔNG xoá bản gốc trên đĩa** → còn nguyên để rollback.
- Idempotent: chạy lại nhiều lần không hỏng; chạy lại được cả khi sau này đổi nhà
  cung cấp (Supabase → R2 hoặc ngược lại).

---

## 5. Bật cho upload mới

Sau khi migrate thành công, đổi trong `.env`:

```env
MEDIA_DISK=s3
```

```bash
php artisan config:clear
```

Từ giờ file upload mới đi thẳng lên R2. Dữ liệu cũ đã có URL R2 từ bước 4. Trait xử lý
được cả giai đoạn chuyển tiếp (một số URL local, một số R2) nên không cần cắt dứt điểm.

---

## 6. Smoke test — bắt buộc, đừng bỏ

Sau khi bật, kiểm 4 việc:

1. **Upload ảnh mới** (qua Vendor hoặc Product) → xem có lỗi 500 không.
   Nhờ `'throw' => true`, lỗi R2 sẽ hiện ra ngay thay vì âm thầm ghi URL chết.
2. **Kiểm URL trong DB** — phải bắt đầu bằng `AWS_URL` bạn đã đặt.
3. **Mở ảnh trong browser** → phải hiện, không 403. Nếu 403 → chưa bật public access
   (bước 2.3) hoặc `AWS_URL` sai.
4. **Xoá một ảnh** → xác nhận file mất trên R2 (bucket → Objects).

Kiểm thêm ảnh **cũ** (đã migrate) vẫn hiện bình thường trong Vendor Library.

---

## 7. Triển khai production

Deploy dự án này là **thủ công** (VPS `git pull` rồi serve `dist/`, không rebuild trên
server). Với thay đổi backend:

```bash
# trên VPS
git pull
cd backend
composer install --no-dev --optimize-autoloader   # cài driver S3 mới
# thêm khối AWS_* + MEDIA_DISK vào .env production
php artisan config:clear
php artisan app:migrate-media-to-object-storage --dry-run
php artisan app:migrate-media-to-object-storage
# rồi mới đổi MEDIA_DISK=s3 và config:clear lần nữa
```

Bước `composer install` là **không thể bỏ** — production hiện chưa có driver S3.

Backup trước khi migrate (nhẹ, làm cho chắc):

```bash
tar czf media-backup-$(date +%F).tar.gz storage/app/public
mysqldump -u USER -p DBNAME > db-backup-$(date +%F).sql
```

---

## 8. Rollback

Vì migrate không xoá bản gốc trên đĩa, quay lại rất đơn giản:

1. Đổi `MEDIA_DISK=public` trong `.env` → `php artisan config:clear`.
   → Upload mới quay về đĩa server ngay.
2. Nếu cần trả URL trong DB về dạng cũ: restore `db-backup-*.sql` ở bước 7.

File trên R2 để lại cũng vô hại (10GB free).

---

## 9. Việc còn mở

- [ ] Chưa chạy `--dry-run` lần nào trên production → làm ở bước 4.1.
- [ ] Quyết định cuối về `AWS_URL`: r2.dev (khuyến nghị) hay custom domain.
- [ ] `composer audit` báo 26 advisory trên 11 package (có sẵn từ trước, không do R2)
      → nên xử lý riêng, không gộp vào việc này.
- [ ] Nhánh `feat/media-object-storage` **chưa merge vào `main`** — production chưa
      chịu ảnh hưởng gì. Chỉ merge khi đã chốt xong server và làm hết checklist trên.
