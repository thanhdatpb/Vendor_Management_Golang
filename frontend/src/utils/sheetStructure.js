// ════════════════════════════════════════════════════════
//  SHEET STRUCTURE — thao tác CẤU TRÚC của một bảng tính giá (mục 02 / 05 / 06)
//
//  Ở đây chỉ có hàm THUẦN: đổi thứ tự dòng size, đổi thứ tự cột Customize và
//  áp giá mặc định cho một cột. Tách khỏi component vì ba lý do:
//    • test được mà không phải render React (bộ test chạy mỗi lần lưu file);
//    • dùng chung cho nút ↑↓ / ←→, phím Alt+↑↓ và kéo bằng tay cầm — cả ba
//      đường đều phải cho ra ĐÚNG một kết quả;
//    • các hàm này trả về "patch" nên đi qua được undo stack của PriceTable.
//
//  ⚠ Nguyên tắc không được phá: giá của cột Customize bám `ci.id`, KHÔNG bám
//  chỉ số cột. Đổi thứ tự cột chỉ hoán vị mảng `customizeInfos`, không đụng
//  một khoá nào trong `size.customize`.
// ════════════════════════════════════════════════════════

/** Ô customize đang trống? ('' / null / undefined đều là trống, 0 thì KHÔNG.) */
const isBlank = (v) => v === '' || v === null || v === undefined;

/**
 * Di chuyển một phần tử trong mảng đi `delta` bậc (âm = lên/trái).
 * Trả về MẢNG MỚI; index ra ngoài biên thì trả nguyên mảng cũ (no-op) để nút
 * ↑ ở dòng đầu và ↓ ở dòng cuối không làm gì cả thay vì cuộn vòng.
 */
export function moveByDelta(list, index, delta) {
  const arr = Array.isArray(list) ? list : [];
  const to = index + delta;
  if (index < 0 || index >= arr.length || to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
}

/** Di chuyển phần tử có `id` tới vị trí `toIndex` (đường đi của thao tác kéo-thả). */
export function moveById(list, id, toIndex) {
  const arr = Array.isArray(list) ? list : [];
  const from = arr.findIndex((x) => x?.id === id);
  if (from < 0) return arr;
  return moveByDelta(arr, from, toIndex - from);
}

/** Danh sách id theo đúng thứ tự đang hiển thị — giá trị để ghi vào `pt.sizeOrder`. */
export const orderIdsOf = (list) => (Array.isArray(list) ? list : []).map((x) => x?.id).filter(Boolean);

/**
 * Những dòng size sẽ bị ảnh hưởng khi áp giá mặc định cho một cột Customize.
 * @param {Array} sizes
 * @param {string} ciId
 * @param {object} opts  { mode: 'all' | 'empty-only' }  — mặc định 'empty-only'
 */
export function affectedSizes(sizes, ciId, { mode = 'empty-only' } = {}) {
  const rows = Array.isArray(sizes) ? sizes : [];
  if (mode === 'all') return rows;
  return rows.filter((sz) => isBlank(sz?.customize?.[ciId]));
}

/** Số ô sẽ đổi — dùng cho dòng xem trước "sẽ cập nhật n ô" trong hộp thoại. */
export function countAffected(sizes, ciId, value, opts) {
  return affectedSizes(sizes, ciId, opts).length;
}

/**
 * Patch áp giá mặc định cho một cột Customize.
 * @returns {Array<{id: string, ciId: string, value: *}>} — số phần tử LUÔN bằng
 *          `countAffected` với cùng tham số, để nhãn nút không bao giờ nói dối.
 */
export function applyColumnDefault(sizes, ciId, value, opts) {
  return affectedSizes(sizes, ciId, opts).map((sz) => ({ id: sz.id, ciId, value }));
}
