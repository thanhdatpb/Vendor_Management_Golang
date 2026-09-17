// ════════════════════════════════════════════════════════
//  Ô lọc theo vendor ở Thư viện Vendor (role Vendor / Admin)
//
//  Bug thật (2026-09-17): chọn VN1 thì danh sách chỉ còn file có VN1, nhưng mở
//  file nhiều vendor vẫn thấy cả phôi của CN1, VN3. Điều bộ test này canh:
//    1. Card + cửa sổ file chỉ còn phôi và dòng giá của vendor đang lọc.
//    2. Lưu từ cửa sổ đang lọc KHÔNG xoá dòng của vendor khác đang bị ẩn.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VendorLibraryViewer from '../VendorLibraryViewer';
import { vendorLibraryApi } from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  default: { get: vi.fn() },
  vendorLibraryApi: {
    get: vi.fn(),
    save: vi.fn(),
    setSampleStatus: vi.fn(),
    setBestSeller: vi.fn(),
  },
}));

vi.mock('../../../../services/echo', () => ({
  subscribeVendorLibraryChanges: vi.fn(() => () => {}),
}));

vi.mock('../../../../utils/vendorExcel', () => ({
  parseHappyCreativeLibrary: vi.fn(),
  downloadVendorLibraryTemplate: vi.fn(),
  exportVendorLibraryFiles: vi.fn(),
}));

let currentUser = { role: 'vendor', name: 'Vendor A' };
vi.stubGlobal('localStorage', {
  getItem: (k) => (k === 'user' ? JSON.stringify(currentUser) : null),
  setItem: () => {}, removeItem: () => {}, clear: () => {},
});

const general = (id, vendor, productType) => ({ id, kyHieu: vendor, vendorName: vendor, productType, chatLieu: `${vendor} fabric` });
const price = (kyHieu, productType, size, pricing1) => ({ kyHieu, productType, size, pricing1 });

const MULTI_VENDOR_FILE = {
  id: 'f_croptop',
  filename: 'HC_Croptop_P.Happy',
  importedAt: '2026-08-21T10:03:00.000Z',
  title: 'Croptop',
  generalInfo: [
    general('g_cn1', 'CN1', 'Croptop Cotton'),
    general('g_vn1', 'VN1', 'Croptop Poly'),
    general('g_vn3', 'VN3', 'Croptop Linen'),
  ],
  pricing: [
    price('CN1', 'Croptop Cotton', 'S', 1.11),
    price('VN1', 'Croptop Poly', 'S', 2.22),
    price('', 'Croptop Poly', 'M', 3.33),
    price('VN3', 'Croptop Linen', 'S', 4.44),
  ],
  sourceTab: 'all',
  projects: [],
};

const renderViewer = (props = {}) => render(
  <MemoryRouter initialEntries={['/vendor/library']}>
    <VendorLibraryViewer {...props} />
  </MemoryRouter>
);

const vendorSelect = () => screen.getByRole('combobox', { name: 'Lọc theo vendor' });

beforeEach(() => {
  currentUser = { role: 'vendor', name: 'Vendor A' };
  vendorLibraryApi.get.mockReset();
  vendorLibraryApi.save.mockReset();
  vendorLibraryApi.get.mockResolvedValue({ data: [MULTI_VENDOR_FILE] });
  vendorLibraryApi.save.mockResolvedValue({ data: { message: 'ok' } });
});

describe('ô lọc theo vendor', () => {
  it('card của file nhiều vendor chỉ còn vendor đang lọc', async () => {
    renderViewer();
    await screen.findByText('HC_Croptop_P.Happy');
    expect(screen.getByText('CN1, VN1, VN3')).toBeInTheDocument();

    await userEvent.selectOptions(vendorSelect(), 'VN1');

    expect(screen.queryByText('CN1, VN1, VN3')).not.toBeInTheDocument();
    expect(screen.getByText('1 sản phẩm · 2 dòng giá')).toBeInTheDocument();
  });

  it('mở file khi đang lọc VN1 thì chỉ thấy phôi và dòng giá của VN1', async () => {
    renderViewer();
    await screen.findByText('HC_Croptop_P.Happy');
    await userEvent.selectOptions(vendorSelect(), 'VN1');

    await userEvent.click(screen.getByText('HC_Croptop_P.Happy'));
    const dialog = await screen.findByRole('dialog', { name: 'HC_Croptop_P.Happy' });

    expect(within(dialog).getByText(/1 phôi · 2 dòng giá/)).toBeInTheDocument();
    expect(within(dialog).getByText('Đang lọc vendor · ẩn 2 phôi khác')).toBeInTheDocument();
    expect(within(dialog).getByText('VN1 fabric')).toBeInTheDocument();
    expect(within(dialog).queryByText('CN1 fabric')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('VN3 fabric')).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: /Về giá/ }));

    expect(within(dialog).getAllByText('Croptop Poly')).toHaveLength(2);
    expect(within(dialog).queryByText('Croptop Cotton')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('Croptop Linen')).not.toBeInTheDocument();
  });

  it('không lọc thì cửa sổ file vẫn hiện đủ mọi vendor', async () => {
    renderViewer();
    await userEvent.click(await screen.findByText('HC_Croptop_P.Happy'));
    const dialog = await screen.findByRole('dialog', { name: 'HC_Croptop_P.Happy' });

    expect(within(dialog).getByText(/3 phôi · 4 dòng giá/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/Đang lọc vendor/)).not.toBeInTheDocument();
  });

  it('Admin xoá dòng giá trong cửa sổ đang lọc — dòng của vendor khác vẫn còn', async () => {
    currentUser = { role: 'admin', name: 'Admin' };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderViewer({ readOnly: true, canManage: true });
    await screen.findByText('HC_Croptop_P.Happy');
    await userEvent.selectOptions(vendorSelect(), 'VN1');

    await userEvent.click(screen.getByText('HC_Croptop_P.Happy'));
    const dialog = await screen.findByRole('dialog', { name: 'HC_Croptop_P.Happy' });
    await userEvent.click(within(dialog).getByRole('button', { name: /Về giá/ }));
    await userEvent.click(within(dialog).getAllByRole('button', { name: /Xóa/ })[0]);

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    const saved = vendorLibraryApi.save.mock.calls.at(-1)[0];
    expect(saved[0].pricing.map((r) => r.pricing1)).toEqual([1.11, 3.33, 4.44]);
    expect(saved[0].generalInfo).toHaveLength(3);
  });
});
