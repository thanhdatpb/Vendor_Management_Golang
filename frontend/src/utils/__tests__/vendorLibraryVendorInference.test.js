// ════════════════════════════════════════════════════════
//  Fix (2026-09): template "Về giá" của một số file KHÔNG có cột Ký hiệu →
//  mọi dòng giá parse ra `kyHieu` rỗng, record trong index không tra được
//  vendor nào, và dải thông tin phôi trên bảng tính giá hiện toàn "—" dù
//  Section 1 ("Thông tin chung về phôi") của chính file đó có đủ vendor +
//  chất liệu + AVG TG (bug thật: HC_Football Jersey_P.Global_16).
//  loadVendorLibraryIndex phải suy ngược vendor/info từ Section 1.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { loadVendorLibraryIndex, listLibraryRecords, findLibraryEntry } from '../vendorLibraryIndex';
import { __setLibraryFixture } from '../../test/apiMock.js';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

const info = (over = {}) => ({
  kyHieu: 'CN1', vendorName: 'CN1', productType: 'Football',
  chatLieu: '90% Polyester + 10 % spandex',
  chiTietSize: 'size chart.png',
  avgTimeVendor: 'Thời gian sản xuất: 3-5 bds',
  avgTimeActual: 'Thời gian sản xuất: 4-9 bds',
  images: [],
  ...over,
});

const priceRow = (size, pricing1, over = {}) => ({
  kyHieu: '', productType: 'Football', size, pricing1,
  pricing2: null, eco_price: null, eco_total: null, eco_price_item2: null,
  ...over,
});

describe('loadVendorLibraryIndex — suy vendor + info phôi khi "Về giá" thiếu cột Ký hiệu', () => {
  it('file 1 vendor, mọi dòng giá trống Ký hiệu → record lấy vendor và info của Section 1', async () => {
    __setLibraryFixture([{
      filename: 'HC_Football Jersey_P.Global_16.05.xlsx',
      generalInfo: [info()],
      pricing: [priceRow('Men S', 11.94), priceRow('Men M', 13.96)],
    }]);

    const libIndex = await loadVendorLibraryIndex('global');
    const records = listLibraryRecords(libIndex, { q: 'Football' });

    expect(records).toHaveLength(1);
    expect(records[0].vendorCode).toBe('CN1');
    expect(records[0].chatLieu).toBe('90% Polyester + 10 % spandex');
    expect(records[0].avgTimeVendor).toBe('Thời gian sản xuất: 3-5 bds');
    expect(records[0].sizes).toEqual(['Men S', 'Men M']);

    // Bảng cũ resolve theo TÊN phôi cũng phải thấy đúng vendor/info đó.
    const entry = findLibraryEntry(libIndex, 'Football');
    expect(entry.vendor).toBe('CN1');
    expect(entry.chiTietSize).toBe('size chart.png');
  });

  it('Section 1 nhiều dòng → khớp theo TÊN PHÔI, không lấy nhầm dòng vendor khác', async () => {
    __setLibraryFixture([{
      filename: 'HC_Mix_P.Global_16.xlsx',
      generalInfo: [
        info({ kyHieu: 'VN3', vendorName: 'VN3', productType: 'Jacket', chatLieu: 'Nylon' }),
        info({ kyHieu: 'CN1', vendorName: 'CN1', productType: 'Football', chatLieu: 'Polyester' }),
      ],
      pricing: [priceRow('Men S', 11.94)],
    }]);

    const libIndex = await loadVendorLibraryIndex('global');
    const records = listLibraryRecords(libIndex, { q: 'Football' });

    expect(records).toHaveLength(1);
    expect(records[0].vendorCode).toBe('CN1');
    expect(records[0].chatLieu).toBe('Polyester');
  });

  it('nhiều dòng Section 1, không dòng nào khớp tên phôi → để trống, KHÔNG đoán bừa', async () => {
    __setLibraryFixture([{
      filename: 'HC_Unknown_P.Global_16.xlsx',
      generalInfo: [
        info({ kyHieu: 'VN3', vendorName: 'VN3', productType: 'Jacket', chatLieu: 'Nylon' }),
        info({ kyHieu: 'CN1', vendorName: 'CN1', productType: 'Croptop', chatLieu: 'Cotton' }),
      ],
      pricing: [priceRow('Men S', 11.94)],
    }]);

    const libIndex = await loadVendorLibraryIndex('global');
    const records = listLibraryRecords(libIndex, { q: 'Football' });

    expect(records).toHaveLength(1);
    expect(records[0].vendorCode).toBe('');
    expect(records[0].chatLieu).toBe('');
  });

  it('dòng giá có Ký hiệu mà Section 1 không có vendor đó → giữ vendor thô, info để TRỐNG', async () => {
    __setLibraryFixture([{
      filename: 'HC_Named_P.Global_16.xlsx',
      generalInfo: [info({ kyHieu: 'CN1', vendorName: 'CN1' })],
      pricing: [priceRow('Men S', 11.94, { kyHieu: 'VN9' })],
    }]);

    const libIndex = await loadVendorLibraryIndex('global');
    const records = listLibraryRecords(libIndex, { q: 'Football' });

    expect(records).toHaveLength(1);
    expect(records[0].vendorCode).toBe('VN9');
    // Chất liệu / AVG TG của CN1 KHÔNG được gán cho VN9 — vendor khác là phôi
    // khác, gán nhầm còn tệ hơn "—" (ca 2 vendor cùng tên phôi).
    expect(records[0].chatLieu).toBe('');
    expect(records[0].avgTimeVendor).toBe('');
  });

  it('Section 1 chỉ điền "Vendor Name" (Ký hiệu trống) → vẫn tra ra vendor đó', async () => {
    __setLibraryFixture([{
      filename: 'HC_VendorNameOnly_P.Global_16.xlsx',
      generalInfo: [info({ kyHieu: '', vendorName: 'CN1' })],
      pricing: [priceRow('Men S', 11.94)],
    }]);

    const libIndex = await loadVendorLibraryIndex('global');
    const records = listLibraryRecords(libIndex, { q: 'Football' });

    expect(records[0].vendorCode).toBe('CN1');
    expect(records[0].chatLieu).toBe('90% Polyester + 10 % spandex');
  });

  it('vendor trống + có record vendor tên rõ ràng cùng phôi → vẫn GỘP như cũ, không tách thêm record suy ra', async () => {
    __setLibraryFixture([{
      filename: 'HC_Carry_P.Global_16.xlsx',
      generalInfo: [info({ kyHieu: 'US3', vendorName: 'US3' })],
      pricing: [
        priceRow('Men S', 11.94),
        priceRow('Men M', 13.96, { kyHieu: 'US3' }),
        priceRow('Men L', 13.96),
      ],
    }]);

    const libIndex = await loadVendorLibraryIndex('global');
    const records = listLibraryRecords(libIndex, { q: 'Football' });

    expect(records).toHaveLength(1);
    expect(records[0].vendorCode).toBe('US3');
    expect([...records[0].sizes].sort()).toEqual(['Men L', 'Men M', 'Men S']);
  });
});
