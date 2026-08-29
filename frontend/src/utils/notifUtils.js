import { notificationApi } from '../services/api';
import { fmtVNDateTime } from './vnTime';

// Map role → localStorage key (fallback khi backend chưa có POST /notifications)
const ROLE_LS_KEY = {
  staff_a: 'STAFF_A_NOTIFICATIONS',
  staff_b: 'STAFF_B_NOTIFICATIONS',
  seller:  'SELLER_NOTIFICATIONS',
  admin:   'STAFF_B_NOTIFICATIONS_TO_ADMIN',
};

/**
 * Gửi notification tới một role cụ thể.
 * Ưu tiên POST /notifications (backend). Nếu backend chưa có endpoint,
 * tự động fallback về localStorage để không bị gián đoạn.
 *
 * @param {'staff_a'|'staff_b'|'seller'|'admin'} forRole
 * @param {object} payload  - { type, title, message, icon, product_id, data:{...} }
 */
export async function pushNotif(forRole, payload) {
  const { type, title, message, icon, product_id, ...extra } = payload;

  try {
    await notificationApi.create({
      for_role: forRole,
      type,
      product_id: product_id || null,
      data: { title, message, icon, ...extra },
    });
  } catch {
    // Fallback: localStorage (same-device only) — sẽ xóa sau khi backend triển khai
    const key = ROLE_LS_KEY[forRole];
    if (!key) return;
    try {
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const notif = {
        id: Date.now(),
        type,
        title,
        message,
        icon,
        product_id,
        productId: product_id,
        time: fmtVNDateTime(Date.now()),
        timestamp: Date.now(),
        is_read: false,
        read: false,
        ...extra,
      };
      localStorage.setItem(key, JSON.stringify([notif, ...existing].slice(0, 100)));
      window.dispatchEvent(new StorageEvent('storage', { key }));
    } catch { /* ignore */ }
  }
}

/**
 * Gửi notification cho nhiều roles cùng lúc.
 */
export async function pushNotifMulti(roles, payload) {
  await Promise.allSettled(roles.map(role => pushNotif(role, payload)));
}
