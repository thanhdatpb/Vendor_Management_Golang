// SyncService.js
// Lớp đồng bộ ngầm localStorage qua json-server cho phép share network local.

const SERVER_URL = `http://${window.location.hostname}:3000/state`;
const POLLING_INTERVAL = 3000;

let lastSyncString = '';
let isSyncing = false;

// 1. Lưu lại hàm setItem gốc của trình duyệt
const originalSetItem = localStorage.setItem;

// Hàm debounce để đẩy dữ liệu lên server (tránh gửi liên tục nếu có nhiều setItem cùng lúc)
let pushTimeout;
const pushToServer = () => {
  clearTimeout(pushTimeout);
  pushTimeout = setTimeout(async () => {
    try {
      const currentState = { ...localStorage };
      const stateString = JSON.stringify(currentState);
      
      // Nếu không có thay đổi so với lần cuối sync lên server, bỏ qua
      if (stateString === lastSyncString) return;

      isSyncing = true;
      const res = await fetch(SERVER_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: stateString
      });
      
      if (res.ok) {
        lastSyncString = stateString;
      }
    } catch (e) {
      console.warn('SyncService: Không thể kết nối tới json-server', e);
    } finally {
      isSyncing = false;
    }
  }, 1000);
};

// 2. Khởi tạo service
export const initSyncService = () => {
  console.log('🔄 Đang khởi chạy SyncService...');
  
  // Ghi đè hàm setItem
  localStorage.setItem = function(key, value) {
    // Gọi hàm gốc để lưu vào local storage của máy này
    originalSetItem.apply(this, arguments);
    
    // Gửi sự kiện storage để các React Component cập nhật lại UI ngay lập tức
    window.dispatchEvent(new Event('storage'));
    
    // Yêu cầu đồng bộ lên server
    pushToServer();
  };

  // 3. Polling lấy dữ liệu từ server về mỗi POLLING_INTERVAL giây
  setInterval(async () => {
    if (isSyncing) return; // Không lấy về nếu đang chuẩn bị đẩy lên (sẽ bị đè)
    try {
      const res = await fetch(SERVER_URL);
      if (!res.ok) return;
      const remoteState = await res.json();
      const remoteString = JSON.stringify(remoteState);

      // Nếu dữ liệu server khác với dữ liệu hiện tại, nạp đè vào localStorage
      if (remoteString !== lastSyncString && Object.keys(remoteState).length > 0) {
        lastSyncString = remoteString;
        
        Object.keys(remoteState).forEach(key => {
          originalSetItem.call(localStorage, key, remoteState[key]);
        });

        console.log('🔄 Đã nạp dữ liệu mới từ máy khác về localStorage');
        
        // Gửi sự kiện để React render lại màn hình
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      // server down hoặc chưa bật, bỏ qua
    }
  }, POLLING_INTERVAL);
  
  // Nạp lần đầu ngay khi mở trang
  (async () => {
    try {
      const res = await fetch(SERVER_URL);
      if (res.ok) {
        const remoteState = await res.json();
        if (Object.keys(remoteState).length > 0) {
          Object.keys(remoteState).forEach(key => {
            originalSetItem.call(localStorage, key, remoteState[key]);
          });
          lastSyncString = JSON.stringify(remoteState);
          window.dispatchEvent(new Event('storage'));
          console.log('✅ Đã nạp dữ liệu lần đầu từ server');
        } else {
          // Nếu server trống thì push dữ liệu hiện tại lên
          pushToServer();
        }
      }
    } catch (e) {}
  })();
};
