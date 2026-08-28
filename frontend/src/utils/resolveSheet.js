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
//
//  PR-A4 (mục 02/05/06) — ba thứ MỚI, đều chỉ sống trong bảng tính giá và
//  KHÔNG bao giờ ghi ngược lên thư viện Vendor (một phôi dùng chung nhiều
//  project có size dư là chuyện bình thường, Seller phải tự dọn được trong
//  bảng giá của mình mà không đụng file gốc):
//    • size Seller tự thêm (`origin: 'manual'`) sống sót qua mỗi lần resolve;
//    • `size.overrides.{label,itemCost}` thắng giá trị thư viện — sửa tại chỗ;
//    • `pt.sizeOrder` quyết định thứ tự dòng, id lạ đẩy về cuối.
//  Bảng cũ không có ba trường này thì mọi thứ chạy y hệt trước.
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
 * Nhãn dùng để KHỚP một dòng state với một size của thư viện.
 *
 * `overrides.label` cho phép Seller đổi tên hiển thị của dòng thư viện, mà
 * `handleSave` lại ghi xuống server bản ĐÃ resolve (label đã đổi). Nếu khớp
 * bằng `label` thì lần mở sau dòng "S (rộng)" không còn khớp size "S" của thư
 * viện → vừa mọc thêm một dòng "S" mới, vừa biến dòng cũ thành size lạ. Vì vậy
 * dòng thư viện luôn mang theo `libLabel` = nhãn GỐC của thư viện.
 */
export const libLabelOf = (sz) => sz?.libLabel ?? sz?.label;

/** Giá mặc định của các cột Customize — chỉ áp cho dòng size MỚI dựng (mục 06). */
function defaultCustomizeOf(pt) {
  const out = {};
  (pt?.customizeInfos || []).forEach((ci) => {
    if (ci?.defaultPrice !== undefined && ci?.defaultPrice !== null && ci?.defaultPrice !== '') {
      out[ci.id] = ci.defaultPrice;
    }
  });
  return out;
}

/**
 * Danh sách size của 1 Product Type theo đúng một "nguồn" thư viện (entry theo
 * tên, hoặc record theo vendor cụ thể — cả hai đều có hình dạng {sizes, bySize}).
 * Giữ nguyên dòng cũ khi khớp label (không mất giá đã nhập), dòng chưa có thì
 * tạo mới với id tiền định để state và UI luôn dùng chung một id.
 */
export function libSizesOf(pt, libSource) {
  const deleted = pt?.deletedSizes || [];
  return (libSource?.sizes || [])
    .filter((label) => !deleted.includes(label))
    .map((label) => {
      const existing = (pt.sizes || []).find((s) => libLabelOf(s) === label);
      if (existing) return existing;
      return { ...makeSize(label, ''), id: libSizeId(pt.id, label), customize: defaultCustomizeOf(pt) };
    });
}

/**
 * Dòng size do Seller tự thêm vào một Product Type LẤY TỪ THƯ VIỆN (mục 02).
 * Trước PR-A4 những dòng này bị `libSizesOf` bỏ qua nên biến mất ngay lần
 * resolve kế tiếp. Nhận diện theo 3 dấu hiệu, đủ để bảng cũ cũng đúng:
 *   • `origin === 'manual'` (dòng thêm bằng nút ＋ Thêm Size từ nay);
 *   • `isLib === false` (đánh dấu tường minh);
 *   • nhãn không khớp size nào của thư viện (size dư / size riêng).
 */
export function manualSizesOf(pt, libSource) {
  const libLabels = new Set((libSource?.sizes || []).map((l) => normalizeKey(l)));
  return (pt?.sizes || []).filter((sz) =>
    sz?.origin === 'manual' || sz?.isLib === false || !libLabels.has(normalizeKey(libLabelOf(sz)))
  );
}

/**
 * Sắp dòng size theo `pt.sizeOrder` (mục 05). Id không có trong danh sách thứ
 * tự (size vừa thêm, size mới xuất hiện ở thư viện) đẩy về cuối và giữ nguyên
 * thứ tự tương đối với nhau — Array.prototype.sort ổn định từ ES2019.
 */
export function orderSizes(sizes, sizeOrder) {
  if (!Array.isArray(sizeOrder) || !sizeOrder.length) return sizes;
  const pos = new Map(sizeOrder.map((id, i) => [id, i]));
  const rank = (sz) => (pos.has(sz?.id) ? pos.get(sz.id) : Number.MAX_SAFE_INTEGER);
  return [...sizes].sort((a, b) => rank(a) - rank(b));
}

/** Nguồn thư viện của một Product Type: record gắn chặt, hoặc entry khớp tên. */
function libSourceOf(pt, libIndex) {
  if (pt?.libRef?.recordKey) return findLibraryRecord(libIndex, pt.libRef.recordKey);
  return findLibraryEntry(libIndex, pt?.name);
}

/**
 * Sizes dùng làm gốc khi ghi: với PT gắn `libRef` thì đồng bộ theo ĐÚNG record
 * đó; PT lấy từ thư viện theo tên (đường lùi) thì đồng bộ theo entry khớp tên;
 * PT nhập tay giữ nguyên. Record/entry biến mất khỏi thư viện thì giữ nguyên
 * state hiện có (không tự xoá size chỉ vì thư viện đang tạm không có).
 *
 * ⚠ Phải trả về ĐỦ dòng đang hiển thị (thư viện + tự thêm, đúng thứ tự): mọi
 * thao tác ghi (`patchPTSizes`) lấy mảng này làm gốc, thiếu dòng nào là mất
 * dòng đó ngay lần gõ giá kế tiếp.
 */
export function baseSizesOf(pt, libIndex) {
  const source = libSourceOf(pt, libIndex);
  if (!source) return pt?.sizes || [];
  return orderSizes([...libSizesOf(pt, source), ...manualSizesOf(pt, source)], pt.sizeOrder);
}

/** Một dòng thư viện sau khi nạp giá vốn + ship, rồi áp override cục bộ của Seller. */
function decorateLibRow(base, source, pt) {
  const label = libLabelOf(base);
  // Bản chỉnh 2026-07-17: giá vốn = P1 (không còn cột Total); cost-ship lấy per-method.
  const itemCost = getLibraryItemCost(source, label) || '';
  const totalShipCost = getLibraryShip(source, label, pt.shipMethod) || 0;      // cột "Price Ship"
  const shipCostItem = getLibraryShipItem2(source, label, pt.shipMethod) || 0;  // cột "Price Ship Item 2"
  const ov = base.overrides || {};
  return {
    ...base,
    libLabel: label,
    label: ov.label ?? label,
    itemCost: ov.itemCost ?? itemCost,
    totalShipCost,
    shipCostItem,
    isLib: true,
  };
}

/** Dòng Seller tự thêm: thư viện KHÔNG được đụng vào giá vốn đã nhập tay. */
const decorateManualRow = (sz) => ({ ...sz, isLib: false, origin: 'manual' });

/** Ghép dòng thư viện + dòng tự thêm rồi sắp theo `pt.sizeOrder`. */
function composeSizes(pt, source) {
  const lib = libSizesOf(pt, source).map((base) => decorateLibRow(base, source, pt));
  const manual = manualSizesOf(pt, source).map(decorateManualRow);
  return orderSizes([...lib, ...manual], pt.sizeOrder);
}

/** Product Type resolve theo TÊN — đường lùi cho bảng chưa có `libRef`. */
function resolveByName(pt, libIndex) {
  const libEntry = findLibraryEntry(libIndex, pt.name);
  if (!libEntry) return pt;
  return { ...pt, sizes: composeSizes(pt, libEntry) };
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
      if (sz?.origin === 'manual' || sz?.isLib === false) return decorateManualRow(sz);
      const label = libLabelOf(sz);
      const snap = snapshot[label] || {};
      const ov = sz.overrides || {};
      return {
        ...sz, isLib: true, libLabel: label,
        label: ov.label ?? label,
        itemCost: ov.itemCost ?? snap.itemCost ?? sz.itemCost ?? '',
        totalShipCost: snap.totalShipCost ?? sz.totalShipCost ?? 0,
        shipCostItem: snap.shipCostItem ?? sz.shipCostItem ?? 0,
      };
    });
    return {
      ...pt, sizes: orderSizes(sizes, pt.sizeOrder),
      vendorCode: pt.libRef.vendorCode, warning: 'record-missing',
    };
  }

  return { ...pt, sizes: composeSizes(pt, record), vendorCode: record.vendorCode };
}

/**
 * Bỏ MỌI chỉnh sửa cấu trúc cục bộ của một Product Type và quay về đúng thư
 * viện (mục 02): xoá `overrides` của từng dòng, bỏ size Seller tự thêm, bỏ thứ
 * tự tuỳ chỉnh. Giá size / customize đã nhập cho các dòng thư viện được GIỮ —
 * đây là nút "khôi phục cấu trúc", không phải nút xoá trắng công sức nhập giá.
 *
 * Không có nguồn thư viện (PT nhập tay) thì trả nguyên PT — không có gì để khôi phục.
 */
export function restoreFromLibrary(pt, libIndex) {
  const source = libSourceOf(pt, libIndex);
  if (!source) return pt;
  const sizes = (source.sizes || []).map((label) => {
    const existing = (pt.sizes || []).find((s) => libLabelOf(s) === label);
    if (!existing) return { ...makeSize(label, ''), id: libSizeId(pt.id, label), customize: defaultCustomizeOf(pt) };
    const rest = { ...existing };
    delete rest.overrides;
    return { ...rest, label, libLabel: label };
  });
  const rest = { ...pt };
  delete rest.sizeOrder;
  delete rest.deletedSizes;
  return { ...rest, sizes };
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
