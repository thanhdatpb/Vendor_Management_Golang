// ════════════════════════════════════════════════════════
//  MỤC 02 — THƯ VIỆN VENDOR CHỈ ĐỌC, DÙ THAO TÁC GÌ Ở BẢNG TÍNH GIÁ
//
//  Quyết định 2026-08-28: một phôi dùng chung nhiều project có size dư là
//  bình thường. Seller được xoá/sửa/thêm size NGAY TRONG bảng tính giá của
//  mình mà không cần Staff B sửa lại thư viện gốc — nhưng đúng vì vậy, mọi
//  thao tác đó phải chứng minh được KHÔNG đụng tới thư viện: `vendorLibraryApi.save`
//  không được gọi lần nào, và bản thân object `libIndex` không đổi bit nào
//  sau một chuỗi thêm/sửa/xoá/khôi phục.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { loadVendorLibraryIndex } from '../vendorLibraryIndex';
import { resolveSheet, restoreFromLibrary } from '../resolveSheet';
import { makeSize } from '../pricingEngine';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

let libIndex;
beforeAll(async () => { libIndex = await loadVendorLibraryIndex('happy'); });

const libPT = (over = {}) => ({
  id: 'pt_lib', name: 'Football Jersey', phoi: '0', shipMethod: 'eco',
  customizeInfos: [{ id: 'ci1', name: 'Face' }],
  sizes: [
    { id: 'szlib_pt_lib_s', label: 'S', sizeAdd: '1', customize: { ci1: '3' } },
    { id: 'szlib_pt_lib_m', label: 'M', sizeAdd: '2', customize: { ci1: '3' } },
  ],
  ...over,
});

describe('Chuỗi thêm / sửa / xoá / khôi phục size không ghi thư viện', () => {
  it('vendorLibraryApi.save không được gọi lần nào', async () => {
    const { vendorLibraryApi } = await import('../../services/api');
    vendorLibraryApi.save.mockClear();

    let pt = libPT();
    // Xoá size dư ngay trong bảng tính giá.
    let out = resolveSheet({ settings: {}, productTypes: [pt] }, libIndex).productTypes[0];
    pt = { ...pt, sizes: out.sizes.filter((s) => s.label !== 'M') };
    // Thêm size Seller tự thêm.
    pt = { ...pt, sizes: [...pt.sizes, { ...makeSize('3XL', '9'), origin: 'manual', isLib: false }] };
    // Override tên + item cost của một dòng thư viện.
    pt = { ...pt, sizes: pt.sizes.map((s) => (s.id === 'szlib_pt_lib_s' ? { ...s, overrides: { label: 'S (rộng)', itemCost: 1 } } : s)) };
    resolveSheet({ settings: {}, productTypes: [pt] }, libIndex);
    // Khôi phục lại theo thư viện.
    restoreFromLibrary(pt, libIndex);

    expect(vendorLibraryApi.save).not.toHaveBeenCalled();
  });

  it('libIndex deep-equal trước và sau toàn bộ chuỗi thao tác', () => {
    const before = JSON.stringify(libIndex);

    let pt = libPT();
    let out = resolveSheet({ settings: {}, productTypes: [pt] }, libIndex).productTypes[0];
    pt = { ...pt, sizes: out.sizes.filter((s) => s.label !== 'M') };
    pt = { ...pt, sizes: [...pt.sizes, { ...makeSize('3XL', '9'), origin: 'manual', isLib: false }] };
    resolveSheet({ settings: {}, productTypes: [pt] }, libIndex);
    restoreFromLibrary(pt, libIndex);

    expect(JSON.stringify(libIndex)).toBe(before);
  });
});
