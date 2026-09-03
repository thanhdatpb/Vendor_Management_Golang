// ════════════════════════════════════════════════════════
//  ADMIN — Tổng Quan: bảng "Lịch sử Form" của từng project.
//
//  Trước đây modal chỉ có 7 cột rút gọn và không bấm được vào dòng nào. Test
//  này chốt 2 điều: (1) bộ cột trùng với bảng danh sách sản phẩm của role
//  Vendor (ID / Project / Nhân sự request / Product Type / Ảnh / Ngày request /
//  Deadline Date / Vendor), (2) bấm vào 1 dòng thì gọi API lấy bản đầy đủ và mở
//  modal chi tiết sản phẩm giống role Vendor.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormHistoryModal from '../FormHistoryModal';
import { productApi } from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  productApi: {
    getById: vi.fn(),
  },
  notificationApi: {
    list: vi.fn(),
    markRead: vi.fn(),
  },
}));

// Node 22 tắt localStorage của chính nó và che mất bản của jsdom → tự dựng
// storage trong bộ nhớ cho riêng file test này (không đụng setup dùng chung).
if (!window.localStorage) {
  let data = {};
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: k => (k in data ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: k => { delete data[k]; },
      clear: () => { data = {}; },
    },
  });
}

const product = (overrides = {}) => ({
  id: 5,
  project: 'creative',
  product_type: 'Wrapped Canvas',
  status: 'approved',
  seller_name: 'Huyen Vo',
  created_at: '2026-08-14T02:00:00.000Z',
  deadline_date: '2026-08-26T02:00:00.000Z',
  assigned_vendors: [{ name: 'US4' }],
  ...overrides,
});

const baseProps = {
  open: true,
  onClose: vi.fn(),
  title: 'Lịch sử Form — Creative Project (Đã Duyệt)',
  filterType: 'project',
  filterValue: 'Creative Project',
  initialStatus: 'approved',
  allProducts: [product()],
};

beforeEach(() => {
  window.localStorage.clear();
  productApi.getById.mockReset();
  productApi.getById.mockResolvedValue({ data: { data: product() } });
});

describe('FormHistoryModal — bộ cột', () => {
  it('hiện đủ cột như bảng sản phẩm của role Vendor', () => {
    render(<FormHistoryModal {...baseProps} />);

    ['ID', 'Project', 'Nhân sự request', 'Product Type', 'Ảnh', 'Ngày request', 'Deadline Date', 'Vendor']
      .forEach(col => expect(screen.getByRole('columnheader', { name: col })).toBeInTheDocument());
  });

  it('ẩn cột Trạng thái khi đã lọc sẵn 1 trạng thái, hiện lại khi xem tất cả', () => {
    const { rerender } = render(<FormHistoryModal {...baseProps} />);
    expect(screen.queryByRole('columnheader', { name: 'Trạng thái' })).not.toBeInTheDocument();

    rerender(<FormHistoryModal {...baseProps} initialStatus="all" />);
    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();
  });

  it('điền dữ liệu request: nhân sự, product type, vendor đã gán', () => {
    render(<FormHistoryModal {...baseProps} />);

    const row = screen.getByText('Wrapped Canvas').closest('tr');
    expect(within(row).getByText('Huyen Vo')).toBeInTheDocument();
    expect(within(row).getByText('US4')).toBeInTheDocument();
  });

  it('không có vendor được gán thì lấy tên vendor từ Thư viện Vendor', () => {
    window.localStorage.setItem('STAFF_VENDOR_LIST_V1', JSON.stringify([
      { product_type: 'Wrapped Canvas', name: 'CN4' },
    ]));

    render(<FormHistoryModal {...baseProps} allProducts={[product({ assigned_vendors: null })]} />);

    const row = screen.getByText('Wrapped Canvas').closest('tr');
    expect(within(row).getByText('CN4')).toBeInTheDocument();
  });
});

describe('FormHistoryModal — mở chi tiết request', () => {
  it('bấm vào dòng thì gọi API và mở modal chi tiết sản phẩm', async () => {
    render(<FormHistoryModal {...baseProps} />);

    await userEvent.click(screen.getByText('Wrapped Canvas'));

    expect(productApi.getById).toHaveBeenCalledWith(5);
    expect(await screen.findByText('Chi tiết sản phẩm')).toBeInTheDocument();
  });

  it('API lỗi thì vẫn mở chi tiết bằng dữ liệu có sẵn trong danh sách', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    productApi.getById.mockRejectedValue(new Error('network down'));

    render(<FormHistoryModal {...baseProps} />);
    await userEvent.click(screen.getByText('Wrapped Canvas'));

    expect(await screen.findByText('Chi tiết sản phẩm')).toBeInTheDocument();
  });
});
