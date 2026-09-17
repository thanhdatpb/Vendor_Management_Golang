// ════════════════════════════════════════════════════════
//  Bản chụp vendor cung cấp cho request — utils/libraryAssign.js
//
//  Canh 3 điều:
//    1. Khớp dòng giá cho phôi y như luồng tick cũ (4 bước lùi dần).
//    2. Cung cấp thêm là GỘP: phôi mới thêm vào, phôi đã có thì thay bản mới,
//       phôi khác không bao giờ bị xoá.
//    3. Nhận ra giá trong file gốc đã khác bản chụp Seller đang xem.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  buildAssignedVendors,
  assignedRowKey,
  groupAssignedByRow,
  mergeAssignedVendors,
  removeAssignedRows,
  assignedPricesDiffer,
  assignedSourceState,
  tierRanges,
  productTypeOverlap,
} from '../libraryAssign';

const file = {
  id: 'file_wood',
  filename: 'HC_Wooden Ornament P.GLB',
  generalInfo: [
    { id: 'g_cn1', kyHieu: 'CN1', vendorName: 'CN1', productType: 'Wooden Ornament', chatLieu: 'Gỗ bạch dương', images: ['https://img/cn1.jpg'], linkFolder: 'https://drive/wood', avgTimeVendor: 'SX: 3-5 BDS' },
    { id: 'g_vn2', kyHieu: 'VN2', vendorName: 'VN2', productType: 'Wooden Ornament', chatLieu: 'Gỗ thông', images: [] },
    { id: 'g_us1', kyHieu: '', vendorName: 'US1', productType: 'Wooden Ornament Mini', chatLieu: 'MDF' },
  ],
  pricing: [
    { kyHieu: 'CN1', productType: 'Wooden Ornament', size: '3in', eco_total: 4.85, ground_total: 5.6 },
    { kyHieu: 'CN1', productType: 'Wooden Ornament', size: '4in', eco_total: 5.2, ground_total: 6.1 },
    { kyHieu: 'VN2', productType: 'Wooden Ornament', size: '3.5in', pricing1: 5, eco_price: 1.4 },
    { kyHieu: 'US1', productType: 'Wooden Ornament Mini', size: '2in', eco_total: 5.95 },
  ],
};

describe('buildAssignedVendors', () => {
  it('mỗi size của phôi thành một phần tử, mang theo file gốc để lần ngược', () => {
    const out = buildAssignedVendors(file, ['g_cn1'], { providedAt: '2026-09-17T04:00:00.000Z' });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      id: 'g_cn1_0', excel_row_id: 'g_cn1', name: 'CN1', size: '3in', eco_total: 4.85,
      source_file_id: 'file_wood', source_file_name: 'HC_Wooden Ornament P.GLB',
      media_url: 'https://img/cn1.jpg', link_folder: 'https://drive/wood', is_excel: true,
      avg_time_vendor: 'SX: 3-5 BDS', provided_at: '2026-09-17T04:00:00.000Z',
    });
    expect(out[1]).toMatchObject({ size: '4in', eco_total: 5.2 });
  });

  it('phôi không ghi Ký hiệu thì khớp dòng giá theo tên vendor', () => {
    const out = buildAssignedVendors(file, ['g_us1']);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: 'US1', size: '2in', eco_total: 5.95 });
  });

  it('bỏ qua id phôi không có trong file', () => {
    expect(buildAssignedVendors(file, ['khong_co'])).toEqual([]);
    expect(buildAssignedVendors(null, ['g_cn1'])).toEqual([]);
  });

  it('phôi chưa có dòng giá vẫn được cung cấp (không mất vendor)', () => {
    const bare = { id: 'f2', filename: 'F2', generalInfo: [{ id: 'r1', kyHieu: 'ZZ', vendorName: 'ZZ', chiTietSize: 'S-XL' }], pricing: [] };
    expect(buildAssignedVendors(bare, ['r1'])).toEqual([
      expect.objectContaining({ id: 'r1', name: 'ZZ', size: 'S-XL' }),
    ]);
  });
});

describe('gộp / gỡ danh sách đã cung cấp', () => {
  const cn1 = buildAssignedVendors(file, ['g_cn1']);
  const vn2 = buildAssignedVendors(file, ['g_vn2']);

  it('khoá phôi giống nhau cho mọi size của cùng phôi', () => {
    expect(new Set(cn1.map(assignedRowKey))).toEqual(new Set(['file_wood::g_cn1']));
    expect(assignedRowKey({ id: 42, name: 'DB vendor' })).toBe('db::42');
  });

  it('thêm phôi mới vào cuối, giữ nguyên phôi đã có', () => {
    const merged = mergeAssignedVendors(cn1, vn2);
    expect(groupAssignedByRow(merged).map((g) => g.name)).toEqual(['CN1', 'VN2']);
  });

  it('cung cấp lại phôi đã có thì THAY bằng bản mới, không nhân đôi', () => {
    const fresh = buildAssignedVendors(
      { ...file, pricing: file.pricing.map((p) => (p.kyHieu === 'CN1' ? { ...p, eco_total: 9 } : p)) },
      ['g_cn1'],
    );
    const merged = mergeAssignedVendors([...cn1, ...vn2], fresh);
    expect(merged).toHaveLength(cn1.length + vn2.length);
    expect(merged.filter((v) => v.excel_row_id === 'g_cn1').every((v) => v.eco_total === 9)).toBe(true);
  });

  it('gỡ đúng phôi được chọn', () => {
    const left = removeAssignedRows([...cn1, ...vn2], ['file_wood::g_cn1']);
    expect(groupAssignedByRow(left).map((g) => g.name)).toEqual(['VN2']);
  });
});

describe('assignedPricesDiffer', () => {
  const current = buildAssignedVendors(file, ['g_cn1']);

  it('không đổi thì false — kể cả khi thứ tự size khác', () => {
    expect(assignedPricesDiffer(current, [...current].reverse())).toBe(false);
  });

  it('giá đổi thì true', () => {
    const changed = current.map((v, i) => (i === 0 ? { ...v, eco_total: 4.99 } : v));
    expect(assignedPricesDiffer(current, changed)).toBe(true);
  });

  it('không đọc được bản mới (file đã xoá) thì không báo đổi giá', () => {
    expect(assignedPricesDiffer(current, [])).toBe(false);
  });
});

describe('assignedSourceState', () => {
  const items = buildAssignedVendors(file, ['g_cn1']);
  const group = groupAssignedByRow(items)[0];

  it('phân biệt file đang đọc, file đã xoá và phôi đã xoá', () => {
    expect(assignedSourceState(group, {})).toEqual({ state: 'checking' });
    expect(assignedSourceState(group, { file_wood: { status: 'notFound' } })).toEqual({ state: 'fileGone' });
    expect(assignedSourceState(group, {
      file_wood: { status: 'ok', file: { ...file, generalInfo: file.generalInfo.filter((r) => r.id !== 'g_cn1') } },
    })).toEqual({ state: 'rowGone' });
  });

  it('chỉ báo stale khi size hoặc giá trong file nguồn đã đổi', () => {
    expect(assignedSourceState(group, { file_wood: { status: 'ok', file } })).toEqual({ state: 'fresh' });
    const changed = { ...file, pricing: file.pricing.map((p) => (p.kyHieu === 'CN1' ? { ...p, eco_total: 9 } : p)) };
    expect(assignedSourceState(group, { file_wood: { status: 'ok', file: changed } })).toMatchObject({ state: 'stale' });
  });
});

describe('tierRanges', () => {
  it('lấy min–max qua các size; ECO suy từ pricing1 + eco_price khi thiếu eco_total', () => {
    const cn1 = tierRanges(buildAssignedVendors(file, ['g_cn1']));
    expect(cn1.map((t) => [t.short, t.min, t.max])).toEqual([['ECO', 4.85, 5.2], ['GND', 5.6, 6.1]]);
    const vn2 = tierRanges(buildAssignedVendors(file, ['g_vn2']));
    expect(vn2[0]).toMatchObject({ short: 'ECO', min: 6.4, max: 6.4 });
  });
});

describe('productTypeOverlap', () => {
  it('đếm từ có nghĩa trùng nhau, không phân biệt hoa thường / dấu', () => {
    expect(productTypeOverlap('Wooden Ornament', ['HC_Wooden Ornament P.GLB'])).toBe(2);
    expect(productTypeOverlap('Wooden Ornament', ['Ornament - Acrylic'])).toBe(1);
    expect(productTypeOverlap('Wooden Ornament', ['Comfort Colors 1717'])).toBe(0);
    expect(productTypeOverlap('Embroidered Sweatshirt', ['EMBROIDERED sweatshirt'])).toBe(2);
    expect(productTypeOverlap('Túi Vải Canvas', ['tui vai canvas'])).toBe(1); // "tui", "vai" ≤ 3 ký tự bị bỏ
  });
});
