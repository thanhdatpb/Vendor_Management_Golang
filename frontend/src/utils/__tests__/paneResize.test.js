// ════════════════════════════════════════════════════════
//  Phép tính khung chia đôi kéo được (utils/paneResize.js).
// ════════════════════════════════════════════════════════
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  PANE_DEFAULT_RATIO, PANE_MIN_BOTTOM_PX, PANE_MIN_TOP_PX,
  clampPaneRatio, paneRatioBounds, ratioFromPointer, readPaneState, writePaneState,
} from '../paneResize';

// Node 22+ có global `localStorage` riêng (chưa bật) che mất bản của jsdom, nên
// trong test không có localStorage thật — dựng bản giả tối thiểu.
const fakeStorage = (initial = {}) => {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  };
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('paneRatioBounds', () => {
  it('quy ngưỡng px tối thiểu của 2 nửa thành biên tỷ lệ', () => {
    const { min, max } = paneRatioBounds(1000);
    expect(min).toBeCloseTo(PANE_MIN_TOP_PX / 1000, 5);
    expect(max).toBeCloseTo((1000 - PANE_MIN_BOTTOM_PX) / 1000, 5);
  });

  it('khung chưa đo được (0 / NaN) → biên an toàn theo tỷ lệ', () => {
    expect(paneRatioBounds(0)).toEqual({ min: 0.15, max: 0.85 });
    expect(paneRatioBounds(NaN)).toEqual({ min: 0.15, max: 0.85 });
  });

  it('khung quá thấp để chứa cả 2 ngưỡng → chia đôi, không trả biên đảo ngược', () => {
    const { min, max } = paneRatioBounds(150);
    expect(min).toBe(0.5);
    expect(max).toBe(0.5);
    expect(min).toBeLessThanOrEqual(max);
  });
});

describe('clampPaneRatio', () => {
  it('kẹp giá trị vào trong biên', () => {
    expect(clampPaneRatio(0.99, 1000)).toBeCloseTo((1000 - PANE_MIN_BOTTOM_PX) / 1000, 5);
    expect(clampPaneRatio(0.01, 1000)).toBeCloseTo(PANE_MIN_TOP_PX / 1000, 5);
    expect(clampPaneRatio(0.4, 1000)).toBeCloseTo(0.4, 5);
  });

  it('giá trị không hợp lệ → rơi về mặc định (đã kẹp)', () => {
    expect(clampPaneRatio(NaN, 1000)).toBeCloseTo(PANE_DEFAULT_RATIO, 5);
    expect(clampPaneRatio(undefined, 1000)).toBeCloseTo(PANE_DEFAULT_RATIO, 5);
  });

  it('tôn trọng ngưỡng px truyền riêng', () => {
    expect(clampPaneRatio(0.05, 1000, { minTopPx: 300 })).toBeCloseTo(0.3, 5);
  });
});

describe('ratioFromPointer', () => {
  it('đổi toạ độ chuột thành tỷ lệ so với khung chứa', () => {
    expect(ratioFromPointer(500, 100, 1000)).toBeCloseTo(0.4, 5);
  });

  it('kéo quá tay vẫn bị kẹp trong biên', () => {
    expect(ratioFromPointer(2000, 100, 1000)).toBeCloseTo((1000 - PANE_MIN_BOTTOM_PX) / 1000, 5);
    expect(ratioFromPointer(0, 100, 1000)).toBeCloseTo(PANE_MIN_TOP_PX / 1000, 5);
  });

  it('khung chưa đo được → null để bên gọi bỏ qua lần kéo đó', () => {
    expect(ratioFromPointer(500, 0, 0)).toBeNull();
  });
});

describe('readPaneState / writePaneState', () => {
  it('ghi rồi đọc lại đúng trạng thái', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    writePaneState('PANE_TEST', { ratio: 0.33, collapsed: true });
    expect(readPaneState('PANE_TEST')).toEqual({ ratio: 0.33, collapsed: true });
  });

  it('storage bị chặn (private mode) → không ném lỗi, dùng mặc định', () => {
    // Trước đây test này trông chờ môi trường KHÔNG có localStorage — đúng với
    // Node 26 cục bộ nhưng sai trên CI Node 24 (jsdom ở đó có storage thật).
    // Dựng hẳn storage luôn ném lỗi để kết quả giống nhau ở mọi Node.
    const blocked = () => { throw new Error('storage bị chặn'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked, clear: blocked });

    expect(() => writePaneState('PANE_TEST_BLOCKED', { ratio: 0.4 })).not.toThrow();
    expect(readPaneState('PANE_TEST_BLOCKED')).toEqual({ ratio: PANE_DEFAULT_RATIO, collapsed: false });
  });

  it('chưa có gì trong storage → mặc định', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(readPaneState('PANE_TEST_EMPTY')).toEqual({ ratio: PANE_DEFAULT_RATIO, collapsed: false });
  });

  it('dữ liệu hỏng hoặc ratio vô lý → mặc định, không ném lỗi', () => {
    vi.stubGlobal('localStorage', fakeStorage({ PANE_TEST_BAD: '{oops' }));
    expect(readPaneState('PANE_TEST_BAD')).toEqual({ ratio: PANE_DEFAULT_RATIO, collapsed: false });

    localStorage.setItem('PANE_TEST_OOR', JSON.stringify({ ratio: 5, collapsed: 'yes' }));
    expect(readPaneState('PANE_TEST_OOR')).toEqual({ ratio: PANE_DEFAULT_RATIO, collapsed: false });
  });
});
