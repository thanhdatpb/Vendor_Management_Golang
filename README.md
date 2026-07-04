# HappC-Hub Vendor Manager

Hệ thống nội bộ quản lý nhà cung cấp (Vendors) và quy trình thẩm định sản phẩm cho **Happy Creative LLC**.

Production: [vendorhub.viehana.com](https://vendorhub.viehana.com)

---

## Vai trò & Luồng nghiệp vụ

Hệ thống có 5 vai trò:

| Vai trò | Mô tả |
|---|---|
| **Admin** | Duyệt/từ chối Product Request, quản lý nhân sự & phân quyền, xem toàn bộ dữ liệu. |
| **Seller / Staff A** | Tạo yêu cầu sản phẩm (Product Request), duyệt vendor do Staff B đề xuất, thiết lập giá bán. |
| **Vendor / Staff B** | Tiếp nhận Request, quản lý Thư viện Vendor (import Excel), gán vendor phù hợp cho từng sản phẩm. |
| **CSF** *(Customer Service & Fulfillment)* | Chỉ xem (read-only) Thư viện Vendor — **không thấy giá**. Xem được cả 4 project (Happy / Creative / Global / Hapify84) cùng lúc. |
| **PD** *(Product Design)* | Chỉ xem (read-only) Thư viện Vendor — **không thấy giá**. Chỉ xem được project mà tài khoản được gán. |

CSF/PD dùng chung dữ liệu Thư viện Vendor với Seller/Staff B nhưng hiển thị gộp "Thông tin chung về phôi" + cột **Link Template** vào 1 bảng duy nhất, ẩn hoàn toàn mọi trường giá (Target Cost, Economy/Express/Overnight Price...).

---

## Tính năng chính

- **Quản lý Product Request**: Staff A tạo yêu cầu sản phẩm, Admin duyệt, Staff B tiếp nhận và xử lý.
- **Thư viện Vendor**: Import danh sách vendor từ file Excel (định dạng Happy Creative), xem thông tin phôi và bảng giá theo từng project.
- **Gán Vendor cho sản phẩm**: Staff B gán vendor phù hợp, Seller xem và ra quyết định đặt Sample.
- **Thiết lập giá**: Cấu hình Target Cost, Economy / Express / Overnight Price và Link Template theo từng vendor.
- **Tra cứu read-only cho CSF/PD**: Xem Thư viện Vendor không kèm giá, đúng phạm vi project được phân quyền.
- **Quản lý nhân sự (Admin)**: Thêm/sửa/khoá tài khoản theo từng project, phân role Seller/PD/CSF/Admin/Vendor.
- **Hệ thống thông báo**: Cross-role notifications (Admin → Staff B, Staff B → Staff A, Seller → Staff B).
- **Xuất dữ liệu**: Export danh sách sản phẩm và vendor ra file Excel.

---

## Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **UI**: Ant Design + Ant Design Icons, Chart.js (`react-chartjs-2`)
- **Styling**: Inline CSS — Design System nội bộ (`HC.orange`, `HC.surface`, gradient, glassmorphism). Không dùng Tailwind/CSS framework.
- **HTTP**: Axios
- **Excel**: SheetJS (XLSX)
- **Routing**: React Router DOM v7

### Backend
- **Framework**: Laravel 12
- **Auth**: Laravel Sanctum (token) + Laravel Socialite (Google OAuth)
- **Database**: MySQL 8.0
- **Storage**: Local Disk (Symlink)

### Infrastructure
- **Hosting**: Hostinger — backend Laravel deploy qua Git (branch `main`), Document Root trỏ vào `backend/public`.
- **Frontend build**: build tĩnh (`vite build`) — **không tự động rebuild khi push code nguồn**, xem lưu ý ở mục Triển khai bên dưới.
- **Docker**: MySQL + phpMyAdmin (môi trường dev local).

---

## Cấu trúc thư mục

```
/
├── backend/           # Laravel 12 API
├── frontend/          # React + Vite (mã nguồn .jsx)
│   └── dist/          # Build tĩnh đã build sẵn — đây là thứ thực sự được serve ở production
├── docker-compose.yml # MySQL & phpMyAdmin local
├── BACKEND_SCHEMA.md  # Schema & endpoint spec cho các API cần implement
└── .gitignore
```

---

## Cài đặt (Development)

### Yêu cầu
- PHP >= 8.2 & Composer
- Node.js >= 18 & NPM
- Docker & Docker Compose

### 1. Database (Docker)
```bash
docker-compose up -d
# MySQL: port 3306 | phpMyAdmin: port 8080
```

### 2. Backend
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan storage:link
php artisan migrate --seed
php artisan serve
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Triển khai (Production)

**Backend** — trỏ Document Root vào `backend/public`:
```bash
composer install --optimize-autoloader --no-dev
php artisan storage:link
php artisan config:cache
php artisan migrate --force
```

**Frontend** — build và deploy thư mục `dist`:
```bash
cd frontend
npm run build
```

> ⚠️ **Lưu ý quan trọng**: `frontend/dist` là bản build **tĩnh, đã commit sẵn vào git** và chính là thứ được serve ở production — nó **không tự rebuild khi bạn push code `.jsx`**. Sau bất kỳ thay đổi nào ở `frontend/src`, phải chạy `npm run build` rồi commit lại `frontend/dist` (hoặc upload thủ công) thì thay đổi mới thực sự lên production. Chỉ sửa source mà quên bước này là nguyên nhân phổ biến nhất khiến "code đã merge nhưng giao diện chưa đổi".

Auto-deploy được cấu hình qua Hostinger GIT (branch `main`).
