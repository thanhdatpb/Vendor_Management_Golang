// ════════════════════════════════════════════════════════
//  Thống kê phôi (Admin): "phôi đã duyệt" và "phôi trong thư viện" là HAI số
//  riêng. Phôi đã duyệt = Request đã duyệt VÀ đã được cung cấp vendor.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  collectApprovedPhoi,
  filterApprovedByProject,
  summarizePhoi,
  vendorKey,
} from '../approvedPhoiStats';

// Một phôi trong bản chụp assigned_vendors sinh nhiều dòng (mỗi size một dòng).
const sized = (fileId, rowId, vendor, productType, sizes = ['S', 'M'], extra = {}) =>
  sizes.map((size, i) => ({
    id: `${rowId}_${i}`, excel_row_id: rowId, source_file_id: fileId, is_excel: true,
    name: vendor, vendor_type: productType, size, ...extra,
  }));

const product = (id, overrides = {}) => ({
  id,
  status: 'approved',
  product_type: `Request ${id}`,
  project: 'Happy Project',
  created_at: '2026-09-10T02:00:00Z',
  submitted_at: '2026-09-11T02:00:00Z',
  reviewed_at: '2026-09-15T02:00:00Z',
  assigned_vendors: [],
  ...overrides,
});

describe('collectApprovedPhoi', () => {
  it('chỉ lấy Request đã duyệt VÀ đã được cung cấp vendor', () => {
    const list = collectApprovedPhoi([
      product(1, { assigned_vendors: sized('f1', 'r1', 'VN3', 'Hoodie') }),
      product(2, { assigned_vendors: [] }),                        // duyệt nhưng chưa có vendor
      product(3, { assigned_vendors: null }),
      product(4, { status: 'pending', assigned_vendors: sized('f1', 'r2', 'US1', 'Tee') }),
      product(5, { status: 'rejected', assigned_vendors: sized('f1', 'r3', 'US1', 'Tee') }),
    ]);
    expect(list.map((x) => x.productId)).toEqual([1]);
  });

  it('gộp các size của cùng một phôi thành một dòng', () => {
    const list = collectApprovedPhoi([
      product(1, { assigned_vendors: [...sized('f1', 'r1', 'VN3', 'Hoodie', ['S', 'M', 'L']), ...sized('f2', 'r9', 'US1', 'Tee', ['S'])] }),
    ]);
    expect(list).toHaveLength(2);
    expect(list.map((x) => x.phoi).sort()).toEqual(['Hoodie', 'Tee']);
  });

  it('mang project, ngày request (submitted_at, lùi về created_at) và ngày duyệt', () => {
    const [a] = collectApprovedPhoi([product(1, { assigned_vendors: sized('f1', 'r1', 'VN3', 'Hoodie') })]);
    expect(a).toMatchObject({ project: 'Happy', projectKey: 'happy', vendor: 'VN3', requestedAt: '2026-09-11T02:00:00Z', approvedAt: '2026-09-15T02:00:00Z' });

    const [b] = collectApprovedPhoi([product(2, { submitted_at: null, assigned_vendors: sized('f1', 'r1', 'VN3', 'Hoodie') })]);
    expect(b.requestedAt).toBe('2026-09-10T02:00:00Z');
  });

  it('mới duyệt nhất lên đầu', () => {
    const list = collectApprovedPhoi([
      product(1, { reviewed_at: '2026-09-01T00:00:00Z', assigned_vendors: sized('f1', 'r1', 'VN3', 'A') }),
      product(2, { reviewed_at: '2026-09-20T00:00:00Z', assigned_vendors: sized('f1', 'r2', 'VN3', 'B') }),
    ]);
    expect(list.map((x) => x.phoi)).toEqual(['B', 'A']);
  });
});

describe('filterApprovedByProject', () => {
  it('lọc theo id project, bỏ trống = giữ tất cả', () => {
    const list = collectApprovedPhoi([
      product(1, { project: 'Happy Project', assigned_vendors: sized('f1', 'r1', 'VN3', 'A') }),
      product(2, { project: 'Global Project', assigned_vendors: sized('f1', 'r2', 'VN3', 'B') }),
    ]);
    expect(filterApprovedByProject(list, 'global').map((x) => x.phoi)).toEqual(['B']);
    expect(filterApprovedByProject(list, '')).toHaveLength(2);
  });
});

describe('summarizePhoi', () => {
  const files = [
    { id: 'f1', generalInfo: [{ vendorName: 'VN3' }, { vendorName: 'VN3' }, { vendorName: 'US1' }] },
    { id: 'f2', generalInfo: [{ vendorName: '', kyHieu: 'CN1' }, { vendorName: 'vn3 ' }] },
  ];

  it('hai số RIÊNG: phôi đã duyệt đếm theo phôi, phôi thư viện đếm dòng generalInfo', () => {
    const approved = collectApprovedPhoi([
      product(1, { assigned_vendors: sized('f1', 'r1', 'VN3', 'Hoodie') }),
      // Cùng phôi r1 được cung cấp cho Request thứ hai → vẫn là MỘT phôi
      product(2, { assigned_vendors: sized('f1', 'r1', 'VN3', 'Hoodie') }),
      product(3, { assigned_vendors: sized('old', 'x1', 'ZZ9', 'Mug') }), // file đã rời thư viện
    ]);
    const s = summarizePhoi(approved, files);
    expect(s.approved).toBe(2);
    expect(s.library).toBe(5);
    expect(s.fileCount).toBe(2);
  });

  it('theo vendor: gộp hoa/thường, lấy tên theo thư viện, xếp theo số đã duyệt', () => {
    const approved = collectApprovedPhoi([
      product(1, { assigned_vendors: [...sized('f1', 'r1', 'vn3', 'A'), ...sized('f1', 'r2', 'VN3', 'B')] }),
      product(2, { assigned_vendors: sized('f1', 'r3', 'US1', 'C') }),
    ]);
    const { vendors } = summarizePhoi(approved, files);
    expect(vendors.map((v) => [v.name, v.approved, v.library])).toEqual([
      ['VN3', 2, 3],
      ['US1', 1, 1],
      ['CN1', 0, 1],
    ]);
    expect(vendorKey(' vn3 ')).toBe('VN3');
  });

  it('vendor chỉ có phôi đã duyệt (không còn trong thư viện) vẫn được liệt kê', () => {
    const approved = collectApprovedPhoi([product(1, { assigned_vendors: sized('old', 'x1', 'ZZ9', 'Mug') })]);
    const { vendors } = summarizePhoi(approved, []);
    expect(vendors).toEqual([{ key: 'ZZ9', name: 'ZZ9', approved: 1, library: 0 }]);
  });
});
