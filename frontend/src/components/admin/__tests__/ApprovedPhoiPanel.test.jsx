// ════════════════════════════════════════════════════════
//  Khối "Thống kê phôi" của Admin trên Tổng quan Vendor & Sản phẩm
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApprovedPhoiPanel from '../ApprovedPhoiPanel';
import { productApi } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  productApi: { getApprovedProducts: vi.fn() },
}));
vi.mock('../../../services/echo', () => ({
  subscribeProductChanges: vi.fn(() => () => {}),
}));

const sized = (fileId, rowId, vendor, productType) => [
  { id: `${rowId}_0`, excel_row_id: rowId, source_file_id: fileId, is_excel: true, name: vendor, vendor_type: productType, size: 'S' },
  { id: `${rowId}_1`, excel_row_id: rowId, source_file_id: fileId, is_excel: true, name: vendor, vendor_type: productType, size: 'M' },
];

const PRODUCTS = [
  { id: 1, status: 'approved', project: 'Happy Project', submitted_at: '2026-09-18T03:00:00Z', reviewed_at: '2026-09-22T03:00:00Z', assigned_vendors: sized('f1', 'r1', 'US1', 'T-shirt 2D Unisex') },
  { id: 2, status: 'approved', project: 'Global Project', submitted_at: '2026-09-15T03:00:00Z', reviewed_at: '2026-09-21T03:00:00Z', assigned_vendors: sized('f2', 'r2', 'VN3', 'Car Clip Acrylic') },
  // Đã duyệt nhưng chưa được cung cấp vendor → không được xuất hiện ở đâu
  { id: 3, status: 'approved', project: 'Happy Project', submitted_at: '2026-09-19T03:00:00Z', reviewed_at: '2026-09-20T03:00:00Z', assigned_vendors: [] },
];

const FILES = [
  { id: 'f1', filename: 'T-shirt 2D', importedAt: '2026-09-20T03:00:00Z', generalInfo: [{ id: 'g1', vendorName: 'US1', productType: 'Tee Bella' }, { id: 'g2', vendorName: 'US1', productType: 'Tee Gildan' }] },
  { id: 'f2', filename: 'Car Clip Acrylic', importedAt: '2026-09-21T03:00:00Z', generalInfo: [{ id: 'g3', vendorName: 'VN3', productType: 'Clip Round' }, { id: 'g4', vendorName: 'VN3', productType: 'Clip Heart' }, { id: 'g5', vendorName: 'VN3', productType: 'Clip Star' }] },
];

const store = {};
vi.stubGlobal('localStorage', {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
});

beforeEach(() => {
  localStorage.clear();
  productApi.getApprovedProducts.mockResolvedValue({ data: { data: PRODUCTS } });
});

const panel = () => screen.getByRole('region', { name: 'Thống kê phôi' });

describe('ApprovedPhoiPanel', () => {
  it('hai số riêng: phôi đã duyệt (có vendor) và phôi trong thư viện', async () => {
    render(<ApprovedPhoiPanel files={FILES} />);

    await screen.findByText('T-shirt 2D Unisex');
    const p = within(panel());
    expect(p.getByRole('group', { name: 'Phôi đã duyệt' })).toHaveTextContent('2');
    expect(p.getByRole('group', { name: 'Phôi trong thư viện' })).toHaveTextContent('5');
    expect(p.getByText('Trong 2 file vendor đang hoạt động')).toBeInTheDocument();
    // Không còn tỷ lệ gộp giữa hai số
    expect(panel()).not.toHaveTextContent('%');
  });

  it('bảng Mới duyệt: phôi, vendor, project, ngày request, ngày duyệt', async () => {
    render(<ApprovedPhoiPanel files={FILES} />);

    const row = (await screen.findByText('T-shirt 2D Unisex')).closest('tr');
    const r = within(row);
    expect(r.getByText('US1')).toBeInTheDocument();
    expect(r.getByText('Happy')).toBeInTheDocument();
    expect(r.getByText('18/09/2026')).toBeInTheDocument();
    expect(r.getByText('22/09/2026')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // tiêu đề + 2 phôi (Request #3 không có vendor)
  });

  it('bấm vendor thì báo lên để lọc thư viện; bấm lại thì bỏ lọc', async () => {
    const onVendorFilterChange = vi.fn();
    const { rerender } = render(<ApprovedPhoiPanel files={FILES} onVendorFilterChange={onVendorFilterChange} />);
    await screen.findByText('T-shirt 2D Unisex');

    await userEvent.click(screen.getByRole('button', { name: /^VN3:/ }));
    expect(onVendorFilterChange).toHaveBeenLastCalledWith('VN3');

    rerender(<ApprovedPhoiPanel files={FILES} vendorFilter="VN3" onVendorFilterChange={onVendorFilterChange} />);
    expect(screen.getByRole('button', { name: /^VN3:/ })).toHaveAttribute('aria-pressed', 'true');
    // Bảng Mới duyệt chỉ còn phôi của VN3
    expect(screen.queryByText('T-shirt 2D Unisex')).not.toBeInTheDocument();
    expect(screen.getByText('Car Clip Acrylic')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^VN3:/ }));
    expect(onVendorFilterChange).toHaveBeenLastCalledWith('');
  });

  it('đang chọn vendor: liệt kê mọi phôi của vendor, tách Đã duyệt / Trong thư viện', async () => {
    const onVendorFilterChange = vi.fn();
    render(<ApprovedPhoiPanel files={FILES} vendorFilter="VN3" onVendorFilterChange={onVendorFilterChange} />);

    expect(await screen.findByRole('heading', { name: 'Phôi của VN3' })).toBeInTheDocument();
    // Tab Đã duyệt mặc định: phôi + project + ngày
    const approvedTab = screen.getByRole('button', { name: 'Đã duyệt (1)' });
    expect(approvedTab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Car Clip Acrylic').closest('tr')).toHaveTextContent('Global');

    // Tab Trong thư viện: đủ 3 phôi của VN3 kèm tên file
    await userEvent.click(screen.getByRole('button', { name: 'Trong thư viện (3)' }));
    ['Clip Round', 'Clip Heart', 'Clip Star'].forEach((name) => expect(screen.getByText(name)).toBeInTheDocument());
    expect(screen.getByText('Clip Round').closest('tr')).toHaveTextContent('Car Clip Acrylic');
    expect(screen.queryByText('Tee Bella')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc' }));
    expect(onVendorFilterChange).toHaveBeenLastCalledWith('');
  });

  it('vendor chưa có phôi duyệt thì mở thẳng tab Trong thư viện', async () => {
    productApi.getApprovedProducts.mockResolvedValue({ data: { data: [] } });
    render(<ApprovedPhoiPanel files={FILES} vendorFilter="US1" onVendorFilterChange={vi.fn()} />);
    expect(await screen.findByText('Tee Bella')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trong thư viện (2)' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('nhiều vendor thì hiện 6, còn lại mở bằng Xem tất cả vendor', async () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: 'm' + i, filename: 'F' + i, generalInfo: [{ id: 'x' + i, vendorName: 'V' + (i + 1), productType: 'P' }] }));
    productApi.getApprovedProducts.mockResolvedValue({ data: { data: [] } });
    render(<ApprovedPhoiPanel files={many} onVendorFilterChange={vi.fn()} />);
    await screen.findByText('Chưa có phôi nào được duyệt và cung cấp vendor.');
    const vendorButtons = () => screen.getAllByRole('button', { name: /phôi trong thư viện$/ });
    expect(vendorButtons()).toHaveLength(6);
    await userEvent.click(screen.getByRole('button', { name: 'Xem tất cả vendor (9)' }));
    expect(vendorButtons()).toHaveLength(9);
  });

  it('lọc Project áp cho phôi đã duyệt', async () => {
    render(<ApprovedPhoiPanel files={FILES} projectFilter="global" />);
    await screen.findByText('Car Clip Acrylic');
    expect(screen.queryByText('T-shirt 2D Unisex')).not.toBeInTheDocument();
    expect(within(panel()).getByRole('group', { name: 'Phôi đã duyệt' })).toHaveTextContent('1');
  });

  it('thu gọn còn một dòng và nhớ lựa chọn', async () => {
    const { unmount } = render(<ApprovedPhoiPanel files={FILES} />);
    await screen.findByText('T-shirt 2D Unisex');

    await userEvent.click(screen.getByRole('button', { name: /Thu gọn/ }));
    expect(panel()).toHaveTextContent('2 phôi đã duyệt · 5 phôi trong thư viện');
    unmount();

    render(<ApprovedPhoiPanel files={FILES} />);
    expect(screen.getByRole('button', { name: /Mở thống kê/ })).toBeInTheDocument();
  });

  it('tải lỗi thì báo và cho thử lại', async () => {
    productApi.getApprovedProducts.mockRejectedValueOnce(new Error('network'));
    render(<ApprovedPhoiPanel files={FILES} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh sách phôi đã duyệt.');
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getByText('T-shirt 2D Unisex')).toBeInTheDocument());
  });
});
