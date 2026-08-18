// ════════════════════════════════════════════════════════
//  MỤC 16 — Cập nhật realtime, người dùng không phải F5
//
//  Mỗi test dưới đây là một gạch đầu dòng trong nhánh "Mục tiêu đạt được"
//  của mục 16. Viết TRƯỚC khi sửa code — đỏ ở đây nghĩa là tính năng chưa có.
//  Khi PR hoàn thành: đổi tên file bỏ hậu tố `.pending` để nó thành cổng chặn
//  merge của `npm test`.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Echo/Pusher không được kết nối thật trong test. Mock ở tầng thư viện để
// kiểm được đúng hành vi đăng ký kênh mà không mở socket nào.
const listeners = new Map();
const channelSpy = vi.fn();
const stopListeningSpy = vi.fn();

vi.mock('laravel-echo', () => ({
  default: class EchoMock {
    channel(name) {
      channelSpy(name);
      return {
        listen: (event, cb) => {
          listeners.set(`${name}::${event}`, cb);
          return this;
        },
        stopListening: (event) => {
          stopListeningSpy(`${name}::${event}`);
          listeners.delete(`${name}::${event}`);
          return this;
        },
      };
    }
  },
}));
vi.mock('pusher-js', () => ({ default: class PusherMock {} }));

/** Bắn một event như thể Pusher vừa đẩy xuống. */
const emit = (channel, event, payload) => {
  const cb = listeners.get(`${channel}::${event}`);
  if (!cb) throw new Error(`Chưa có ai lắng nghe ${channel}::${event}`);
  cb(payload);
};

beforeEach(() => {
  listeners.clear();
  channelSpy.mockClear();
  stopListeningSpy.mockClear();
  vi.resetModules();
  vi.stubEnv('VITE_PUSHER_APP_KEY', 'test-key');
  vi.stubEnv('VITE_PUSHER_APP_CLUSTER', 'ap1');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('mục 16 — bảng tính giá tự cập nhật, không cần F5', () => {
  it('có kênh riêng theo project để không nhận nhầm thay đổi của project khác', async () => {
    const { subscribePriceSheetChanges } = await import('../echo');

    subscribePriceSheetChanges('happy', () => {});

    expect(channelSpy).toHaveBeenCalledWith('price-sheets.happy');
  });

  it('gọi callback khi có bảng giá vừa được người khác lưu', async () => {
    const { subscribePriceSheetChanges } = await import('../echo');
    const onChange = vi.fn();

    subscribePriceSheetChanges('happy', onChange);
    emit('price-sheets.happy', '.PriceSheetChanged', {
      id: 'sheet_abc', version: 3, updatedBy: 'Trang',
    });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sheet_abc', version: 3, updatedBy: 'Trang' })
    );
  });

  it('huỷ đăng ký khi component unmount — không rò listener', async () => {
    const { subscribePriceSheetChanges } = await import('../echo');

    const unsubscribe = subscribePriceSheetChanges('happy', () => {});
    unsubscribe();

    expect(stopListeningSpy).toHaveBeenCalledWith('price-sheets.happy::.PriceSheetChanged');
  });

  it('payload chỉ mang tín hiệu, KHÔNG mang nội dung bảng giá', async () => {
    // Kênh Pusher là public — nội dung thật phải tải lại qua API có Bearer
    // token, đúng mẫu bảo mật của NotificationCreated đã có sẵn.
    const { subscribePriceSheetChanges } = await import('../echo');
    let received = null;

    subscribePriceSheetChanges('happy', (e) => { received = e; });
    emit('price-sheets.happy', '.PriceSheetChanged', {
      id: 'sheet_abc', version: 3, updatedBy: 'Trang',
    });

    expect(received).not.toHaveProperty('data');
    expect(received).not.toHaveProperty('productTypes');
    expect(received).not.toHaveProperty('settings');
  });
});

describe('mục 16 — thư viện Vendor tự cập nhật sau import', () => {
  it('đăng ký được kênh thư viện', async () => {
    const { subscribeVendorLibraryChanges } = await import('../echo');

    subscribeVendorLibraryChanges(() => {});

    expect(channelSpy).toHaveBeenCalledWith('vendor-library');
  });

  it('gọi callback khi thư viện vừa bị ghi', async () => {
    const { subscribeVendorLibraryChanges } = await import('../echo');
    const onChange = vi.fn();

    subscribeVendorLibraryChanges(onChange);
    emit('vendor-library', '.VendorLibraryChanged', { updatedAt: '2026-08-13T10:00:00Z' });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ updatedAt: expect.any(String) })
    );
  });
});

describe('mục 16 — realtime không được chết âm thầm', () => {
  it('báo trạng thái CHƯA CẤU HÌNH khi thiếu key Pusher', async () => {
    // Bundle được build sẵn rồi commit; build từ máy thiếu .env sẽ đẩy lên
    // production bản không có realtime. Phải hỏi được trạng thái để hiện chỉ
    // báo trên giao diện, thay vì chỉ một dòng console.warn không ai thấy.
    vi.stubEnv('VITE_PUSHER_APP_KEY', '');
    vi.stubEnv('VITE_PUSHER_APP_CLUSTER', '');
    vi.resetModules();

    const { getRealtimeStatus } = await import('../echo');

    expect(getRealtimeStatus()).toBe('unconfigured');
  });

  it('báo trạng thái đã cấu hình khi có key', async () => {
    const { getRealtimeStatus } = await import('../echo');

    expect(getRealtimeStatus()).not.toBe('unconfigured');
  });

  it('subscribe khi chưa cấu hình vẫn trả hàm huỷ, không ném lỗi', async () => {
    vi.stubEnv('VITE_PUSHER_APP_KEY', '');
    vi.resetModules();

    const { subscribePriceSheetChanges, subscribeVendorLibraryChanges } = await import('../echo');

    expect(() => subscribePriceSheetChanges('happy', () => {})()).not.toThrow();
    expect(() => subscribeVendorLibraryChanges(() => {})()).not.toThrow();
  });
});
