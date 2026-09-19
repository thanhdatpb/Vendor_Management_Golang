// ════════════════════════════════════════════════════════
//  SUBMENU THƯ VIỆN VENDOR ↔ URL (dùng chung cho MỌI role)
//
//  Ba chế độ của Thư Viện Vendor (Tổng quan / New Arrivals / Best Seller) nằm
//  trên query `?view=` thay vì state cục bộ, nên bookmark, F5 và nút Back đều
//  giữ đúng chế độ — giống cách mục chính nằm trên path.
//
//  Đường dẫn khác nhau theo role (/admin/vendors, /seller/vendors,
//  /vendor/library, /csf/:project, /pd/:project…) nên ở đây chỉ dựng phần query
//  và GIỮ NGUYÊN các query khác đang có (ví dụ `?assign=…&type=…` của Vendor khi
//  đi từ một request sang thư viện).
// ════════════════════════════════════════════════════════
import { VENDOR_LIBRARY_MODES } from './vendorLibraryMode';

export const VENDOR_LIBRARY_SUBMENU = Object.freeze([
  { id: VENDOR_LIBRARY_MODES.ALL, label: 'Tổng quan Vendor & Sản phẩm' },
  { id: VENDOR_LIBRARY_MODES.NEW_PRODUCTS, label: 'New Arrivals', query: 'new-arrivals', hasCount: true },
  { id: VENDOR_LIBRARY_MODES.BEST_SELLER, label: 'Best Seller', query: 'best-seller', hasCount: true },
]);

const MODE_BY_QUERY = new Map(
  VENDOR_LIBRARY_SUBMENU
    .filter((item) => item.query)
    .map((item) => [item.query, item.id]),
);

const QUERY_BY_MODE = new Map(
  VENDOR_LIBRARY_SUBMENU.map((item) => [item.id, item.query || '']),
);

/** Đọc chế độ từ query string; thiếu/sai giá trị thì về Tổng quan. */
export function vendorLibraryModeFromSearch(search = '') {
  const view = new URLSearchParams(search).get('view');
  return MODE_BY_QUERY.get(view) || VENDOR_LIBRARY_MODES.ALL;
}

/**
 * Query string mới khi đổi chế độ — các tham số khác giữ nguyên. Tổng quan là
 * mặc định nên bỏ hẳn `view` cho URL gọn.
 */
export function vendorLibraryModeSearch(search = '', mode) {
  const params = new URLSearchParams(search);
  const query = QUERY_BY_MODE.get(mode) || '';
  if (query) params.set('view', query);
  else params.delete('view');
  const next = params.toString();
  return next ? `?${next}` : '';
}

/** Đường dẫn đầy đủ của một chế độ, giữ nguyên các query khác của trang. */
export function vendorLibraryPathWithMode(pathname, search, mode) {
  return `${pathname}${vendorLibraryModeSearch(search, mode)}`;
}

/** Badge số file: chưa có số thì "…", quá nhiều thì "999+". */
export function formatVendorLibraryCount(value) {
  if (!Number.isFinite(value)) return '…';
  if (value > 999) return '999+';
  return String(Math.max(0, value));
}
