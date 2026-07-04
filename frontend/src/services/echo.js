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
