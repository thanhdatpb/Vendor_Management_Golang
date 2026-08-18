import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

let echoInstance = null;

// Lazy singleton — chỉ tạo kết nối Pusher khi thực sự có nơi cần lắng nghe.
// Nếu chưa cấu hình VITE_PUSHER_APP_KEY, trả về null để nơi gọi tự fallback
// sang polling thay vì lỗi.
export function getEcho() {
  if (echoInstance) return echoInstance;

  const key = import.meta.env.VITE_PUSHER_APP_KEY;
  const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER;

  if (!key || !cluster) {
    console.warn('Pusher chưa được cấu hình (VITE_PUSHER_APP_KEY/CLUSTER trống) — real-time update sẽ không hoạt động, chỉ còn polling.');
    return null;
  }

  echoInstance = new Echo({
    broadcaster: 'pusher',
    key,
    cluster,
    forceTLS: true,
  });

  return echoInstance;
}

/**
 * Trạng thái realtime để hiển thị trên giao diện.
 *
 * Vì sao cần: key Pusher được NHÚNG CỨNG vào bundle lúc `vite build`, mà repo
 * commit sẵn `frontend/dist`. Ai build từ máy thiếu `.env` sẽ đẩy lên
 * production một bản không có realtime, và dấu hiệu duy nhất là một dòng
 * console.warn không ai nhìn. Hàm này cho phép hiện chấm trạng thái ở header
 * để phát hiện bằng mắt.
 *
 * @returns {'unconfigured'|'connected'|'connecting'|'disconnected'}
 */
export function getRealtimeStatus() {
  const key = import.meta.env.VITE_PUSHER_APP_KEY;
  const cluster = import.meta.env.VITE_PUSHER_APP_CLUSTER;
  if (!key || !cluster) return 'unconfigured';

  const state = echoInstance?.connector?.pusher?.connection?.state;
  if (state === 'connected') return 'connected';
  if (state === 'connecting' || state === 'initialized') return 'connecting';
  if (!echoInstance) return 'connecting'; // chưa ai subscribe nên chưa mở socket
  return 'disconnected';
}

/**
 * Đăng ký nghe một event trên một kênh public.
 * Gom về đây để mọi subscriber có cùng hành vi: chưa cấu hình Pusher thì trả
 * hàm huỷ rỗng (nơi gọi vẫn chạy bình thường, chỉ mất realtime), và luôn dọn
 * listener khi unmount.
 */
function subscribe(channelName, eventName, callback) {
  const echo = getEcho();
  if (!echo || typeof callback !== 'function') return () => {};

  const channel = echo.channel(channelName);
  channel.listen(eventName, callback);

  return () => {
    channel.stopListening(eventName, callback);
  };
}

/**
 * Lắng nghe sự kiện thay đổi Product trên kênh public "products".
 * @param {(data: { action: string, product: object }) => void} callback
 * @returns {() => void} hàm hủy đăng ký, gọi khi component unmount
 */
export function subscribeProductChanges(callback) {
  const echo = getEcho();
  if (!echo) return () => {};

  const channel = echo.channel('products');
  channel.listen('.ProductChanged', callback);

  return () => {
    channel.stopListening('.ProductChanged', callback);
  };
}

/**
 * Lắng nghe tín hiệu có notification mới. Event chỉ mang userId/notificationId;
 * nội dung thật luôn được tải lại qua API có Bearer token.
 */
export function subscribeNotificationChanges(userId, callback) {
  const echo = getEcho();
  if (!echo || !userId) return () => {};

  const listener = (event) => {
    if (String(event?.userId) === String(userId)) callback(event);
  };
  const channel = echo.channel('notifications');
  channel.listen('.NotificationCreated', listener);

  return () => {
    channel.stopListening('.NotificationCreated', listener);
  };
}

/**
 * Lắng nghe thay đổi bảng tính giá trong PHẠM VI MỘT PROJECT.
 *
 * Kênh tách theo project để Seller không nhận tín hiệu của project khác (và
 * cũng không suy ra được project khác có bao nhiêu bảng). Bảng không thuộc
 * project nào phát trên kênh 'price-sheets.all'.
 *
 * Event chỉ mang { id, action, version, updatedBy } — KHÔNG mang nội dung bảng
 * giá, vì kênh Pusher là public. Nơi gọi phải tự tải lại qua API có token,
 * đúng mẫu bảo mật của subscribeNotificationChanges ở trên.
 *
 * @param {string} projectKey project của user; rỗng → nghe kênh chung
 * @param {(e: { id: string, action: string, version: number, updatedBy: string }) => void} callback
 * @returns {() => void} hàm huỷ đăng ký
 */
export function subscribePriceSheetChanges(projectKey, callback) {
  const scope = (projectKey || '').trim() || 'all';
  return subscribe(`price-sheets.${scope}`, '.PriceSheetChanged', callback);
}

/**
 * Lắng nghe thay đổi thư viện Vendor (import file mới, đổi Sample/Best Seller).
 *
 * Vì sao cần: trước đây thư viện chỉ tải lúc mount, nên sau khi Vendor import
 * file mới thì người đang mở tab vẫn thấy bản cũ — và bảng tính giá của họ tính
 * trên giá vốn cũ mà không hay biết.
 *
 * @param {(e: { reason: string, updatedAt: string }) => void} callback
 * @returns {() => void} hàm huỷ đăng ký
 */
export function subscribeVendorLibraryChanges(callback) {
  return subscribe('vendor-library', '.VendorLibraryChanged', callback);
}
