// ════════════════════════════════════════════════════════
//  HELPER TEST DÙNG CHUNG (T0)
//  Bốn mục tiêu "giữ nguyên sau save / reload / clone / export" (mục 02, 05,
//  06, 08) đều quy về một phép thử: serialize đúng như priceSheetApi.save gửi
//  lên server, đọc lại, rồi resolve lại với thư viện.
// ════════════════════════════════════════════════════════
import { resolveSheet } from '../utils/resolveSheet';
import { loadVendorLibraryIndex } from '../utils/vendorLibraryIndex';

/** Đúng những gì đi qua dây: JSON.stringify → server → JSON.parse. */
export const serialize = (sheet) => JSON.parse(JSON.stringify(sheet));

/** save → JSON → reload → resolve lại theo thư viện. */
export const roundTrip = (sheet, libIndex) => resolveSheet(serialize(sheet), libIndex);

/**
 * Index thư viện dựng từ fixture. Gọi được vì test đã mock `services/api`
 * (xem từng file test) — không có request mạng nào thật sự xảy ra.
 */
export const fixtureLibIndex = (projectKey = '', skipFilter = false) =>
  loadVendorLibraryIndex(projectKey, skipFilter);

/** Map label → giá trị của một Product Type, dùng để so sánh trước/sau thao tác. */
export const sizeValueMap = (pt, field = 'sizeAdd') =>
  new Map((pt?.sizes || []).map((sz) => [sz.label, sz[field]]));

/** Map label → toàn bộ dữ liệu người dùng nhập (giá + customize) của 1 Product Type. */
export const sizeInputMap = (pt) =>
  new Map((pt?.sizes || []).map((sz) => [sz.label, {
    sizeAdd: sz.sizeAdd,
    customize: { ...(sz.customize || {}) },
  }]));
