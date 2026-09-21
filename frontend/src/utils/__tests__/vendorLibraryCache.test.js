// ════════════════════════════════════════════════════════
//  Cache theo ETag cho blob thư viện.
//
//  Màn hình thư viện tải NGUYÊN blob (vài MB) lúc mount, rồi còn tự làm mới nền
//  mỗi lần quay lại tab hoặc Pusher báo có thay đổi. Không có cache thì mỗi lần
//  như vậy là một lần tải lại cả thư viện dù không có gì đổi.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadVendorLibrary, resetVendorLibraryCache } from '../vendorLibraryCache';
import { vendorLibraryApi } from '../../services/api';

vi.mock('../../services/api', () => ({
  vendorLibraryApi: { get: vi.fn() },
}));

const files = (name = 'HappyC_VendorLibrary_p.happy_2026-06.xlsx') => ([{
  id: `id_${name}`,
  filename: name,
  importedAt: '2026-06-01T00:00:00.000Z',
  generalInfo: [{ id: 'g1', kyHieu: 'VN3', productType: 'Football Jersey' }],
  pricing: [{ id: 'p1', kyHieu: 'VN3', size: 'S' }],
}]);

const ok = (data, etag) => ({ status: 200, data, headers: etag ? { etag } : {} });
const notModified = () => ({ status: 304, data: '', headers: {} });

beforeEach(() => {
  vi.clearAllMocks();
  resetVendorLibraryCache();
});

describe('loadVendorLibrary', () => {
  it('lần đầu KHÔNG gửi If-None-Match (chưa có gì để so)', async () => {
    vendorLibraryApi.get.mockResolvedValueOnce(ok(files(), 'W/"abc"'));

    await loadVendorLibrary('all');

    expect(vendorLibraryApi.get).toHaveBeenCalledWith('all', {});
  });

  it('lần sau gửi ETag đã nhận, và 304 thì dùng lại bản cũ', async () => {
    vendorLibraryApi.get.mockResolvedValueOnce(ok(files(), '"abc"'));
    const first = await loadVendorLibrary('all');

    vendorLibraryApi.get.mockResolvedValueOnce(notModified());
    const second = await loadVendorLibrary('all');

    expect(vendorLibraryApi.get).toHaveBeenLastCalledWith('all', { 'If-None-Match': '"abc"' });
    expect(second).toEqual(first);
    expect(second[0].filename).toBe('HappyC_VendorLibrary_p.happy_2026-06.xlsx');
  });

  it('server trả 200 với dữ liệu mới thì thay bản cũ, không giữ bản cũ nữa', async () => {
    vendorLibraryApi.get.mockResolvedValueOnce(ok(files('cu.xlsx'), '"v1"'));
    await loadVendorLibrary('all');

    vendorLibraryApi.get.mockResolvedValueOnce(ok(files('moi.xlsx'), '"v2"'));
    const updated = await loadVendorLibrary('all');

    expect(updated[0].filename).toBe('moi.xlsx');

    // ETag mới phải được dùng cho lần hỏi kế tiếp, không phải ETag cũ.
    vendorLibraryApi.get.mockResolvedValueOnce(notModified());
    await loadVendorLibrary('all');
    expect(vendorLibraryApi.get).toHaveBeenLastCalledWith('all', { 'If-None-Match': '"v2"' });
  });

  /**
   * Server chưa phát ETag (bản backend cũ) thì không được im lặng phục vụ bản
   * cache mãi mãi — phải tải đầy đủ như trước.
   */
  it('server không phát ETag thì lần sau vẫn tải đầy đủ', async () => {
    vendorLibraryApi.get.mockResolvedValueOnce(ok(files(), null));
    await loadVendorLibrary('all');

    vendorLibraryApi.get.mockResolvedValueOnce(ok(files('khac.xlsx'), null));
    const second = await loadVendorLibrary('all');

    expect(vendorLibraryApi.get).toHaveBeenLastCalledWith('all', {});
    expect(second[0].filename).toBe('khac.xlsx');
  });

  it('body không phải mảng thì trả mảng rỗng, không ném lỗi', async () => {
    vendorLibraryApi.get.mockResolvedValueOnce(ok({ message: 'lỗi gì đó' }, '"x"'));

    await expect(loadVendorLibrary('all')).resolves.toEqual([]);
  });

  it('resetVendorLibraryCache xoá cả ETag lẫn dữ liệu', async () => {
    vendorLibraryApi.get.mockResolvedValueOnce(ok(files(), '"abc"'));
    await loadVendorLibrary('all');

    resetVendorLibraryCache();

    vendorLibraryApi.get.mockResolvedValueOnce(ok(files(), '"abc"'));
    await loadVendorLibrary('all');

    expect(vendorLibraryApi.get).toHaveBeenLastCalledWith('all', {});
  });

  it('lỗi mạng KHÔNG làm hỏng cache — lần sau vẫn hỏi bằng ETag cũ', async () => {
    vendorLibraryApi.get.mockResolvedValueOnce(ok(files(), '"abc"'));
    await loadVendorLibrary('all');

    vendorLibraryApi.get.mockRejectedValueOnce(new Error('mạng chập chờn'));
    await expect(loadVendorLibrary('all')).rejects.toThrow('mạng chập chờn');

    vendorLibraryApi.get.mockResolvedValueOnce(notModified());
    await expect(loadVendorLibrary('all')).resolves.toEqual(files());
    expect(vendorLibraryApi.get).toHaveBeenLastCalledWith('all', { 'If-None-Match': '"abc"' });
  });
});
