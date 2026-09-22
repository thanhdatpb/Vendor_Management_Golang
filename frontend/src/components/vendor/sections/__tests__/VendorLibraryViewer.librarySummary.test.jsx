// ════════════════════════════════════════════════════════
//  Khe `renderLibrarySummary` của Thư viện Vendor — Admin gắn khối "Thống kê
//  phôi" vào đây. Canh:
//    1. Chỉ vẽ ở chế độ Tổng quan, và chỉ khi được truyền (role khác giữ nguyên).
//    2. `files` theo ô Project, KHÔNG theo ô vendor — bấm lọc vendor thì số của
//       các vendor khác không đổi.
//    3. `setVendorFilter` đặt đúng ô "Tất cả vendor" của thư viện.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
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

vi.stubGlobal('localStorage', {
  getItem: (k) => (k === 'user' ? JSON.stringify({ role: 'admin', name: 'Admin' }) : null),
  setItem: () => {}, removeItem: () => {}, clear: () => {},
});

const file = (id, filename, vendors, projects) => ({
  id, filename, title: filename, importedAt: '2026-09-21T09:37:00.000Z', sourceTab: 'all', projects,
  generalInfo: vendors.map((v, i) => ({ id: `${id}_g${i}`, kyHieu: v, vendorName: v, productType: `${filename} ${v}` })),
  pricing: [],
});

const FILES = [
  file('f1', 'Hoodie AOP', ['VN3', 'US1'], []),         // chia sẻ cho mọi project
  file('f2', 'Metal Sign', ['VN5'], ['global']),         // chỉ Global
];

const renderViewer = (props = {}) => render(
  <MemoryRouter initialEntries={['/admin/vendors']}>
    <VendorLibraryViewer readOnly canManage {...props} />
  </MemoryRouter>
);

beforeEach(() => {
  vendorLibraryApi.get.mockReset();
  vendorLibraryApi.get.mockResolvedValue({ data: FILES });
});

describe('renderLibrarySummary', () => {
  it('không truyền thì không có khối nào thêm vào (role khác giữ nguyên)', async () => {
    renderViewer();
    await screen.findByText('Hoodie AOP');
    expect(screen.queryByTestId('summary')).not.toBeInTheDocument();
  });

  it('chỉ vẽ ở chế độ Tổng quan', async () => {
    const summary = vi.fn(() => <div data-testid="summary" />);
    const { unmount } = renderViewer({ mode: 'all', renderLibrarySummary: summary });
    await screen.findByText('Hoodie AOP');
    expect(screen.getByTestId('summary')).toBeInTheDocument();
    unmount();

    summary.mockClear();
    renderViewer({ mode: 'best_seller', renderLibrarySummary: summary });
    await waitFor(() => expect(vendorLibraryApi.get).toHaveBeenCalled());
    expect(summary).not.toHaveBeenCalled();
  });

  it('files theo ô Project nhưng không theo ô vendor; setVendorFilter đặt ô "Tất cả vendor"', async () => {
    const summary = vi.fn(() => <div data-testid="summary" />);
    renderViewer({ mode: 'all', renderLibrarySummary: summary });
    await screen.findByText('Hoodie AOP');
    await waitFor(() => expect(summary.mock.calls.at(-1)[0].libraryLoaded).toBe(true));
    expect(summary.mock.calls.at(-1)[0].files.map((f) => f.id)).toEqual(['f1', 'f2']);

    // Lọc vendor qua khe → ô vendor đổi, danh sách file lọc theo, nhưng `files` giữ nguyên
    act(() => { summary.mock.calls.at(-1)[0].setVendorFilter('VN5'); });
    expect(screen.getByRole('combobox', { name: 'Lọc theo vendor' })).toHaveValue('VN5');
    expect(screen.queryByText('Hoodie AOP')).not.toBeInTheDocument();
    expect(summary.mock.calls.at(-1)[0].vendorFilter).toBe('VN5');
    expect(summary.mock.calls.at(-1)[0].files.map((f) => f.id)).toEqual(['f1', 'f2']);

    // Lọc project Happy → file chỉ chia sẻ cho Global rời khỏi `files`
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Lọc theo project' }), 'happy');
    const last = summary.mock.calls.at(-1)[0];
    expect(last.projectFilter).toBe('happy');
    expect(last.files.map((f) => f.id)).toEqual(['f1']);
  });
});
