// ════════════════════════════════════════════════════════
//  PriceSheetPage — /price-sheets/:id
//
//  4 trạng thái tải (loading/404/403/lỗi mạng) + 2 nhánh theo role:
//  Admin xem chỉ-đọc (không input, không nút Lưu/Xoá, Lịch sử không có nút
//  Khôi phục — coverage này trước nằm ở PriceSheetSection.test.jsx khi còn
//  là modal, nay chuyển về đây vì view đó chuyển thành trang riêng);
//  Seller ra thẳng PriceSheetWorkspace (sửa được, y hệt lúc mở từ danh sách).
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PriceSheetPage from '../PriceSheetPage';
import { priceSheetApi } from '../../services/api';

const { mockNavigate, routerState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  routerState: { location: { state: null } },
}));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'sheet_1' }),
    useLocation: () => routerState.location,
  };
});

const authState = vi.hoisted(() => ({ isAdmin: false }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isAdmin: authState.isAdmin }),
}));

vi.mock('../../services/api', () => ({
  priceSheetApi: { get: vi.fn(), versions: vi.fn(async () => ({ data: [] })) },
}));

vi.mock('../../components/seller/PriceSheetWorkspace', () => ({
  default: ({ sheet, onClose }) => (
    <div data-testid="workspace">
      <span data-testid="ws-name">{sheet.name}</span>
      <button onClick={onClose}>Đóng workspace</button>
    </div>
  ),
}));

const fullSheet = (overrides = {}) => ({
  id: 'sheet_1', name: 'Legend Shirt', project: 'happy', version: 3,
  vendorRef: 'VN3', updatedBy: 'Seller A', createdBy: 'Seller A',
  settings: { price: 19.9, quantity: 1, amzFeePct: 17, shipPerItem: 2 },
  productTypes: [{
    id: 'pt1', name: 'Football Jersey', phoi: 0, shown: true, customizeInfos: [],
    sizes: [{ id: 'sz1', label: 'S', sizeAdd: 2, itemCost: 8.2 }],
  }],
  history: [],
  ...overrides,
});

const httpError = (status) => Object.assign(new Error('HTTP error'), { response: { status } });

beforeEach(() => {
  priceSheetApi.get.mockReset();
  priceSheetApi.versions.mockClear();
  mockNavigate.mockReset();
  authState.isAdmin = false;
  routerState.location = { state: null };
});

describe('4 trạng thái tải', () => {
  it('404 → thẻ "không tìm thấy" kèm nút quay lại', async () => {
    priceSheetApi.get.mockRejectedValue(httpError(404));

    render(<PriceSheetPage />);

    expect(await screen.findByText('Không tìm thấy bảng tính giá')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Về Bảng tính giá/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/seller/price-sheets');
  });

  it('403 → thẻ "không có quyền", back về mục Bảng Tính Giá của Admin', async () => {
    authState.isAdmin = true;
    priceSheetApi.get.mockRejectedValue(httpError(403));

    render(<PriceSheetPage />);

    expect(await screen.findByText('Bạn không có quyền xem bảng này')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Về Bảng tính giá/ }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/price-sheets');
  });

  it('lỗi mạng → thẻ lỗi kèm nút Thử lại gọi lại get()', async () => {
    priceSheetApi.get.mockRejectedValueOnce(new Error('network down'));
    priceSheetApi.get.mockResolvedValueOnce({ data: fullSheet() });

    render(<PriceSheetPage />);

    expect(await screen.findByText('Không tải được bảng tính giá')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));

    await screen.findByTestId('workspace');
    expect(priceSheetApi.get).toHaveBeenCalledTimes(2);
  });

  // Bảng vừa tạo đi kèm router state: POST lưu lên server có thể chưa xong nên
  // GET sẽ 404 — phải mở thẳng bằng bản trong state, không được rơi vào thẻ
  // "Không tìm thấy bảng tính giá" bắt người dùng quay lại danh sách.
  it('bảng vừa tạo (router state) mở thẳng workspace, không gọi get()', async () => {
    routerState.location = { state: { sheet: fullSheet({ name: 'Bảng vừa tạo' }) } };
    priceSheetApi.get.mockRejectedValue(httpError(404));

    render(<PriceSheetPage />);

    expect(await screen.findByTestId('ws-name')).toHaveTextContent('Bảng vừa tạo');
    expect(priceSheetApi.get).not.toHaveBeenCalled();
  });

  it('router state của bảng KHÁC thì bỏ qua, vẫn tải theo id trên URL', async () => {
    routerState.location = { state: { sheet: fullSheet({ id: 'sheet_khac', name: 'Bảng khác' }) } };
    priceSheetApi.get.mockResolvedValue({ data: fullSheet({ name: 'Bảng đúng' }) });

    render(<PriceSheetPage />);

    expect(await screen.findByTestId('ws-name')).toHaveTextContent('Bảng đúng');
    expect(priceSheetApi.get).toHaveBeenCalledWith('sheet_1');
  });
});

describe('Admin — chỉ xem, không có đường sửa/xoá', () => {
  beforeEach(() => { authState.isAdmin = true; });

  it('render bảng chỉ-đọc, không có input hay nút Lưu/Xoá nào', async () => {
    priceSheetApi.get.mockResolvedValue({ data: fullSheet() });

    render(<PriceSheetPage />);

    await screen.findByText('Chỉ xem — Admin không sửa hay xoá bảng tính giá của Seller ở đây.');
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Lưu/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xoá/ })).not.toBeInTheDocument();
  });

  it('Lịch sử phiên bản mở được nhưng không có nút Khôi phục', async () => {
    priceSheetApi.get.mockResolvedValue({ data: fullSheet() });
    priceSheetApi.versions.mockResolvedValue({
      data: [{ version: 2, savedAt: '2026-08-17T00:00:00.000Z', savedBy: 'Seller A', avgMargin: 40, minPrice: 20, maxPrice: 30, count: 2 }],
    });

    render(<PriceSheetPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Lịch sử phiên bản' }));

    await screen.findByText(/v2/);
    expect(screen.queryByRole('button', { name: /Khôi phục/ })).not.toBeInTheDocument();
  });

  it('có nút Copy link và Export Excel', async () => {
    priceSheetApi.get.mockResolvedValue({ data: fullSheet() });

    render(<PriceSheetPage />);

    expect(await screen.findByRole('button', { name: /Copy link/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export Excel/ })).toBeInTheDocument();
  });
});

describe('Seller — ra thẳng workspace sửa được', () => {
  it('render PriceSheetWorkspace với đúng bảng đã tải', async () => {
    priceSheetApi.get.mockResolvedValue({ data: fullSheet() });

    render(<PriceSheetPage />);

    expect(await screen.findByTestId('ws-name')).toHaveTextContent('Legend Shirt');
  });

  it('đóng workspace thì navigate về mục Bảng Tính Giá của Seller', async () => {
    priceSheetApi.get.mockResolvedValue({ data: fullSheet() });

    render(<PriceSheetPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Đóng workspace' }));

    expect(mockNavigate).toHaveBeenCalledWith('/seller/price-sheets');
  });
});
