// ════════════════════════════════════════════════════════
//  ĐIỀU HƯỚNG SAU LOGIN VỀ ĐÚNG LINK ĐÃ BẤM (bảng tính giá)
//
//  ProtectedRoute đá user chưa đăng nhập về "/", làm mất đích đến ban đầu.
//  Ai dán link /price-sheets/:id mà chưa login thì vào thẳng trang login rồi
//  RỚT VỀ dashboard theo role — không tới bảng họ định xem.
//
//  Lưu sessionStorage (không phải query param): luồng Google OAuth vòng qua
//  backend rồi mới quay lại /auth/callback, query param không sống sót qua
//  vòng đó.
//
//  Whitelist bằng regex — chỉ nhận đúng dạng /price-sheets/<id>, không nhận
//  path tuỳ ý, để không biến thành open-redirect qua sessionStorage.
// ════════════════════════════════════════════════════════
import { roleRoute } from './roleRoute';

const KEY = 'POST_LOGIN_REDIRECT';

/**
 * Các trang có link riêng, gửi được cho người khác:
 *   • /price-sheets/<id>            — một bảng tính giá
 *   • /library/<fileId>[/<slug>]    — một file Thư viện Vendor
 * Slug chỉ để đọc, không dùng tra cứu, nên cho phép các ký tự an toàn của URL.
 */
const ALLOWED_PATH = /^\/(?:price-sheets\/[A-Za-z0-9_-]+|library\/[A-Za-z0-9_.~%-]+(?:\/[A-Za-z0-9_.~%-]*)?)$/;

// Query và hash cũng phải giữ: /library/<id>?row=<rowId> trỏ tới ĐÚNG một phôi
// trong file. Chỉ lưu pathname như trước thì mở link rồi đăng nhập sẽ rơi về
// đầu file — mất đúng chỗ mà người gửi đang muốn chỉ cụ thể.
const SAFE_SEARCH = /^(?:\?[A-Za-z0-9_\-=&%.~+]{0,200})?$/;
const SAFE_HASH = /^(?:#[A-Za-z0-9_\-%.~]{0,80})?$/;

/** Tách một đích đến thành 3 phần, không dùng URL() để khỏi cần origin. */
const splitTarget = (target) => {
  const queryAt = target.indexOf('?');
  const hashAt = target.indexOf('#');
  const marks = [queryAt, hashAt].filter((i) => i >= 0).sort((a, b) => a - b);
  const pathname = target.slice(0, marks.length ? marks[0] : target.length);
  const search = queryAt >= 0
    ? target.slice(queryAt, hashAt > queryAt ? hashAt : target.length)
    : '';
  const hash = hashAt >= 0 ? target.slice(hashAt) : '';
  return { pathname, search, hash };
};

/**
 * Whitelist tường minh — sessionStorage là thứ trang khác cùng origin ghi được,
 * nên không nhận path tuỳ ý để khỏi biến thành open-redirect.
 */
const isAllowedTarget = (target) => {
  if (typeof target !== 'string' || target === '' || target.length > 512) return false;
  const { pathname, search, hash } = splitTarget(target);
  return ALLOWED_PATH.test(pathname) && SAFE_SEARCH.test(search) && SAFE_HASH.test(hash);
};

/**
 * Gọi từ ProtectedRoute lúc đá user chưa đăng nhập về "/".
 * Nhận cả object `location` của react-router lẫn chuỗi path.
 */
export const rememberPostLoginRedirect = (location) => {
  const target = typeof location === 'string'
    ? location
    : `${location?.pathname || ''}${location?.search || ''}${location?.hash || ''}`;

  try {
    if (isAllowedTarget(target)) {
      sessionStorage.setItem(KEY, target);
    }
  } catch { /* sessionStorage có thể bị chặn (private mode) — bỏ qua */ }
};

/**
 * Đọc + xoá đích đến đã lưu (đọc một lần — tránh redirect lặp nếu user quay
 * lại "/" sau khi đã vào bảng). Trả `null` nếu không có/không hợp lệ.
 */
const consumePostLoginRedirect = () => {
  try {
    const saved = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return saved && isAllowedTarget(saved) ? saved : null;
  } catch {
    return null;
  }
};

/** Đích đến sau khi có user: link đã lưu (nếu có) — không thì về theo role. */
export const postLoginPath = (role) => consumePostLoginRedirect() || roleRoute(role);
