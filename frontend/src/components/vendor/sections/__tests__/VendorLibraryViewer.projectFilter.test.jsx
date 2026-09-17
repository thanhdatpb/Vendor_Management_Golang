// ════════════════════════════════════════════════════════
//  Ô lọc theo project ở Thư viện Vendor (role Vendor / Admin)
//
//  Điều bộ test này canh:
//    1. Thứ tự lựa chọn: Tất cả Project → Happy → Creative → Global → Hapify84.
//    2. Chọn một project = đúng những file seller của project đó thấy:
//       file share All + file share cho project đó; file cũ chưa share thì theo
//       ký hiệu P.xxx trong tên (không có ký hiệu = All).
//    3. Chỉ view quản lý thư viện (Vendor/Admin) có ô này — Seller thì không.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

const libraryFile = (id, filename, projects) => ({
  id,
  filename,
  importedAt: '2026-09-10T10:00:00.000Z',
  title: filename,
  generalInfo: [{ id: `${id}_g1`, kyHieu: 'VN3', vendorName: 'VN3', productType: 'Mug', chatLieu: 'Ceramic' }],
  pricing: [{ kyHieu: 'VN3', productType: 'Mug', size: 'S', pricing1: 5 }],
  sourceTab: 'all',
  ...(projects === undefined ? {} : { projects }),
});

const FILES = [
  libraryFile('f_all', 'Shared All Mug', []),
  libraryFile('f_happy', 'Happy Only Mug', ['happy']),
  libraryFile('f_happy_creative', 'Happy Creative Mug', ['happy', 'creative']),
  libraryFile('f_creative', 'Creative Only Mug', ['creative']),
  libraryFile('f_legacy_creative', 'Legacy_P.Creative_Mug', undefined),
  libraryFile('f_legacy_plain', 'Legacy Plain Mug', undefined),
];

const renderViewer = (props = {}) => render(
  <MemoryRouter initialEntries={['/vendor/library']}>
    <VendorLibraryViewer {...props} />
  </MemoryRouter>
);

const projectSelect = () => screen.getByRole('combobox', { name: 'Lọc theo project' });

beforeEach(() => {
  currentUser = { role: 'vendor', name: 'Vendor A' };
  vendorLibraryApi.get.mockReset();
  vendorLibraryApi.get.mockResolvedValue({ data: FILES });
});

describe('ô lọc theo project', () => {
  it('liệt kê project theo đúng thứ tự, mặc định Tất cả Project', async () => {
    renderViewer();
    await screen.findByText('Shared All Mug');

    const options = within(projectSelect()).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual([
      'Tất cả Project',
      'Happy Project',
      'Creative Project',
      'Global Project',
      'Hapify84 Project',
    ]);
    expect(projectSelect()).toHaveValue('');
    FILES.forEach((f) => expect(screen.getByText(f.filename)).toBeInTheDocument());
  });

  it('chọn Happy Project thì gộp file share All và file share cho Happy', async () => {
    renderViewer();
    await screen.findByText('Shared All Mug');

    await userEvent.selectOptions(projectSelect(), 'happy');

    expect(screen.getByText('Shared All Mug')).toBeInTheDocument();
    expect(screen.getByText('Happy Only Mug')).toBeInTheDocument();
    expect(screen.getByText('Happy Creative Mug')).toBeInTheDocument();
    expect(screen.getByText('Legacy Plain Mug')).toBeInTheDocument();
    expect(screen.queryByText('Creative Only Mug')).not.toBeInTheDocument();
    expect(screen.queryByText('Legacy_P.Creative_Mug')).not.toBeInTheDocument();
  });

  it('không còn file nào thì báo theo project và Xóa bộ lọc trả lại đủ danh sách', async () => {
    vendorLibraryApi.get.mockResolvedValue({ data: [
      libraryFile('f_creative', 'Creative Only Mug', ['creative']),
    ] });
    renderViewer();
    await screen.findByText('Creative Only Mug');

    await userEvent.selectOptions(projectSelect(), 'global');

    expect(screen.getByText('Không có file nào chia sẻ cho Global Project')).toBeInTheDocument();
    expect(screen.queryByText('Creative Only Mug')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));

    expect(screen.getByText('Creative Only Mug')).toBeInTheDocument();
    expect(projectSelect()).toHaveValue('');
  });

  it('Admin (readOnly nhưng canManage) cũng có ô lọc', async () => {
    currentUser = { role: 'admin', name: 'Admin' };
    renderViewer({ readOnly: true, canManage: true });
    await screen.findByText('Shared All Mug');

    await userEvent.selectOptions(projectSelect(), 'creative');

    expect(screen.getByText('Creative Only Mug')).toBeInTheDocument();
    expect(screen.getByText('Legacy_P.Creative_Mug')).toBeInTheDocument();
    expect(screen.queryByText('Happy Only Mug')).not.toBeInTheDocument();
  });

  it('Seller không có ô lọc theo project', async () => {
    currentUser = { role: 'seller', name: 'Seller Happy', project: 'Happy Project' };
    renderViewer({ readOnly: true });
    await screen.findByText('Shared All Mug');

    expect(screen.queryByRole('combobox', { name: 'Lọc theo project' })).not.toBeInTheDocument();
  });
});
