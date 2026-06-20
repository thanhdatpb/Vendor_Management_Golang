# HappC-Hub Vendor Manager

Hệ thống nội bộ quản lý nhà cung cấp (Vendors) và quy trình thẩm định sản phẩm cho **Happy Creative LLC**.

Production: [vendorhub.viehana.com](https://vendorhub.viehana.com)

---

## Tính năng chính

- **Phân quyền 3 vai trò**: Admin (CCO), Seller / Staff A (Kinh doanh), Vendor / Staff B (Vận hành).
- **Quản lý Product Request**: Staff A tạo yêu cầu sản phẩm, Admin duyệt, Staff B tiếp nhận và xử lý.
- **Thư viện Vendor**: Import danh sách vendor từ file Excel (định dạng Happy Creative), xem thông tin phôi và bảng giá.
- **Gán Vendor cho sản phẩm**: Staff B gán vendor phù hợp, Seller xem và ra quyết định đặt Sample.
- **Thiết lập giá**: Cấu hình Target Cost, Economy / Express / Overnight Price theo từng vendor.
- **Hệ thống thông báo**: Cross-role notifications (Admin → Staff B, Staff B → Staff A, Seller → Staff B).
- **Xuất dữ liệu**: Export danh sách sản phẩm và vendor ra file Excel.

---

## Tech Stack

### Frontend
- **Framework**: React.js + Vite
- **Styling**: Inline CSS — Design System nội bộ (`HC.orange`, `HC.surface`, gradient, glassmorphism)
- **Icons**: Ant Design Icons
- **HTTP**: Axios
- **Excel**: SheetJS (XLSX)
- **Routing**: React Router DOM

### Backend
- **Framework**: Laravel 11
- **Auth**: Laravel Sanctum
- **Database**: MySQL 8.0
- **Storage**: Local Disk (Symlink)

### Infrastructure
- **Hosting**: Hostinger (auto-deploy từ GitHub branch `main`)
- **Docker**: MySQL + phpMyAdmin (môi trường dev local)

---

## Cấu trúc thư mục

```
/
├── backend/           # Laravel 11 API
├── frontend/          # React + Vite
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

## Tài khoản mặc định

| Vai trò | Username |
|---|---|
| Admin | `happyc.admin` |
| Vendor / Staff B | `happyc.vendor` |
| Seller / Staff A | `happyc.seller.happy` · `happyc.seller.creative` · `happyc.seller.global` · `happyc.seller.pilot` |

---

## Triển khai (Production)

**Backend** — trỏ Document Root vào `backend/public`:
```bash
composer install --optimize-autoloader --no-dev
php artisan storage:link
php artisan config:cache
php artisan migrate --force
```

**Frontend** — build và upload thư mục `dist`:
```bash
cd frontend
npm run build
# Copy nội dung dist/ vào public_html hoặc deploy riêng
```

Auto-deploy được cấu hình qua Hostinger GIT (branch `main`).
