// ════════════════════════════════════════════════════════
//  MỘT CHỖ DUY NHẤT quyết định role nào được thấy trường giá của Thư viện Vendor.
//
//  Trước đây quy tắc này nằm rải rác trong 2 component viewer
//  (VendorLibraryViewer 1982 dòng dùng cho Vendor/Admin, và bản CSF/PD 420 dòng
//  tách riêng). Mỗi thay đổi phân quyền phải sửa 2 nơi và dễ sót — đó chính là
//  cách lỗi rò rỉ giá phát sinh.
//
//  ⚠ Đây là nguồn sự thật cho việc DỰNG CỘT. Nguồn sự thật về BẢO MẬT là
//  backend/app/Support/VendorFieldVisibility.php — server không được gửi trường
//  giá cho role không có quyền, ẩn ở UI là chưa đủ.
// ════════════════════════════════════════════════════════

/** Role được phép thấy giá. Danh sách CHO PHÉP: role lạ mặc định không thấy. */
export const ROLES_WITH_PRICES = ['admin', 'seller', 'vendor', 'staffa', 'staffb'];

/**
 * Role chỉ-đọc thư viện. Tách riêng khỏi `canSeePrices` vì hai câu hỏi khác nhau:
 * "có được thấy giá không" (mặc định KHÔNG, fail-closed) và "có phải là role
 * chỉ-đọc đã biết không" (dùng để chặn hẳn màn hình soạn thảo). Chặn màn hình
 * chỉ dựa trên danh sách tường minh này — nếu dùng `!canSeePrices` thì một user
 * thiếu trường `role` trong localStorage sẽ bị khoá oan.
 */
export const READ_ONLY_LIBRARY_ROLES = ['csf', 'pd', 'marvel'];

export const isReadOnlyLibraryRole = (role) =>
  READ_ONLY_LIBRARY_ROLES.includes(normalizeRole(role));

/**
 * Mọi khoá mang tiền trong một dòng "Về giá" của thư viện.
 * Thêm phương thức ship mới → thêm khoá vào đây, không thêm chỗ nào khác.
 * Phải khớp với PRICE_FIELDS bên PHP.
 */
export const PRICE_FIELD_KEYS = [
  'pricing1', 'pricing2',
  'eco_price', 'eco_total', 'eco_price_item2',
  'ground_price', 'ground_total', 'ground_price_item2',
  'express_price', 'express_total', 'express_price_item2',
  'twoday_price', 'twoday_total', 'twoday_price_item2',
  'overnight_price', 'overnight_total', 'overnight_price_item2',
  'fast_price', 'fast_total', 'fast_price_item2',
  'targetCost', 'target_cost',
  'economyPrice', 'economy_price',
  'totalPrice', 'total_price',
  'itemCost', 'item_cost',
  'unitPrice', 'unit_price',
];

/**
 * Hai cột "AVG TG" — thời gian sản xuất / vận chuyển trung bình của phôi.
 * CSF VẪN xem được (cần để trả lời khách về thời gian giao); PD và Marvel thì không.
 * Phải khớp LEAD_TIME_FIELDS bên PHP.
 */
export const LEAD_TIME_FIELD_KEYS = ['avgTimeVendor', 'avgTimeActual'];

/** Role được xem 2 cột thời gian. Danh sách CHO PHÉP: role lạ mặc định không thấy. */
export const ROLES_WITH_LEAD_TIME = ['admin', 'seller', 'vendor', 'staffa', 'staffb', 'csf'];

/** Chuẩn hoá role: bỏ dấu _/-/space, chữ thường. */
export const normalizeRole = (role) => (role ?? '').toString().toLowerCase().replace(/[-_\s]/g, '');

export const canSeePrices = (role) => ROLES_WITH_PRICES.includes(normalizeRole(role));

export const canSeeLeadTime = (role) => ROLES_WITH_LEAD_TIME.includes(normalizeRole(role));

/** Role của người đang đăng nhập, đọc từ localStorage như phần còn lại của app. */
export function currentUserRole() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}').role || '';
  } catch {
    return '';
  }
}

/**
 * Bỏ mọi trường giá khỏi một object nếu role không được xem.
 * Dùng như lưới an toàn ở tầng UI: kể cả server (hoặc một bản cache cũ) có lỡ
 * trả giá về, component vẫn không có gì để render ra.
 */
export function stripPriceFields(row, role) {
  return stripKeys(row, canSeePrices(role) ? [] : PRICE_FIELD_KEYS);
}

/**
 * Bỏ mọi trường role này không được xem — giá và/hoặc 2 cột thời gian.
 * Dùng như lưới an toàn ở tầng UI: kể cả server (hoặc một bản cache cũ) có lỡ
 * trả về thì component vẫn không có gì để render ra.
 */
export function stripHiddenFields(row, role) {
  const forbidden = [
    ...(canSeePrices(role) ? [] : PRICE_FIELD_KEYS),
    ...(canSeeLeadTime(role) ? [] : LEAD_TIME_FIELD_KEYS),
  ];
  return stripKeys(row, forbidden);
}

function stripKeys(row, forbidden) {
  if (!row || typeof row !== 'object' || forbidden.length === 0) return row;
  if (Array.isArray(row)) return row.map((item) => stripKeys(item, forbidden));

  const out = {};
  Object.keys(row).forEach((key) => {
    if (forbidden.includes(key)) return;
    const value = row[key];
    out[key] = (value && typeof value === 'object') ? stripKeys(value, forbidden) : value;
  });
  return out;
}
