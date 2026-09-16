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

/**
 * Mục Thư Viện Vendor của từng role — đích "quay lại" khi đóng cửa sổ một file
 * được mở thẳng từ link (/library/:fileId), lúc không có bước lịch sử nào để lùi.
 *
 * CSF/Marvel/PD không có mục thư viện riêng: cả dashboard của họ LÀ thư viện,
 * chia theo project, nên trỏ về gốc để useSectionRoute tự chọn project mặc định.
 */
const LIBRARY_PATH_BY_ROLE = {
  admin:  sectionPath('/admin', ADMIN_SECTIONS, 'vendors'),
  seller: sectionPath('/seller', SELLER_SECTIONS, 'vendors'),
  staffa: sectionPath('/seller', SELLER_SECTIONS, 'vendors'),
  staff:  sectionPath('/seller', SELLER_SECTIONS, 'vendors'),
  vendor: sectionPath('/vendor', VENDOR_SECTIONS, 'library'),
  staffb: sectionPath('/vendor', VENDOR_SECTIONS, 'library'),
  csf:    '/csf',
  marvel: '/marvel',
  pd:     '/pd',
};

/** Role lạ → về trang đăng nhập, giống UNKNOWN_ROLE_ROUTE của utils/roleRoute. */
export const libraryPathForRole = (role) => {
  const key = (typeof role === 'object' && role ? role.name : role ?? '')
    .toString().toLowerCase().replace(/[-_\s]/g, '');
  return LIBRARY_PATH_BY_ROLE[key] || '/';
};
