import { VENDOR_LIBRARY_MODES } from '../../utils/vendorLibraryMode';

export const ADMIN_VENDOR_LIBRARY_PATH = '/admin/vendors';

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

/** Đọc mode từ query string; thiếu/sai giá trị thì về Tổng quan. */
export function vendorLibraryModeFromSearch(search = '') {
  const view = new URLSearchParams(search).get('view');
  return MODE_BY_QUERY.get(view) || VENDOR_LIBRARY_MODES.ALL;
}

/** URL chuẩn của từng submenu; Tổng quan không cần query string. */
export function adminVendorLibraryPath(mode) {
  const item = VENDOR_LIBRARY_SUBMENU.find((entry) => entry.id === mode);
  return item?.query
    ? `${ADMIN_VENDOR_LIBRARY_PATH}?view=${encodeURIComponent(item.query)}`
    : ADMIN_VENDOR_LIBRARY_PATH;
}

export function formatVendorLibraryCount(value) {
  if (!Number.isFinite(value)) return '…';
  if (value > 999) return '999+';
  return String(Math.max(0, value));
}

