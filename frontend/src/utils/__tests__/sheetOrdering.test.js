// ════════════════════════════════════════════════════════
//  MỤC 05 (thứ tự Size) + MỤC 06 (thứ tự cột Custom & giá mặc định)
//  ⛔ ĐỎ LÀ ĐÚNG cho tới khi PR-A4 / PR-A5 xong.
//
//  Hôm nay: thứ tự size = thứ tự gặp trong file Excel, mọi sắp xếp cục bộ bị
//  ghi đè mỗi lần dựng lại bảng từ thư viện; cột Custom chưa sắp xếp được và
//  giá mặc định chỉ áp cho size đang có, size thêm sau không nhận.
//
//  Bẫy quan trọng phải giữ: mapping giá customize bám `ci.id`, KHÔNG bám chỉ số cột.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { loadVendorLibraryIndex } from '../vendorLibraryIndex';
import { resolveSheet } from '../resolveSheet';
import { roundTrip, sizeInputMap } from '../../test/roundTrip';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

let libIndex;
beforeAll(async () => { libIndex = await loadVendorLibraryIndex('happy'); });

const libPT = (over = {}) => ({
  id: 'pt_lib', name: 'Football Jersey', phoi: '0', shipMethod: 'eco',
  customizeInfos: [{ id: 'ci1', name: 'Face' }, { id: 'ci2', name: 'Name' }],
  sizes: [
    { id: 'szlib_pt_lib_s', label: 'S', sizeAdd: '1', customize: { ci1: '3', ci2: '1' } },
    { id: 'szlib_pt_lib_m', label: 'M', sizeAdd: '2', customize: { ci1: '3', ci2: '1' } },
    { id: 'szlib_pt_lib_l', label: 'L', sizeAdd: '3', customize: { ci1: '3', ci2: '1' } },
  ],
  ...over,
});

describe('Mục 05 — thứ tự Size', () => {
  const ordered = () => libPT({ sizeOrder: ['szlib_pt_lib_2xl', 'szlib_pt_lib_l', 'szlib_pt_lib_s'] });

  it('resolveSheet tôn trọng pt.sizeOrder, id lạ đẩy về cuối', () => {
    const out = resolveSheet({ settings: {}, productTypes: [ordered()] }, libIndex);
    expect(out.productTypes[0].sizes.slice(0, 3).map((s) => s.label)).toEqual(['2XL', 'L', 'S']);
    expect(out.productTypes[0].sizes).toHaveLength(5);
  });

  it('thứ tự giữ nguyên sau save → reload', () => {
    const after = roundTrip({ settings: {}, productTypes: [ordered()] }, libIndex);
    expect(after.productTypes[0].sizes.slice(0, 3).map((s) => s.label)).toEqual(['2XL', 'L', 'S']);
  });

  it('đổi thứ tự KHÔNG đổi giá và mapping cột Customize', () => {
    const before = resolveSheet({ settings: {}, productTypes: [libPT()] }, libIndex);
    const after = resolveSheet({ settings: {}, productTypes: [ordered()] }, libIndex);
    expect(sizeInputMap(after.productTypes[0])).toEqual(sizeInputMap(before.productTypes[0]));
  });

  it('thứ tự trong file export khớp thứ tự trên màn hình', async () => {
    const { buildSheetAoa } = await import('../sheetExport');
    const rows = buildSheetAoa(resolveSheet({ settings: {}, productTypes: [ordered()] }, libIndex));
    expect(rows.slice(6, 9).map((r) => r[1])).toEqual(['2XL', 'L', 'S']);
  });

  it('KHÔNG đụng tới thứ tự size của thư viện Vendor master', () => {
    const before = JSON.stringify(libIndex);
    resolveSheet({ settings: {}, productTypes: [ordered()] }, libIndex);
    expect(JSON.stringify(libIndex)).toBe(before);
  });
});

describe('Mục 06 — thứ tự cột Custom', () => {
  it('hoán vị mảng customizeInfos không làm đổi giá của bất kỳ ô nào', () => {
    const pt = libPT();
    const swapped = { ...pt, customizeInfos: [pt.customizeInfos[1], pt.customizeInfos[0]] };
    const before = resolveSheet({ settings: {}, productTypes: [pt] }, libIndex).productTypes[0];
    const after = resolveSheet({ settings: {}, productTypes: [swapped] }, libIndex).productTypes[0];

    after.sizes.forEach((sz, i) => expect(sz.customize).toEqual(before.sizes[i].customize));
  });

  it('đổi TÊN cột không làm mất giá đã nhập (mapping theo ci.id)', () => {
    const pt = libPT();
    const renamed = { ...pt, customizeInfos: [{ id: 'ci1', name: 'Add Custom Face' }, pt.customizeInfos[1]] };
    const after = roundTrip({ settings: {}, productTypes: [renamed] }, libIndex).productTypes[0];
    expect(after.sizes[0].customize.ci1).toBe('3');
  });

  it('header file export đổi theo thứ tự cột mới', async () => {
    const { buildSheetAoa } = await import('../sheetExport');
    const pt = libPT();
    const swapped = { ...pt, customizeInfos: [pt.customizeInfos[1], pt.customizeInfos[0]] };
    const header = buildSheetAoa(resolveSheet({ settings: {}, productTypes: [swapped] }, libIndex))[5];
    expect(header.slice(4, 6)).toEqual(['Name', 'Face']);
  });
});

describe('Mục 06 — giá mặc định cho cột Custom', () => {
  it('chế độ "chỉ ô đang trống" không ghi đè ô đã có giá', async () => {
    const { applyColumnDefault } = await import('../sheetStructure');
    const sizes = [
      { id: 'a', customize: { ci1: '3' } },
      { id: 'b', customize: {} },
      { id: 'c', customize: { ci1: '' } },
    ];
    const patches = applyColumnDefault(sizes, 'ci1', 5, { mode: 'empty-only' });
    expect(patches.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('chế độ "tất cả size" ghi mọi ô và số ô khớp con số xem trước', async () => {
    const { applyColumnDefault, countAffected } = await import('../sheetStructure');
    const sizes = [{ id: 'a', customize: { ci1: '3' } }, { id: 'b', customize: {} }];
    expect(countAffected(sizes, 'ci1', 5, { mode: 'all' })).toBe(2);
    expect(applyColumnDefault(sizes, 'ci1', 5, { mode: 'all' })).toHaveLength(2);
  });

  it('size thêm sau tự nhận defaultPrice đã lưu ở cột', () => {
    const pt = libPT({ customizeInfos: [{ id: 'ci1', name: 'Face', defaultPrice: 4 }] });
    const out = resolveSheet({ settings: {}, productTypes: [pt] }, libIndex);
    const newRow = out.productTypes[0].sizes.find((s) => s.label === 'XL');   // chưa có trong state
    expect(newRow.customize.ci1).toBe(4);
  });
});
