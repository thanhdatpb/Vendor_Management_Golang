// ════════════════════════════════════════════════════════
//  RESOLVE SHEET — bind bảng tính giá với thư viện Vendor.
//
//  Tách khỏi PriceSheetWorkspace theo T0 của kế hoạch fix: đây là nơi duy nhất
//  quyết định "một Product Type hiển thị những size nào, Item Cost và ship cost
//  lấy từ đâu". Tách ra thành hàm THUẦN để test được các mục tiêu 02/03/04/05
//  mà không phải render React.
//
//  PR-A3 (mục 03/04): trước đây MỌI Product Type resolve theo TÊN
//  (findLibraryEntry) — 2 vendor cùng tên phôi bị đè nhau, vendor gặp trước
//  thắng. Giờ một Product Type có thể gắn CHẶT vào một record cụ thể qua
//  `pt.libRef.recordKey` (một vendor, một file nguồn) — đường mới. PT chưa có
//  `libRef` (mọi bảng đã lưu trước đây) vẫn resolve theo tên y hệt cũ — đường
//  lùi KHÔNG đổi field nào, không có migration, không có bảng nào tự đổi số.
//  Muốn 2 vendor cùng một phôi cùng tồn tại: thêm 2 Product Type block riêng,
//  mỗi block một `libRef` — xem AddProductTypeModal + mục 03 (bỏ chặn trùng tên).
// ════════════════════════════════════════════════════════
import { makeSize } from './pricingEngine';
import {
  findLibraryEntry, findLibraryRecord, getLibraryItemCost, getLibraryShip, getLibraryShipItem2, normalizeKey,
} from './vendorLibraryIndex';

// ── Size lấy từ thư viện vendor: id phải suy ra được từ (ptId + label) ──
// resolveSheet dựng lại danh sách size từ thư viện ở MỖI lần gọi. Nếu dòng chưa
// có trong state mà lại sinh id ngẫu nhiên (makeSize → uid) thì id hiển thị trên
// UI không tồn tại trong state → onUpdateSize không tìm thấy dòng để patch, ô
// "Giá Size" gõ không ăn (và input còn bị remount vì React key đổi liên tục).
//
// Id chỉ cần duy nhất TRONG một pt.id — hai Product Type block khác pt.id
// (kể cả cùng tên phôi, cùng vendor) đã tự nhiên có id khác nhau, nên KHÔNG
// cần nhét thêm recordKey vào đây.
export const libSizeId = (ptId, label) => `szlib_${ptId}_${normalizeKey(label)}`;

/**
 * Danh sách size của 1 Product Type theo đúng một "nguồn" thư viện (entry theo
 * tên, hoặc record theo vendor cụ thể — cả hai đều có hình dạng {sizes, bySize}).
 * Giữ nguyên dòng cũ khi khớp label (không mất giá đã nhập), dòng chưa có thì
 * tạo mới với id tiền định để state và UI luôn dùng chung một id.
 */
export function libSizesOf(pt, libSource) {
  return (libSource?.sizes || []).map((label) => {
    const existing = (pt.sizes || []).find((s) => s.label === label);
    return existing || { ...makeSize(label, ''), id: libSizeId(pt.id, label) };
  });
}

/**
 * Sizes dùng làm gốc khi ghi: với PT gắn `libRef` thì đồng bộ theo ĐÚNG record
 * đó; PT lấy từ thư viện theo tên (đường lùi) thì đồng bộ theo entry khớp tên;
 * PT nhập tay giữ nguyên. Record/entry biến mất khỏi thư viện thì giữ nguyên
 * state hiện có (không tự xoá size chỉ vì thư viện đang tạm không có).
 */
export function baseSizesOf(pt, libIndex) {
  if (pt?.libRef?.recordKey) {
    const record = findLibraryRecord(libIndex, pt.libRef.recordKey);
    return record ? libSizesOf(pt, record) : (pt.sizes || []);
  }
  const libEntry = findLibraryEntry(libIndex, pt.name);
  return libEntry ? libSizesOf(pt, libEntry) : (pt.sizes || []);
}

/** Product Type resolve theo TÊN — đường lùi cho bảng chưa có `libRef` (giữ nguyên 100% hành vi cũ). */
function resolveByName(pt, libIndex) {
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
}

/** Product Type gắn chặt vào một record cụ thể (mục 03/04) — một vendor, một file nguồn. */
function resolveByRecord(pt, libIndex) {
  const record = findLibraryRecord(libIndex, pt.libRef.recordKey);

  if (!record) {
    // Record nguồn đã biến mất khỏi thư viện (file bị xoá / import lại). Dùng
    // costSnapshot đã chốt lúc thêm Product Type — KHÔNG âm thầm đổi số của
    // bảng đang chạy thật, và báo rõ để Seller biết mà kiểm tra lại thư viện.
    const snapshot = pt.costSnapshot || {};
    const sizes = (pt.sizes || []).map((sz) => {
      const snap = snapshot[sz.label] || {};
      return {
        ...sz, isLib: true,
        itemCost: snap.itemCost ?? sz.itemCost ?? '',
        totalShipCost: snap.totalShipCost ?? sz.totalShipCost ?? 0,
        shipCostItem: snap.shipCostItem ?? sz.shipCostItem ?? 0,
      };
    });
    return { ...pt, sizes, vendorCode: pt.libRef.vendorCode, warning: 'record-missing' };
  }

  const sizes = libSizesOf(pt, record).map((base) => {
    const label = base.label;
    const itemCost = getLibraryItemCost(record, label) || '';
    const totalShipCost = getLibraryShip(record, label, pt.shipMethod) || 0;
    const shipCostItem = getLibraryShipItem2(record, label, pt.shipMethod) || 0;
    return { ...base, label, itemCost, totalShipCost, shipCostItem, isLib: true };
  });
  return { ...pt, sizes, vendorCode: record.vendorCode };
}

/**
 * Bind cả bảng tính giá với thư viện: mỗi Product Type khớp được nguồn thư viện
 * (theo `libRef` hoặc theo tên) sẽ lấy danh sách size + Item Cost (cột P1) +
 * ship cost theo phương thức ship. Product Type nhập tay giữ nguyên.
 *
 * @param {object} sheet    — bảng tính giá (state hiện tại của workspace)
 * @param {object|null} libIndex — index thư viện (loadVendorLibraryIndex)
 * @returns {object} sheet mới, KHÔNG mutate đầu vào
 */
export function resolveSheet(sheet, libIndex) {
  const productTypes = (sheet?.productTypes || []).map((pt) =>
    (pt?.libRef?.recordKey ? resolveByRecord(pt, libIndex) : resolveByName(pt, libIndex))
  );
  return { ...sheet, productTypes };
}
