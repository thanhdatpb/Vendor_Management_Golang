// ════════════════════════════════════════════════════════
//  CHUẨN HOÁ MỘT DÒNG DANH SÁCH BẢNG TÍNH GIÁ (mục 17)
//
//  `GET /price-sheets` giờ chỉ trả các cột tổng hợp — không kèm settings /
//  productTypes / history. Nhưng màn hình danh sách còn phải vẽ được 2 nguồn
//  dữ liệu khác nữa:
//    • cache localStorage của bản cũ (sheet ĐẦY ĐỦ)
//    • bảng vừa tạo / vừa lưu ở máy này (cũng là sheet đầy đủ)
//  Hàm này quy cả ba về một hình dạng để component chỉ có một đường vẽ.
//
//  Thuần logic, không dính React → test được mà không cần render.
// ════════════════════════════════════════════════════════
import { summarizeSheet } from './pricingEngine';
import { projectNameToKey } from '../constants/projects';

const text = (v) => (v ?? '').toString();
const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * @returns {{
 *   id: string, name: string, project: string, projectKey: string,
 *   version: number|undefined,
 *   vendorRef: string, sourceFile: string, productTypeNames: string[],
 *   sizeCount: number, minPrice: number|null, maxPrice: number|null,
 *   avgMargin: number|null, updatedAt: string|null, updatedBy: string,
 *   createdBy: string, isFull: boolean
 * } | null}
 */
export function normalizeSheetRow(row) {
  if (!row || typeof row !== 'object' || !row.id) return null;

  const base = {
    id: row.id,
    name: text(row.name),
    project: text(row.project),
    // Khoá project đã chuẩn hoá. `price_sheets.project` lưu ĐÚNG chuỗi trong
    // cột `users.project`, mà màn Quản Lý Nhân Sự cho chọn dạng nhãn
    // ("Creative Project") → server hạ chữ thường thành "creative project".
    // Bộ lọc/badge lại dùng id ngắn ("creative"), nên so bằng `===` trượt hết
    // và mọi chip project đếm 0. Quy về id ngay tại đây, giữ nguyên `project`
    // thô để không phá cache localStorage và dữ liệu cũ.
    projectKey: projectNameToKey(row.project) || '',
    version: row.version,
    vendorRef: text(row.vendorRef),
    sourceFile: text(row._sourceFile),
    updatedAt: row.updatedAt || null,
    updatedBy: text(row.updatedBy),
    createdBy: text(row.createdBy),
  };

  // Sheet đầy đủ → tính tại chỗ, đúng như bản cũ vẫn làm.
  if (Array.isArray(row.productTypes)) {
    const sum = summarizeSheet(row);
    return {
      ...base,
      productTypeNames: row.productTypes
        .map((pt) => text(pt?.name).trim())
        .filter(Boolean),
      sizeCount: sum.count,
      minPrice: sum.minPrice,
      maxPrice: sum.maxPrice,
      avgMargin: sum.avgMargin,
      isFull: true,
    };
  }

  return {
    ...base,
    productTypeNames: Array.isArray(row.productTypeNames)
      ? row.productTypeNames.map((n) => text(n).trim()).filter(Boolean)
      : [],
    sizeCount: Number(row.sizeCount) || 0,
    minPrice: numOrNull(row.minPrice),
    maxPrice: numOrNull(row.maxPrice),
    avgMargin: numOrNull(row.avgMargin),
    isFull: false,
  };
}

/**
 * Bản rút gọn để cache ở localStorage — cùng hình dạng với payload server trả.
 *
 * Bản cũ nhét nguyên sheet (productTypes + tới 20 snapshot history) của MỌI
 * bảng vào `PRICE_SHEETS_V1` và chạm trần ~5MB của localStorage: cache hỏng
 * lặng lẽ, danh sách trống trơn khi mất mạng.
 */
export function toSummaryRow(normalized) {
  if (!normalized) return null;

  return {
    id: normalized.id,
    name: normalized.name,
    project: normalized.project,
    projectKey: normalized.projectKey,
    version: normalized.version,
    vendorRef: normalized.vendorRef,
    _sourceFile: normalized.sourceFile,
    productTypeNames: normalized.productTypeNames,
    sizeCount: normalized.sizeCount,
    minPrice: normalized.minPrice,
    maxPrice: normalized.maxPrice,
    avgMargin: normalized.avgMargin,
    updatedAt: normalized.updatedAt,
    updatedBy: normalized.updatedBy,
    createdBy: normalized.createdBy,
    _summary: true,
  };
}

/** Ô tìm kiếm của danh sách: tên bảng / vendor / tên product type. */
export function matchesSheetSearch(normalized, query) {
  const q = text(query).trim().toLowerCase();
  if (!q) return true;
  if (!normalized) return false;

  return (
    normalized.name.toLowerCase().includes(q) ||
    normalized.vendorRef.toLowerCase().includes(q) ||
    normalized.productTypeNames.some((n) => n.toLowerCase().includes(q))
  );
}

/** Bảng có thuộc project của user không (giữ nguyên quy tắc so khớp cũ). */
export function sheetInProject(normalized, projectKey, skip) {
  if (skip || !projectKey) return true;
  const project = text(normalized?.project);
  if (!project) return true;

  return project === projectKey || projectKey.includes(project) || project.includes(projectKey);
}
