// ════════════════════════════════════════════════════════
//  VENDOR — Import thư viện Excel bị chặn oan (regression 2026-08-21)
//
//  Ca lỗi thật: Vendor bấm "Import thư viện Excel" → hộp thoại chọn file của
//  HĐH mở ra, cửa sổ trình duyệt MẤT focus. Chọn file xong, hộp thoại đóng,
//  cửa sổ LẤY LẠI focus → handler `focus` gọi fetchLibrary, mà hàm này hạ
//  `dataLoaded = false` NGAY rồi mới chờ mạng. Sự kiện `change` của input file
//  bắn ra ngay sau đó → handleImport thấy cờ false → từ chối với thông báo
//  "Dữ liệu thư viện chưa tải xong. Vui lòng đợi rồi thử lại."
//
//  Thư viện càng nhiều file (thực tế 92 file) blob càng lâu về, cửa sổ lỗi
//  càng rộng → gần như lần nào cũng dính. Vendor không import được file nào.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import VendorLibraryViewer from '../VendorLibraryViewer';
import { vendorLibraryApi } from '../../../../services/api';
import { parseHappyCreativeLibrary } from '../../../../utils/vendorExcel';

vi.mock('../../../../services/api', () => ({
  vendorLibraryApi: {
    get: vi.fn(),
    save: vi.fn(),
    setSampleStatus: vi.fn(),
    setBestSeller: vi.fn(),
  },
}));

// Không mở socket thật trong test; trả về hàm huỷ rỗng như bản thật khi chưa
// cấu hình Pusher.
vi.mock('../../../../services/echo', () => ({
  subscribeVendorLibraryChanges: vi.fn(() => () => {}),
}));

vi.mock('../../../../utils/vendorExcel', () => ({
  parseHappyCreativeLibrary: vi.fn(),
  downloadVendorLibraryTemplate: vi.fn(),
}));

// Node 22+ có global localStorage riêng (chưa bật) che mất bản của jsdom;
// component đọc localStorage để suy ra project của user nên phải dựng bản giả,
// nếu không component ném lỗi ngay lúc render.
vi.stubGlobal('localStorage', {
  getItem: (k) => (k === 'user' ? JSON.stringify({ role: 'vendor', name: 'Vendor A' }) : null),
  setItem: () => {}, removeItem: () => {}, clear: () => {},
});

const libraryFile = (name = 'HC_Pillow_P.Happy_18.08') => ({
  id: `id_${name}`,
  filename: name,
  importedAt: '2026-08-18T10:04:00.000Z',
  title: name,
  generalInfo: [{ id: 'g1', kyHieu: 'VN3', productType: 'Pillow', chatLieu: 'Cotton' }],
  pricing: [{ kyHieu: 'VN3', productType: 'Pillow', size: 'S', pricing1: 8.2 }],
  sourceTab: 'all',
});

const xlsxFile = (name = 'HC_NewVendor_P.Happy_21.08.xlsx') =>
  new File(['nội dung giả'], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

beforeEach(() => {
  vendorLibraryApi.get.mockReset();
  vendorLibraryApi.save.mockReset();
  parseHappyCreativeLibrary.mockReset();

  vendorLibraryApi.get.mockResolvedValue({ data: [libraryFile()] });
  vendorLibraryApi.save.mockResolvedValue({ data: { message: 'ok' } });
  parseHappyCreativeLibrary.mockResolvedValue({
    title: 'New Vendor',
    generalInfo: [{ id: 'g9', kyHieu: 'VN9', productType: 'Mug', notes: 'Ghi chú từ Excel' }],
    pricing: [{ kyHieu: 'VN9', productType: 'Mug', size: '11oz', pricing1: 3.4 }],
  });
});

/** Input file bị ẩn (display:none) nên không query bằng role được. */
const fileInput = () => document.querySelector('input[type="file"]');

const waitFirstLoad = () => waitFor(() => expect(vendorLibraryApi.get).toHaveBeenCalled());

describe('Import Excel sau khi cửa sổ lấy lại focus — regression 2026-08-21', () => {
  it('IMPORT ĐƯỢC dù sự kiện focus vừa kích hoạt làm mới nền', async () => {
    render(<VendorLibraryViewer />);
    await waitFirstLoad();
    await screen.findAllByText(/HC_Pillow/);

    // Hộp thoại chọn file đóng lại → cửa sổ lấy lại focus. Cho request làm mới
    // nền treo lơ lửng (không resolve) để mô phỏng blob 92 file về chậm —
    // đúng lúc xấu nhất mà người dùng gặp.
    vendorLibraryApi.get.mockImplementationOnce(() => new Promise(() => {}));
    fireEvent.focus(window);

    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } });

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    expect(screen.queryByText(/chưa tải xong/i)).not.toBeInTheDocument();
  });

  it('không hiện thông báo chặn oan "Dữ liệu thư viện chưa tải xong"', async () => {
    render(<VendorLibraryViewer />);
    await waitFirstLoad();

    vendorLibraryApi.get.mockImplementationOnce(() => new Promise(() => {}));
    fireEvent.focus(window);
    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } });

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    expect(screen.queryByText(/Vui lòng đợi rồi thử lại/i)).not.toBeInTheDocument();
  });

  it('file mới được gộp vào danh sách cũ, không ghi đè mất file đang có', async () => {
    render(<VendorLibraryViewer />);
    await waitFirstLoad();
    await screen.findAllByText(/HC_Pillow/);

    fireEvent.focus(window);
    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } });

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    const [saved] = vendorLibraryApi.save.mock.calls[0];
    const names = saved.map((f) => f.filename);
    expect(names).toContain('HC_Pillow_P.Happy_18.08');            // file cũ còn nguyên
    expect(names).toContain('HC_NewVendor_P.Happy_21.08');         // file mới đã vào
  });

  it('giữ nguyên Notes đã parse trong payload lưu thư viện', async () => {
    render(<VendorLibraryViewer />);
    await waitFirstLoad();

    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } });

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    const [saved] = vendorLibraryApi.save.mock.calls[0];
    const imported = saved.find((f) => f.filename === 'HC_NewVendor_P.Happy_21.08');
    expect(imported.generalInfo[0].notes).toBe('Ghi chú từ Excel');
  });

  it('quay lại tab (visibilitychange) cũng không chặn import', async () => {
    render(<VendorLibraryViewer />);
    await waitFirstLoad();

    vendorLibraryApi.get.mockImplementationOnce(() => new Promise(() => {}));
    fireEvent(document, new Event('visibilitychange'));
    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } });

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
  });
});

describe('Làm mới nền không được giẫm lên thao tác đang chạy', () => {
  it('đang import thì KHÔNG gọi thêm request làm mới nền', async () => {
    // parse treo lơ lửng = đang trong lúc import dở
    let releaseParse;
    parseHappyCreativeLibrary.mockImplementationOnce(
      () => new Promise((resolve) => { releaseParse = () => resolve({ title: 't', generalInfo: [], pricing: [] }); })
    );

    render(<VendorLibraryViewer />);
    await waitFirstLoad();
    const callsAfterMount = vendorLibraryApi.get.mock.calls.length;

    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } });
    await screen.findByText(/Đang import/i);

    fireEvent.focus(window);           // realtime/focus đòi làm mới giữa chừng
    expect(vendorLibraryApi.get).toHaveBeenCalledTimes(callsAfterMount);

    releaseParse();
    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
  });

  it('làm mới nền lỗi thì KHÔNG dựng banner lỗi đè lên màn hình đang dùng được', async () => {
    render(<VendorLibraryViewer />);
    await waitFirstLoad();
    await screen.findAllByText(/HC_Pillow/);

    vendorLibraryApi.get.mockRejectedValueOnce(new Error('mạng chập chờn'));
    fireEvent.focus(window);

    await waitFor(() => expect(vendorLibraryApi.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Không thể kết nối server/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/HC_Pillow/).length).toBeGreaterThan(0);   // bản đang xem vẫn còn
  });
});

describe('Lần tải đầu vẫn giữ nguyên hành vi cũ', () => {
  it('lỗi ở lần tải đầu VẪN hiện banner để người dùng biết mà thử lại', async () => {
    vendorLibraryApi.get.mockReset();
    vendorLibraryApi.get.mockRejectedValue(new Error('server sập'));

    render(<VendorLibraryViewer />);

    expect(await screen.findByText(/server sập|Không thể kết nối server/i)).toBeInTheDocument();
  });

  it('chưa tải xong lần đầu thì VẪN chặn import — cờ dataLoaded còn đúng ý nghĩa', async () => {
    vendorLibraryApi.get.mockReset();
    vendorLibraryApi.get.mockImplementation(() => new Promise(() => {})); // treo mãi

    render(<VendorLibraryViewer />);
    fireEvent.change(fileInput(), { target: { files: [xlsxFile()] } });

    expect(await screen.findByText(/chưa tải xong/i)).toBeInTheDocument();
    expect(vendorLibraryApi.save).not.toHaveBeenCalled();
  });
});
