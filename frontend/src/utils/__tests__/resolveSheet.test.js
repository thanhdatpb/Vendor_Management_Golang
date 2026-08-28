// ════════════════════════════════════════════════════════
//  RESOLVE SHEET — nơi bảng tính giá bind với thư viện Vendor.
//  Tách khỏi component theo T0 nên test được mà không render React.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { loadVendorLibraryIndex } from '../vendorLibraryIndex';
import { resolveSheet, libSizesOf, libSizeId, baseSizesOf, restoreFromLibrary } from '../resolveSheet';
import { findLibraryEntry } from '../vendorLibraryIndex';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

let libIndex;
beforeAll(async () => { libIndex = await loadVendorLibraryIndex('happy'); });

const libPT = (over = {}) => ({
  id: 'pt_lib', name: 'Football Jersey', phoi: '0', shown: true, shipMethod: 'eco',
  customizeInfos: [{ id: 'ci1', name: 'Add Custom Face' }],
  sizes: [{ id: 'szlib_pt_lib_s', label: 'S', sizeAdd: '4.5', itemCost: '', customize: { ci1: '3' } }],
  ...over,
});
const manualPT = (over = {}) => ({
  id: 'pt_man', name: 'Phôi tự nhập', phoi: '1.2', shown: true, customizeInfos: [],
  sizes: [{ id: 'sz_a', label: 'One size', sizeAdd: '2', itemCost: '5.5', customize: {} }],
  ...over,
});

describe('resolveSheet — Product Type lấy từ thư viện', () => {
  it('dựng đủ danh sách size theo thư viện và đánh dấu isLib', () => {
    const out = resolveSheet({ productTypes: [libPT()] }, libIndex);
    expect(out.productTypes[0].sizes.map((s) => s.label)).toEqual(['S', 'M', 'L', 'XL', '2XL']);
    expect(out.productTypes[0].sizes.every((s) => s.isLib)).toBe(true);
  });

  it('Item Cost nạp từ cột P1, ship cost nạp theo phương thức ship đang chọn', () => {
    const eco = resolveSheet({ productTypes: [libPT()] }, libIndex).productTypes[0].sizes[0];
    expect(eco).toMatchObject({ label: 'S', itemCost: 8.2, totalShipCost: 4.1, shipCostItem: 1.1 });

    const express = resolveSheet({ productTypes: [libPT({ shipMethod: 'express' })] }, libIndex).productTypes[0].sizes[0];
    expect(express).toMatchObject({ totalShipCost: 9.8, shipCostItem: 2.6 });
  });

  it('phương thức ship thiếu trong thư viện → ship cost = 0, KHÔNG phải NaN', () => {
    const sz = resolveSheet({ productTypes: [libPT({ shipMethod: 'overnight' })] }, libIndex).productTypes[0].sizes[0];
    expect(sz.totalShipCost).toBe(0);
    expect(sz.shipCostItem).toBe(0);
  });

  it('GIỮ NGUYÊN giá đã nhập của dòng khớp label (không được mất dữ liệu)', () => {
    const out = resolveSheet({ productTypes: [libPT()] }, libIndex);
    const s = out.productTypes[0].sizes.find((x) => x.label === 'S');
    expect(s.sizeAdd).toBe('4.5');
    expect(s.customize).toEqual({ ci1: '3' });
  });

  it('dòng chưa có trong state nhận id tiền định và ỔN ĐỊNH qua nhiều lần resolve', () => {
    const sheet = { productTypes: [libPT()] };
    const a = resolveSheet(sheet, libIndex).productTypes[0].sizes.map((s) => s.id);
    const b = resolveSheet(sheet, libIndex).productTypes[0].sizes.map((s) => s.id);
    expect(a).toEqual(b);                                   // id đổi mỗi render = input bị remount, gõ không ăn
    expect(a[1]).toBe(libSizeId('pt_lib', 'M'));
  });

  it('không mutate sheet đầu vào và không mutate index thư viện', () => {
    const sheet = { productTypes: [libPT()] };
    const beforeSheet = JSON.stringify(sheet);
    const beforeIndex = JSON.stringify(libIndex);
    resolveSheet(sheet, libIndex);
    expect(JSON.stringify(sheet)).toBe(beforeSheet);
    expect(JSON.stringify(libIndex)).toBe(beforeIndex);     // thư viện Vendor gốc không được đổi
  });

  it('lọc bỏ size thư viện nếu nằm trong danh sách deletedSizes', () => {
    // State size KHÔNG có isLib — isLib chỉ được resolveSheet gắn khi render.
    // deletedSizes lưu nhãn gốc của size cần ẩn đi.
    const sheet = {
      productTypes: [libPT({
        sizes: [
          { id: 'szlib_pt_lib_s', label: 'S', sizeAdd: '4.5' },
          { id: 'szlib_pt_lib_m', label: 'M', sizeAdd: '5' },
        ],
        deletedSizes: ['S'],
      })],
    };
    const out = resolveSheet(sheet, libIndex);
    const labels = out.productTypes[0].sizes.map((s) => s.label);
    expect(labels).not.toContain('S');
    expect(labels).toContain('M');
  });

  it('“Khôi phục theo thư viện” khôi phục cả size thư viện đã bị xoá', () => {
    // State size không có isLib — giống trạng thái thực tế sau khi lưu
    const pt = libPT({
      sizes: [
        { id: 'szlib_pt_lib_m', label: 'M', sizeAdd: '5' },
      ],
      deletedSizes: ['S'],
    });
    const restored = restoreFromLibrary(pt, libIndex);
    expect(restored.deletedSizes).toBeUndefined();
    expect(restored.sizes.map((s) => s.label)).toEqual(['S', 'M', 'L', 'XL', '2XL']);
  });
});

describe('resolveSheet — Product Type nhập tay', () => {
  it('giữ nguyên toàn bộ size, không gắn isLib', () => {
    const out = resolveSheet({ productTypes: [manualPT()] }, libIndex);
    expect(out.productTypes[0].sizes).toEqual(manualPT().sizes);
    expect(out.productTypes[0].sizes[0].isLib).toBeUndefined();
  });

  it('bảng trộn cả 2 loại: mỗi loại xử lý độc lập', () => {
    const out = resolveSheet({ productTypes: [libPT(), manualPT()] }, libIndex);
    expect(out.productTypes[0].sizes).toHaveLength(5);
    expect(out.productTypes[1].sizes).toHaveLength(1);
  });

  it('không có index thư viện (chưa tải xong) thì trả nguyên bảng', () => {
    const sheet = { productTypes: [libPT(), manualPT()] };
    expect(resolveSheet(sheet, null).productTypes).toEqual(sheet.productTypes);
  });
});

describe('libSizesOf / baseSizesOf', () => {
  it('libSizesOf giữ object cũ khi label khớp (giữ nguyên tham chiếu = không mất state)', () => {
    const pt = libPT();
    const entry = findLibraryEntry(libIndex, pt.name);
    const sizes = libSizesOf(pt, entry);
    expect(sizes[0]).toBe(pt.sizes[0]);
  });

  it('baseSizesOf trả size thư viện cho PT thư viện, trả size gốc cho PT nhập tay', () => {
    expect(baseSizesOf(libPT(), libIndex)).toHaveLength(5);
    expect(baseSizesOf(manualPT(), libIndex)).toEqual(manualPT().sizes);
  });
});
