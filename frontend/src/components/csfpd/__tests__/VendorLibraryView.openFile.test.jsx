// ════════════════════════════════════════════════════════
//  CSF / PD / Marvel — mở một file thư viện thành cửa sổ có URL riêng
//
//  Ba role này chỉ tra cứu, nhưng cũng cần gửi link file cho nhau. Cùng cơ chế
//  với danh sách của Admin/Vendor/Seller: bấm hàng → URL đổi → cửa sổ hiện ra.
//  Điều phải canh thêm ở đây: cửa sổ KHÔNG được để lọt cột giá.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import CsfVendorLibrary from '../CsfVendorLibrary';
import { vendorLibraryApi } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() },
  vendorLibraryApi: { get: vi.fn() },
}));

vi.mock('../../../services/echo', () => ({
  subscribeVendorLibraryChanges: vi.fn(() => () => {}),
}));

const asRole = (role) => vi.stubGlobal('localStorage', {
  getItem: (k) => (k === 'user' ? JSON.stringify({ role, project: 'happy' }) : null),
  setItem: () => {}, removeItem: () => {}, clear: () => {},
});

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="url">{location.pathname}</div>;
}

const library = () => ([{
  id: 'f1',
  filename: 'HappyC_VendorLibrary_p.happy_2026-06.xlsx',
  importedAt: '2026-06-10T08:00:00.000Z',
  title: 'Football Jersey',
  generalInfo: [{ id: 'g1', kyHieu: 'VN3', vendorName: 'VN3', productType: 'Football Jersey' }],
  // Server đã cắt cột giá cho 3 role này; giữ đúng hình dạng đó trong test.
  pricing: [{ kyHieu: 'VN3', productType: 'Football Jersey', size: 'S', linkTemplate: 'https://drive.example/t' }],
}]);

const renderAt = (path = '/csf/happy') => render(
  <MemoryRouter initialEntries={[path]}>
    <CsfVendorLibrary projectKey="happy" />
    <LocationProbe />
  </MemoryRouter>
);

beforeEach(() => {
  asRole('csf');
  vendorLibraryApi.get.mockReset();
  vendorLibraryApi.get.mockResolvedValue({ data: library() });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('bấm vào một file', () => {
  it('đổi URL sang /library/:fileId và mở cửa sổ', async () => {
    renderAt();

    await userEvent.click(await screen.findByText(/HappyC_VendorLibrary_p\.happy_2026-06/));

    await waitFor(() => {
      expect(screen.getByTestId('url')).toHaveTextContent('/library/f1/');
    });
    expect(screen.getByRole('region', { name: 'Tháng 6/2026' })).toBeInTheDocument();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Football Jersey').length).toBeGreaterThan(0);
  });

  it('mở thẳng bằng URL của file cũng ra đúng cửa sổ đó', async () => {
    renderAt('/library/f1/happyc-vendorlibrary-p-happy-2026-06');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('có nút copy link ngay trên hàng file', async () => {
    renderAt();

    expect(await screen.findByRole('button', { name: /Copy link file/ })).toBeInTheDocument();
  });

  it('cửa sổ không dựng cột giá nào', async () => {
    renderAt('/library/f1');

    await screen.findByRole('dialog');
    for (const label of ['P1', 'P2', 'Economy', 'Ground', 'Express', 'Overnight']) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });
});
