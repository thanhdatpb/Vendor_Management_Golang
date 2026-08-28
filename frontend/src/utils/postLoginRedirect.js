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
const ALLOWED_PATH = /^\/price-sheets\/[A-Za-z0-9_-]+$/;

/** Gọi từ ProtectedRoute lúc đá user chưa đăng nhập về "/". */
export const rememberPostLoginRedirect = (pathname) => {
  try {
    if (ALLOWED_PATH.test(pathname)) {
      sessionStorage.setItem(KEY, pathname);
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
    return saved && ALLOWED_PATH.test(saved) ? saved : null;
  } catch {
    return null;
  }
};

/** Đích đến sau khi có user: link đã lưu (nếu có) — không thì về theo role. */
export const postLoginPath = (role) => consumePostLoginRedirect() || roleRoute(role);
