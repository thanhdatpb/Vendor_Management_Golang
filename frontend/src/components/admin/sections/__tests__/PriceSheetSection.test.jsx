// ════════════════════════════════════════════════════════
//  ADMIN — Bảng Tính Giá: chỉ xem, lọc theo project, không có đường sửa/xoá.
//
//  Không cần route riêng cho Admin: seesAllProjects() ở backend đã gồm
//  'admin', nên priceSheetApi.list()/.get() dùng THẲNG API của Seller. Test
//  ở đây chốt phần logic + UI phía trước, không lặp lại test đã có cho API.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PriceSheetSection from '../PriceSheetSection';
import { priceSheetApi } from '../../../../services/api';

vi.mock('../../../../services/api', () => ({
  priceSheetApi: {
    list: vi.fn(),
    get: vi.fn(),
    versions: vi.fn(async () => ({ data: [] })),
  },
}));

// XLSX.writeFile GHI FILE THẬT ra đĩa khi chạy trong Node — hai file
// HC_Gia_*.xlsx từng rơi vào thư mục frontend/ chính vì test export ở dưới.
// Mock ở tầng thư viện: không đụng đĩa, mà còn kiểm được tên file xuất ra.
const xlsxMock = vi.hoisted(() => ({ writeFile: vi.fn() }));
vi.mock('xlsx', () => ({
  default: {
    utils: {
      aoa_to_sheet: () => ({}),
      book_new: () => ({ SheetNames: [], Sheets: {} }),
      book_append_sheet: () => {},
    },
    writeFile: xlsxMock.writeFile,
  },
}));

// jsdom không cài sẵn URL.createObjectURL — sheetExport gọi khi export Excel.
beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
  globalThis.URL.revokeObjectURL = vi.fn();
});

const summaryRow = (overrides = {}) => ({
  id: 'sheet_1', name: 'Legend Shirt', project: 'happy', version: 3,
  vendorRef: 'VN3', productTypeNames: ['Football Jersey'],
  sizeCount: 5, minPrice: 21.9, maxPrice: 40.9, avgMargin: 42.5,
  updatedAt: '2026-08-18T03:00:00.000Z', updatedBy: 'Seller A', createdBy: 'Seller A', _summary: true,
  ...overrides,
});

const fullSheet = (overrides = {}) => ({
  id: 'sheet_1', name: 'Legend Shirt', project: 'happy', vendorRef: 'VN3',
  updatedBy: 'Seller A', createdBy: 'Seller A',
  settings: { price: 19.9, quantity: 1, amzFeePct: 17, shipPerItem: 2 },
  productTypes: [{
    id: 'pt1', name: 'Football Jersey', phoi: 0, shown: true, customizeInfos: [],
    sizes: [{ id: 'sz1', label: 'S', sizeAdd: 2, itemCost: 8.2 }],
  }],
  history: [],
  ...overrides,
});

beforeEach(() => {
  priceSheetApi.list.mockReset();
  priceSheetApi.get.mockReset();
  xlsxMock.writeFile.mockClear();
});

describe('danh sách — trộn nhiều project', () => {
  it('hiện đủ số bảng và đúng cột Project cho từng dòng', async () => {
    priceSheetApi.list.mockResolvedValue({
      data: [summaryRow({ id: 's_happy', project: 'happy' }), summaryRow({ id: 's_creative', project: 'creative' })],
    });

    render(<PriceSheetSection />);

    expect(await screen.findByText('2 bảng')).toBeInTheDocument();
    // 'Happy Project' / 'Creative Project' xuất hiện cả ở chip lọc lẫn badge
    // cột Project của từng dòng — kiểm bằng số lần xuất hiện, không phải có/không.
    expect(screen.getAllByText('Happy Project').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Creative Project').length).toBeGreaterThanOrEqual(2);
  });

  it('chip project đếm đúng số bảng của từng project', async () => {
    priceSheetApi.list.mockResolvedValue({
      data: [
        summaryRow({ id: 's1', project: 'happy' }),
        summaryRow({ id: 's2', project: 'happy' }),
        summaryRow({ id: 's3', project: 'creative' }),
      ],
    });

    render(<PriceSheetSection />);
    await screen.findByText('3 bảng');

    const happyChip = screen.getByRole('button', { name: /Happy Project/ });
    expect(happyChip).toHaveTextContent('2');
    const creativeChip = screen.getByRole('button', { name: /Creative Project/ });
    expect(creativeChip).toHaveTextContent('1');
  });

  it('bấm chip project thì lọc đúng, chip Tất cả đưa về đủ', async () => {
    const user = userEvent.setup();
    priceSheetApi.list.mockResolvedValue({
      data: [summaryRow({ id: 's1', name: 'Bang Happy', project: 'happy' }), summaryRow({ id: 's2', name: 'Bang Creative', project: 'creative' })],
    });

    render(<PriceSheetSection />);
    await screen.findByText('Bang Happy');

    await user.click(screen.getByRole('button', { name: /^Creative Project/ }));
    expect(screen.queryByText('Bang Happy')).not.toBeInTheDocument();
    expect(screen.getByText('Bang Creative')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Tất cả/ }));
    expect(screen.getByText('Bang Happy')).toBeInTheDocument();
    expect(screen.getByText('Bang Creative')).toBeInTheDocument();
  });

  it('project rỗng/không nhận ra không làm vỡ danh sách', async () => {
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow({ id: 's1', project: '' })] });

    render(<PriceSheetSection />);

    expect(await screen.findByText('1 bảng')).toBeInTheDocument();
  });
});

describe('chỉ xem — không có đường sửa/xoá', () => {
  it('bấm Xem thì gọi get(id) và mở modal đọc nội dung đầy đủ', async () => {
    const user = userEvent.setup();
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow()] });
    priceSheetApi.get.mockResolvedValue({ data: fullSheet() });

    render(<PriceSheetSection />);
    await user.click(await screen.findByRole('button', { name: 'Xem' }));

    await waitFor(() => expect(priceSheetApi.get).toHaveBeenCalledWith('sheet_1'));
    expect(await screen.findByText('Chỉ xem — Admin không sửa hay xoá bảng tính giá của Seller ở đây.')).toBeInTheDocument();
  });

  it('modal xem không có input hay nút Lưu/Sửa/Xoá nào', async () => {
    const user = userEvent.setup();
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow()] });
    priceSheetApi.get.mockResolvedValue({ data: fullSheet() });

    render(<PriceSheetSection />);
    await user.click(await screen.findByRole('button', { name: 'Xem' }));
    // Tên bảng lặp ở cả dòng danh sách lẫn tiêu đề modal — chờ tiêu đề Chỉ Xem
    // xuất hiện là đủ xác nhận modal đã mở, không cần tìm theo tên bảng.
    await screen.findByText('Chỉ xem — Admin không sửa hay xoá bảng tính giá của Seller ở đây.');

    // Ô tìm kiếm ngoài trang (nền sau modal) vẫn là 1 textbox hợp lệ — chỉ loại
    // đúng nó ra, còn lại phải rỗng thì mới chắc BÊN TRONG modal không có input.
    const searchBox = screen.getByPlaceholderText(/Tìm bảng/);
    expect(screen.queryAllByRole('textbox').filter((el) => el !== searchBox)).toHaveLength(0);
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /Lưu/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xoá/ })).not.toBeInTheDocument();
  });

  it('panel Lịch sử mở từ modal xem không có nút Khôi phục', async () => {
    const user = userEvent.setup();
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow()] });
    priceSheetApi.get.mockResolvedValue({ data: fullSheet() });
    priceSheetApi.versions.mockResolvedValue({
      data: [{ version: 2, savedAt: '2026-08-17T00:00:00.000Z', savedBy: 'Seller A', avgMargin: 40, minPrice: 20, maxPrice: 30, count: 2 }],
    });

    render(<PriceSheetSection />);
    await user.click(await screen.findByRole('button', { name: 'Xem' }));
    await user.click(await screen.findByRole('button', { name: 'Lịch sử phiên bản' }));

    await screen.findByText(/v2/);
    expect(screen.queryByRole('button', { name: /Khôi phục/ })).not.toBeInTheDocument();
  });

  it('bấm export ở danh sách gọi get(id) rồi xuất file, không mở modal', async () => {
    const user = userEvent.setup();
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow()] });
    priceSheetApi.get.mockResolvedValue({ data: fullSheet() });

    render(<PriceSheetSection />);
    await user.click(await screen.findByTitle('Export Excel'));

    await waitFor(() => expect(priceSheetApi.get).toHaveBeenCalledWith('sheet_1'));
    await waitFor(() => expect(xlsxMock.writeFile).toHaveBeenCalled());
    // Xuất ĐÚNG tên file quy ước, và đi qua mock nên không rơi file vào repo.
    expect(xlsxMock.writeFile.mock.calls[0][1]).toMatch(/^HC_Gia_.*.xlsx$/);
    expect(screen.queryByText('Chỉ xem — Admin không sửa hay xoá bảng tính giá của Seller ở đây.')).not.toBeInTheDocument();
  });
});

describe('lỗi tải — không nuốt thành danh sách rỗng im lặng', () => {
  it('API lỗi thì hiện banner kèm nút Thử lại', async () => {
    priceSheetApi.list.mockRejectedValue(new Error('network down'));

    render(<PriceSheetSection />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh sách bảng tính giá');
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('bấm Thử lại gọi lại list()', async () => {
    const user = userEvent.setup();
    priceSheetApi.list.mockRejectedValueOnce(new Error('network down'));
    priceSheetApi.list.mockResolvedValueOnce({ data: [summaryRow()] });

    render(<PriceSheetSection />);
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Thử lại' }));

    expect(await screen.findByText('1 bảng')).toBeInTheDocument();
  });
});

describe('tìm kiếm', () => {
  it('tìm theo tên bảng, vendor, product type — không phân biệt project đang chọn', async () => {
    const user = userEvent.setup();
    priceSheetApi.list.mockResolvedValue({
      data: [summaryRow({ id: 's1', name: 'Legend Shirt' }), summaryRow({ id: 's2', name: 'Night Light', vendorRef: 'CR7', productTypeNames: ['Night Light'] })],
    });

    render(<PriceSheetSection />);
    await screen.findByText('2 bảng');

    await user.type(screen.getByPlaceholderText(/Tìm bảng/), 'night');

    expect(screen.queryByText('Legend Shirt')).not.toBeInTheDocument();
    // Tên bảng "Night Light" lặp lại ở chip productType cùng dòng.
    expect(screen.getAllByText('Night Light').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('1 bảng')).toBeInTheDocument();
  });
});

// ════════════════════════════════════════════════════════
//  Lỗi thật trên production 21/08/2026: "Tất cả 44" nhưng mọi chip project
//  đều đếm 0. Nguyên nhân: `users.project` lưu dạng NHÃN ("Creative Project"),
//  server hạ chữ thường thành "creative project" rồi ghi vào
//  `price_sheets.project`, trong khi chip lọc dùng id ngắn ("creative").
//  Fixture cũ của file này dùng sẵn id ngắn nên không bắt được.
// ════════════════════════════════════════════════════════
describe('project lưu dạng nhãn — regression 2026-08', () => {
  it('chip đếm đúng dù DB lưu "Creative Project" / "creative project" / "creative"', async () => {
    priceSheetApi.list.mockResolvedValue({
      data: [
        summaryRow({ id: 's1', project: 'Creative Project' }),
        summaryRow({ id: 's2', project: 'creative project' }),
        summaryRow({ id: 's3', project: 'creative' }),
        summaryRow({ id: 's4', project: 'Happy Project' }),
      ],
    });

    render(<PriceSheetSection />);
    await screen.findByText('4 bảng');

    expect(screen.getByRole('button', { name: /^Creative Project/ })).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /^Happy Project/ })).toHaveTextContent('1');
  });

  it('bấm chip lọc ra đúng các bảng, không còn danh sách rỗng', async () => {
    const user = userEvent.setup();
    priceSheetApi.list.mockResolvedValue({
      data: [
        summaryRow({ id: 's1', name: 'Bang Creative', project: 'creative project' }),
        summaryRow({ id: 's2', name: 'Bang Happy', project: 'Happy Project' }),
      ],
    });

    render(<PriceSheetSection />);
    await screen.findByText('Bang Creative');

    await user.click(screen.getByRole('button', { name: /^Creative Project/ }));
    expect(screen.getByText('Bang Creative')).toBeInTheDocument();
    expect(screen.queryByText('Bang Happy')).not.toBeInTheDocument();
    expect(screen.getByText('1 bảng')).toBeInTheDocument();
  });

  it('badge cột Project hiện nhãn chuẩn, không hiện chuỗi thô của DB', async () => {
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow({ id: 's1', project: 'hapify84 project' })] });

    render(<PriceSheetSection />);
    await screen.findByText('1 bảng');

    // Nhãn xuất hiện ở cả chip lọc lẫn badge của dòng → đếm số lần, không dùng có/không.
    expect(screen.getAllByText('Hapify84 Project').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('hapify84 project')).not.toBeInTheDocument();
  });

  it('tổng các chip bằng đúng chip "Tất cả" — bảng chưa gán project có chỗ đứng', async () => {
    priceSheetApi.list.mockResolvedValue({
      data: [
        summaryRow({ id: 's1', project: 'Happy Project' }),
        summaryRow({ id: 's2', project: '' }),
        summaryRow({ id: 's3', project: 'Zeta Project' }),
      ],
    });

    render(<PriceSheetSection />);
    await screen.findByText('3 bảng');

    const countOf = (name) => Number(screen.getByRole('button', { name }).textContent.match(/(\d+)$/)[1]);
    const all = countOf(/^Tất cả/);
    const perChip = [/^Happy Project/, /^Creative Project/, /^Global Project/, /^Hapify84 Project/, /^Chưa gán project/]
      .reduce((sum, name) => sum + countOf(name), 0);

    expect(perChip).toBe(all);
    expect(countOf(/^Chưa gán project/)).toBe(2);   // project rỗng + project lạ
  });

  it('không có bảng nào chưa gán thì KHÔNG bày thêm chip rỗng', async () => {
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow({ id: 's1', project: 'Happy Project' })] });

    render(<PriceSheetSection />);
    await screen.findByText('1 bảng');

    expect(screen.queryByRole('button', { name: /Chưa gán project/ })).not.toBeInTheDocument();
  });

  it('chip "Chưa gán project" lọc ra đúng những bảng không nhận diện được project', async () => {
    const user = userEvent.setup();
    priceSheetApi.list.mockResolvedValue({
      data: [
        summaryRow({ id: 's1', name: 'Bang Happy', project: 'Happy Project' }),
        summaryRow({ id: 's2', name: 'Bang La', project: 'Zeta Project' }),
      ],
    });

    render(<PriceSheetSection />);
    await screen.findByText('Bang Happy');

    await user.click(screen.getByRole('button', { name: /^Chưa gán project/ }));
    expect(screen.getByText('Bang La')).toBeInTheDocument();
    expect(screen.queryByText('Bang Happy')).not.toBeInTheDocument();
  });
});
