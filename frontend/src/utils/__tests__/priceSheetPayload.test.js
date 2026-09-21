// ════════════════════════════════════════════════════════
//  PAYLOAD POST /price-sheets — hợp đồng giữa client và PriceSheetController.
//  Điều quan trọng nhất ở đây: autosave KHÔNG được mang `history` lên, vì
//  storeVersions() ghi một phiên bản cho mỗi snapshot nhận được — autosave
//  mỗi vài giây kèm history là lịch sử đầy rác trong vài phút (trần 20 bản).
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { buildPriceSheetPayload } from '../priceSheetPayload';

const sheet = {
  id: 'sheet_1', name: 'Pajamas', version: 4,
  settings: { price: '6.99' },
  productTypes: [{ id: 'pt_1', sizes: [] }],
  history: [{ version: 3, savedAt: '2026-09-20T02:00:00.000Z' }],
};

describe('lưu thường (chốt mốc phiên bản)', () => {
  it('giữ nguyên history và gắn expectedVersion', () => {
    const body = buildPriceSheetPayload(sheet);
    expect(body.history).toHaveLength(1);
    expect(body.expectedVersion).toBe(4);
    expect(body.autosave).toBeUndefined();
    expect(body.force).toBeUndefined();
  });

  it('force: true khi người dùng cố ý ghi đè sau cảnh báo 409', () => {
    expect(buildPriceSheetPayload(sheet, { force: true }).force).toBe(true);
  });

  it('bảng chưa có version thì KHÔNG gửi expectedVersion (giữ hành vi cũ của server)', () => {
    const { version, ...noVersion } = sheet;
    expect(buildPriceSheetPayload(noVersion).expectedVersion).toBeUndefined();
  });
});

describe('autosave', () => {
  it('BỎ HẲN history → server không tạo phiên bản mới', () => {
    const body = buildPriceSheetPayload(sheet, { autosave: true });
    expect(body).not.toHaveProperty('history');
    expect(body.autosave).toBe(true);
  });

  it('vẫn gửi expectedVersion — autosave không được phép ghi đè mù', () => {
    const body = buildPriceSheetPayload(sheet, { autosave: true });
    expect(body.expectedVersion).toBe(4);
    expect(body.force).toBeUndefined();
  });

  it('giữ nguyên nội dung bảng (id, settings, productTypes)', () => {
    const body = buildPriceSheetPayload(sheet, { autosave: true });
    expect(body.id).toBe('sheet_1');
    expect(body.settings).toEqual({ price: '6.99' });
    expect(body.productTypes).toHaveLength(1);
  });

  it('không làm hỏng sheet gốc', () => {
    buildPriceSheetPayload(sheet, { autosave: true });
    expect(sheet.history).toHaveLength(1);
  });
});

it('sheet null/undefined không làm vỡ luồng gọi', () => {
  expect(buildPriceSheetPayload(null)).toEqual({});
  expect(buildPriceSheetPayload(undefined, { autosave: true })).toEqual({ autosave: true });
});
