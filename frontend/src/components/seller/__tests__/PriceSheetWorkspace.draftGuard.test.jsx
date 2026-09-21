// ════════════════════════════════════════════════════════
//  CHẶN MẤT DỮ LIỆU KHI THOÁT + KHÔI PHỤC BẢN NHÁP
//
//  Hai lỗ hổng của bản cũ:
//    • `onClose` điều hướng thẳng về danh sách, không hỏi gì — mọi thứ chưa
//      lưu bốc hơi. Overlay ngoài cùng cũng gọi đúng hàm đó.
//    • Không có bản nháp nào ở máy, nên mất mạng lúc đang nhập = mất trắng.
//
//  Nháp KHÔNG bao giờ được tự nạp đè: nó có thể cũ hơn bản người khác vừa lưu
//  — đúng kiểu ghi đè âm thầm mà mục 16 đã chặn ở tầng server.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import PriceSheetWorkspace from '../PriceSheetWorkspace';
import { saveDraft, readDraft, draftKey } from '../../../utils/priceSheetDraft';

vi.mock('../../../services/api', () => ({
  priceSheetApi: { versions: vi.fn(async () => ({ data: [] })) },
  vendorLibraryApi: { get: vi.fn(async () => ({ data: [] })) },
}));

// Node 22+ có global `localStorage` riêng (chưa bật) che mất bản của jsdom.
const fakeStorage = (initial = {}) => {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
  };
};

const SHEET = {
  id: 'sheet_1', name: 'Pajamas', project: 'happy', version: 4,
  settings: {
    price: '6.99', quantity: 1, shipPerOrder: '0', shipPerItem: '4.99',
    couponUsd: '0', couponPct: '5', variableFeePct: '0', amzFeePct: '17', importTax: '0',
  },
  productTypes: [{
    id: 'pt_1', name: 'Satin Pajamas', shown: true, customizeInfos: [],
    sizes: [{ id: 'sz_1', label: 'S', sizeAdd: '0', itemCost: '20.3', customize: {} }],
  }],
  history: [],
  historyCount: 0,
};

const offline = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

const setup = (props = {}) => {
  const onSave = props.onSave || vi.fn(async (sheet) => ({ ...sheet, version: (sheet.version || 0) + 1 }));
  const onClose = props.onClose || vi.fn();
  render(<PriceSheetWorkspace sheet={props.sheet || SHEET} onSave={onSave} onClose={onClose} showToast={vi.fn()} />);
  return { onSave, onClose };
};

const nameInput = () => screen.getByLabelText('Tên bảng tính giá');
// Footer có nhãn riêng 'Đóng bảng' — nút ✕ ở header cũng tên 'Đóng'.
const closeButton = () => screen.getByRole('button', { name: 'Đóng bảng' });
const rename = (value) => act(() => { fireEvent.change(nameInput(), { target: { value } }); });
const tick = async (ms = 3000) => {  // > AUTOSAVE_DELAY (2,5s)
  await act(async () => {
    vi.advanceTimersByTime(ms);
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
};
const click = async (el) => { await act(async () => { fireEvent.click(el); await Promise.resolve(); }); };

const seedDraft = (over = {}) => saveDraft('sheet_1', {
  baseVersion: 4, savedAt: '2026-09-21T03:00:00.000Z',
  name: 'Pajamas bản nháp', settings: SHEET.settings, productTypes: SHEET.productTypes,
  ...over,
});

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  vi.useFakeTimers();
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('đóng bảng', () => {
  it('nội dung đã lên server → đóng thẳng, không hỏi gì', async () => {
    const { onClose } = setup();
    rename('Pajamas v2');
    await tick(); // autosave chạy xong

    await click(closeButton());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Còn thay đổi chưa lưu lên server/)).not.toBeInTheDocument();
  });

  it('chưa lên được server → HỎI trước, không đóng ngay', async () => {
    const onSave = vi.fn().mockRejectedValue(offline());
    const { onClose } = setup({ onSave });
    rename('Pajamas v2');
    await tick();

    await click(closeButton());

    expect(screen.getByText(/Còn thay đổi chưa lưu lên server/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('"Thoát, giữ bản nháp ở máy" → đóng và GIỮ nháp để mở lại còn khôi phục', async () => {
    const onSave = vi.fn().mockRejectedValue(offline());
    const { onClose } = setup({ onSave });
    rename('Pajamas v2');
    await tick();
    await click(closeButton());

    await click(screen.getByRole('button', { name: /Thoát, giữ bản nháp ở máy/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(readDraft('sheet_1').name).toBe('Pajamas v2');
  });

  it('"Ở lại" → không đóng, không mất gì', async () => {
    const onSave = vi.fn().mockRejectedValue(offline());
    const { onClose } = setup({ onSave });
    rename('Pajamas v2');
    await tick();
    await click(closeButton());

    await click(screen.getByRole('button', { name: 'Ở lại' }));

    expect(onClose).not.toHaveBeenCalled();
    expect(nameInput()).toHaveValue('Pajamas v2');
  });

  it('"Lưu rồi thoát" → thử ghi lại ngay lần nữa rồi mới đóng', async () => {
    const onSave = vi.fn()
      .mockRejectedValueOnce(offline())
      .mockImplementation(async (sheet) => sheet);
    const { onClose } = setup({ onSave });
    rename('Pajamas v2');
    await tick();
    await click(closeButton());
    onSave.mockClear();

    await click(screen.getByRole('button', { name: /Lưu rồi thoát/ }));
    await tick(0);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][1]).toEqual({ autosave: true });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(draftKey('sheet_1'))).toBeNull(); // đã lên server
  });
});

describe('khôi phục bản nháp khi mở lại bảng', () => {
  it('nháp khác bản trên server → hiện banner, KHÔNG tự nạp đè', async () => {
    seedDraft();
    setup();
    await tick(0);

    expect(screen.getByText(/Có bản nháp chưa lưu ở máy này/)).toBeInTheDocument();
    expect(nameInput()).toHaveValue('Pajamas'); // vẫn là bản server cho tới khi người dùng chọn
  });

  it('bấm Khôi phục → nạp nội dung nháp rồi tự lưu lên server', async () => {
    seedDraft();
    const { onSave } = setup();
    await tick(0);

    await click(screen.getByRole('button', { name: /Khôi phục bản nháp/ }));
    expect(nameInput()).toHaveValue('Pajamas bản nháp');

    await tick();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].name).toBe('Pajamas bản nháp');
  });

  it('bấm Bỏ nháp → xoá khoá ở máy, banner biến mất', async () => {
    seedDraft();
    setup();
    await tick(0);

    await click(screen.getByRole('button', { name: 'Bỏ nháp' }));

    expect(localStorage.getItem(draftKey('sheet_1'))).toBeNull();
    expect(screen.queryByText(/Có bản nháp chưa lưu ở máy này/)).not.toBeInTheDocument();
  });

  it('nháp trùng y hệt bản server thì không làm phiền ai', async () => {
    seedDraft({ name: SHEET.name });
    setup();
    await tick(0);

    expect(screen.queryByText(/Có bản nháp chưa lưu ở máy này/)).not.toBeInTheDocument();
  });

  it('nháp dựa trên version CŨ hơn server → cảnh báo ghi đè bằng nội dung cũ', async () => {
    seedDraft({ baseVersion: 2, savedAt: '2026-09-19T03:00:00.000Z', name: 'Pajamas bản nháp cũ' });
    setup();
    await tick(0);

    expect(screen.getByText(/ghi đè bằng nội dung cũ hơn/)).toBeInTheDocument();
  });
});
