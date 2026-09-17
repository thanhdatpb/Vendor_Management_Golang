// ════════════════════════════════════════════════════════
//  CUNG CẤP VENDOR CHO REQUEST TỪ FILE THƯ VIỆN — logic thuần, không dính React
//
//  `products.assigned_vendors` là BẢN CHỤP: mỗi phần tử là một dòng giá (một
//  size) của một phôi trong file thư viện, kèm `source_file_id` + `excel_row_id`
//  để lần ngược về file gốc. Seller duyệt đúng con số đã thấy lúc cung cấp —
//  file đổi giá sau đó không tự đổi dưới tay họ.
//
//  Trước đây logic dựng bản chụp nằm thẳng trong handler của VendorsSection
//  (luồng tick trong Thư viện). Tách ra đây để luồng dán link / tìm file dùng
//  chung đúng MỘT cách khớp giá, và để test được.
// ════════════════════════════════════════════════════════

const norm = (s) => (s ?? '').toString().trim().toLowerCase();

/**
 * Các dòng giá (sheet "Về giá") thuộc về một phôi (dòng generalInfo).
 *
 * Giữ nguyên 4 bước khớp của luồng cũ — file Excel thực tế ghi Ký hiệu không
 * đồng đều, nên phải lùi dần:
 *   1. khớp đúng Ký hiệu (kể cả khi cả hai cùng trống);
 *   2. phôi không ghi Ký hiệu → khớp Ký hiệu dòng giá theo tên vendor;
 *   3. khớp Product Type, bỏ các dòng thuộc vendor KHÁC trong cùng file;
 *   4. chỉ chọn đúng 1 phôi → lấy mọi dòng không thuộc vendor khác.
 */
function pricingRowsForRow(file, row, selectedCount) {
  const pricing = Array.isArray(file?.pricing) ? file.pricing : [];
  const general = Array.isArray(file?.generalInfo) ? file.generalInfo : [];
  const mk = norm(row.kyHieu);

  const otherKeys = new Set();
  general.forEach((g) => {
    if (g.id === row.id) return;
    if (g.kyHieu) otherKeys.add(norm(g.kyHieu));
    if (g.vendorName) otherKeys.add(norm(g.vendorName));
  });

  let rows = pricing.filter((p) => norm(p.kyHieu) === mk);

  if (rows.length === 0 && !mk && row.vendorName) {
    const mvk = norm(row.vendorName);
    rows = pricing.filter((p) => norm(p.kyHieu) === mvk);
  }

  if (rows.length === 0 && row.productType) {
    const mpt = norm(row.productType);
    rows = pricing.filter((p) => {
      const pk = norm(p.kyHieu);
      if (pk && otherKeys.has(pk)) return false;
      const ppt = norm(p.productType);
      return mpt && ppt && (ppt === mpt || ppt.includes(mpt) || mpt.includes(ppt));
    });
  }

  if (rows.length === 0 && selectedCount === 1) {
    rows = pricing.filter((p) => {
      const pk = norm(p.kyHieu);
      return !pk || !otherKeys.has(pk);
    });
  }

  return rows;
}

const PRICE_COPY_FIELDS = [
  'eco_total', 'eco_price', 'pricing1', 'pricing2',
  'fast_total', 'fast_price', 'express_total', 'express_price',
  'ground_total', 'ground_price', 'twoday_total', 'twoday_price',
  'overnight_total', 'overnight_price',
];

/**
 * Bản chụp `assigned_vendors` cho các phôi được chọn trong MỘT file.
 *
 * @param {object} file     một phần tử của thư viện (có generalInfo + pricing)
 * @param {Iterable<string>} rowIds  id các dòng generalInfo được chọn
 * @param {{ providedAt?: string }} [options]
 * @returns {object[]}
 */
export function buildAssignedVendors(file, rowIds, { providedAt } = {}) {
  if (!file) return [];
  const wanted = new Set([...(rowIds || [])].map(String));
  const general = Array.isArray(file.generalInfo) ? file.generalInfo : [];
  const matched = general.filter((r) => wanted.has(String(r.id)));
  if (matched.length === 0) return [];

  const uniqueLinks = [...new Set(general.map((r) => (r.linkFolder || '').trim()).filter(Boolean))];
  const fileLevelLink = uniqueLinks.length === 1 ? uniqueLinks[0] : null;

  const out = [];
  matched.forEach((m) => {
    const base = {
      excel_row_id: m.id,
      name: m.vendorName || m.kyHieu || 'Excel Vendor',
      vendor_type: m.productType || m.kyHieu || 'New',
      overview: m.chatLieu || '',
      media_url: (m.images && m.images.length > 0) ? m.images[0] : '',
      link_folder: m.linkFolder || fileLevelLink || '',
      is_excel: true,
      kyHieu: m.kyHieu || '',
      source_file_id: file.id,
      source_file_name: file.filename || '',
      avg_time_vendor: m.avgTimeVendor || '',
      avg_time_actual: m.avgTimeActual || '',
      ...(providedAt ? { provided_at: providedAt } : {}),
    };

    const priced = pricingRowsForRow(file, m, matched.length);
    if (priced.length === 0) {
      out.push({ ...base, id: m.id, size: m.chiTietSize || '' });
      return;
    }
    priced.forEach((p, pi) => {
      const item = {
        ...base,
        id: `${m.id}_${pi}`,
        size: p.size || m.chiTietSize || '',
        optional: p.optional || '',
        product_type: p.productType || '',
      };
      PRICE_COPY_FIELDS.forEach((field) => { item[field] = p[field] ?? null; });
      out.push(item);
    });
  });
  return out;
}

/**
 * Khoá của MỘT phôi trong danh sách đã cung cấp. Một phôi sinh nhiều phần tử
 * (mỗi size một dòng) nên gộp / gỡ / làm mới đều theo khoá này.
 */
export function assignedRowKey(v) {
  if (!v) return '';
  if (v.is_excel || v.excel_row_id) {
    const file = v.source_file_id || `name:${norm(v.source_file_name) || norm(v.name)}`;
    return `${file}::${v.excel_row_id ?? v.id}`;
  }
  return `db::${v.id}`;
}

/** Nhóm danh sách đã cung cấp theo phôi, giữ thứ tự xuất hiện. */
export function groupAssignedByRow(list) {
  const groups = new Map();
  (Array.isArray(list) ? list : []).forEach((v) => {
    const key = assignedRowKey(v);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        fileId: v.source_file_id || null,
        fileName: v.source_file_name || '',
        rowId: v.excel_row_id ?? null,
        name: (v.name || v.vendor_type || '—').toString(),
        productType: v.vendor_type || v.product_type || '',
        providedAt: v.provided_at || null,
        items: [],
      });
    }
    groups.get(key).items.push(v);
  });
  return [...groups.values()];
}

/**
 * Gộp phần mới vào danh sách đang có: phôi đã có thì THAY bằng bản mới (làm mới
 * giá), phôi chưa có thì thêm vào cuối. Không bao giờ xoá phôi khác.
 */
export function mergeAssignedVendors(existing, added) {
  const addedKeys = new Set((added || []).map(assignedRowKey));
  const kept = (existing || []).filter((v) => !addedKeys.has(assignedRowKey(v)));
  return [...kept, ...(added || [])];
}

/** Bỏ các phôi theo khoá (nút "Gỡ"). */
export function removeAssignedRows(existing, rowKeys) {
  const drop = new Set(rowKeys || []);
  return (existing || []).filter((v) => !drop.has(assignedRowKey(v)));
}

const COMPARE_FIELDS = ['size', 'optional', ...PRICE_COPY_FIELDS];
const comparable = (items) => (items || [])
  .map((v) => COMPARE_FIELDS.map((f) => {
    const value = v[f];
    if (value === null || value === undefined || value === '') return '';
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(4) : String(value).trim();
  }).join('|'))
  .sort()
  .join('\n');

/** Giá / size trong file gốc đã khác bản chụp đang cung cấp cho Seller? */
export function assignedPricesDiffer(currentItems, freshItems) {
  if (!freshItems || freshItems.length === 0) return false;
  return comparable(currentItems) !== comparable(freshItems);
}

/**
 * Đối chiếu một phôi đã cung cấp với file nguồn đang đọc được.
 *
 * Đặt ở module logic thuần để drawer và test dùng chung mà không làm file
 * React export lẫn component + helper (Fast Refresh sẽ coi đó là lỗi).
 */
export function assignedSourceState(group, sources) {
  if (!group?.fileId || group.rowId == null) return { state: 'unknown' };
  const source = sources?.[group.fileId];
  if (!source || source.status === 'loading') return { state: 'checking' };
  if (source.status === 'notFound') return { state: 'fileGone' };
  if (source.status !== 'ok') return { state: 'unknown' };

  const fresh = buildAssignedVendors(source.file, [group.rowId]);
  if (fresh.length === 0) return { state: 'rowGone' };
  if (assignedPricesDiffer(group.items, fresh)) return { state: 'stale', fresh };
  return { state: 'fresh' };
}

// ── Giá theo hạng ship — cùng quy tắc với bảng "So sánh nhà phân phối" ──
export const PRICE_TIERS = [
  { key: 'eco_total', short: 'ECO', label: 'Economy', color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
  { key: 'ground_total', short: 'GND', label: 'Ground', color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'twoday_total', short: '2DAY', label: '2 Days', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { key: 'express_total', short: 'EXP', label: 'Express', color: '#b45309', bg: '#fff7ed', border: '#fed7aa' },
  { key: 'overnight_total', short: 'OVN', label: 'Overnight', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
];

export function tierTotal(item, key) {
  const v = Number(item?.[key]);
  if (item?.[key] != null && item[key] !== '' && v > 0) return v;
  if (key === 'eco_total') {
    const p1 = Number(item?.pricing1);
    const ep = Number(item?.eco_price);
    if (p1 > 0 && ep > 0) return p1 + ep;
  }
  return null;
}

/** Khoảng giá (min–max qua các size) của từng hạng ship có dữ liệu. */
export function tierRanges(items) {
  return PRICE_TIERS.map((t) => {
    const vals = (items || []).map((vi) => tierTotal(vi, t.key)).filter((n) => n != null && n > 0);
    if (vals.length === 0) return null;
    return { ...t, min: Math.min(...vals), max: Math.max(...vals) };
  }).filter(Boolean);
}

// ── So khớp Product Type giữa request và file (chỉ để CẢNH BÁO, không chặn) ──
export const foldText = (s) => String(s ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase();

const meaningfulWords = (s) => foldText(s).split(/[^a-z0-9]+/).filter((w) => w.length > 3);

/** Số từ có nghĩa (dài hơn 3 ký tự) trùng nhau giữa Product Type request và các nhãn của file. */
export function productTypeOverlap(requestType, labels) {
  const wanted = new Set(meaningfulWords(requestType));
  if (wanted.size === 0) return 0;
  const seen = new Set();
  (Array.isArray(labels) ? labels : [labels]).forEach((label) => {
    meaningfulWords(label).forEach((w) => { if (wanted.has(w)) seen.add(w); });
  });
  return seen.size;
}
