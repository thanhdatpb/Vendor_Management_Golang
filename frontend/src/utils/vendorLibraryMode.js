import { timeValue, vnStartOfWeek } from './vnTime';

export const VENDOR_LIBRARY_MODES = Object.freeze({
  ALL: 'all',
  NEW_PRODUCTS: 'new_products',
  BEST_SELLER: 'best_seller',
});

/**
 * New Arrivals chỉ gồm file được import từ 00:00 thứ Hai của tuần hiện tại
 * theo giờ Việt Nam. `now` được nhận vào để test ranh giới tuần ổn định.
 */
export function isWithinCurrentVendorWeek(importedAt, now = new Date()) {
  if (!importedAt) return false;
  const importedTime = timeValue(importedAt, NaN);
  if (!Number.isFinite(importedTime)) return false;
  return importedTime >= vnStartOfWeek(now);
}

/** Một file Best Seller khi có ít nhất một dòng sản phẩm được đánh dấu. */
export function hasBestSellerProduct(file) {
  return (file?.generalInfo || []).some((row) => Boolean(row?.bestSeller));
}

/**
 * Badge sidebar đếm FILE, không đếm dòng sản phẩm và không phụ thuộc tìm kiếm/
 * bộ lọc đang dùng trong nội dung thư viện.
 */
export function getVendorLibraryModeCounts(files, now = new Date()) {
  const source = Array.isArray(files) ? files : [];

  return {
    [VENDOR_LIBRARY_MODES.NEW_PRODUCTS]: source.filter(
      (file) => file?.sourceTab === VENDOR_LIBRARY_MODES.NEW_PRODUCTS
        && isWithinCurrentVendorWeek(file?.importedAt, now),
    ).length,
    [VENDOR_LIBRARY_MODES.BEST_SELLER]: source.filter(hasBestSellerProduct).length,
  };
}

