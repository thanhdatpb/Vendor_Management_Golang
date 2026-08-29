// ════════════════════════════════════════════════════════
//  VN TIME — mọi mốc thời gian hiển thị đều theo giờ Việt Nam (UTC+7)
//
//  Hai lỗi lệch giờ mà file này gom lại xử lý một chỗ:
//
//  1) Backend đọc bảng bằng Query Builder (`DB::table(...)`) nên các cột
//     `saved_at` / `updated_at` ra thẳng chuỗi thô của DB: "2026-08-24 06:27:12",
//     KHÔNG có hậu tố "Z" hay offset. Giá trị là UTC (config/app.php để 'UTC'),
//     nhưng `new Date("2026-08-24 06:27:12")` lại hiểu chuỗi không offset là giờ
//     máy → lịch sử lưu bị hiển thị sớm 7 tiếng.
//
//  2) `toLocaleString('vi-VN')` chỉ đổi ĐỊNH DẠNG, còn múi giờ vẫn theo máy
//     người xem. Máy để nhầm timezone (hoặc nhân sự ngồi ngoài VN) là ra giờ khác
//     — trong khi cả team đọc mốc thời gian theo giờ VN.
//
//  Nên: chuỗi không offset được đọc là UTC, và mọi thứ hiển thị ra đều format
//  với timeZone 'Asia/Ho_Chi_Minh'.
// ════════════════════════════════════════════════════════

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

// Việt Nam bỏ DST từ 1975 → offset cố định +07:00. Nhờ vậy các phép "đầu tuần
// theo giờ VN", "dấu ngày cho tên file" tính bằng số học được, không cần
// Intl.formatToParts.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// "2026-08-24 06:27:12" / "2026-08-24T06:27:12" / "...T06:27:12.123" — dạng
// datetime KHÔNG kèm offset. Có "Z" hoặc "+07:00" thì regex không khớp và
// chuỗi được để cho `new Date` parse như bình thường.
const NO_OFFSET = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/;

/** Chuyển giá trị thời gian bất kỳ về Date, hoặc null nếu không đọc được. */
export function toDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value !== 'string') return null;

  const raw = value.trim();
  if (!raw) return null;

  const m = NO_OFFSET.exec(raw);
  const d = m
    ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)))
    : new Date(raw);

  return Number.isNaN(d.getTime()) ? null : d;
}

/** Mốc thời gian dạng số (ms) để so sánh/sắp xếp; không đọc được thì `fallback`. */
export function timeValue(value, fallback = 0) {
  const d = toDate(value);
  return d ? d.getTime() : fallback;
}

function fmt(value, options, fallback) {
  const d = toDate(value);
  if (!d) return fallback;
  try {
    return d.toLocaleString('vi-VN', { timeZone: VN_TIMEZONE, ...options });
  } catch {
    return fallback;
  }
}

/** Ngày + giờ theo giờ VN — "13:27:12 24/8/2026". */
export function fmtVNDateTime(value, fallback = '') {
  return fmt(value, undefined, fallback);
}

/** Ngày + giờ gọn theo giờ VN — "24/08/2026 13:27". */
export function fmtVNDateTimeShort(value, fallback = '') {
  return fmt(value, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }, fallback);
}

/** Chỉ ngày theo giờ VN — "24/8/2026". */
export function fmtVNDate(value, fallback = '') {
  const d = toDate(value);
  if (!d) return fallback;
  try {
    return d.toLocaleDateString('vi-VN', { timeZone: VN_TIMEZONE });
  } catch {
    return fallback;
  }
}

/** Ngày đầy đủ có thứ theo giờ VN — "Thứ Hai, 24 tháng 8, 2026". */
export function fmtVNLongDate(value = new Date(), fallback = '') {
  const d = toDate(value);
  if (!d) return fallback;
  try {
    return d.toLocaleDateString('vi-VN', {
      timeZone: VN_TIMEZONE, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return fallback;
  }
}

// ─── Các mốc/dấu tính theo lịch VN ──────────────────────
// Dời mốc đi +7h rồi đọc bằng getUTC* = đọc đúng "giờ treo tường" ở VN mà không
// phụ thuộc timezone của máy.
function vnWallClock(value) {
  const d = toDate(value);
  return d ? new Date(d.getTime() + VN_OFFSET_MS) : null;
}

const pad2 = (n) => String(n).padStart(2, '0');

/** Ngày VN cho tên file — "24-08-2026". */
export function vnDateStamp(value = new Date(), sep = '-') {
  const w = vnWallClock(value);
  if (!w) return '';
  return [pad2(w.getUTCDate()), pad2(w.getUTCMonth() + 1), w.getUTCFullYear()].join(sep);
}

/** Ngày VN dạng ISO — "2026-08-24". */
export function vnIsoDate(value = new Date()) {
  const w = vnWallClock(value);
  if (!w) return '';
  return `${w.getUTCFullYear()}-${pad2(w.getUTCMonth() + 1)}-${pad2(w.getUTCDate())}`;
}

/** Dấu ngày-giờ VN an toàn cho tên file — "2026-08-24T13-27-12". */
export function vnFileStamp(value = new Date()) {
  const w = vnWallClock(value);
  if (!w) return '';
  return `${vnIsoDate(value)}T${pad2(w.getUTCHours())}-${pad2(w.getUTCMinutes())}-${pad2(w.getUTCSeconds())}`;
}

/**
 * Mốc 00:00 thứ Hai của tuần hiện tại **theo lịch VN**, trả về ms epoch.
 * Dùng cho "New Arrivals": file rời tab khi sang thứ Hai kế tiếp — ranh giới đó
 * phải là nửa đêm ở VN, không phải nửa đêm của máy người xem.
 */
export function vnStartOfWeek(value = new Date()) {
  const w = vnWallClock(value);
  if (!w) return null;
  const dow = w.getUTCDay();                       // 0 = Chủ nhật
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const mondayWall = Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate() - daysSinceMonday);
  return mondayWall - VN_OFFSET_MS;                // đổi ngược về mốc UTC thật
}
