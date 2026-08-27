// ════════════════════════════════════════════════════════
//  Fix: phôi bị parse tách thành record "vendor trống" + record có tên vendor
//  (carry-forward kyHieu lệch dòng khi import Excel) → picker liệt kê 2 record
//  rời rạc cho CÙNG một phôi, chọn record nào cũng thiếu size (bug: "Canvas
//  1.5"" không đủ size, xem AddProductTypeModal). loadVendorLibraryIndex phải
//  tự gộp lại khi chỉ có đúng 1 vendor tên rõ ràng trong file đó.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { loadVendorLibraryIndex, listLibraryRecords, getLibraryItemCost } from '../vendorLibraryIndex';
import { __setLibraryFixture } from '../../test/apiMock.js';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

const mkRow = (kyHieu, size, pricing1) => ({
  kyHieu, productType: 'Canvas 1,5"', size, pricing1,
  pricing2: null, eco_price: null, eco_total: null, eco_price_item2: null,
});

describe('loadVendorLibraryIndex — gộp record vendor trống do carry-forward lệch dòng', () => {
  it('1 vendor tên rõ ràng + nhiều dòng vendor trống cùng file/cùng phôi → gộp thành 1 record đủ size', async () => {
    __setLibraryFixture([{
      filename: 'HC_Canvas 1.5_P.Creative_14.xlsx',
      generalInfo: [],
      pricing: [
        mkRow('', '8×12"', 7.56),
        mkRow('', '12×16"', 10.78),
        mkRow('US3', '12×18"', 11.76),   // dòng duy nhất có tên vendor (carry-forward bị lệch xuống đây)
        mkRow('', '16×20"', 13.86),
        mkRow('', '16×24"', 15.96),
        mkRow('', '20×24"', 18.48),
        mkRow('', '20×30"', 21.00),
        mkRow('', '24×36"', 25.20),
      ],
    }]);

    const libIndex = await loadVendorLibraryIndex('creative');
    const records = listLibraryRecords(libIndex, { q: 'Canvas 1,5' });

    expect(records).toHaveLength(1);
    expect(records[0].vendorCode).toBe('US3');
    expect(records[0].sizes).toHaveLength(8);
    expect(getLibraryItemCost(records[0], '8×12"')).toBe(7.56);
    expect(getLibraryItemCost(records[0], '12×18"')).toBe(11.76);
  });

  it('2 vendor tên khác nhau thật sự + dòng trống → KHÔNG gộp (không đoán được size trống thuộc vendor nào)', async () => {
    __setLibraryFixture([{
      filename: 'HC_Multi_Vendor_P.Creative_14.xlsx',
      generalInfo: [],
      pricing: [
        mkRow('US1', '8×10"', 9.60),
        mkRow('US3', '8×12"', 7.56),
        mkRow('', '12×16"', 10.78),
      ],
    }]);

    const libIndex = await loadVendorLibraryIndex('creative');
    const records = listLibraryRecords(libIndex, { q: 'Canvas 1,5' });

    expect(records).toHaveLength(3);
    expect(records.map((r) => r.vendorCode).sort()).toEqual(['', 'US1', 'US3']);
  });
});
