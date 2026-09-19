// ════════════════════════════════════════════════════════
//  Chế độ Thư Viện Vendor + số file cho badge submenu ở sidebar Admin.
//
//  Badge phải khớp đúng danh sách người dùng thấy khi bấm vào submenu:
//    • New Arrivals — file upload vào tab New Arrivals trong TUẦN hiện tại
//      (từ 00:00 thứ Hai giờ Việt Nam), đếm theo FILE.
//    • Best Seller  — file có ít nhất một dòng sản phẩm được đánh dấu ⭐.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  VENDOR_LIBRARY_MODES,
  isWithinCurrentVendorWeek,
  hasBestSellerProduct,
  getVendorLibraryModeCounts,
} from '../vendorLibraryMode';

// Thứ Năm 17/09/2026 10:00 giờ VN. Thứ Hai tuần này bắt đầu 14/09 00:00 VN
// = 13/09 17:00 UTC.
const NOW = new Date('2026-09-17T03:00:00Z');
const MONDAY_VN_START = '2026-09-13T17:00:00Z';
const LAST_SUNDAY_VN_END = '2026-09-13T16:59:59Z';

describe('isWithinCurrentVendorWeek', () => {
  it('tính từ đúng 00:00 thứ Hai giờ Việt Nam', () => {
    expect(isWithinCurrentVendorWeek(MONDAY_VN_START, NOW)).toBe(true);
    expect(isWithinCurrentVendorWeek(LAST_SUNDAY_VN_END, NOW)).toBe(false);
  });

  it('thiếu hoặc sai định dạng ngày thì không phải hàng mới', () => {
    expect(isWithinCurrentVendorWeek(null, NOW)).toBe(false);
    expect(isWithinCurrentVendorWeek('', NOW)).toBe(false);
    expect(isWithinCurrentVendorWeek('không phải ngày', NOW)).toBe(false);
  });
});

describe('hasBestSellerProduct', () => {
  it('chỉ cần một dòng được đánh dấu', () => {
    expect(hasBestSellerProduct({ generalInfo: [{ id: 1 }, { id: 2, bestSeller: true }] })).toBe(true);
    expect(hasBestSellerProduct({ generalInfo: [{ id: 1, bestSeller: false }] })).toBe(false);
    expect(hasBestSellerProduct({})).toBe(false);
    expect(hasBestSellerProduct(null)).toBe(false);
  });
});

describe('getVendorLibraryModeCounts', () => {
  const files = [
    // New Arrivals trong tuần — có 2 dòng best seller nhưng vẫn chỉ tính 1 file
    {
      id: 'a', sourceTab: 'new_products', importedAt: '2026-09-15T02:00:00Z',
      generalInfo: [{ id: 1, bestSeller: true }, { id: 2, bestSeller: true }],
    },
    // New Arrivals tuần trước → đã rời tab New Arrivals
    { id: 'b', sourceTab: 'new_products', importedAt: LAST_SUNDAY_VN_END, generalInfo: [] },
    // File thường upload tuần này → không phải New Arrivals
    { id: 'c', sourceTab: 'all', importedAt: '2026-09-16T02:00:00Z', generalInfo: [{ id: 3, bestSeller: true }] },
    { id: 'd', sourceTab: 'new_products', importedAt: MONDAY_VN_START, generalInfo: [{ id: 4 }] },
  ];

  it('đếm FILE của từng chế độ', () => {
    expect(getVendorLibraryModeCounts(files, NOW)).toEqual({
      [VENDOR_LIBRARY_MODES.NEW_PRODUCTS]: 2,
      [VENDOR_LIBRARY_MODES.BEST_SELLER]: 2,
    });
  });

  it('dữ liệu rỗng/không hợp lệ trả về 0 thay vì lỗi', () => {
    const zero = { [VENDOR_LIBRARY_MODES.NEW_PRODUCTS]: 0, [VENDOR_LIBRARY_MODES.BEST_SELLER]: 0 };
    expect(getVendorLibraryModeCounts([], NOW)).toEqual(zero);
    expect(getVendorLibraryModeCounts(undefined, NOW)).toEqual(zero);
  });
});
