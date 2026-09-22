// ════════════════════════════════════════════════════════
//  MỤC 03 + 04 — ĐỊNH DANH VENDOR THEO RECORD
//  ⛔ ĐỎ LÀ ĐÚNG cho tới khi PR-A3 xong.
//
//  Hôm nay: vendorLibraryIndex gom theo TÊN Product Type → hai vendor cùng tên
//  phôi bị gộp làm một, vendor gặp trước thắng → Item Cost sai → Profit sai mà
//  không ai thấy. Fixture đã có sẵn ca lỗi: `Football Jersey` của VN3 (P1 8.20)
//  và của VN7 (P1 7.40).
//
//  Khi PR-A3 merge: bỏ hậu tố `.pending` khỏi tên file.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { loadVendorLibraryIndex } from '../vendorLibraryIndex';
import { computeSizeRow } from '../pricingEngine';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

let libIndex;
beforeAll(async () => { libIndex = await loadVendorLibraryIndex('happy'); });

describe('Mục 03 — nhiều Vendor cùng tên phôi cùng tồn tại', () => {
  it('listLibraryRecords trả 2 record riêng cho cùng một tên phôi', async () => {
    const { listLibraryRecords } = await import('../vendorLibraryIndex');
    const records = listLibraryRecords(libIndex, { q: 'Football Jersey' });
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.vendorCode).sort()).toEqual(['VN3', 'VN7']);
    expect(new Set(records.map((r) => r.recordKey)).size).toBe(2);
  });

  it('recordKey gồm file nguồn + mã vendor + tên product type', async () => {
    const { listLibraryRecords } = await import('../vendorLibraryIndex');
    const [rec] = listLibraryRecords(libIndex, { vendor: 'VN7' });
    expect(rec.recordKey).toContain('VN7');
    expect(rec.recordKey).toContain('football jersey');
    expect(rec.filename).toContain('p.happy');
  });

  it('findLibraryRecord lấy đúng record theo recordKey, không lấy vendor gặp trước', async () => {
    const { listLibraryRecords, findLibraryRecord, getLibraryItemCost } = await import('../vendorLibraryIndex');
    const vn7 = listLibraryRecords(libIndex, { vendor: 'VN7' })[0];
    const rec = findLibraryRecord(libIndex, vn7.recordKey);
    expect(getLibraryItemCost(rec, 'S')).toBe(7.4);      // KHÔNG phải 8.2 của VN3
  });

  it('mỗi record giữ nguyên bộ size và giá vốn của chính vendor đó', async () => {
    const { listLibraryRecords, getLibraryItemCost } = await import('../vendorLibraryIndex');
    const [a, b] = listLibraryRecords(libIndex, { q: 'Football Jersey' })
      .sort((x, y) => x.vendorCode.localeCompare(y.vendorCode));
    expect(getLibraryItemCost(a, 'XL')).toBe(9.1);       // VN3
    expect(getLibraryItemCost(b, 'XL')).toBe(8.3);       // VN7
  });
});

describe('Mục 03 — bảng giá tham chiếu tới record cụ thể', () => {
  it('resolveSheet ưu tiên libRef.recordKey thay vì tra theo tên', async () => {
    const { listLibraryRecords } = await import('../vendorLibraryIndex');
    const { resolveSheet } = await import('../resolveSheet');
    const vn7 = listLibraryRecords(libIndex, { vendor: 'VN7' })[0];

    const sheet = { settings: {}, productTypes: [{
      id: 'pt1', name: 'Football Jersey', phoi: '0', shipMethod: 'eco',
      libRef: { recordKey: vn7.recordKey, vendorCode: 'VN7' },
      customizeInfos: [], sizes: [],
    }] };
    const out = resolveSheet(sheet, libIndex);
    // Item Cost = Total (Fulfill) Economy của VN7 (12.00) — KHÔNG phải 12.30 của VN3.
    expect(out.productTypes[0].sizes[0].itemCost).toBe(12);
    expect(out.productTypes[0].sizes[0].p1).toBe(7.4);
    expect(out.productTypes[0].vendorCode).toBe('VN7');
  });

  it('record nguồn bị xoá khỏi thư viện → dùng costSnapshot và cảnh báo, KHÔNG âm thầm đổi số', async () => {
    const { resolveSheet } = await import('../resolveSheet');
    const sheet = { settings: {}, productTypes: [{
      id: 'pt1', name: 'Football Jersey', phoi: '0', shipMethod: 'eco',
      libRef: { recordKey: 'file-da-xoa::VN9::football jersey', vendorCode: 'VN9' },
      costSnapshot: { S: { itemCost: 7.9, shipCostItem: 1.2, totalShipCost: 4.4 } },
      customizeInfos: [], sizes: [{ id: 'sz1', label: 'S', sizeAdd: '1', customize: {} }],
    }] };
    const out = resolveSheet(sheet, libIndex);
    expect(out.productTypes[0].warning).toBe('record-missing');
    expect(out.productTypes[0].sizes[0].itemCost).toBe(7.9);
  });

  it('bảng CŨ chưa có libRef vẫn mở và tính đúng như trước (tương thích ngược)', async () => {
    const { resolveSheet } = await import('../resolveSheet');
    const legacy = { settings: {}, productTypes: [{
      id: 'pt1', name: 'Football Jersey', phoi: '0', shipMethod: 'eco', customizeInfos: [], sizes: [],
    }] };
    const out = resolveSheet(legacy, libIndex);
    // fallback theo tên: vendor đầu tiên (VN3) — Item Cost = Total (Fulfill) Economy.
    expect(out.productTypes[0].sizes[0].itemCost).toBe(12.3);
    // Tổng giá vốn giữ nguyên như công thức cũ P1 + Price Ship = 8.2 + 4.1.
    const { computeSizeRow } = await import('../pricingEngine');
    const r = computeSizeRow(legacy.settings, out.productTypes[0], out.productTypes[0].sizes[0]);
    expect(r.totalCost).toBeCloseTo(8.2 + 4.1, 10);
  });
});

describe('Mục 04 — thêm trùng Product Type trong cùng một bảng', () => {
  it('hai block cùng tên phôi khác vendor tính ra Profit khác nhau', async () => {
    const { listLibraryRecords } = await import('../vendorLibraryIndex');
    const { resolveSheet } = await import('../resolveSheet');
    const [vn3] = listLibraryRecords(libIndex, { vendor: 'VN3' });
    const [vn7] = listLibraryRecords(libIndex, { vendor: 'VN7' });

    const settings = { price: 10, quantity: 1, shipPerItem: 2, shipPerOrder: 0, amzFeePct: 17, importTax: 0, couponUsd: 0, couponPct: 0, variableFeePct: 0 };
    const mk = (id, rec) => ({ id, name: 'Football Jersey', phoi: '0', shipMethod: 'eco', customizeInfos: [], sizes: [], libRef: { recordKey: rec.recordKey } });
    const out = resolveSheet({ settings, productTypes: [mk('ptA', vn3), mk('ptB', vn7)] }, libIndex);

    const a = computeSizeRow(settings, out.productTypes[0], out.productTypes[0].sizes[0]);
    const b = computeSizeRow(settings, out.productTypes[1], out.productTypes[1].sizes[0]);
    expect(a.profit).not.toBeCloseTo(b.profit, 6);
  });

  it('id dòng size vẫn duy nhất khi hai block trùng tên', async () => {
    const { listLibraryRecords } = await import('../vendorLibraryIndex');
    const { resolveSheet } = await import('../resolveSheet');
    const [vn3] = listLibraryRecords(libIndex, { vendor: 'VN3' });
    const mk = (id) => ({ id, name: 'Football Jersey', phoi: '0', shipMethod: 'eco', customizeInfos: [], sizes: [], libRef: { recordKey: vn3.recordKey } });
    const out = resolveSheet({ settings: {}, productTypes: [mk('ptA'), mk('ptB')] }, libIndex);

    const ids = out.productTypes.flatMap((pt) => pt.sizes.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
