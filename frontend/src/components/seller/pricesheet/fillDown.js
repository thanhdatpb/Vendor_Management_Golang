// ════════════════════════════════════════════════════════
//  FILL DOWN / CLEAR / UNDO — logic THUẦN cho thao tác vùng chọn trong bảng giá.
//
//  Tách sẵn theo T0 của kế hoạch fix (mục 01 + 06 + Milestone P) để test được
//  mà không cần mô phỏng chuột. PriceTable sẽ gọi các hàm này khi PR-A1 nối UI:
//  kéo chuột CHỈ chọn vùng, mọi thay đổi hàng loạt đi qua đây và đẩy được vào
//  undo stack.
//
//  Quy ước: mọi hàm trả về danh sách patch dạng { id, patch } — đúng chữ ký
//  onUpdateSize(ptId, szId, patch) đang dùng, để nơi gọi chỉ việc lặp lại.
// ════════════════════════════════════════════════════════

/** Ô nhập được phép sửa hàng loạt. Cột tính được (Total/Profit/Margin…) không nằm ở đây. */
export const EDITABLE_FIELDS = ['sizeAdd', 'itemCost'];

/**
 * Danh sách id size trong vùng chọn giữa 2 chỉ số dòng (kéo lên hay xuống đều được).
 * @returns {string[]} id theo đúng thứ tự hiển thị
 */
export function selectionIds(sizes, anchorIdx, focusIdx) {
  const list = sizes || [];
  if (anchorIdx == null || focusIdx == null) return [];
  const a = Math.max(0, Math.min(anchorIdx, focusIdx));
  const b = Math.min(list.length - 1, Math.max(anchorIdx, focusIdx));
  const ids = [];
  for (let k = a; k <= b; k++) if (list[k]) ids.push(list[k].id);
  return ids;
}

/** Đọc giá trị hiện tại của 1 ô (sizeAdd/itemCost hoặc customize theo id cột). */
export function readCell(size, field) {
  if (!size) return '';
  if (field && field.startsWith('customize:')) {
    const ciId = field.slice('customize:'.length);
    return size.customize?.[ciId] ?? '';
  }
  return size?.[field] ?? '';
}

/** Dựng patch ghi vào 1 ô (giữ nguyên các key khác của size). */
export function writeCellPatch(size, field, value) {
  if (field && field.startsWith('customize:')) {
    const ciId = field.slice('customize:'.length);
    return { customize: { ...(size?.customize || {}), [ciId]: value } };
  }
  return { [field]: value };
}

/**
 * Fill Down — sao chép giá trị của ô ĐẦU vùng chọn xuống các ô còn lại.
 * Không đụng ô ngoài vùng chọn, không đụng ô nguồn.
 *
 * @param {Array} sizes       — danh sách size đang hiển thị (đúng thứ tự)
 * @param {string[]} selected — id các dòng trong vùng chọn
 * @param {string} field      — 'sizeAdd' | 'itemCost' | 'customize:<ciId>'
 * @returns {Array<{id: string, patch: object}>}
 */
export function computeFillDown(sizes, selected, field = 'sizeAdd') {
  const ids = selected || [];
  if (ids.length < 2) return [];
  const byId = new Map((sizes || []).map((s) => [s.id, s]));
  const source = byId.get(ids[0]);
  if (!source) return [];
  const value = readCell(source, field);

  return ids.slice(1).reduce((patches, id) => {
    const sz = byId.get(id);
    if (!sz) return patches;
    if (readCell(sz, field) === value) return patches;   // đã đúng giá trị → không tạo patch thừa
    patches.push({ id, patch: writeCellPatch(sz, field, value) });
    return patches;
  }, []);
}

/**
 * Fill Right — sao chép giá trị của ô trái nhất sang các cột còn lại của CÙNG một dòng.
 * Chỉ áp cho cột nhập; cột tính được không có trong `fields`.
 */
export function computeFillRight(size, fields) {
  const cols = fields || [];
  if (!size || cols.length < 2) return [];
  const value = readCell(size, cols[0]);
  let patch = {};
  cols.slice(1).forEach((field) => {
    if (readCell(size, field) === value) return;
    patch = { ...patch, ...writeCellPatch({ ...size, ...patch }, field, value) };
  });
  return Object.keys(patch).length ? [{ id: size.id, patch }] : [];
}

/**
 * Xoá vùng chọn — CÓ CHỦ ĐÍCH (người dùng bấm nút / nhấn Delete), khác hẳn hành
 * vi cũ "kéo chuột là mất giá". Luôn hoàn tác được nhờ computeUndoPatches.
 */
export function computeClear(sizes, selected, field = 'sizeAdd') {
  const byId = new Map((sizes || []).map((s) => [s.id, s]));
  return (selected || []).reduce((patches, id) => {
    const sz = byId.get(id);
    if (!sz) return patches;
    if (readCell(sz, field) === '') return patches;
    patches.push({ id, patch: writeCellPatch(sz, field, '') });
    return patches;
  }, []);
}

/**
 * Patch nghịch đảo của một thao tác hàng loạt — đẩy vào undo stack TRƯỚC khi áp.
 * Nghịch đảo tính trên trạng thái sizes hiện tại (trước khi áp patches).
 */
export function computeUndoPatches(sizes, patches) {
  const byId = new Map((sizes || []).map((s) => [s.id, s]));
  return (patches || []).reduce((undo, { id, patch }) => {
    const sz = byId.get(id);
    if (!sz) return undo;
    const before = {};
    Object.keys(patch).forEach((key) => {
      before[key] = key === 'customize' ? { ...(sz.customize || {}) } : (sz[key] ?? '');
    });
    undo.push({ id, patch: before });
    return undo;
  }, []);
}

/** Áp danh sách patch lên mảng sizes (thuần — dùng cho test và cho reducer). */
export function applyPatches(sizes, patches) {
  if (!patches?.length) return sizes || [];
  const map = new Map(patches.map((p) => [p.id, p.patch]));
  return (sizes || []).map((sz) => (map.has(sz.id) ? { ...sz, ...map.get(sz.id) } : sz));
}

/** Giới hạn undo stack theo kế hoạch: tối đa 20 bước. */
export const UNDO_LIMIT = 20;

/** Đẩy một bước vào undo stack (bất biến, cắt bớt theo UNDO_LIMIT). */
export function pushUndo(stack, step) {
  return [step, ...(stack || [])].slice(0, UNDO_LIMIT);
}
