// ════════════════════════════════════════════════════════
//  MỤC 02 — THÊM / SỬA / XOÁ SIZE Ở CẢ HAI LOẠI PRODUCT TYPE
//  ⛔ ĐỎ LÀ ĐÚNG cho tới khi PR-A4 xong.
//
//  Hôm nay: với Product Type lấy từ thư viện, `libSizesOf` dựng lại danh sách
//  size CHỈ theo thư viện → size Seller tự thêm biến mất, tên size bị khoá,
//  và dòng biến thể dư thừa không xoá được. Kèm theo đó, `summarizeSheet` tính
//  avgMargin trên mọi dòng nên dòng rác kéo tụt số liệu cả bảng.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { loadVendorLibraryIndex } from '../vendorLibraryIndex';
import { resolveSheet } from '../resolveSheet';
import { summarizeSheet } from '../pricingEngine';
import { roundTrip } from '../../test/roundTrip';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

let libIndex;
beforeAll(async () => { libIndex = await loadVendorLibraryIndex('happy'); });

const libPT = (sizes) => ({
  id: 'pt_lib', name: 'Football Jersey', phoi: '0', shipMethod: 'eco', customizeInfos: [], sizes,
});

describe('Mục 02 — size do Seller thêm vào Product Type từ thư viện', () => {
  it('không bị mất sau khi resolve lại theo thư viện', () => {
    const sheet = { settings: {}, productTypes: [libPT([
      { id: 'sz_custom', label: '3XL', sizeAdd: '6', itemCost: '10', isLib: false, customize: {} },
    ])] };
    const out = resolveSheet(sheet, libIndex);
    expect(out.productTypes[0].sizes.map((s) => s.label)).toContain('3XL');
  });

  it('giữ nguyên sau save → reload', () => {
    const sheet = { settings: {}, productTypes: [libPT([
      { id: 'sz_custom', label: '3XL', sizeAdd: '6', itemCost: '10', isLib: false, customize: {} },
    ])] };
    const after = roundTrip(sheet, libIndex);
    const added = after.productTypes[0].sizes.find((s) => s.label === '3XL');
    expect(added).toBeTruthy();
    expect(added.sizeAdd).toBe('6');
    expect(added.itemCost).toBe('10');            // giá vốn nhập tay không bị thư viện ghi đè
  });

  it('sửa được tên size do Seller thêm (không bị khoá như dòng thư viện)', () => {
    const sheet = { settings: {}, productTypes: [libPT([
      { id: 'sz_custom', label: 'Size riêng', sizeAdd: '1', isLib: false, customize: {} },
    ])] };
    const out = resolveSheet(sheet, libIndex);
    expect(out.productTypes[0].sizes.find((s) => s.id === 'sz_custom').isLib).toBe(false);
  });
});

describe('Mục 02 — override cục bộ dòng lấy từ thư viện', () => {
  it('override tên và Item Cost thắng giá trị thư viện', () => {
    const sheet = { settings: {}, productTypes: [libPT([
      { id: 'szlib_pt_lib_s', label: 'S', sizeAdd: '2', customize: {}, overrides: { label: 'S (rộng)', itemCost: 9.99 } },
    ])] };
    const out = resolveSheet(sheet, libIndex);
    const s = out.productTypes[0].sizes[0];
    expect(s.label).toBe('S (rộng)');
    expect(s.itemCost).toBe(9.99);
  });

  it('override KHÔNG ghi ngược vào thư viện Vendor', async () => {
    const api = await import('../../services/api');
    const before = JSON.stringify(libIndex);
    const sheet = { settings: {}, productTypes: [libPT([
      { id: 'szlib_pt_lib_s', label: 'S', sizeAdd: '2', customize: {}, overrides: { itemCost: 1 } },
    ])] };
    resolveSheet(sheet, libIndex);
    expect(JSON.stringify(libIndex)).toBe(before);
    expect(api.vendorLibraryApi.save).not.toHaveBeenCalled();
  });

  it('“Khôi phục theo thư viện” bỏ mọi override và size tự thêm', async () => {
    const { restoreFromLibrary } = await import('../resolveSheet');
    const pt = libPT([
      { id: 'szlib_pt_lib_s', label: 'S', sizeAdd: '2', customize: {}, overrides: { itemCost: 1 } },
      { id: 'sz_custom', label: '3XL', sizeAdd: '6', isLib: false, customize: {} },
    ]);
    const restored = restoreFromLibrary(pt, libIndex);
    expect(restored.sizes.map((s) => s.label)).toEqual(['S', 'M', 'L', 'XL', '2XL']);
    expect(restored.sizes.every((s) => !s.overrides)).toBe(true);
  });
});

describe('Mục 02 — dòng bị loại khỏi phần tổng hợp', () => {
  const settings = { price: 9.9, quantity: 1, shipPerItem: 2, shipPerOrder: 0, amzFeePct: 17, importTax: 0.35, couponUsd: 0, couponPct: 0, variableFeePct: 3 };
  const sheet = (excluded) => ({ settings, productTypes: [{
    id: 'pt', name: 'PT', phoi: '0', customizeInfos: [], sizes: [
      { id: 'a', label: 'M', sizeAdd: '5', itemCost: '5', customize: {} },
      { id: 'b', label: 'XS', sizeAdd: '0', itemCost: '5', customize: {}, excluded },
    ],
  }] });

  it('avgMargin bỏ qua dòng excluded', () => {
    const withJunk = summarizeSheet(sheet(false)).avgMargin;
    const excludedOut = summarizeSheet(sheet(true)).avgMargin;
    expect(excludedOut).toBeGreaterThan(withJunk);
    expect(summarizeSheet(sheet(true)).count).toBe(1);
  });

  it('dòng excluded vẫn còn trong file export nhưng có cột đánh dấu', async () => {
    const { buildSheetAoa } = await import('../sheetExport');
    const rows = buildSheetAoa(sheet(true));
    const header = rows[5];
    expect(header).toContain('Loại khỏi tổng hợp');
    expect(rows.filter((r) => r[1] === 'XS')).toHaveLength(1);
  });
});
