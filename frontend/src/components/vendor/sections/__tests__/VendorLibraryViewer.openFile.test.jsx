// ════════════════════════════════════════════════════════
//  Mở một file thư viện thành cửa sổ riêng, có URL riêng
//
//  Ba điều bộ test này canh:
//    1. Bấm vào hàng file thì URL đổi sang /library/:fileId và mang theo
//       location cũ — App.jsx dựa vào đó để giữ dashboard phía sau.
//    2. URL /library/:fileId thì cửa sổ hiện ra với đúng file đó (F5 hay mở
//       link người khác gửi đều rơi vào đây).
//    3. Import đè file trùng tên GIỮ NGUYÊN id — id là địa chỉ của mọi link
//       đã gửi đi; sinh id mới là link cũ chết im lặng.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import VendorLibraryViewer from '../VendorLibraryViewer';
import { vendorLibraryApi } from '../../../../services/api';
import { parseHappyCreativeLibrary } from '../../../../utils/vendorExcel';

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
  getItem: (k) => (k === 'user' ? JSON.stringify({ role: 'vendor', name: 'Vendor A' }) : null),
  setItem: () => {}, removeItem: () => {}, clear: () => {},
});

const libraryFile = (overrides = {}) => ({
  id: 'file_pillow',
  filename: 'HC_Pillow_P.Happy_18.08',
  importedAt: '2026-08-18T10:04:00.000Z',
  title: 'Pillow',
  generalInfo: [{ id: 'g1', kyHieu: 'VN3', vendorName: 'VN3', productType: 'Pillow', chatLieu: 'Cotton' }],
  pricing: [{ kyHieu: 'VN3', productType: 'Pillow', size: 'S', pricing1: 8.2 }],
  sourceTab: 'all',
  projects: [],
  ...overrides,
});

/** Hiện URL hiện tại để khẳng định điều hướng đã xảy ra. */
function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="url">
      {location.pathname}
      <span data-testid="co-nen">{location.state?.libraryBackground ? 'co' : 'khong'}</span>
      <span data-testid="co-file">{location.state?.libraryFile?.id || 'khong'}</span>
    </div>
  );
}

const renderAt = (path = '/vendor/library') => render(
  <MemoryRouter initialEntries={[path]}>
    <VendorLibraryViewer />
    <LocationProbe />
  </MemoryRouter>
);

/** Mô phỏng đúng App.jsx: khi URL đổi, dashboard vẫn nhận location nền. */
function BackgroundRouteHarness() {
  const location = useLocation();
  const background = location.state?.libraryBackground;
  const inline = location.state?.libraryInline === true;

  return (
    <>
      <Routes location={background || location}>
        <Route path="/vendor/library" element={<VendorLibraryViewer />} />
      </Routes>
      {background && !inline && <div data-testid="route-overlay">route overlay</div>}
      <LocationProbe />
    </>
  );
}

const renderWithBackgroundRoute = () => render(
  <MemoryRouter initialEntries={['/vendor/library']}>
    <BackgroundRouteHarness />
  </MemoryRouter>
);

beforeEach(() => {
  vendorLibraryApi.get.mockReset();
  vendorLibraryApi.save.mockReset();
  parseHappyCreativeLibrary.mockReset();

  vendorLibraryApi.get.mockResolvedValue({ data: [libraryFile()] });
  vendorLibraryApi.save.mockResolvedValue({ data: { message: 'ok' } });
});

describe('bấm vào một file', () => {
  it('danh sách file dùng từng nhóm tháng với lưới hai cột và không còn nút mở file riêng', async () => {
    renderAt();
    await screen.findByText('HC_Pillow_P.Happy_18.08');

    expect(screen.getByTestId('vendor-library-file-grid')).toHaveClass('hc-library-month-list');
    expect(document.querySelector('.hc-library-month-grid')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Tháng 8/2026' })).toBeInTheDocument();
    expect(screen.queryByText('↗')).not.toBeInTheDocument();
  });

  it('hiển thị tháng mới trước cùng số file của từng tháng', async () => {
    vendorLibraryApi.get.mockResolvedValue({ data: [
      libraryFile({ id: 'sep-new', filename: 'September New', importedAt: '2026-09-15T08:00:00.000Z' }),
      libraryFile({ id: 'aug', filename: 'August File', importedAt: '2026-08-28T08:00:00.000Z' }),
      libraryFile({ id: 'sep-old', filename: 'September Old', importedAt: '2026-09-01T08:00:00.000Z' }),
    ] });

    renderAt();

    const september = await screen.findByRole('region', { name: 'Tháng 9/2026' });
    const august = screen.getByRole('region', { name: 'Tháng 8/2026' });
    expect(within(september).getByText('2 file')).toBeInTheDocument();
    expect(within(august).getByText('1 file')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Tháng 9/2026',
      'Tháng 8/2026',
    ]);
  });

  it('giữ modal của danh sách để Vendor vẫn sửa và lưu được dữ liệu', async () => {
    renderWithBackgroundRoute();

    await userEvent.click(await screen.findByText('HC_Pillow_P.Happy_18.08'));

    expect(await screen.findByRole('dialog', { name: 'HC_Pillow_P.Happy_18.08' })).toBeInTheDocument();
    expect(screen.queryByTestId('route-overlay')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Sửa/ }));
    const material = screen.getByPlaceholderText('Chất liệu...');
    await userEvent.clear(material);
    await userEvent.type(material, 'Linen');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    const saved = vendorLibraryApi.save.mock.calls.at(-1)[0];
    expect(saved[0].generalInfo[0].chatLieu).toBe('Linen');
  });

  it('đổi URL sang /library/:fileId và mang theo location cũ làm nền', async () => {
    renderAt();
    const title = await screen.findByText('HC_Pillow_P.Happy_18.08');

    await userEvent.click(title);

    await waitFor(() => {
      expect(screen.getByTestId('url')).toHaveTextContent('/library/file_pillow/hc-pillow-p-happy-18-08');
    });
    expect(screen.getByTestId('co-nen')).toHaveTextContent('co');
    expect(screen.getByTestId('co-file')).toHaveTextContent('file_pillow');
  });

  it('bấm vào TÊN file cũng mở file — không nhảy ra ô đổi tên như trước', async () => {
    renderAt();
    await screen.findByText('HC_Pillow_P.Happy_18.08');

    await userEvent.click(screen.getByText('HC_Pillow_P.Happy_18.08'));

    await waitFor(() => {
      expect(screen.getByTestId('url')).toHaveTextContent('/library/file_pillow');
    });
    // Ô đổi tên (nếu bật) sẽ mang sẵn tên file làm giá trị — không có nghĩa là
    // không mở ô nào, mà là ô ĐỔI TÊN không bật.
    expect(screen.queryByDisplayValue('HC_Pillow_P.Happy_18.08')).not.toBeInTheDocument();
  });

  it('đổi tên nằm ở nút ✎ riêng, và không mở file', async () => {
    renderAt();
    await screen.findByText('HC_Pillow_P.Happy_18.08');

    await userEvent.click(screen.getByRole('button', { name: /Đổi tên file/ }));

    expect(screen.getByDisplayValue('HC_Pillow_P.Happy_18.08')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('/vendor/library');
  });

  it('bấm nút 🔗 chỉ copy link, KHÔNG mở file', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    renderAt();
    await screen.findByText('HC_Pillow_P.Happy_18.08');

    await userEvent.click(screen.getByRole('button', { name: /Copy link file/ }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText.mock.calls[0][0]).toContain('/library/file_pillow/hc-pillow-p-happy-18-08');
    expect(screen.getByTestId('url')).toHaveTextContent('/vendor/library');
  });

  it('copy trong cửa sổ đổi nút thành Copied và không hiện toast thành công', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    renderWithBackgroundRoute();
    await userEvent.click(await screen.findByText('HC_Pillow_P.Happy_18.08'));

    await userEvent.click(await screen.findByRole('button', { name: 'Copy link' }));

    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(screen.queryByText(/Đã copy link file/)).not.toBeInTheDocument();
  });
});

describe('vào thẳng bằng URL của file', () => {
  it('dựng cửa sổ đúng file, kèm số phôi và số dòng giá', async () => {
    renderAt('/library/file_pillow/hc-pillow-p-happy-18-08');

    const dialog = await screen.findByRole('dialog', { name: 'HC_Pillow_P.Happy_18.08' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/1 phôi · 1 dòng giá/)).toBeInTheDocument();
  });

  it('id không có trong danh sách thì không dựng cửa sổ rỗng', async () => {
    renderAt('/library/khong-he-co');

    await waitFor(() => expect(vendorLibraryApi.get).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('import đè file trùng tên', () => {
  it('giữ nguyên id cũ để link đã gửi đi không chết', async () => {
    parseHappyCreativeLibrary.mockResolvedValue({
      title: 'Pillow',
      generalInfo: [{ id: 'g9', kyHieu: 'VN3', productType: 'Pillow' }],
      pricing: [{ kyHieu: 'VN3', productType: 'Pillow', size: 'S', pricing1: 9.9 }],
    });

    renderAt();
    await waitFor(() => expect(vendorLibraryApi.get).toHaveBeenCalled());
    await screen.findByText('HC_Pillow_P.Happy_18.08');

    const sameName = new File(['x'], 'HC_Pillow_P.Happy_18.08.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [sameName] } });

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    const saved = vendorLibraryApi.save.mock.calls[0][0];
    const entry = saved.find((f) => f.filename === 'HC_Pillow_P.Happy_18.08');

    expect(entry.id).toBe('file_pillow');
    // Nội dung thì phải là bản mới — chỉ id là thứ giữ lại.
    expect(entry.pricing[0].pricing1).toBe(9.9);
  });

  it('file mới hoàn toàn thì vẫn sinh id mới', async () => {
    parseHappyCreativeLibrary.mockResolvedValue({
      title: 'Mug',
      generalInfo: [{ id: 'g9', kyHieu: 'VN9', productType: 'Mug' }],
      pricing: [],
    });

    renderAt();
    await waitFor(() => expect(vendorLibraryApi.get).toHaveBeenCalled());
    await screen.findByText('HC_Pillow_P.Happy_18.08');

    const newFile = new File(['x'], 'HC_Mug_P.Happy_21.08.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [newFile] } });

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    const saved = vendorLibraryApi.save.mock.calls[0][0];
    const entry = saved.find((f) => f.filename === 'HC_Mug_P.Happy_21.08');

    expect(entry.id).toBeTruthy();
    expect(entry.id).not.toBe('file_pillow');
  });
});
