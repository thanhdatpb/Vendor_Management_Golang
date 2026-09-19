// ════════════════════════════════════════════════════════
//  Submenu Thư Viện Vendor ↔ URL `/admin/vendors?view=…`
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  VENDOR_LIBRARY_SUBMENU,
  vendorLibraryModeFromSearch,
  adminVendorLibraryPath,
  formatVendorLibraryCount,
} from '../vendorLibraryNavigation';
import { VENDOR_LIBRARY_MODES } from '../../../utils/vendorLibraryMode';

describe('VENDOR_LIBRARY_SUBMENU', () => {
  it('đúng thứ tự và nhãn như bản phác thảo', () => {
    expect(VENDOR_LIBRARY_SUBMENU.map((item) => item.label)).toEqual([
      'Tổng quan Vendor & Sản phẩm',
      'New Arrivals',
      'Best Seller',
    ]);
  });

  it('chỉ New Arrivals và Best Seller có badge số file', () => {
    expect(VENDOR_LIBRARY_SUBMENU.filter((item) => item.hasCount).map((item) => item.id)).toEqual([
      VENDOR_LIBRARY_MODES.NEW_PRODUCTS,
      VENDOR_LIBRARY_MODES.BEST_SELLER,
    ]);
  });
});

describe('URL ↔ chế độ', () => {
  it.each([
    ['', VENDOR_LIBRARY_MODES.ALL],
    ['?view=new-arrivals', VENDOR_LIBRARY_MODES.NEW_PRODUCTS],
    ['?view=best-seller', VENDOR_LIBRARY_MODES.BEST_SELLER],
    ['?view=khong-ton-tai', VENDOR_LIBRARY_MODES.ALL],
  ])('"%s" → %s', (search, mode) => {
    expect(vendorLibraryModeFromSearch(search)).toBe(mode);
  });

  it('Tổng quan không cần query, hai chế độ còn lại có view', () => {
    expect(adminVendorLibraryPath(VENDOR_LIBRARY_MODES.ALL)).toBe('/admin/vendors');
    expect(adminVendorLibraryPath(VENDOR_LIBRARY_MODES.NEW_PRODUCTS)).toBe('/admin/vendors?view=new-arrivals');
    expect(adminVendorLibraryPath(VENDOR_LIBRARY_MODES.BEST_SELLER)).toBe('/admin/vendors?view=best-seller');
  });

  it('đường dẫn sinh ra đọc lại đúng chế độ', () => {
    VENDOR_LIBRARY_SUBMENU.forEach(({ id }) => {
      const search = adminVendorLibraryPath(id).split('?')[1] || '';
      expect(vendorLibraryModeFromSearch(search ? `?${search}` : '')).toBe(id);
    });
  });
});

describe('formatVendorLibraryCount', () => {
  it('số thường, chặn trên 999+, chưa có số thì "…"', () => {
    expect(formatVendorLibraryCount(0)).toBe('0');
    expect(formatVendorLibraryCount(8)).toBe('8');
    expect(formatVendorLibraryCount(1000)).toBe('999+');
    expect(formatVendorLibraryCount(undefined)).toBe('…');
    expect(formatVendorLibraryCount(NaN)).toBe('…');
  });
});
