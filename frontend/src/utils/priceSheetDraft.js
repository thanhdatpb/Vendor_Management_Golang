// ════════════════════════════════════════════════════════
//  BẢN NHÁP BẢNG TÍNH GIÁ — lưới an toàn cuối cùng, nằm ở máy người dùng.
//
//  Vì sao cần dù đã có autosave lên server: autosave vẫn có thể thất bại
//  (mất mạng, token hết hạn, server 500). Trước bản này, mọi thao tác chỉ
//  nằm trong React state — đóng tab / F5 / bấm Hủy là mất sạch, và Seller
//  không còn Google Sheet để đối chiếu.
//
//  Nháp chỉ giữ phần NGƯỜI DÙNG SỬA ĐƯỢC (name + settings + productTypes),
//  không giữ `history`: lịch sử đã ra bảng riêng ở server (mục 17), nhét vào
//  đây chỉ làm phình localStorage — vốn đã từng chạm trần ~5MB và hỏng lặng
//  lẽ (xem persistAllSheets ở SetupPriceSection).
// ════════════════════════════════════════════════════════

export const DRAFT_PREFIX = 'PRICE_SHEET_DRAFT_';


/** Khoá localStorage của một bảng. Không có id thì không có nháp. */
export function draftKey(sheetId) {
  const id = (sheetId ?? '').toString().trim();
  return id ? `${DRAFT_PREFIX}${id}` : '';
}

/** Chữ ký nội dung — dùng để so nháp với bản đang mở / bản trên server. */
export function contentSignature({ name, settings, productTypes } = {}) {
  return JSON.stringify({ name: name || '', settings: settings || {}, productTypes: productTypes || [] });
}

/**
 * Ghi nháp. KHÔNG bao giờ ném: hỏng nháp là chuyện nhỏ, làm vỡ luồng gõ của
 * Seller mới là chuyện lớn.
 *
 * @param {string} sheetId
 * @param {{baseVersion?: number, name?: string, settings?: object, productTypes?: Array, savedAt?: string}} draft
 * @returns {boolean} ghi được hay không
 */
export function saveDraft(sheetId, draft = {}) {
  const key = draftKey(sheetId);
  if (!key) return false;
  try {
    localStorage.setItem(key, JSON.stringify({
      sheetId,
      baseVersion: draft.baseVersion ?? null,
      savedAt: draft.savedAt || new Date().toISOString(),
      name: draft.name || '',
      settings: draft.settings || {},
      productTypes: draft.productTypes || [],
    }));
    return true;
  } catch (err) {
    // Hết quota hoặc localStorage bị chặn (private mode) — báo một dòng rồi thôi.
    console.warn('Không ghi được bản nháp bảng tính giá:', err?.message || err);
    return false;
  }
}

/** Đọc nháp. Trả null khi không có / hỏng JSON / thiếu phần nội dung. */
export function readDraft(sheetId) {
  const key = draftKey(sheetId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== 'object' || !Array.isArray(draft.productTypes)) return null;
    return draft;
  } catch (err) {
    console.warn('Bản nháp bảng tính giá hỏng, bỏ qua:', err?.message || err);
    return null;
  }
}

export function clearDraft(sheetId) {
  const key = draftKey(sheetId);
  if (!key) return;
  try { localStorage.removeItem(key); } catch { /* nháp không xoá được thì lần mở sau tự so nội dung */ }
}

/** Nháp có khác nội dung đang mở không — giống hệt thì không cần hỏi gì. */
export function draftDiffers(draft, current) {
  if (!draft) return false;
  return contentSignature(draft) !== contentSignature(current);
}

/**
 * Nháp cũ hơn bản trên server: có người khác (hoặc chính mình ở máy khác) đã
 * lưu sau lúc nháp này sinh ra. Vẫn cho khôi phục, nhưng phải NÓI RÕ — khôi
 * phục mù chính là kiểu âm thầm ghi đè mà mục 16 đã chặn ở tầng server.
 */
export function isStaleDraft(draft, sheet) {
  // `== null` bắt cả undefined: Number(null) là 0 — coi nháp "không biết
  // version" là cũ hơn mọi bản server thì lần nào cũng dựng cảnh báo sai.
  if (draft?.baseVersion == null || sheet?.version == null) return false;
  const base = Number(draft.baseVersion);
  const current = Number(sheet.version);
  if (!Number.isFinite(base) || !Number.isFinite(current)) return false;
  return base < current;
}
