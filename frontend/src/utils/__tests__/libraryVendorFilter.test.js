// ════════════════════════════════════════════════════════
//  Lọc một file Thư viện Vendor theo vendor (ô "Tất cả vendor")
//
//  Bug thật (2026-09-17): file nhiều vendor (CN1, VN1, VN3) — chọn VN1 ở ô lọc
//  nhưng mở file vẫn thấy phôi của VN3, CN1. Bộ test này canh:
//    1. View chỉ còn phôi + dòng giá của vendor được chọn.
//    2. Vendor của dòng giá suy đúng như cột Vendor Name (ký hiệu lan xuống,
//       productType, file một vendor).
//    3. Lưu từ view KHÔNG làm mất dòng giá của vendor khác đang bị ẩn.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  pricingRowOwners,
  filterLibraryEntryByVendor,
  unwrapLibraryVendorView,
} from '../libraryVendorFilter';

const g = (id, vendorName, productType, over = {}) => ({ id, kyHieu: vendorName, vendorName, productType, ...over });
const p = (kyHieu, productType, size, pricing1) => ({ kyHieu, productType, size, pricing1 });

const multiVendorFile = () => ({
  id: 'f1',
  filename: 'HC_Croptop_P.Happy',
  generalInfo: [
    g('g1', 'CN1', 'Croptop Cotton'),
    g('g2', 'VN1', 'Croptop Poly'),
    g('g3', 'VN3', 'Croptop Linen'),
  ],
  pricing: [
    p('CN1', 'Croptop Cotton', 'S', 1),
    p('', 'Croptop Cotton', 'M', 2),
    p('VN1', 'Croptop Poly', 'S', 3),
    p('', 'Croptop Poly', 'M', 4),
    p('VN3', 'Croptop Linen', 'S', 5),
  ],
});

describe('pricingRowOwners', () => {
  it('ký hiệu ở dòng đầu khối lan xuống các dòng trống phía dưới', () => {
    const file = multiVendorFile();
    expect(pricingRowOwners(file.pricing, file.generalInfo).map((o) => o.vendor))
      .toEqual(['CN1', 'CN1', 'VN1', 'VN1', 'VN3']);
  });

  it('dòng không có ký hiệu nào thì tra theo productType của Section 1', () => {
    const general = [g('g1', 'CN1', 'Hoodie', { kyHieu: '' }), g('g2', 'VN1', 'Tote', { kyHieu: '' })];
    const rows = [p('', 'Tote', 'S', 1), p('', 'Hoodie', 'S', 2)];
    expect(pricingRowOwners(rows, general).map((o) => o.vendor)).toEqual(['VN1', 'CN1']);
  });

  it('không suy ra được thì vendor rỗng (bảng hiện N/A)', () => {
    const general = [g('g1', 'CN1', 'Hoodie'), g('g2', 'VN1', 'Tote')];
    expect(pricingRowOwners([p('', 'Mug', 'S', 1)], general)[0].vendor).toBe('');
  });
});

describe('filterLibraryEntryByVendor', () => {
  it('chỉ giữ phôi và dòng giá của vendor được chọn', () => {
    const view = filterLibraryEntryByVendor(multiVendorFile(), 'VN1');

    expect(view.generalInfo.map((r) => r.id)).toEqual(['g2']);
    expect(view.pricing.map((r) => r.pricing1)).toEqual([3, 4]);
    expect(view.id).toBe('f1');
    expect(view.filename).toBe('HC_Croptop_P.Happy');
  });

  it('dòng mượn ký hiệu của dòng trên được ghi hẳn ký hiệu khi tách ra', () => {
    const view = filterLibraryEntryByVendor(multiVendorFile(), 'VN1');
    expect(view.pricing.map((r) => r.kyHieu)).toEqual(['VN1', 'VN1']);
  });

  it('không chọn vendor thì trả nguyên entry', () => {
    const file = multiVendorFile();
    expect(filterLibraryEntryByVendor(file, '')).toBe(file);
  });

  it('dấu view không lọt vào JSON gửi lên server', () => {
    const view = filterLibraryEntryByVendor(multiVendorFile(), 'VN1');
    expect(Object.keys(JSON.parse(JSON.stringify(view))).sort())
      .toEqual(['filename', 'generalInfo', 'id', 'pricing']);
  });
});

describe('unwrapLibraryVendorView — lưu từ view lọc vendor', () => {
  it('sửa một dòng giá: dòng của vendor khác giữ nguyên, đúng thứ tự', () => {
    const raw = multiVendorFile();
    const view = filterLibraryEntryByVendor(raw, 'VN1');
    const edited = { ...view, pricing: view.pricing.map((r, i) => (i === 1 ? { ...r, pricing1: 40 } : r)) };

    const saved = unwrapLibraryVendorView(raw, edited);

    expect(saved.pricing.map((r) => r.pricing1)).toEqual([1, 2, 3, 40, 5]);
    expect(saved.pricing[0]).toBe(raw.pricing[0]);
    expect(saved.pricing[4]).toBe(raw.pricing[4]);
  });

  it('đổi tên file từ card đang lọc không xoá dòng giá bị ẩn', () => {
    const raw = multiVendorFile();
    const view = filterLibraryEntryByVendor(raw, 'VN1');

    const saved = unwrapLibraryVendorView(raw, { ...view, filename: 'Tên mới' });

    expect(saved.filename).toBe('Tên mới');
    expect(saved.pricing).toHaveLength(5);
    expect(pricingRowOwners(saved.pricing, raw.generalInfo).map((o) => o.vendor))
      .toEqual(['CN1', 'CN1', 'VN1', 'VN1', 'VN3']);
  });

  it('xoá dòng giá chỉ xoá đúng dòng đó', () => {
    const raw = multiVendorFile();
    const view = filterLibraryEntryByVendor(raw, 'VN1');

    const saved = unwrapLibraryVendorView(raw, { ...view, pricing: view.pricing.filter((_, i) => i !== 0) });

    expect(saved.pricing.map((r) => r.pricing1)).toEqual([1, 2, 4, 5]);
    expect(pricingRowOwners(saved.pricing, raw.generalInfo).map((o) => o.vendor))
      .toEqual(['CN1', 'CN1', 'VN1', 'VN3']);
  });

  it('thêm dòng giá: chèn ngay sau dòng cuối của vendor, vẫn thuộc vendor đó', () => {
    const raw = multiVendorFile();
    const view = filterLibraryEntryByVendor(raw, 'VN1');

    const saved = unwrapLibraryVendorView(raw, { ...view, pricing: [...view.pricing, p('', 'Croptop Poly', 'L', 9)] });

    expect(saved.pricing.map((r) => r.pricing1)).toEqual([1, 2, 3, 4, 9, 5]);
    expect(pricingRowOwners(saved.pricing, raw.generalInfo)[4].vendor).toBe('VN1');
  });

  it('entry không phải view thì trả nguyên', () => {
    const raw = multiVendorFile();
    const full = { ...raw, filename: 'x' };
    expect(unwrapLibraryVendorView(raw, full)).toBe(full);
  });

  it('bản đã lưu không còn là view — lưu lần sau không ghép lại lần nữa', () => {
    const raw = multiVendorFile();
    const saved = unwrapLibraryVendorView(raw, filterLibraryEntryByVendor(raw, 'VN1'));
    const next = { ...saved, filename: 'y' };
    expect(unwrapLibraryVendorView(saved, next)).toBe(next);
  });
});
