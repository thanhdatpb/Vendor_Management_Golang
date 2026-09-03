// ════════════════════════════════════════════════════════
//  VENDOR LIBRARY INDEX — tra cứu size + giá "Về giá" theo Product Type
//  Dùng cho PriceSheetWorkspace: lấy size thật từ thư viện, và tự động
//  suy ra Item Cost theo phương thức ship (Economy/Ground/Express/2 Days/Overnight)
//  từ cột "Total (Fulfill)" tương ứng trong thư viện.
// ════════════════════════════════════════════════════════
import { vendorLibraryApi } from '../services/api';
import { extractFileProject, fileSharedProjects, fileVisibleToProject } from '../constants/projects';

export const normalizeKey = (s) => (s ?? '').toString().trim().toLowerCase();

// Ảnh nhúng qua formula Excel đôi khi là base64/data-URI khổng lồ thay vì URL
// bình thường — index gọn không được cõng nó. Hai hằng dưới đây phải KHỚP với
// VendorLibraryIndexBuilder.php (MAX_IMAGE_URL_LENGTH / MAX_IMAGES_PER_RECORD)
// để 2 đường build index (lean-index server / blob-fallback dưới đây) cho ra
// cùng kết quả, không lệch tuỳ server có endpoint gọn hay không.
const MAX_IMAGE_URL_LENGTH = 300;
const MAX_IMAGES_PER_RECORD = 4;

// Project của một file: ưu tiên danh sách chia sẻ tường minh do Vendor/Admin đặt
// (`file.projects`), file chưa chia sẻ thì vẫn suy theo ký hiệu `P.xxx` trong tên.
// Trả về id project khi file thuộc đúng MỘT project, còn lại null (= dùng chung).
function fileProjectTag(file) {
  const shared = fileSharedProjects(file);
  if (shared) return shared.length === 1 ? shared[0] : null;
  return extractFileProject(file?.filename);
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
/**
 * Field "info phôi" (mục 02) — không phải giá, chỉ copy nguyên qua nếu có.
 * `images` là DANH SÁCH: dải thông tin phôi trên bảng tính giá hiện nhiều ảnh
 * như bảng Thư viện Vendor. `image` (ảnh đại diện) GIỮ NGUYÊN cho code cũ.
 */
const GENERAL_INFO_TEXT_FIELDS = ['chatLieu', 'chiTietSize', 'image', 'chiTietSizeImage', 'avgTimeVendor', 'avgTimeActual'];
function pickGeneralInfo(source) {
  const out = {};
  GENERAL_INFO_TEXT_FIELDS.forEach((f) => { out[f] = source?.[f] || ''; });
  // Mặc định [] chứ KHÔNG phải '' — UI map thẳng trên field này.
  out.images = Array.isArray(source?.images) ? source.images : [];
  return out;
}

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
      ...pickGeneralInfo(record), // server đã lồng sẵn (VendorLibraryIndexBuilder)
    });
  });
  return buildLegacyView(mergeBlankVendorRecords(byKey));
}

/**
 * Rút index[key] cấp ngoài (hình dạng CŨ) từ danh sách record đã gom theo productType key.
 *
 * `sizes`/`bySize` GỘP từ MỌI record cùng tên phôi (không chỉ record đầu) — nếu
 * không, PT chưa gắn `libRef` (bảng cũ, resolve theo tên) bị giới hạn đúng
 * bằng bộ size của vendor gặp trước, còn size chỉ vendor khác mới có thì biến
 * mất khỏi bảng dù thư viện có đủ (bug thật: chọn phôi có 8 size trong thư
 * viện nhưng bảng chỉ hiện 1 size — vì vendor gặp trước chỉ có 1 size). Size
 * trùng tên giữa các record vẫn giữ giá trị của record gặp trước — KHÔNG đổi
 * field đã tính, chỉ bổ sung thêm size mà record đầu chưa có.
 */
function buildLegacyView(byProductTypeKey) {
  const index = {};
  Object.entries(byProductTypeKey).forEach(([key, records]) => {
    const first = records[0];
    const bySize = {};
    const sizes = [];
    records.forEach((record) => {
      (record.sizes || []).forEach((label) => {
        const sKey = normalizeKey(label);
        if (bySize[sKey]) return;
        bySize[sKey] = record.bySize[sKey];
        sizes.push(label);
      });
    });
    index[key] = {
      productType: first.productType, vendor: first.vendor, filename: first.filename,
      sizes, bySize,
      records, // MỚI (mục 03/04) — danh sách đầy đủ, mỗi vendor một record riêng
      // Info phôi (mục 02) của record ĐẦU TIÊN — chỉ dùng khi PT chưa gắn
      // libRef (đường lùi resolve theo tên); PT có libRef đọc thẳng từ đúng
      // record của nó qua findLibraryRecord, không qua nhánh này.
      ...pickGeneralInfo(first),
    };
  });
  return index;
}

/**
 * Gộp record "vendor trống" (kyHieu rỗng — carry-forward vendor khi import Excel
 * bị lệch dòng, thường do merge cell) vào record CÙNG FILE + CÙNG TÊN PHÔI có
 * vendor tên rõ ràng, CHỈ KHI file đó chỉ có đúng 1 vendor được đặt tên.
 *
 * Bug thật: phôi "Canvas 1,5"" trong 1 file bị tách thành 2 record — 1 record
 * "US3" chỉ 1 size + 1 record vendor trống 7 size (tổng đúng 8 size của US3,
 * nhưng bị chia làm đôi khi liệt kê ở picker → chọn record nào cũng thiếu
 * size). 2+ vendor tên khác nhau thật sự thì GIỮ NGUYÊN tách riêng (đúng thiết
 * kế PR-A3) — không đoán được size trống thuộc vendor nào trong trường hợp đó.
 */
function mergeBlankVendorRecords(byProductTypeKey) {
  Object.keys(byProductTypeKey).forEach((key) => {
    const byFile = {};
    byProductTypeKey[key].forEach((r) => { (byFile[r.filename] ||= []).push(r); });

    const merged = [];
    Object.values(byFile).forEach((group) => {
      const named = group.filter((r) => r.vendorCode);
      const blank = group.filter((r) => !r.vendorCode);
      const distinctVendors = [...new Set(named.map((r) => r.vendorCode))];

      if (blank.length && distinctVendors.length === 1) {
        const target = named[0];
        blank.forEach((b) => {
          b.sizes.forEach((label) => {
            const sKey = normalizeKey(label);
            if (!target.bySize[sKey]) {
              target.bySize[sKey] = b.bySize[sKey];
              target.sizes.push(label);
            }
          });
        });
        merged.push(target, ...named.slice(1));
      } else {
        merged.push(...group);
      }
    });

    byProductTypeKey[key] = merged;
  });
  return byProductTypeKey;
}

/** Gom blob thư viện đầy đủ thành index (đường lùi cho server chưa có index). */
function indexFromFiles(files, projectKey, skip) {
  const filtered = (skip || !projectKey)
    ? files
    : files.filter((f) => fileVisibleToProject(f, projectKey));

  // byKey: normalizeKey(productType) -> Map(recordKey -> record) — Map giữ đúng
  // thứ tự gặp trong file để "vendor gặp trước thắng" (đường lùi) không đổi.
  const byKey = {};
  filtered.forEach((file) => {
    const pricing = Array.isArray(file.pricing) ? file.pricing : [];
    const filename = (file.filename || '').replace(/\.[^.]+$/, '');
    const project = fileProjectTag(file) || undefined;

    // Info phôi (mục 02) không nằm trong `pricing` — gom theo `kyHieu`, vendor
    // gặp trước thắng, cùng quy ước với backend (VendorLibraryIndexBuilder).
    const generalByVendor = {};
    (Array.isArray(file.generalInfo) ? file.generalInfo : []).forEach((row) => {
      const vCode = normalizeKey(row?.kyHieu);
      if (!vCode || generalByVendor[vCode]) return;
      // Ảnh nhúng qua formula Excel đôi khi là base64/data-URI khổng lồ thay vì
      // URL bình thường — cùng ngưỡng MAX_IMAGE_URL_LENGTH phía backend, để 2
      // đường build index (lean-index server / blob-fallback này) không lệch
      // hành vi tuỳ server có endpoint gọn hay không.
      const images = (Array.isArray(row.images) ? row.images : [])
        .filter((img) => typeof img === 'string' && img && img.length <= MAX_IMAGE_URL_LENGTH)
        .slice(0, MAX_IMAGES_PER_RECORD);
      const sizeGuide = row.chiTietSizeImage || '';
      generalByVendor[vCode] = {
        chatLieu: row.chatLieu || '', chiTietSize: row.chiTietSize || '',
        image: images[0] || '',
        images,
        chiTietSizeImage: sizeGuide.length > MAX_IMAGE_URL_LENGTH ? '' : sizeGuide,
        avgTimeVendor: row.avgTimeVendor || '', avgTimeActual: row.avgTimeActual || '',
      };
    });

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
          ...pickGeneralInfo(generalByVendor[normalizeKey(vendorCode)]),
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
  return buildLegacyView(mergeBlankVendorRecords(byKeyArrays));
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
