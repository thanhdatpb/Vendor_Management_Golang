// ════════════════════════════════════════════════════════
//  FIX: PT chưa gắn `libRef` (bảng cũ, resolve theo tên) từng bị giới hạn
//  đúng bằng bộ size của vendor GẶP TRƯỚC trong thư viện — size chỉ vendor
//  khác mới có thì biến mất khỏi bảng dù thư viện có đủ.
//
//  Ca lỗi thật: "Canvas 1,5"" của project creative — vendor US3 có 8 size,
//  nhưng vendor gặp trước (ít size hơn) làm bảng chỉ hiện 1 size. Test dưới
//  dựng lại đúng hình dạng đó bằng fixture riêng (không đụng fixture chung).
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

const fixture = [{
  filename: 'HappyC_VendorLibrary_p.creative_2026-06.xlsx',
  generalInfo: [],
  pricing: [
    // Vendor gặp trước — chỉ có 1 size (giống ca lỗi thật)
    { kyHieu: 'US1', productType: 'Canvas 1,5"', size: '8x12"', pricing1: 7.56 },
    // Vendor gặp sau — 3 size, trong đó 8x12" trùng tên với US1
    { kyHieu: 'US3', productType: 'Canvas 1,5"', size: '8x12"', pricing1: 99.99 },
    { kyHieu: 'US3', productType: 'Canvas 1,5"', size: '12x16"', pricing1: 8.30 },
    { kyHieu: 'US3', productType: 'Canvas 1,5"', size: '16x20"', pricing1: 9.10 },
  ],
}];

describe('buildLegacyView — gộp size từ mọi vendor cùng tên phôi (đường lùi, PT không có libRef)', () => {
  beforeEach(async () => {
    const { __setLibraryFixture } = await import('../../test/apiMock.js');
    const { resetVendorLibraryIndexCache } = await import('../vendorLibraryIndex');
    __setLibraryFixture(fixture);
    resetVendorLibraryIndexCache();
  });

  it('entry theo tên gộp đủ size từ mọi vendor, không chỉ vendor gặp trước', async () => {
    const { loadVendorLibraryIndex, findLibraryEntry } = await import('../vendorLibraryIndex');
    const index = await loadVendorLibraryIndex('creative');
    const entry = findLibraryEntry(index, 'Canvas 1,5"');
    expect(entry.sizes).toEqual(['8x12"', '12x16"', '16x20"']);
  });

  it('size trùng tên giữ giá của vendor gặp trước — không âm thầm đổi số đã tính', async () => {
    const { loadVendorLibraryIndex, findLibraryEntry, getLibraryItemCost } = await import('../vendorLibraryIndex');
    const index = await loadVendorLibraryIndex('creative');
    const entry = findLibraryEntry(index, 'Canvas 1,5"');
    expect(getLibraryItemCost(entry, '8x12"')).toBe(7.56); // US1 (gặp trước), không phải 99.99 của US3
  });

  it('size chỉ vendor sau mới có vẫn đọc được giá đúng của vendor đó', async () => {
    const { loadVendorLibraryIndex, findLibraryEntry, getLibraryItemCost } = await import('../vendorLibraryIndex');
    const index = await loadVendorLibraryIndex('creative');
    const entry = findLibraryEntry(index, 'Canvas 1,5"');
    expect(getLibraryItemCost(entry, '12x16"')).toBe(8.30);
    expect(getLibraryItemCost(entry, '16x20"')).toBe(9.10);
  });

  it('resolveSheet (PT không có libRef) cũng thấy đủ 3 size', async () => {
    const { loadVendorLibraryIndex } = await import('../vendorLibraryIndex');
    const { resolveSheet } = await import('../resolveSheet');
    const index = await loadVendorLibraryIndex('creative');
    const sheet = { settings: {}, productTypes: [{
      id: 'pt1', name: 'Canvas 1,5"', phoi: '0', shipMethod: 'eco', customizeInfos: [], sizes: [],
    }] };
    const out = resolveSheet(sheet, index);
    expect(out.productTypes[0].sizes.map((s) => s.label)).toEqual(['8x12"', '12x16"', '16x20"']);
  });
});
