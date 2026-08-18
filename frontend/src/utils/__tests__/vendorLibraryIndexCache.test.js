// ════════════════════════════════════════════════════════
//  MỤC 17 — Index thư viện: nhẹ, cache theo ETag, và có đường lùi.
//
//  Trước đây mỗi lần mở MỘT bảng giá là một lần tải NGUYÊN blob thư viện (ảnh,
//  notes, generalInfo) chỉ để lấy danh sách size và giá vốn.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadVendorLibraryIndex, resetVendorLibraryIndexCache,
  findLibraryEntry, getLibraryItemCost, getLibraryShip,
} from '../vendorLibraryIndex';
import { vendorLibraryApi } from '../../services/api';

vi.mock('../../services/api', () => ({
  vendorLibraryApi: {
    index: vi.fn(),
    get: vi.fn(),
  },
}));

/** Record gọn đúng như `GET /vendor-library/index` trả cho role thấy giá. */
const pricedRecords = () => ([
  {
    recordKey: 'a1b2c3',
    productType: 'Football Jersey',
    vendorCode: 'VN3',
    filename: 'HappyC_VendorLibrary_p.happy_2026-06.xlsx',
    project: 'happy',
    sizes: [
      { size: 'S', pricing1: 8.2, eco_price: 4.1, eco_price_item2: 1.1 },
      { size: 'M', pricing1: 8.6, eco_price: 4.1 },
    ],
  },
]);

/** Cùng record nhưng đã bị server strip giá (role CSF/PD/Marvel). */
const strippedRecords = () => ([
  {
    recordKey: 'a1b2c3',
    productType: 'Football Jersey',
    vendorCode: 'VN3',
    filename: 'HappyC_VendorLibrary_p.happy_2026-06.xlsx',
    project: 'happy',
    sizes: [{ size: 'S' }, { size: 'M' }],
  },
]);

const okResponse = (data, etag = 'W/"abc123"') => ({
  status: 200,
  data,
  headers: { etag },
});

beforeEach(() => {
  resetVendorLibraryIndexCache();
  vendorLibraryApi.index.mockReset();
  vendorLibraryApi.get.mockReset();
});

describe('loadVendorLibraryIndex — dùng endpoint index gọn', () => {
  it('dựng index từ record gọn, giữ nguyên hình dạng cũ', async () => {
    vendorLibraryApi.index.mockResolvedValue(okResponse(pricedRecords()));

    const index = await loadVendorLibraryIndex('happy');
    const entry = findLibraryEntry(index, 'Football Jersey');

    expect(entry.vendor).toBe('VN3');
    // Đuôi file bị cắt như bản cũ vẫn làm.
    expect(entry.filename).toBe('HappyC_VendorLibrary_p.happy_2026-06');
    expect(entry.sizes).toEqual(['S', 'M']);
    expect(getLibraryItemCost(entry, 'S')).toBe(8.2);
    expect(getLibraryShip(entry, 'S', 'eco')).toBe(4.1);
  });

  it('KHÔNG tải blob đầy đủ khi endpoint index chạy được', async () => {
    vendorLibraryApi.index.mockResolvedValue(okResponse(pricedRecords()));

    await loadVendorLibraryIndex('happy');

    expect(vendorLibraryApi.get).not.toHaveBeenCalled();
  });

  it('không cho role hẹp tự nới phạm vi: gửi đúng project đang xem', async () => {
    vendorLibraryApi.index.mockResolvedValue(okResponse(pricedRecords()));

    await loadVendorLibraryIndex('happy');
    expect(vendorLibraryApi.index).toHaveBeenCalledWith('happy', {});

    // Role xem-tất-cả (skip=true) không kèm project.
    resetVendorLibraryIndexCache();
    await loadVendorLibraryIndex('happy', true);
    expect(vendorLibraryApi.index).toHaveBeenLastCalledWith('', {});
  });
});

describe('mở bảng thứ hai không tải lại thư viện', () => {
  it('lần sau gửi If-None-Match và dùng lại bản đã có khi server trả 304', async () => {
    vendorLibraryApi.index.mockResolvedValueOnce(okResponse(pricedRecords(), 'W/"etag-1"'));
    const first = await loadVendorLibraryIndex('happy');

    // 304: body RỖNG — nếu code không dùng cache thì index sẽ trống.
    vendorLibraryApi.index.mockResolvedValueOnce({ status: 304, data: '', headers: {} });
    const second = await loadVendorLibraryIndex('happy');

    expect(vendorLibraryApi.index).toHaveBeenLastCalledWith('happy', { 'If-None-Match': 'W/"etag-1"' });
    expect(second).toEqual(first);
    expect(findLibraryEntry(second, 'Football Jersey').sizes).toEqual(['S', 'M']);
  });

  it('thư viện đổi (200 kèm ETag mới) thì nhận dữ liệu mới, không kẹt ở bản cũ', async () => {
    vendorLibraryApi.index.mockResolvedValueOnce(okResponse(pricedRecords(), 'W/"etag-1"'));
    await loadVendorLibraryIndex('happy');

    const updated = pricedRecords();
    updated[0].sizes.push({ size: 'L', pricing1: 9.1 });
    vendorLibraryApi.index.mockResolvedValueOnce(okResponse(updated, 'W/"etag-2"'));

    const index = await loadVendorLibraryIndex('happy');
    expect(findLibraryEntry(index, 'Football Jersey').sizes).toEqual(['S', 'M', 'L']);
  });

  it('đổi project thì không dùng nhầm cache của project trước', async () => {
    vendorLibraryApi.index.mockResolvedValueOnce(okResponse(pricedRecords(), 'W/"etag-1"'));
    await loadVendorLibraryIndex('happy');

    vendorLibraryApi.index.mockResolvedValueOnce(okResponse([], 'W/"etag-creative"'));
    const index = await loadVendorLibraryIndex('creative');

    // Không gửi ETag của project khác lên — nếu gửi, server có thể trả 304 nhầm.
    expect(vendorLibraryApi.index).toHaveBeenLastCalledWith('creative', {});
    expect(Object.keys(index)).toHaveLength(0);
  });
});

describe('role không được xem giá', () => {
  it('vẫn dựng được index size, nhưng không có giá vốn để đọc', async () => {
    vendorLibraryApi.index.mockResolvedValue(okResponse(strippedRecords()));

    const index = await loadVendorLibraryIndex('happy');
    const entry = findLibraryEntry(index, 'Football Jersey');

    expect(entry.sizes).toEqual(['S', 'M']);
    expect(getLibraryItemCost(entry, 'S')).toBeNull();
    expect(getLibraryShip(entry, 'S', 'eco')).toBeNull();
    expect(JSON.stringify(index)).not.toContain('pricing1');
  });
});

describe('đường lùi khi server chưa có endpoint index', () => {
  const legacyBlob = [{
    filename: 'HappyC_VendorLibrary_p.happy_2026-06.xlsx',
    generalInfo: [{ kyHieu: 'VN3', chatLieu: 'Polyester' }],
    pricing: [
      { kyHieu: 'VN3', productType: 'Football Jersey', size: 'S', pricing1: 8.2, eco_price: 4.1 },
      { kyHieu: 'VN3', productType: 'Football Jersey', size: 'N/A', pricing1: 9.9 },
    ],
  }];

  it('404 → quay về tải blob đầy đủ thay vì làm trắng bảng tính giá', async () => {
    vendorLibraryApi.index.mockRejectedValue({ response: { status: 404 }, message: 'Not Found' });
    vendorLibraryApi.get.mockResolvedValue({ data: legacyBlob });

    const index = await loadVendorLibraryIndex('happy');
    const entry = findLibraryEntry(index, 'Football Jersey');

    expect(vendorLibraryApi.get).toHaveBeenCalledWith('all');
    // Dòng size "N/A" bị loại ở cả hai đường.
    expect(entry.sizes).toEqual(['S']);
    expect(getLibraryItemCost(entry, 'S')).toBe(8.2);
  });

  it('lọc project vẫn đúng ở đường lùi', async () => {
    vendorLibraryApi.index.mockRejectedValue({ response: { status: 404 } });
    vendorLibraryApi.get.mockResolvedValue({ data: legacyBlob });

    const index = await loadVendorLibraryIndex('creative');

    expect(Object.keys(index)).toHaveLength(0);
  });
});
