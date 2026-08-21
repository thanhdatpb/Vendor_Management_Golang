// ════════════════════════════════════════════════════════
//  ADMIN — Quản Lý Nhân Sự: bỏ tiêu đề lặp trong phần nội dung.
//
//  Trang Admin đã in "Quản Lý Nhân Sự" ở thanh header; section in lại một lần
//  nữa ngay dưới đó. Test này chốt việc bỏ, và quan trọng hơn: chốt rằng mọi
//  thứ CÒN LẠI của màn hình (mô tả, nút Thêm, tab theo project/role, bảng nhân
//  sự, banner lỗi tải) vẫn nguyên — xoá markup rất dễ cắt nhầm hàng xóm.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffManagementSection from '../StaffManagementSection';
import { adminUserApi } from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  adminUserApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    toggleStatus: vi.fn(),
  },
}));

const user = (overrides = {}) => ({
  id: 1,
  full_name: 'Dat Tran',
  email: 'happyc.dattran@gmail.com',
  role: 'vendor',
  project: null,
  is_active: true,
  last_seen_at: '2026-08-21T01:00:00.000Z',
  ...overrides,
});

const seller = (project, overrides = {}) =>
  user({ role: 'seller', project, ...overrides });

beforeEach(() => {
  adminUserApi.list.mockReset();
  adminUserApi.list.mockResolvedValue({ data: { users: [
    user({ id: 1, full_name: 'Dat Tran', role: 'vendor' }),
    user({ id: 2, full_name: 'Admin', email: 'hc.thinhnguyen', role: 'admin' }),
    seller('Happy Project', { id: 3, full_name: 'Seller Happy', email: 'happy@hc.vn' }),
    seller('Creative Project', { id: 4, full_name: 'Seller Creative', email: 'creative@hc.vn' }),
    user({ id: 5, full_name: 'PD One', email: 'pd@hc.vn', role: 'pd' }),
  ] } });
});

describe('bỏ tiêu đề lặp trong section', () => {
  it('section KHÔNG in lại "Quản Lý Nhân Sự" (thanh header của trang đã có)', async () => {
    render(<StaffManagementSection />);
    await screen.findByText('Seller Happy');   // tab mặc định = Happy

    expect(screen.queryByText('Quản Lý Nhân Sự')).not.toBeInTheDocument();
  });

  it('dòng mô tả vẫn còn — bỏ tiêu đề chứ không bỏ cả khối header', async () => {
    render(<StaffManagementSection />);

    expect(await screen.findByText('Thêm, sửa hoặc khoá tài khoản nhân sự theo từng dự án')).toBeInTheDocument();
  });
});

describe('phần còn lại của màn hình không bị ảnh hưởng', () => {
  it('nút "Thêm nhân sự" vẫn còn và vẫn mở được modal', async () => {
    const u = userEvent.setup();
    render(<StaffManagementSection />);
    await screen.findByText('Seller Happy');   // tab mặc định = Happy

    await u.click(screen.getByRole('button', { name: /Thêm nhân sự/ }));
    expect(await screen.findByText('Thêm nhân sự mới')).toBeInTheDocument();
  });

  it('đủ 8 tab: 4 project + PD + CSF + Marvel + Admin & Vendor', async () => {
    render(<StaffManagementSection />);
    await screen.findByText('Seller Happy');   // tab mặc định = Happy

    ['Happy', 'Creative', 'Global', 'Hapify84', 'PD', 'CSF', 'Marvel', 'Admin & Vendor']
      .forEach((label) => expect(screen.getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument());
  });

  it('tab đếm đúng số nhân sự của từng nhóm', async () => {
    render(<StaffManagementSection />);
    await screen.findByText('Seller Happy');   // tab mặc định = Happy

    expect(screen.getByRole('button', { name: /^Happy/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /^Creative/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /^PD/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /^Admin & Vendor/ })).toHaveTextContent('2');
  });

  it('bảng vẫn render đủ cột và đúng dòng nhân sự', async () => {
    render(<StaffManagementSection />);
    await screen.findByText('Seller Happy');   // tab mặc định = Happy

    // Header viết hoa bằng CSS textTransform — trong DOM vẫn là chữ thường.
    ['Tên nhân sự', 'Gmail', 'Lần truy cập cuối', 'Thao tác']
      .forEach((h) => expect(screen.getByText(h)).toBeInTheDocument());

    expect(screen.getByText('happy@hc.vn')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Sửa/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Khoá/ }).length).toBeGreaterThan(0);
  });

  it('đổi tab vẫn lọc đúng danh sách', async () => {
    const u = userEvent.setup();
    render(<StaffManagementSection />);
    await screen.findByText('Seller Happy');   // tab mặc định = Happy

    await u.click(screen.getByRole('button', { name: /^Happy/ }));
    expect(await screen.findByText('Seller Happy')).toBeInTheDocument();
    expect(screen.queryByText('Seller Creative')).not.toBeInTheDocument();
  });

  it('API lỗi vẫn hiện banner "dữ liệu KHÔNG bị mất", không im lặng', async () => {
    adminUserApi.list.mockRejectedValue({ response: { status: 500 } });
    render(<StaffManagementSection />);

    expect(await screen.findByText(/Không tải được danh sách nhân sự/)).toBeInTheDocument();
  });
});
