# Happy Creative Hub Vendor Manager

Dự án phần mềm quản lý nhà cung cấp (Vendors) và người bán (Sellers) cho hệ thống Vendor Management (Vendor Hub).

## 🌟 Tính năng chính (Features)

- **Phân quyền người dùng**: Quản trị viên (Admin), Người bán (Seller - Staff A), Nhà cung cấp (Vendor - Staff B).
- **Quản lý sản phẩm**: Đề xuất, kiểm duyệt, so sánh và lựa chọn sản phẩm từ các Vendors.
- **Quản lý Vendor/Seller**: Quản lý thông tin, thiết lập giá (Pricing), cấu hình giao hàng (Eco, Fast, Express...).
- **Hệ thống thông báo (Notifications)**: Gửi tin tức, cập nhật theo thời gian thực cho Seller và Vendor.
- **Báo cáo & Thống kê**: Biểu đồ phân tích (Chart.js), xuất dữ liệu ra file Excel.

## 🛠 Công nghệ sử dụng (Tech Stack)

### Frontend
- **Framework**: React 19 + Vite
- **Styling / UI**: TailwindCSS, Ant Design, Lucide Icons
- **Routing**: React Router DOM (v7)
- **State Management**: Zustand
- **Khác**: Axios, SheetJS (XLSX), Chart.js

### Backend
- **Framework**: Laravel 11
- **Authentication**: Laravel Sanctum
- **Database**: MySQL 8.0
- **Storage**: Local Disk (Symlink)

### Infrastructure
- Docker & Docker Compose (cho MySQL và phpMyAdmin)
- Vercel (Hỗ trợ cấu hình deploy frontend nhanh qua `vercel.json`)

## 📂 Cấu trúc thư mục (Directory Structure)

```
/
├── backend/                # Mã nguồn API Laravel
├── frontend/               # Mã nguồn giao diện React (Vite)
├── docker-compose.yml      # Cấu hình container MySQL & phpMyAdmin
├── .gitignore              # Cấu hình Git bỏ qua file rác/private

## 🚀 Hướng dẫn cài đặt (Installation)

### 1. Yêu cầu hệ thống (Prerequisites)
- PHP >= 8.2 & Composer
- Node.js >= 18 & NPM
- Docker & Docker Compose

### 2. Thiết lập Database (Docker)
Khởi chạy container cho MySQL và phpMyAdmin:
```bash
docker-compose up -d
```
*(MySQL sẽ chạy ở port 3306, phpMyAdmin ở port 8080)*

### 3. Cài đặt Backend (Laravel)
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate

# Tạo symlink để lưu trữ ảnh upload
php artisan storage:link

# Chạy migration và tạo dữ liệu mẫu
php artisan migrate --seed
```

### 4. Cài đặt Frontend (React)
```bash
cd frontend
npm install
```

## 💻 Chạy dự án (Development)

Bạn có thể chạy dự án nhanh chóng bằng cách sử dụng script có sẵn ở thư mục gốc:
- Nhấn đúp vào file `start-dev.bat` để chạy đồng thời cả Frontend và Backend.

**Hoặc chạy thủ công qua Terminal:**

1. **Backend:**
```bash
cd backend
php artisan serve
```

2. **Frontend:**
```bash
cd frontend
npm run dev
```
| Quyền hạn | User đăng nhập |
|---|---|
| **Admin** | `happyc.admin` |
| **Vendor (Staff B)** | `happyc.vendor` |
| **Seller (Staff A)** | `happyc.seller.happy, happyc.seller.creative, happyc.seller.global, happyc.seller.pilot` |

## 📦 Triển khai (Deployment)

1. **Backend**:
   - Upload mã nguồn `backend` lên máy chủ.
   - Document Root của Web Server (Nginx/Apache) cần trỏ vào thư mục `backend/public`.
   - Chạy `composer install --optimize-autoloader --no-dev`.
   - Cập nhật file `.env` (APP_ENV=production, APP_DEBUG=false, cấu hình Database).
   - Chạy `php artisan storage:link` và `php artisan config:cache`.

2. **Frontend**:
   - Chạy `npm run build` trong thư mục `frontend`.
   - Thư mục `frontend/dist` chứa các file tĩnh đã được tối ưu hóa.
   - Có thể copy nội dung trong `dist` bỏ vào `backend/public` (nếu chạy chung domain), hoặc deploy thư mục `dist` lên các nền tảng như Vercel/Netlify.