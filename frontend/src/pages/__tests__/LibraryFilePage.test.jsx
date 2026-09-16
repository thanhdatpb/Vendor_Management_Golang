// ════════════════════════════════════════════════════════
//  LibraryFilePage — /library/:fileId
//
//  Màn hình người nhận link thấy khi mở từ Slack/email. Bốn trạng thái tải
//  (loading / 404 / 403 / lỗi mạng), hai nhánh theo role (thấy giá → 2 tab của
//  thư viện; CSF/PD/Marvel → bảng gộp), và đường cứu link cũ theo tên file.
//
//  403 phải KHÁC 404: người nhận cần biết file có thật, chỉ là ngoài phạm vi
//  project của họ — nếu không họ tưởng link hỏng và đi nhắn lại người gửi.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryFilePage from '../LibraryFilePage';
import { vendorLibraryApi } from '../../services/api';

const { mockNavigate, routeParams } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  routeParams: { current: { fileId: 'file_1', slug: 'baby-bodysuit' } },
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => routeParams.current };
});

const authState = vi.hoisted(() => ({ user: { role: 'admin' } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => authState }));

vi.mock('../../services/api', () => ({
  default: { get: vi.fn() },
  vendorLibraryApi: { getFile: vi.fn(), getFileByName: vi.fn() },
}));

// Hai view nội dung được thay bằng bản giả: bộ test này lo phần TRẠNG THÁI và
// phần CHỌN view, không lo bảng bên trong (đã có test riêng).
vi.mock('../../components/vendor/sections/VendorLibraryViewer', () => ({
  LibraryCard: ({ entry }) => <div data-testid="hai-tab">{entry.filename}</div>,
  renderChiTietSizeText: (t) => t,
}));
vi.mock('../../components/csfpd/VendorLibraryView', () => ({
  MergedInfoTable: ({ showLeadTime }) => (
    <div data-testid="bang-gop">{showLeadTime ? 'có AVG TG' : 'không AVG TG'}</div>
  ),
}));

const file = (overrides = {}) => ({
  id: 'file_1',
  filename: 'Baby Bodysuit',
  importedAt: '2026-09-15T14:29:00.000Z',
  title: 'Baby Bodysuit',
  generalInfo: [{ id: 'g1', vendorName: 'US1', productType: 'Baby Bodysuit_US1W' }],
  pricing: [{ kyHieu: 'US1', size: 'NB - 24M' }],
  counts: { generalInfo: 1, pricing: 1 },
  ...overrides,
});

const httpError = (status) => Object.assign(new Error('HTTP error'), { response: { status } });

beforeEach(() => {
  vendorLibraryApi.getFile.mockReset();
  vendorLibraryApi.getFileByName.mockReset();
  mockNavigate.mockReset();
  authState.user = { role: 'admin' };
  routeParams.current = { fileId: 'file_1', slug: 'baby-bodysuit' };
});

describe('bốn trạng thái tải', () => {
  it('404 → nói rõ không tìm thấy, kèm đường về thư viện', async () => {
    vendorLibraryApi.getFile.mockRejectedValue(httpError(404));

    render(<LibraryFilePage />);

    expect(await screen.findByText('Không tìm thấy file này')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Về Thư viện Vendor/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/vendors');
  });

  it('403 → nói rõ là vấn đề quyền, KHÔNG phải link hỏng', async () => {
    vendorLibraryApi.getFile.mockRejectedValue(httpError(403));

    render(<LibraryFilePage />);

    expect(await screen.findByText('Bạn không có quyền xem file này')).toBeInTheDocument();
    expect(screen.getByText(/project khác với tài khoản của bạn/)).toBeInTheDocument();
  });

  it('lỗi mạng → có nút thử lại, gọi lại API', async () => {
    vendorLibraryApi.getFile.mockRejectedValue(httpError(500));

    render(<LibraryFilePage />);

    await screen.findByText('Không mở được file');
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(vendorLibraryApi.getFile).toHaveBeenCalledTimes(2);
  });

  it('tải xong → cửa sổ file với tên file trên tiêu đề', async () => {
    vendorLibraryApi.getFile.mockResolvedValue({ data: file() });

    render(<LibraryFilePage />);

    expect(await screen.findByRole('dialog', { name: 'Baby Bodysuit' })).toBeInTheDocument();
    expect(screen.getByText(/1 phôi · 1 dòng giá/)).toBeInTheDocument();
  });
});

describe('view theo role', () => {
  it('mở từ danh sách dùng ngay file đã tải, không chờ gọi API lần hai', async () => {
    render(<LibraryFilePage initialFile={file()} />);

    expect(screen.getByRole('dialog', { name: 'Baby Bodysuit' })).toBeInTheDocument();
    expect(vendorLibraryApi.getFile).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Đóng cửa sổ file' }));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('role xem được giá → 2 tab quen thuộc của thư viện', async () => {
    vendorLibraryApi.getFile.mockResolvedValue({ data: file() });

    render(<LibraryFilePage />);

    expect(await screen.findByTestId('hai-tab')).toBeInTheDocument();
    expect(screen.queryByTestId('bang-gop')).not.toBeInTheDocument();
  });

  it('CSF → bảng gộp, có cột AVG TG', async () => {
    authState.user = { role: 'csf' };
    vendorLibraryApi.getFile.mockResolvedValue({ data: file() });

    render(<LibraryFilePage />);

    expect(await screen.findByTestId('bang-gop')).toHaveTextContent('có AVG TG');
    expect(screen.queryByTestId('hai-tab')).not.toBeInTheDocument();
  });

  it('PD → bảng gộp, KHÔNG có cột AVG TG', async () => {
    authState.user = { role: 'pd' };
    vendorLibraryApi.getFile.mockResolvedValue({ data: file() });

    render(<LibraryFilePage />);

    expect(await screen.findByTestId('bang-gop')).toHaveTextContent('không AVG TG');
  });

  it('đóng cửa sổ đưa về đúng mục thư viện của role đó', async () => {
    authState.user = { role: 'vendor' };
    vendorLibraryApi.getFile.mockResolvedValue({ data: file() });

    render(<LibraryFilePage />);
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByRole('button', { name: 'Đóng cửa sổ file' }));
    expect(mockNavigate).toHaveBeenCalledWith('/vendor/library');
  });
});

describe('link cũ chỉ có tên file', () => {
  it('tra theo tên rồi viết lại URL sang dạng chuẩn, không đẻ thêm bước lịch sử', async () => {
    routeParams.current = { fileId: 'by-name', slug: 'Baby Bodysuit' };
    vendorLibraryApi.getFileByName.mockResolvedValue({ data: file() });

    render(<LibraryFilePage />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/library/file_1/baby-bodysuit', { replace: true });
    });
    expect(vendorLibraryApi.getFile).not.toHaveBeenCalled();
  });

  it('tên không có trong thư viện → 404 như link hỏng', async () => {
    routeParams.current = { fileId: 'by-name', slug: 'Khong Co' };
    vendorLibraryApi.getFileByName.mockRejectedValue(httpError(404));

    render(<LibraryFilePage />);

    expect(await screen.findByText('Không tìm thấy file này')).toBeInTheDocument();
  });
});
