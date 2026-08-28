// ════════════════════════════════════════════════════════
//  "Tạo bảng tính giá" (CreateSheetModal, trong SetupPriceSection) — dùng
//  lại đúng logic per-record với AddProductTypeModal (mục 03/04), thay cho
//  byPT gộp theo TÊN phôi trước đây: 2 vendor cùng tên bị đè nhau, không gắn
//  libRef, và không nạp Item Cost (chỉ lấy nhãn size, bỏ giá).
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetupPriceSection from '../SetupPriceSection';
import { priceSheetApi, vendorLibraryApi } from '../../../services/api';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../services/api', () => ({
  priceSheetApi: {
    list: vi.fn(async () => ({ data: [] })),
    get: vi.fn(),
    save: vi.fn(async () => ({ data: { version: 1 } })),
    remove: vi.fn(async () => ({ data: {} })),
  },
  vendorLibraryApi: { index: vi.fn(), get: vi.fn() },
}));

vi.mock('../../../services/echo', () => ({
  subscribePriceSheetChanges: vi.fn(() => () => {}),
}));

/** Bản lean-index server trả về — đúng hình dạng loadVendorLibraryIndex ăn được:
 *  mỗi phần tử là 1 record, `sizes` là mảng pricing ROW (không phải nhãn suông). */
const leanRecords = () => [
  {
    recordKey: 'happy::VN3::poster', productType: 'Poster', vendorCode: 'VN3', filename: 'file_happy.xlsx', project: 'happy',
    sizes: [{ size: '8x12', pricing1: '4.39' }, { size: '11x14', pricing1: '4.49' }],
  },
  {
    recordKey: 'happy::VN7::poster', productType: 'Poster', vendorCode: 'VN7', filename: 'file_happy.xlsx', project: 'happy',
    sizes: [{ size: '8x12', pricing1: '5.10' }],
  },
];

const openCreateModal = async () => {
  const user = userEvent.setup();
  render(<SetupPriceSection />);
  await user.click(await screen.findByRole('button', { name: '＋ Tạo bảng tính giá' }));
  return user;
};

beforeEach(() => {
  priceSheetApi.list.mockClear();
  priceSheetApi.save.mockClear();
  vendorLibraryApi.index.mockReset();
  vendorLibraryApi.index.mockResolvedValue({ status: 200, data: leanRecords(), headers: {} });
  mockNavigate.mockReset();
});

describe('Liệt kê theo record — không gộp theo tên phôi', () => {
  it('2 vendor cùng tên "Poster" hiện thành 2 dòng chọn riêng, đúng size của từng vendor', async () => {
    await openCreateModal();

    const rows = (await screen.findAllByText('Poster')).map((el) => el.closest('div[style*="cursor"]') || el.parentElement.parentElement);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Vendor: VN3.*2 size/)).toBeInTheDocument();
    expect(screen.getByText(/Vendor: VN7.*1 size/)).toBeInTheDocument();
  });
});

describe('Tạo bảng từ thư viện — mỗi vendor một Product Type riêng, gắn đúng libRef', () => {
  it('chọn cả 2 record cùng tên khác vendor → sheet có 2 productTypes riêng biệt, mỗi cái gắn libRef đúng vendor', async () => {
    const user = await openCreateModal();

    await user.click(screen.getByText(/Vendor: VN3/));
    await user.click(screen.getByText(/Vendor: VN7/));
    await user.click(screen.getByRole('button', { name: /Tạo từ thư viện \(2\)/ }));

    expect(priceSheetApi.save).toHaveBeenCalled();
    const createdSheet = priceSheetApi.save.mock.calls[0][0];

    expect(createdSheet.productTypes).toHaveLength(2);
    const byVendor = Object.fromEntries(createdSheet.productTypes.map((pt) => [pt.libRef?.vendorCode, pt]));

    expect(byVendor.VN3.name).toBe('Poster');
    expect(byVendor.VN3.libRef.recordKey).toBe('happy::VN3::poster');
    expect(byVendor.VN3.sizes.map((s) => s.label)).toEqual(['8x12', '11x14']);

    expect(byVendor.VN7.name).toBe('Poster');
    expect(byVendor.VN7.libRef.recordKey).toBe('happy::VN7::poster');
    expect(byVendor.VN7.sizes.map((s) => s.label)).toEqual(['8x12']);

    // Trước đây (byPT gộp theo tên) sizes chỉ mang nhãn suông, itemCost rỗng —
    // giờ mỗi PT gắn `libRef` để resolveSheet tự nạp đúng Item Cost của ĐÚNG
    // vendor mỗi khi mở bảng, không cần copy tĩnh giá trị vào đây.
    expect(byVendor.VN3.libRef).toEqual({ recordKey: 'happy::VN3::poster', vendorCode: 'VN3', filename: 'file_happy' });
    expect(byVendor.VN7.libRef).toEqual({ recordKey: 'happy::VN7::poster', vendorCode: 'VN7', filename: 'file_happy' });
  });

  it('vendorRef của sheet gộp đủ cả 2 mã vendor đã chọn', async () => {
    const user = await openCreateModal();

    await user.click(screen.getByText(/Vendor: VN3/));
    await user.click(screen.getByText(/Vendor: VN7/));
    await user.click(screen.getByRole('button', { name: /Tạo từ thư viện \(2\)/ }));

    const createdSheet = priceSheetApi.save.mock.calls[0][0];
    expect(createdSheet.vendorRef).toBe('VN3, VN7');
  });

  it('không chọn gì mà bấm "Tạo từ thư viện" thì báo lỗi, không tạo bảng', async () => {
    const user = await openCreateModal();
    await user.click(screen.getByRole('button', { name: /Tạo từ thư viện \(0\)/ }));

    expect(await screen.findByText('Chưa chọn')).toBeInTheDocument();
    expect(priceSheetApi.save).not.toHaveBeenCalled();
  });
});

describe('Bộ lọc theo vendor trong modal tạo bảng (mục 05, đồng bộ AddProductTypeModal)', () => {
  it('bấm chip vendor thì chỉ còn record của vendor đó', async () => {
    const user = await openCreateModal();

    await user.click(await screen.findByRole('button', { name: 'VN7' }));

    expect(screen.queryByText(/Vendor: VN3/)).not.toBeInTheDocument();
    expect(screen.getByText(/Vendor: VN7/)).toBeInTheDocument();
  });
});
