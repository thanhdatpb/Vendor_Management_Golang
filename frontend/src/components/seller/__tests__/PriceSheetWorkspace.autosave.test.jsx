// ════════════════════════════════════════════════════════
//  TỰ LƯU BẢNG TÍNH GIÁ — Seller không phải bấm Lưu mới giữ được công.
//
//  Trước bản này mọi thao tác chỉ nằm trong React state: thoát ra là mất hết,
//  nên Seller lưu thủ công liên tục và một bảng đẻ ra hàng chục phiên bản
//  (ảnh chụp thực tế: v17). Hai hành vi được khoá lại ở đây:
//    1. gõ xong là nội dung tự lên server, KHÔNG tạo phiên bản;
//    2. nút "Lưu bảng tính giá" chỉ còn là nút CHỐT MỐC, và tắt đi khi nội
//       dung chưa đổi so với mốc gần nhất.
//
//  Dùng `fireEvent` + `act` chứ không dùng userEvent: userEvent chờ timer nội
//  bộ của nó, mà ở đây đồng hồ là đồ giả (phải giả thì mới nhảy qua được
//  debounce 1,5s) → test treo tới lúc timeout. Cùng kiểu với
//  library/__tests__/LibraryCopyLinkButton.test.jsx.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import PriceSheetWorkspace from '../PriceSheetWorkspace';
import { readDraft, draftKey } from '../../../utils/priceSheetDraft';

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
  history: [{ version: 4, savedAt: '2026-09-20T02:00:00.000Z' }],
  historyCount: 4,
};

const setup = (props = {}) => {
  const onSave = props.onSave || vi.fn(async (sheet) => ({ ...sheet, version: (sheet.version || 0) + 1 }));
  const onClose = props.onClose || vi.fn();
  render(<PriceSheetWorkspace sheet={SHEET} onSave={onSave} onClose={onClose} showToast={vi.fn()} />);
  return { onSave, onClose };
};

const nameInput = () => screen.getByLabelText('Tên bảng tính giá');
const saveButton = () => screen.getByRole('button', { name: /Lưu bảng tính giá/ });
const status = () => screen.getByTestId('autosave-status');

/** Sửa tên bảng — thao tác rẻ nhất để làm bảng "có thay đổi". */
const rename = (value) => act(() => { fireEvent.change(nameInput(), { target: { value } }); });

/** Đẩy đồng hồ qua mốc debounce rồi cho promise chạy hết. */
const tick = async (ms = 3000) => {  // > AUTOSAVE_DELAY (2,5s)
  await act(async () => {
    vi.advanceTimersByTime(ms);
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
};

const click = async (el) => { await act(async () => { fireEvent.click(el); await Promise.resolve(); }); };

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  vi.useFakeTimers();
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('tự lưu lên server', () => {
  it('sửa xong là tự lưu, và lượt ghi mang cờ autosave', async () => {
    const { onSave } = setup();
    rename('Pajamas v2');
    expect(onSave).not.toHaveBeenCalled(); // còn trong khoảng debounce

    await tick();

    expect(onSave).toHaveBeenCalledTimes(1);
    const [payload, opts] = onSave.mock.calls[0];
    // Cờ `autosave` là thứ loại `history` khỏi body ở tầng payload
    // (utils/priceSheetPayload) → server KHÔNG tạo phiên bản mới.
    expect(opts).toEqual({ autosave: true });
    expect(payload.name).toBe('Pajamas v2');
    expect(status()).toHaveTextContent(/Đã tự lưu lúc/);
  });

  it('mở bảng mà không sửa gì thì không ghi gì lên server', async () => {
    const { onSave } = setup();
    await tick(30000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sửa nhiều lần liên tiếp chỉ tốn MỘT lượt ghi, mang nội dung cuối cùng', async () => {
    const { onSave } = setup();
    rename('A');
    await tick(500);
    rename('AB');
    await tick(500);
    rename('ABC');
    await tick();

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].name).toBe('ABC');
  });

  it('gõ liên tục vẫn bị trần 20s kéo đi ghi, không chờ tới lúc ngừng tay', async () => {
    const { onSave } = setup();
    // Mỗi 2 giây sửa một lần: luôn ở trong khoảng debounce, chỉ trần maxWait
    // mới kéo được lượt ghi đầu tiên ra.
    for (let i = 0; i < 12; i++) {
      rename(`Pajamas ${i}`);
      await tick(2000); // luôn < debounce 2,5s
    }
    expect(onSave).toHaveBeenCalled();
  });

  it('ghi nháp ở máy ngay khi sửa, và xoá nháp sau khi server nhận', async () => {
    setup();
    rename('PajamasX');

    const draft = readDraft('sheet_1');
    expect(draft.name).toBe('PajamasX');
    expect(draft.baseVersion).toBe(4);

    await tick();
    expect(localStorage.getItem(draftKey('sheet_1'))).toBeNull();
  });
});

describe('nút Lưu = chốt mốc phiên bản', () => {
  it('mới mở bảng thì nút tắt — không có mốc rỗng nào được tạo', async () => {
    setup();
    await tick(0); // để lượt nạp thư viện vendor lắng xuống trong act()
    expect(saveButton()).toBeDisabled();
  });

  it('bấm Lưu gửi kèm history dài thêm một bản', async () => {
    const { onSave } = setup();
    rename('Pajamas!');
    await tick();
    onSave.mockClear();

    await click(saveButton());

    expect(onSave).toHaveBeenCalledTimes(1);
    const [payload, opts] = onSave.mock.calls[0];
    expect(opts).toEqual({ force: false });
    expect(payload.history).toHaveLength(SHEET.history.length + 1);
    expect(payload.history[0].version).toBe(5); // historyCount + 1
  });

  it('chốt mốc xong nút tắt lại — bấm nhiều lần không ra nhiều bản giống nhau', async () => {
    const { onSave } = setup();
    rename('Pajamas!');
    await tick();
    await click(saveButton());

    expect(saveButton()).toBeDisabled();
    onSave.mockClear();
    await tick(30000);
    expect(onSave).not.toHaveBeenCalled(); // không có lượt ghi thừa nào
  });

  it('sửa tiếp sau khi chốt mốc thì nút sáng lại', async () => {
    setup();
    rename('Pajamas!');
    await tick();
    await click(saveButton());
    expect(saveButton()).toBeDisabled();

    rename('Pajamas!?');
    await tick(0);
    expect(saveButton()).toBeEnabled();
  });
});

describe('xung đột phiên bản khi đang tự lưu', () => {
  const conflictError = () => Object.assign(new Error('409'), {
    response: {
      status: 409,
      data: { updatedBy: 'Huyen Vo', updatedAt: '2026-09-21T02:00:00.000Z', currentVersion: 9, current: null },
    },
  });

  it('409 → hiện hộp thoại và DỪNG tự lưu, không âm thầm ghi đè', async () => {
    const onSave = vi.fn().mockRejectedValue(conflictError());
    setup({ onSave });

    rename('Pajamas A');
    await tick();

    expect(screen.getByText(/vừa được người khác cập nhật/)).toBeInTheDocument();
    // Tên người kia xuất hiện ở cả câu dẫn lẫn phần giải thích nút `Ghi đè`.
    expect(screen.getAllByText(/Huyen Vo/).length).toBeGreaterThan(0);
    expect(onSave).toHaveBeenCalledTimes(1);

    // Sửa tiếp: không được bắn thêm lượt ghi nào nữa cho tới khi người dùng chọn.
    rename('Pajamas ABCD');
    await tick(60000);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(status()).toHaveTextContent(/xung đột/i);
  });
});

describe('mất mạng', () => {
  it('lỗi mạng → báo còn bản nháp ở máy, rồi tự thử lại', async () => {
    const onSave = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }))
      .mockImplementation(async (sheet) => sheet);
    setup({ onSave });

    rename('Pajamas A');
    await tick();

    expect(status()).toHaveTextContent(/Chưa lưu được/);
    expect(readDraft('sheet_1').name).toBe('Pajamas A'); // nháp vẫn còn

    await tick(5000); // hết backoff → thử lại
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(status()).toHaveTextContent(/Đã tự lưu lúc/);
  });
});
