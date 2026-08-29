// ════════════════════════════════════════════════════════
//  ĐỊNH DẠNG "LẦN TRUY CẬP CUỐI"
//
//  Admin nhìn cột này để biết tài khoản nào còn được dùng, tài khoản nào bỏ
//  không — nên "3 ngày trước" hữu ích hơn "15/08/2026 09:12". Mốc càng cũ thì
//  càng cần con số tuyệt đối, nên quá 7 ngày sẽ hiện ngày tháng.
//
//  Thuần logic, không dính React → test được mà không cần render.
// ════════════════════════════════════════════════════════

import { timeValue, vnDateStamp } from '../../utils/vnTime';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * @param {string|null|undefined} iso  mốc ISO-8601 từ API (`last_seen_at`)
 * @param {Date} [now]                 truyền vào để test không phụ thuộc đồng hồ
 * @returns {{ text: string, stale: boolean }}
 *   `stale` = quá 30 ngày hoặc chưa từng truy cập → tô nhạt để Admin nhận ra ngay.
 */
export function formatLastSeen(iso, now = new Date()) {
  if (!iso) return { text: 'Chưa truy cập', stale: true };

  const then = timeValue(iso, NaN);
  if (!Number.isFinite(then)) return { text: 'Chưa truy cập', stale: true };

  const diff = now.getTime() - then;

  // Lệch âm (đồng hồ máy chủ/máy trạm chênh nhau) → coi như vừa xong, đừng hiện
  // "-3 phút trước".
  if (diff < MINUTE) return { text: 'Vừa xong', stale: false };

  if (diff < HOUR) {
    return { text: `${Math.floor(diff / MINUTE)} phút trước`, stale: false };
  }
  if (diff < DAY) {
    return { text: `${Math.floor(diff / HOUR)} giờ trước`, stale: false };
  }

  const days = Math.floor(diff / DAY);
  if (days <= 7) {
    return { text: `${days} ngày trước`, stale: false };
  }

  // Quá một tuần: ngày tháng cụ thể có ích hơn "37 ngày trước".
  return {
    text: vnDateStamp(then, '/'),
    stale: days > 30,
  };
}
