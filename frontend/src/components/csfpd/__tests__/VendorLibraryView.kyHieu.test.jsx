// ════════════════════════════════════════════════════════
//  Cột "Ký hiệu" đã BỎ khỏi bảng Thư Viện Vendor của MỌI bộ phận.
//
//  Cột này trước đây hiện khi có ít nhất 1 dòng mang kyHieu. Nay bỏ hẳn khỏi
//  UI, nhưng TRƯỜNG `kyHieu` trong dữ liệu vẫn phải giữ nguyên — nó là khoá
//  ghép dòng generalInfo với bảng giá để suy ra Link Template. Bỏ luôn cả
//  trường sẽ làm cột Link Template trống.
//
//  Test ở tầng render của TỪNG bộ phận (đúng thứ dashboard dựng ra), vì khai
//  báo đúng mà quên gỡ khỏi JSX thì người dùng vẫn thấy cột.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CsfVendorLibrary from '../CsfVendorLibrary';
import PdVendorLibrary from '../PdVendorLibrary';
import MarvelVendorLibrary from '../MarvelVendorLibrary';
import { vendorLibraryApi } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  vendorLibraryApi: { get: vi.fn() },
}));

vi.mock('../../../services/echo', () => ({
  subscribeVendorLibraryChanges: vi.fn(() => () => {}),
}));

// Node 22+ che mất localStorage của jsdom → dựng bản giả (lớp lọc giá vẫn đọc role).
const asRole = (role) => vi.stubGlobal('localStorage', {
  getItem: (k) => (k === 'user' ? JSON.stringify({ role }) : null),
  setItem: () => {}, removeItem: () => {}, clear: () => {},
});

const VIEW_OF = { csf: CsfVendorLibrary, pd: PdVendorLibrary, marvel: MarvelVendorLibrary };

/** Card file mặc định đang thu gọn — phải bấm mở mới thấy bảng. */
const openFirstCard = async () => {
  const user = userEvent.setup();
  const header = await screen.findByText(/HappyC_VendorLibrary_p\.happy_2026-06/);
  await user.click(header);
};

const library = () => ([{
  id: 'f1',
  filename: 'HappyC_VendorLibrary_p.happy_2026-06.xlsx',
  importedAt: '2026-08-01T00:00:00.000Z',
  generalInfo: [{
    id: 'row-1', kyHieu: 'VN3', vendorName: 'Viet Nam 3', productType: 'Football Jersey',
    chatLieu: 'Polyester 150gsm', chiTietSize: 'S-M-L-XL',
    notes: 'Ghi chu', linkFolder: 'https://drive.example/vn3',
  }],
  pricing: [{ kyHieu: 'VN3', productType: 'Football Jersey', size: 'S', linkTemplate: 'https://drive.example/template-vn3' }],
}]);

beforeEach(() => {
  vendorLibraryApi.get.mockReset();
  vendorLibraryApi.get.mockResolvedValue({ data: library() });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('cột Ký hiệu đã bỏ khỏi mọi bộ phận', () => {
  it.each(['csf', 'pd', 'marvel'])('%s không còn thấy cột Ký hiệu', async (role) => {
    asRole(role);
    const View = VIEW_OF[role];
    render(<View projectKey="happy" />);
    await openFirstCard();

    // Chờ bảng render xong rồi mới khẳng định là KHÔNG có.
    expect(await screen.findByText('Football Jersey')).toBeInTheDocument();

    expect(screen.queryByText('Ký hiệu')).not.toBeInTheDocument();
    // Giá trị kyHieu cũng không được lọt ra ô nào trong bảng.
    expect(screen.queryByText('VN3')).not.toBeInTheDocument();
  });

  it.each(['csf', 'pd', 'marvel'])('%s vẫn thấy đủ các cột còn lại', async (role) => {
    asRole(role);
    const View = VIEW_OF[role];
    render(<View projectKey="happy" />);
    await openFirstCard();

    expect(await screen.findByText('Football Jersey')).toBeInTheDocument();
    expect(screen.getByText('Vendor Name')).toBeInTheDocument();
    expect(screen.getByText('Product Type')).toBeInTheDocument();
    expect(screen.getByText('Viet Nam 3')).toBeInTheDocument();
    expect(screen.getByText('Polyester 150gsm')).toBeInTheDocument();
    expect(screen.getByText('S-M-L-XL')).toBeInTheDocument();
  });

  /**
   * Bỏ CỘT chứ không bỏ TRƯỜNG: kyHieu vẫn là khoá ghép generalInfo ↔ pricing
   * để suy ra Link Template. Mất trường thì ô này trống — hồi quy khó thấy.
   */
  it('Link Template vẫn ghép đúng qua kyHieu dù cột đã ẩn', async () => {
    asRole('csf');
    render(<CsfVendorLibrary projectKey="happy" />);
    await openFirstCard();

    expect(await screen.findByText('Football Jersey')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Template/ });
    expect(link).toHaveAttribute('href', 'https://drive.example/template-vn3');
  });
});
