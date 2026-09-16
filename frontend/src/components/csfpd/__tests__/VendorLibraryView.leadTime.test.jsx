// ════════════════════════════════════════════════════════
//  2 cột "AVG TG" phải BIẾN MẤT khỏi bảng của PD và Marvel, CSF thì vẫn còn.
//
//  Test thẳng vào component CỦA TỪNG BỘ PHẬN — đúng thứ dashboard render ra.
//  Test ở tầng render chứ không chỉ tầng hàm: khai báo có đúng mà quên nối vào
//  JSX thì người dùng vẫn thấy cột — đó mới là lỗi thật.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// View đọc URL để biết có đang mở cửa sổ một file hay không (/library/:fileId)
// nên mọi lần render phải nằm trong Router.
const render = (ui, options) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>, options);
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
    avgTimeVendor: 'Thoi gian sx 3-5 normal days',
    avgTimeActual: 'update sau 3 tuan chay phoi nay',
    notes: 'Ghi chu', linkFolder: 'https://drive.example/vn3',
  }],
  pricing: [{ kyHieu: 'VN3', productType: 'Football Jersey', size: 'S' }],
}]);

beforeEach(() => {
  vendorLibraryApi.get.mockReset();
  vendorLibraryApi.get.mockResolvedValue({ data: library() });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('2 cột AVG TG theo role', () => {
  it('CSF vẫn thấy đủ 2 cột', async () => {
    asRole('csf');
    render(<CsfVendorLibrary projectKey="happy" />);
    await openFirstCard();

    expect(await screen.findByText('AVG TG (Vendor)')).toBeInTheDocument();
    expect(screen.getByText('AVG TG (Thực tế)')).toBeInTheDocument();
    expect(screen.getByText('Thoi gian sx 3-5 normal days')).toBeInTheDocument();
  });

  it.each(['pd', 'marvel'])('%s không thấy cột nào trong 2 cột đó', async (role) => {
    asRole(role);
    const View = VIEW_OF[role];
    render(<View projectKey="happy" />);
    await openFirstCard();

    // Chờ bảng render xong rồi mới khẳng định là KHÔNG có.
    expect(await screen.findByText('Football Jersey')).toBeInTheDocument();

    expect(screen.queryByText('AVG TG (Vendor)')).not.toBeInTheDocument();
    expect(screen.queryByText('AVG TG (Thực tế)')).not.toBeInTheDocument();
    expect(screen.queryByText('Thoi gian sx 3-5 normal days')).not.toBeInTheDocument();
    expect(screen.queryByText('update sau 3 tuan chay phoi nay')).not.toBeInTheDocument();
  });

  it('PD vẫn thấy đủ phần tra cứu còn lại', async () => {
    asRole('pd');
    render(<PdVendorLibrary projectKey="happy" />);
    await openFirstCard();

    expect(await screen.findByText('Football Jersey')).toBeInTheDocument();
    expect(screen.getByText('Polyester 150gsm')).toBeInTheDocument();
    expect(screen.getByText('S-M-L-XL')).toBeInTheDocument();
    expect(screen.getByText('Viet Nam 3')).toBeInTheDocument();
  });

  /**
   * Server đã lọc 2 trường rồi thì bảng của CSF cũng không dựng nổi cột có dữ
   * liệu — nhưng tiêu đề cột vẫn phải còn, và ô hiện "—" thay vì vỡ layout.
   */
  it('CSF: server không trả 2 trường thì cột vẫn còn, ô hiện "—"', async () => {
    const files = library();
    delete files[0].generalInfo[0].avgTimeVendor;
    delete files[0].generalInfo[0].avgTimeActual;
    vendorLibraryApi.get.mockResolvedValue({ data: files });

    asRole('csf');
    render(<CsfVendorLibrary projectKey="happy" />);
    await openFirstCard();

    expect(await screen.findByText('AVG TG (Vendor)')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
