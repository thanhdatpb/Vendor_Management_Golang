// ════════════════════════════════════════════════════════
//  "Mở bảng" giờ điều hướng sang /price-sheets/:id (link riêng để gửi Admin)
//  thay vì tự fetch rồi mở PriceSheetWorkspace ngay tại danh sách — PriceSheetPage
//  mới là nơi gọi priceSheetApi.get(id) và quyết định Seller/Admin xem gì.
//
//  MỤC 17 — đường lùi khi backend chưa có `GET /price-sheets/{id}` giờ chỉ còn
//  áp dụng cho EXPORT (nút ⬇ ở danh sách vẫn tự fetch bản đầy đủ trước khi
//  xuất Excel): deploy frontend TRƯỚC backend là chuyện xảy ra được, lúc đó
//  `priceSheetApi.get` trả 404 — không có đường lùi thì Seller export ra file
//  trống thay vì lỗi rõ ràng.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetupPriceSection from '../SetupPriceSection';
import { priceSheetApi } from '../../../services/api';
import { exportSheetToExcel } from '../PriceSheetWorkspace';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../../services/api', () => ({
  priceSheetApi: {
    list: vi.fn(),
    get: vi.fn(),
    versions: vi.fn(async () => ({ data: [] })),
    save: vi.fn(async () => ({ data: { version: 2 } })),
    remove: vi.fn(async () => ({ data: {} })),
  },
  vendorLibraryApi: { get: vi.fn(async () => ({ data: [] })) },
}));

// Realtime không thuộc phạm vi test này — trả hàm huỷ rỗng.
vi.mock('../../../services/echo', () => ({
  subscribePriceSheetChanges: vi.fn(() => () => {}),
}));

vi.mock('../PriceSheetWorkspace', () => ({
  exportSheetToExcel: vi.fn(),
}));

/** Sheet ĐẦY ĐỦ — đúng những gì backend CŨ trả về ở danh sách. */
const fullSheet = () => ({
  id: 'sheet_1',
  name: 'Legend Shirt',
  project: '',
  vendorRef: 'VN3',
  settings: { price: 19.9, quantity: 1, amzFeePct: 17 },
  productTypes: [{
    id: 'pt1', name: 'Football Jersey', phoi: 0, customizeInfos: [],
    sizes: Array.from({ length: 20 }, (_, i) => ({
      id: `sz${i}`, label: `SIZE-${i}`, sizeAdd: i, itemCost: 8.2,
    })),
  }],
  history: [],
  updatedAt: '2026-08-18T03:00:00.000Z',
});

/** Dòng rút gọn — đúng những gì backend MỚI trả về. */
const summaryRow = () => ({
  id: 'sheet_1', name: 'Legend Shirt', project: '', version: 3,
  vendorRef: 'VN3', productTypeNames: ['Football Jersey'],
  sizeCount: 20, minPrice: 21.9, maxPrice: 40.9, avgMargin: 42.5,
  updatedAt: '2026-08-18T03:00:00.000Z', _summary: true,
});

const notFound = () => Object.assign(new Error('Not Found'), { response: { status: 404 } });

beforeEach(() => {
  priceSheetApi.list.mockReset();
  priceSheetApi.get.mockReset();
  mockNavigate.mockReset();
  exportSheetToExcel.mockReset();
});

describe('"Mở bảng" điều hướng sang link riêng của bảng', () => {
  it('bấm "Mở bảng" chỉ navigate tới /price-sheets/:id, không tự fetch', async () => {
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow()] });

    render(<SetupPriceSection />);
    const user = userEvent.setup();
    const btn = await screen.findByRole('button', { name: 'Mở bảng' });
    await user.click(btn);

    expect(mockNavigate).toHaveBeenCalledWith('/price-sheets/sheet_1');
    expect(priceSheetApi.get).not.toHaveBeenCalled();
  });
});

describe('export vẫn có đường lùi khi backend chưa có /price-sheets/{id}', () => {
  it('get(id) lỗi 404 → export bằng bản đầy đủ có sẵn trong danh sách thay vì báo lỗi', async () => {
    priceSheetApi.list.mockResolvedValue({ data: [fullSheet()] });
    priceSheetApi.get.mockRejectedValue(notFound());

    render(<SetupPriceSection />);
    const user = userEvent.setup();
    const btn = await screen.findByTitle('Export Excel');
    await user.click(btn);

    await vi.waitFor(() => expect(exportSheetToExcel).toHaveBeenCalled());
    const [exported] = exportSheetToExcel.mock.calls[0];
    expect(exported.name).toBe('Legend Shirt');
    expect(exported.productTypes[0].sizes).toHaveLength(20);
  });

  it('danh sách chỉ có bản rút gọn + get(id) lỗi → không export được bảng rỗng, báo lỗi rõ ràng', async () => {
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow()] });
    priceSheetApi.get.mockRejectedValue(notFound());

    render(<SetupPriceSection />);
    const user = userEvent.setup();
    const btn = await screen.findByTitle('Export Excel');
    await user.click(btn);

    await vi.waitFor(() => expect(priceSheetApi.get).toHaveBeenCalledWith('sheet_1'));
    expect(exportSheetToExcel).not.toHaveBeenCalled();
    expect(await screen.findByText('Không export được')).toBeInTheDocument();
  });
});

describe('danh sách vẽ được cả hai dạng payload', () => {
  it('dạng rút gọn hiện đúng số size và tên product type', async () => {
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow()] });

    render(<SetupPriceSection />);

    expect(await screen.findByText('20 size')).toBeInTheDocument();
    expect(screen.getByText('Football Jersey')).toBeInTheDocument();
  });

  it('dạng đầy đủ của backend cũ cũng ra đúng số size', async () => {
    priceSheetApi.list.mockResolvedValue({ data: [fullSheet()] });

    render(<SetupPriceSection />);

    expect(await screen.findByText('20 size')).toBeInTheDocument();
    expect(screen.getByText('Football Jersey')).toBeInTheDocument();
  });
});
