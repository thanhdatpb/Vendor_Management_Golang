// ════════════════════════════════════════════════════════
//  RESOLVE SHEET — bind bảng tính giá với thư viện Vendor.
//
//  Tách khỏi PriceSheetWorkspace theo T0 của kế hoạch fix: đây là nơi duy nhất
//  quyết định "một Product Type hiển thị những size nào, Item Cost và ship cost
//  lấy từ đâu". Tách ra thành hàm THUẦN để test được các mục tiêu 02/03/04/05
//  mà không phải render React.
//
//  ⚠ Refactor KHÔNG đổi hành vi so với draftSheet useMemo cũ.
// ════════════════════════════════════════════════════════
import { makeSize } from './pricingEngine';
import {
  findLibraryEntry, getLibraryItemCost, getLibraryShip, getLibraryShipItem2, normalizeKey,
} from './vendorLibraryIndex';

// ── Size lấy từ thư viện vendor: id phải suy ra được từ (ptId + label) ──
// resolveSheet dựng lại danh sách size từ thư viện ở MỖI lần gọi. Nếu dòng chưa
// có trong state mà lại sinh id ngẫu nhiên (makeSize → uid) thì id hiển thị trên
// UI không tồn tại trong state → onUpdateSize không tìm thấy dòng để patch, ô
// "Giá Size" gõ không ăn (và input còn bị remount vì React key đổi liên tục).
export const libSizeId = (ptId, label) => `szlib_${ptId}_${normalizeKey(label)}`;

/**
 * Danh sách size của 1 Product Type theo đúng thư viện vendor.
 * Giữ nguyên dòng cũ khi khớp label (không mất giá đã nhập), dòng chưa có thì
 * tạo mới với id tiền định để state và UI luôn dùng chung một id.
 */
export function libSizesOf(pt, libEntry) {
  return (libEntry?.sizes || []).map((label) => {
    const existing = (pt.sizes || []).find((s) => s.label === label);
    return existing || { ...makeSize(label, ''), id: libSizeId(pt.id, label) };
  });
}

/**
 * Sizes dùng làm gốc khi ghi: với PT lấy từ thư viện thì đồng bộ theo thư viện
 * trước (id khớp với dòng đang hiển thị) — bảng cũ lưu thiếu size, hoặc thư viện
 * bổ sung size sau khi bảng được tạo, đều sửa được bình thường.
 */
export function baseSizesOf(pt, libIndex) {
  const libEntry = findLibraryEntry(libIndex, pt.name);
  return libEntry ? libSizesOf(pt, libEntry) : (pt.sizes || []);
}

/**
 * Bind cả bảng tính giá với thư viện: mỗi Product Type khớp được entry thư viện
 * sẽ lấy danh sách size + Item Cost (cột P1) + ship cost theo phương thức ship.
 * Product Type nhập tay giữ nguyên.
 *
 * @param {object} sheet    — bảng tính giá (state hiện tại của workspace)
 * @param {object|null} libIndex — index thư viện (loadVendorLibraryIndex)
 * @returns {object} sheet mới, KHÔNG mutate đầu vào
 */
export function resolveSheet(sheet, libIndex) {
  const productTypes = (sheet?.productTypes || []).map((pt) => {
    const libEntry = findLibraryEntry(libIndex, pt.name);
    if (!libEntry) return pt;
    const sizes = libSizesOf(pt, libEntry).map((base) => {
      const label = base.label;
      // Bản chỉnh 2026-07-17: giá vốn = P1 (không còn cột Total); cost-ship lấy per-method.
      const itemCost = getLibraryItemCost(libEntry, label) || '';
      const totalShipCost = getLibraryShip(libEntry, label, pt.shipMethod) || 0;      // cột "Price Ship"
      const shipCostItem = getLibraryShipItem2(libEntry, label, pt.shipMethod) || 0;  // cột "Price Ship Item 2"
      return { ...base, label, itemCost, totalShipCost, shipCostItem, isLib: true };
    });
    return { ...pt, sizes };
  });
  return { ...sheet, productTypes };
}
