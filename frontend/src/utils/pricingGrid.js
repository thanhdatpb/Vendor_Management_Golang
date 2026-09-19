// ════════════════════════════════════════════════════════════════════════════
//  PRICING GRID — logic THUẦN (không dính React) cho bảng giá Thư Viện Vendor
//
//  1) Total (fulfill) = P1 + Price Ship + Price Ship Item 2
//     → sửa P1 / Price Ship / Price Ship Item 2 thì Total nhóm đó tự nhảy.
//     Chỉ tính lại ĐÚNG nhóm vận chuyển bị sửa; dòng import từ Excel giữ
//     nguyên Total cũ cho tới khi có người sửa ô thuộc nhóm đó.
//  2) Vùng chọn + copy/paste nhiều dòng kiểu Google Sheets (TSV).
//
//  Tách khỏi component để test được và dùng lại cho export/Excel sau này.
//  (Hạ tầng vùng chọn của bảng tính giá Seller — pricesheet/fillDown.js — khoá
//  theo sizes[].id và field 'customize:<id>', không dùng được cho dòng thư
//  viện vốn khoá theo chỉ số dòng và field eco_*/ground_*/twoday_*…)
// ════════════════════════════════════════════════════════════════════════════

export const SHIP_METHODS = [
  { label: 'Economy', priceKey: 'eco_price', item2Key: 'eco_price_item2', totalKey: 'eco_total' },
  { label: 'Ground', priceKey: 'ground_price', item2Key: 'ground_price_item2', totalKey: 'ground_total' },
  { label: 'Express', priceKey: 'express_price', item2Key: 'express_price_item2', totalKey: 'express_total' },
  { label: '2 Days', priceKey: 'twoday_price', item2Key: 'twoday_price_item2', totalKey: 'twoday_total' },
  { label: 'Overnight', priceKey: 'overnight_price', item2Key: 'overnight_price_item2', totalKey: 'overnight_total' },
];

// Cột của lưới THEO ĐÚNG thứ tự hiển thị trong bảng (trừ Vendor Name — cột đó
// suy ra từ generalInfo, không sửa được nên không nằm trong lưới chọn/dán).
export const PRICING_GRID_COLUMNS = [
  { key: 'productType', type: 'text', label: 'Product Type' },
  { key: 'size', type: 'text', label: 'Size' },
  { key: 'optional', type: 'text', label: 'Optional' },
  { key: 'pricing1', type: 'number', label: 'P1' },
  { key: 'pricing2', type: 'number', label: 'P2' },
  ...SHIP_METHODS.flatMap(m => [
    { key: m.priceKey, type: 'number', label: `${m.label} · Price Ship` },
    { key: m.item2Key, type: 'number', label: `${m.label} · Price Ship Item 2` },
    { key: m.totalKey, type: 'number', label: `${m.label} · Total (fulfill)`, computed: true },
  ]),
  // Link Template KHÔNG nằm trong lưới: ô đó là input gõ/dán link luôn mở (việc
  // chính của vendor), giữ nguyên thao tác một-click và không để paste vùng
  // vô tình ghi đè link.
];

export function isBlankValue(v) {
  return v === null || v === undefined || String(v).trim() === '';
}

// "$12.50" / " 12,5 " (dán từ Excel VN) → 12.5 ; chuỗi rác → null
export function toNumberOrNull(v) {
  if (isBlankValue(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).trim().replace(/[$\s]/g, '').replace(/,/g, '.');
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Total (fulfill) của MỘT nhóm vận chuyển. Ô trống coi như 0; cả ba ô cùng
// trống → null (hiển thị "—" thay vì $0.00). Có ô nhập rác → null.
export function computeTotalFulfill(row, method) {
  if (!row || !method) return null;
  const parts = [row.pricing1, row[method.priceKey], row[method.item2Key]];
  if (parts.every(isBlankValue)) return null;
  let sum = 0;
  for (const part of parts) {
    if (isBlankValue(part)) continue;
    const n = toNumberOrNull(part);
    if (n === null) return null;
    sum += n;
  }
  return round2(sum);
}

// Row mới với Total của các nhóm bị ảnh hưởng bởi `changedKeys`.
// - `blank`: giá trị khi không tính được (null cho bảng, '' cho form nhập).
// - Nếu chính ô Total vừa bị sửa/dán tay thì GIỮ giá trị người dùng nhập.
export function withRecalculatedTotals(row, changedKeys, options = {}) {
  if (!row) return row;
  const blank = Object.prototype.hasOwnProperty.call(options, 'blank') ? options.blank : null;
  const changed = new Set(Array.isArray(changedKeys) ? changedKeys : [changedKeys].filter(Boolean));
  if (changed.size === 0) return row;

  let next = row;
  for (const m of SHIP_METHODS) {
    if (changed.has(m.totalKey)) continue; // người dùng ghi đè Total → tôn trọng
    const touched = changed.has('pricing1') || changed.has(m.priceKey) || changed.has(m.item2Key);
    if (!touched) continue;
    const total = computeTotalFulfill(next, m);
    const value = total === null ? blank : total;
    if (String(next[m.totalKey] ?? '') === String(value ?? '')) continue;
    if (next === row) next = { ...row };
    next[m.totalKey] = value;
  }
  return next;
}

// ── Vùng chọn ────────────────────────────────────────────────────────────────
export function normalizeRange(a, b) {
  const from = a || b;
  const to = b || a;
  if (!from || !to) return null;
  return {
    r1: Math.min(from.r, to.r), r2: Math.max(from.r, to.r),
    c1: Math.min(from.c, to.c), c2: Math.max(from.c, to.c),
  };
}

export function isInRange(range, r, c) {
  return !!range && r >= range.r1 && r <= range.r2 && c >= range.c1 && c <= range.c2;
}

export function clampCell(cell, rowCount, colCount) {
  return {
    r: Math.max(0, Math.min(rowCount - 1, cell.r)),
    c: Math.max(0, Math.min(colCount - 1, cell.c)),
  };
}

// ── Clipboard (TSV như Google Sheets / Excel) ────────────────────────────────
export function parseClipboardMatrix(text) {
  if (typeof text !== 'string' || text === '') return [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines.map(line => line.split('\t'));
}

export function buildClipboardText(matrix) {
  return (matrix || [])
    .map(line => (line || []).map(cell => (cell === null || cell === undefined ? '' : String(cell))).join('\t'))
    .join('\n');
}

// Đọc vùng chọn ra ma trận chuỗi để đưa lên clipboard (số thô, không kèm $).
export function rangeToMatrix(rows, columns, range) {
  if (!range) return [];
  const out = [];
  for (let r = range.r1; r <= range.r2; r++) {
    const row = rows?.[r] || {};
    const line = [];
    for (let c = range.c1; c <= range.c2; c++) {
      const col = columns?.[c];
      const v = col ? row[col.key] : null;
      line.push(isBlankValue(v) ? '' : String(v));
    }
    out.push(line);
  }
  return out;
}

function coerceForColumn(col, raw, blank) {
  if (col.type === 'number') {
    if (isBlankValue(raw)) return { ok: true, value: blank };
    const n = toNumberOrNull(raw);
    if (n === null) return { ok: false, value: null }; // ô rác → bỏ qua, giữ giá trị cũ
    return { ok: true, value: n };
  }
  return { ok: true, value: raw === null || raw === undefined ? '' : String(raw) };
}

// Dán ma trận vào bảng:
// - Clipboard 1 ô  → điền đè TOÀN BỘ vùng đang chọn (giống Google Sheets).
// - Nhiều ô        → dán từ góc trên-trái vùng chọn, cắt theo biên bảng
//                    (KHÔNG tự thêm dòng mới; phần thừa báo qua `clipped`).
export function applyMatrixToRows({ rows, columns, range, matrix, blank = null }) {
  const src = Array.isArray(rows) ? rows : [];
  const cols = Array.isArray(columns) ? columns : [];
  if (!range || !Array.isArray(matrix) || matrix.length === 0) {
    return { rows: src, changed: 0, skipped: 0, clipped: false };
  }

  const single = matrix.length === 1 && matrix[0].length === 1;
  const matrixWidth = Math.max(...matrix.map(line => line.length));
  const height = single ? range.r2 - range.r1 + 1 : matrix.length;
  const width = single ? range.c2 - range.c1 + 1 : matrixWidth;

  const next = [...src];
  const changedByRow = new Map();
  let changed = 0;
  let skipped = 0;
  let clipped = false;

  for (let i = 0; i < height; i++) {
    const r = range.r1 + i;
    if (r >= next.length) { clipped = true; continue; }
    for (let j = 0; j < width; j++) {
      const c = range.c1 + j;
      const col = cols[c];
      if (!col) { clipped = true; continue; }
      const raw = single ? matrix[0][0] : (matrix[i]?.[j] ?? '');
      const { ok, value } = coerceForColumn(col, raw, blank);
      if (!ok) { skipped += 1; continue; }
      if (String(next[r]?.[col.key] ?? '') === String(value ?? '')) continue;
      next[r] = { ...next[r], [col.key]: value };
      if (!changedByRow.has(r)) changedByRow.set(r, new Set());
      changedByRow.get(r).add(col.key);
      changed += 1;
    }
  }

  for (const [r, keys] of changedByRow) {
    next[r] = withRecalculatedTotals(next[r], [...keys], { blank });
  }

  return { rows: changed ? next : src, changed, skipped, clipped };
}

// Xoá nội dung vùng chọn (phím Delete/Backspace) + tính lại Total liên quan.
export function clearRangeInRows({ rows, columns, range, blank = null }) {
  const src = Array.isArray(rows) ? rows : [];
  const cols = Array.isArray(columns) ? columns : [];
  if (!range) return { rows: src, changed: 0 };

  const next = [...src];
  let changed = 0;
  for (let r = range.r1; r <= range.r2; r++) {
    if (r >= next.length) continue;
    const keys = [];
    for (let c = range.c1; c <= range.c2; c++) {
      const col = cols[c];
      if (!col) continue;
      const empty = col.type === 'number' ? blank : '';
      if (String(next[r]?.[col.key] ?? '') === String(empty ?? '')) continue;
      next[r] = { ...next[r], [col.key]: empty };
      keys.push(col.key);
      changed += 1;
    }
    if (keys.length) next[r] = withRecalculatedTotals(next[r], keys, { blank });
  }
  return { rows: changed ? next : src, changed };
}
