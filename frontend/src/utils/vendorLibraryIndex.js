// ════════════════════════════════════════════════════════
//  VENDOR LIBRARY INDEX — tra cứu size + giá "Về giá" theo Product Type
//  Dùng cho PriceSheetWorkspace: lấy size thật từ thư viện, và tự động
//  suy ra Item Cost theo phương thức ship (Economy/Ground/Express/2 Days/Overnight)
//  từ cột "Total (Fulfill)" tương ứng trong thư viện.
// ════════════════════════════════════════════════════════
import { vendorLibraryApi } from '../services/api';

export const normalizeKey = (s) => (s ?? '').toString().trim().toLowerCase();

function extractFileProject(filename) {
  if (!filename) return null;
  const fn = filename.toLowerCase();
  if (fn.includes('p.hapify84')) return 'hapify84';
  if (fn.includes('p.happy')) return 'happy';
  if (fn.includes('p.creative')) return 'creative';
  if (fn.includes('p.global')) return 'global';
  return null;
}

// Khai báo phương thức ship → field tương ứng trong pricing row của thư viện.
// (khớp đúng cấu trúc parseHappyCreativeLibrary trong vendorExcel.js)
// priceField    = cột "Price Ship"         → Total Ship cost (ship cả đơn)
// item2Field     = cột "Price Ship Item 2"  → Ship cost/item (ship mỗi sản phẩm thêm, multipack)
// totalField     = cột "Total (Fulfill)"    → không còn dùng để tính giá vốn (Item Cost giờ = P1)
export const SHIP_METHODS = [
  { key: 'eco',       label: 'Economy',   totalField: 'eco_total',       priceField: 'eco_price',       item2Field: 'eco_price_item2' },
  { key: 'ground',    label: 'Ground',    totalField: 'ground_total',    priceField: 'ground_price',    item2Field: 'ground_price_item2' },
  { key: 'express',   label: 'Express',   totalField: 'express_total',   priceField: 'express_price',   item2Field: 'express_price_item2' },
  { key: 'twoday',    label: '2 Days',    totalField: 'twoday_total',    priceField: 'twoday_price',    item2Field: 'twoday_price_item2' },
  { key: 'overnight', label: 'Overnight', totalField: 'overnight_total', priceField: 'overnight_price', item2Field: 'overnight_price_item2' },
];
export const shipMethodLabel = (key) => SHIP_METHODS.find((m) => m.key === key)?.label || '';

// ─── Cache theo ETag (mục 17) ─────────────────────────────────────────────
// Mỗi lần mở một bảng giá là một lần gọi loadVendorLibraryIndex. Trước đây mỗi
// lần đó tải NGUYÊN blob thư viện — ảnh, notes, generalInfo — chỉ để lấy danh
// sách size và giá vốn. Giờ giữ bản đã tải kèm ETag: mở bảng thứ hai trở đi chỉ
// còn một request điều kiện, server trả 304 với body rỗng.
let _indexCache = { key: null, etag: null, records: null };

/** Dọn cache — dùng trong test, và khi thư viện báo có thay đổi (mục 16). */
export function resetVendorLibraryIndexCache() {
  _indexCache = { key: null, etag: null, records: null };
}

/** Nạp danh sách record gọn. `null` = server chưa có endpoint index. */
async function loadLeanRecords(projectKey, skip) {
  if (typeof vendorLibraryApi.index !== 'function') return null;

  const project = skip ? '' : (projectKey || '');
  const reuse = _indexCache.records && _indexCache.key === project && _indexCache.etag;

  try {
    const res = await vendorLibraryApi.index(project, reuse ? { 'If-None-Match': _indexCache.etag } : {});

    if (res.status === 304 && reuse) return _indexCache.records;

    const records = Array.isArray(res.data) ? res.data : [];
    const etag = res.headers?.etag || res.headers?.ETag || null;
    _indexCache = { key: project, etag, records };
    return records;
  } catch (err) {
    // Server cũ chưa có route này → quay về đường tải blob đầy đủ. Mọi lỗi khác
    // (401/500) cũng nên thử đường cũ hơn là làm trắng bảng tính giá.
    console.warn('Không dùng được index thư viện, quay về tải blob đầy đủ:', err?.message || err);
    return null;
  }
}

/**
 * Gom danh sách record gọn của server thành index.
 *
 * PR-A3 (mục 03/04): trước đây mỗi Product Type chỉ giữ ĐÚNG MỘT entry —
 * 2 vendor cùng tên phôi bị đè nhau, vendor gặp trước thắng, Item Cost và
 * Profit tính sai mà không ai thấy. Giờ mỗi (file, vendor, product type) là
 * một RECORD riêng trong index[key].records; index[key] ở cấp ngoài vẫn giữ
 * hình dạng CŨ (vendor/filename/sizes/bySize của record ĐẦU TIÊN) để
 * findLibraryEntry và mọi bảng giá cũ tiếp tục chạy đúng như trước — không
 * có migration nào, không có bảng nào tự đổi số khi mở lại.
 */
function indexFromRecords(records) {
  const byKey = {};
  records.forEach((record) => {
    const ptName = (record?.productType || '').trim();
    if (!ptName) return;
    const key = normalizeKey(ptName);
    const vendorCode = (record.vendorCode || '').trim();
    const filename = (record.filename || '').replace(/\.[^.]+$/, '');
    const recordKey = record.recordKey || `${filename}::${vendorCode}::${key}`;

    const bySize = {};
    const sizeLabels = [];
    (Array.isArray(record.sizes) ? record.sizes : []).forEach((row) => {
      const sizeLabel = (row?.size || '').toString().trim();
      if (!sizeLabel || sizeLabel === 'N/A') return;
      const sKey = normalizeKey(sizeLabel);
      if (!bySize[sKey]) { bySize[sKey] = row; sizeLabels.push(sizeLabel); }
    });

    (byKey[key] ||= []).push({
      recordKey, productType: ptName, vendorCode, vendor: vendorCode,
      filename, project: record.project, sizes: sizeLabels, bySize,
    });
  });
  return buildLegacyView(byKey);
}

/** Rút index[key] cấp ngoài (hình dạng CŨ) từ danh sách record đã gom theo productType key. */
function buildLegacyView(byProductTypeKey) {
  const index = {};
  Object.entries(byProductTypeKey).forEach(([key, records]) => {
    const first = records[0];
    index[key] = {
      productType: first.productType, vendor: first.vendor, filename: first.filename,
      sizes: first.sizes, bySize: first.bySize,
      records, // MỚI (mục 03/04) — danh sách đầy đủ, mỗi vendor một record riêng
    };
  });
  return index;
}

/** Gom blob thư viện đầy đủ thành index (đường lùi cho server chưa có index). */
function indexFromFiles(files, projectKey, skip) {
  const filtered = (skip || !projectKey) ? files : files.filter((f) => {
    const fp = extractFileProject(f.filename);
    return !fp || projectKey.includes(fp) || fp.includes(projectKey);
  });

  // byKey: normalizeKey(productType) -> Map(recordKey -> record) — Map giữ đúng
  // thứ tự gặp trong file để "vendor gặp trước thắng" (đường lùi) không đổi.
  const byKey = {};
  filtered.forEach((file) => {
    const pricing = Array.isArray(file.pricing) ? file.pricing : [];
    const filename = (file.filename || '').replace(/\.[^.]+$/, '');
    const project = extractFileProject(file.filename) || undefined;

    pricing.forEach((p) => {
      const ptName = (p.productType || '').trim();
      if (!ptName) return;
      const key = normalizeKey(ptName);
      const vendorCode = (p.kyHieu || '').trim();
      // Khoá record: file + vendor + product type — cho phép 2 vendor cùng tên
      // phôi (mục 03) tồn tại song song thay vì đè nhau.
      const recordKey = `${filename}::${vendorCode}::${key}`;

      const bucket = (byKey[key] ||= new Map());
      if (!bucket.has(recordKey)) {
        bucket.set(recordKey, {
          recordKey, productType: ptName, vendorCode, vendor: vendorCode,
          filename, project, sizes: [], bySize: {},
        });
      }
      const rec = bucket.get(recordKey);

      const sizeLabel = (p.size && String(p.size).trim() && p.size !== 'N/A') ? String(p.size).trim() : '';
      if (!sizeLabel) return;
      const sKey = normalizeKey(sizeLabel);
      if (!rec.bySize[sKey]) {
        rec.bySize[sKey] = p;
        rec.sizes.push(sizeLabel);
      }
    });
  });

  const byKeyArrays = {};
  Object.entries(byKey).forEach(([key, bucket]) => { byKeyArrays[key] = [...bucket.values()]; });
  return buildLegacyView(byKeyArrays);
}

/**
 * Tải + gom thư viện vendor (đã lọc theo project) thành index:
 *   { [normProductType]: { productType, vendor, filename, sizes:[...], bySize: { [normSize]: pricingRow } } }
 *
 * Ưu tiên endpoint index gọn; server chưa có thì tải blob đầy đủ như trước.
 * Hình dạng trả về giống hệt nhau ở cả hai đường.
 */
export async function loadVendorLibraryIndex(projectKey, skip) {
  const records = await loadLeanRecords(projectKey, skip);
  if (records) return indexFromRecords(records);

  const res = await vendorLibraryApi.get('all');
  const files = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
  return indexFromFiles(files, projectKey, skip);
}

/**
 * Liệt kê MỌI record (mỗi vendor một dòng riêng) — nguồn cho picker "Thêm
 * Product Type" và cho bộ chọn vendor trên Product Type Card (mục 03/04/05).
 * Khác `listLibraryProductTypes`: KHÔNG gộp theo tên, một tên phôi có 2 vendor
 * trả về đúng 2 phần tử.
 */
export function listLibraryRecords(index, { vendor, q } = {}) {
  if (!index) return [];
  const nq = normalizeKey(q);
  const nv = normalizeKey(vendor);
  const all = Object.values(index).flatMap((entry) => entry.records || []);
  return all
    .filter((r) => {
      if (nv && normalizeKey(r.vendorCode) !== nv) return false;
      if (nq && !(normalizeKey(r.productType).includes(nq) || normalizeKey(r.vendorCode).includes(nq))) return false;
      return true;
    })
    .sort((a, b) =>
      a.productType.localeCompare(b.productType, undefined, { numeric: true, sensitivity: 'base' }) ||
      a.vendorCode.localeCompare(b.vendorCode, undefined, { numeric: true, sensitivity: 'base' })
    );
}

/**
 * Tìm đúng MỘT record theo recordKey — dùng khi bảng giá đã chốt vendor cụ
 * thể (`pt.libRef.recordKey`, xem utils/resolveSheet.js). `null` nếu record
 * đã biến mất khỏi thư viện (file bị xoá/import lại) — nơi gọi tự lo phần
 * cảnh báo + costSnapshot, KHÔNG được âm thầm đổi số.
 */
export function findLibraryRecord(index, recordKey) {
  if (!index || !recordKey) return null;
  for (const entry of Object.values(index)) {
    const found = (entry.records || []).find((r) => r.recordKey === recordKey);
    if (found) return found;
  }
  return null;
}

/** Liệt kê Product Type có trong thư viện (đã lọc project) → cho picker chọn. */
export function listLibraryProductTypes(index) {
  if (!index) return [];
  return Object.values(index)
    .map((v) => ({ productType: v.productType, vendor: v.vendor, sizeCount: (v.sizes || []).length }))
    .sort((a, b) => a.productType.localeCompare(b.productType, undefined, { numeric: true, sensitivity: 'base' }));
}

/** Tìm entry thư viện theo tên Product Type — khớp đúng trước, mờ (substring) sau. */
export function findLibraryEntry(index, productTypeName) {
  if (!index || !productTypeName) return null;
  const key = normalizeKey(productTypeName);
  if (index[key]) return index[key];
  const found = Object.values(index).find((v) => {
    const a = normalizeKey(v.productType);
    return a && (a.includes(key) || key.includes(a));
  });
  return found || null;
}

/** Lấy Total (Fulfill) của 1 size theo phương thức ship đã chọn. null nếu không có trong thư viện. */
export function getLibraryTotal(entry, sizeLabel, methodKey) {
  return getLibraryField(entry, sizeLabel, SHIP_METHODS.find((m) => m.key === methodKey)?.totalField);
}

/** Item Cost = cột P1 (Pricing 1) của size — giá hàng thuần, KHÔNG phụ thuộc phương thức ship. */
export function getLibraryItemCost(entry, sizeLabel) {
  return getLibraryField(entry, sizeLabel, 'pricing1');
}

/** Total Ship cost = cột "Price Ship" của phương thức ship đã chọn. */
export function getLibraryShip(entry, sizeLabel, methodKey) {
  return getLibraryField(entry, sizeLabel, SHIP_METHODS.find((m) => m.key === methodKey)?.priceField);
}

/** Ship cost/item = cột "Price Ship Item 2" (mới) của phương thức ship đã chọn. */
export function getLibraryShipItem2(entry, sizeLabel, methodKey) {
  return getLibraryField(entry, sizeLabel, SHIP_METHODS.find((m) => m.key === methodKey)?.item2Field);
}

/** Đọc 1 field số của 1 size từ pricing row thư viện. null nếu thiếu/rỗng. */
function getLibraryField(entry, sizeLabel, field) {
  if (!entry || !field) return null;
  const row = entry.bySize[normalizeKey(sizeLabel)];
  if (!row) return null;
  const v = row[field];
  return (v === null || v === undefined || v === '') ? null : Number(v);
}
