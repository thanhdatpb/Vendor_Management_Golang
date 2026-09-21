// ════════════════════════════════════════════════════════════════════════════
//  CACHE THEO ETAG CHO BLOB THƯ VIỆN
//
//  `GET /api/vendor-library` trả NGUYÊN blob thư viện (vài MB) và là request
//  nặng nhất của hệ thống. Hai màn hình danh sách đều gọi nó lúc mount, rồi
//  còn tự làm mới NỀN mỗi lần người dùng quay lại tab hoặc Pusher báo có thay
//  đổi — nghĩa là tải lại cả thư viện kể cả khi không có gì đổi.
//
//  Module này giữ bản đã tải kèm ETag của nó. Lần sau chỉ gửi một request điều
//  kiện; không có gì đổi thì server trả 304 với body rỗng và ta dùng lại bản
//  trong bộ nhớ. Cùng cơ chế với `vendorLibraryIndex.js` (bảng tính giá), chỉ
//  khác đối tượng cache.
//
//  Cache dùng CHUNG cho mọi nơi gọi và KHÔNG chia theo role: trong một phiên
//  đăng nhập chỉ có một role, và server đã lọc trường theo role trước khi trả
//  (VendorFieldVisibility) nên bản nằm trong cache luôn là bản của chính người
//  đang đăng nhập.
// ════════════════════════════════════════════════════════════════════════════
import { vendorLibraryApi } from '../services/api';

let _cache = { etag: null, files: null };

/** Dọn cache — dùng trong test, và sau khi chính máy này vừa ghi thư viện. */
export function resetVendorLibraryCache() {
  _cache = { etag: null, files: null };
}

/**
 * Tải thư viện, dùng lại bản trong bộ nhớ nếu server trả 304.
 *
 * @param {string} mode  tab đang xem — chuyển tiếp cho server, KHÔNG đổi body
 * @returns {Promise<Array>} danh sách file thư viện
 */
export async function loadVendorLibrary(mode = 'all') {
  const reuse = Array.isArray(_cache.files) && !!_cache.etag;

  const res = await vendorLibraryApi.get(mode, reuse ? { 'If-None-Match': _cache.etag } : {});

  // 304 = không có gì đổi. Body rỗng, bản trong bộ nhớ vẫn đúng.
  if (res.status === 304 && reuse) return _cache.files;

  const files = Array.isArray(res.data) ? res.data : [];
  // Server cũ chưa phát ETag thì `etag` = null → lần sau lại tải đầy đủ như
  // trước. Xuống cấp êm, không phải lỗi.
  const etag = res.headers?.etag || res.headers?.ETag || null;
  _cache = { etag, files };

  return files;
}
