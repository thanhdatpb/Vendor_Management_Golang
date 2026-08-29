// ════════════════════════════════════════════════════════
//  MỤC (TAB) CỦA TỪNG DASHBOARD ↔ SLUG TRÊN URL
//
//  Trước đây mỗi dashboard giữ mục đang mở trong `useState` nên cả role chỉ có
//  một URL (`/seller`, `/admin`…): không bookmark/gửi link được từng mục, nút
//  Back của trình duyệt không quay lại mục trước, và mọi lần remount (ví dụ bấm
//  "Quay lại" từ /price-sheets/:id) đều rớt về mục mặc định — đúng lỗi Seller
//  thoát Bảng tính giá lại nhảy sang Quản Lý Sản Phẩm.
//
//  Nay URL là nguồn sự thật duy nhất. File này khai một chỗ duy nhất cặp
//  `id` (khoá nội bộ mà sidebar/renderSection đang dùng) ↔ `slug` (đoạn URL).
//  Giữ `id` nguyên vẹn để không phải sửa sidebar và switch-case sẵn có.
// ════════════════════════════════════════════════════════

/** Seller / Staff A — /seller/:slug */
export const SELLER_SECTIONS = [
  { id: 'products', slug: 'products', title: 'Danh Sách Sản Phẩm' },
  { id: 'vendors', slug: 'vendors', title: 'Thư Viện Vendor' },
  { id: 'setup_price', slug: 'price-sheets', title: 'Bảng Tính Giá' },
];

/** Admin — /admin/:slug */
export const ADMIN_SECTIONS = [
  { id: 'overview', slug: 'overview', title: 'Tổng Quan' },
  { id: 'vendors', slug: 'vendors', title: 'Thư Viện Vendor' },
  { id: 'pricesheets', slug: 'price-sheets', title: 'Bảng Tính Giá' },
  { id: 'staff', slug: 'staff', title: 'Quản Lý Nhân Sự' },
];

/** Staff B / Vendor — /vendor/:slug */
export const VENDOR_SECTIONS = [
  { id: 'products', slug: 'products', title: 'Quản Lý Form Duyệt' },
  { id: 'library', slug: 'library', title: 'Thư Viện Vendor' },
  { id: 'news', slug: 'news', title: 'Quản Lý Thông Báo' },
];

/**
 * Đường dẫn của một mục. Trả về `basePath` nếu không nhận ra id — để lỡ gọi sai
 * thì vẫn về dashboard chứ không đẻ ra URL rác.
 */
export const sectionPath = (basePath, sections, id) => {
  const found = sections.find((s) => s.id === id);
  return found ? `${basePath}/${found.slug}` : basePath;
};

// Đích "Quay lại" của trang /price-sheets/:id — trỏ thẳng vào mục Bảng Tính Giá
// thay vì `/seller` | `/admin` trống (vốn rơi về mục mặc định).
export const SELLER_PRICE_SHEETS_PATH = sectionPath('/seller', SELLER_SECTIONS, 'setup_price');
export const ADMIN_PRICE_SHEETS_PATH = sectionPath('/admin', ADMIN_SECTIONS, 'pricesheets');
