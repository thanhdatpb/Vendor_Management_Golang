// ════════════════════════════════════════════════════════
//  MỞ BẢNG TÍNH GIÁ CÓ SẴN sau bản chỉnh Item Cost = Total (Fulfill) (2026-09)
//
//  Bảng lưu TRƯỚC bản chỉnh: dòng thư viện mang Item Cost = P1 và Price Ship
//  cộng riêng. Mở lại phải:
//    • hiện Item Cost = Total (Fulfill) tương ứng của thư viện;
//    • giữ nguyên Profit — chỉ đổi cách hiển thị giá vốn, không đổi tiền;
//    • KHÔNG tự ghi gì lên server khi Seller chưa sửa gì.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import legacySheet from '../../../test/fixtures/legacySheet.json';
import PriceSheetWorkspace from '../PriceSheetWorkspace';
import { computeSizeRow, usd } from '../../../utils/pricingEngine';

vi.mock('../../../services/api', async () => {
  const mock = await import('../../../test/apiMock.js');
  return { ...mock, priceSheetApi: { ...mock.priceSheetApi, versions: vi.fn(async () => ({ data: [] })) } };
});

// Node 22+ có global `localStorage` riêng (chưa bật) che mất bản của jsdom.
const fakeStorage = () => {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
  };
};

// Giá Economy của VN3 — Football Jersey trong fixture thư viện (P1, Price Ship, Ship Item 2, Total).
const ECO = {
  S: [8.2, 4.1, 1.1, 12.3], M: [8.2, 4.1, 1.1, 12.3], L: [8.6, 4.1, 1.1, 12.7],
  XL: [9.1, 4.3, 1.2, 13.4], '2XL': [9.6, 4.3, 1.2, 13.9],
};

// Bảng đúng như server đang giữ: bản ĐÃ resolve theo luật cũ (Item Cost = P1).
const SAVED = {
  ...legacySheet, version: 7,
  productTypes: legacySheet.productTypes.map((pt, i) => (i !== 0 ? pt : {
    ...pt,
    sizes: pt.sizes.map((sz) => {
      const [p1, ship, item2] = ECO[sz.label];
      return { ...sz, isLib: true, libLabel: sz.label, itemCost: p1, totalShipCost: ship, shipCostItem: item2 };
    }),
  })),
};

const flush = async (ms = 0) => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    for (let i = 0; i < 20; i++) await Promise.resolve();
  });
};

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  vi.useFakeTimers();
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe('mở bảng tính giá có sẵn', () => {
  it('Item Cost hiện Total (Fulfill), Profit giữ nguyên, không tự ghi server', async () => {
    const onSave = vi.fn(async (sheet) => ({ ...sheet, version: (sheet.version || 0) + 1 }));
    render(<PriceSheetWorkspace sheet={SAVED} onSave={onSave} onClose={vi.fn()} showToast={vi.fn()} />);
    await flush();

    // Giá vốn đã gồm ship: Total (Fulfill) Economy thay vì P1.
    Object.entries(ECO).forEach(([label, [, , , total]]) => {
      expect(screen.getByLabelText(`Item cost — size ${label}`)).toHaveValue(total);
    });
    // Phôi có Total ở 3 phương thức → bộ chọn chỉ gồm 3 cái đó, giữ Economy Seller đã chọn.
    expect(screen.getByRole('button', { name: /^Economy\$12\.30/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/Chọn 1 trong/)).not.toBeInTheDocument();

    // Profit của từng size y hệt số bảng đang hiển thị trước bản chỉnh.
    const libPt = SAVED.productTypes[0];
    libPt.sizes.forEach((sz) => {
      const before = computeSizeRow(SAVED.settings, libPt, sz);
      expect(screen.getAllByText(usd(before.profitAfter)).length).toBeGreaterThan(0);
    });

    // Không sửa gì → không có lượt ghi nào, kể cả sau khi quá mốc tự lưu.
    await flush(30000);
    expect(onSave).not.toHaveBeenCalled();
  });
});
