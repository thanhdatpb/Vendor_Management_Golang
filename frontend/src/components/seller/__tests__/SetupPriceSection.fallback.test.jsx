// ════════════════════════════════════════════════════════
//  MỤC 17 — Đường lùi khi backend chưa có `GET /price-sheets/{id}`.
//
//  Deploy frontend TRƯỚC backend là chuyện xảy ra được (CDN/cache, hoặc chỉ
//  đơn giản là làm sai thứ tự). Lúc đó `priceSheetApi.get` trả 404. Không có
//  đường lùi thì Seller không mở được BẤT KỲ bảng giá nào — cả tính năng chết.
//
//  Ở tình huống đó, backend cũ vẫn trả danh sách dạng sheet ĐẦY ĐỦ, nên bản
//  trong danh sách là đủ để mở workspace.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetupPriceSection from '../SetupPriceSection';
import { priceSheetApi } from '../../../services/api';

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

// Workspace thật quá nặng để dựng; thay bằng bản ghi lại đúng thứ nó nhận được.
vi.mock('../PriceSheetWorkspace', () => ({
  default: ({ sheet }) => (
    <div data-testid="workspace">
      <span data-testid="ws-name">{sheet.name}</span>
      <span data-testid="ws-sizes">{sheet.productTypes?.[0]?.sizes?.length ?? 0}</span>
    </div>
  ),
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

const clickOpen = async () => {
  const user = userEvent.setup();
  const btn = await screen.findByRole('button', { name: 'Mở bảng' });
  await user.click(btn);
};

beforeEach(() => {
  priceSheetApi.list.mockReset();
  priceSheetApi.get.mockReset();
});

describe('mở bảng khi backend chưa có /price-sheets/{id}', () => {
  it('dùng bản đầy đủ trong danh sách thay vì chặn người dùng', async () => {
    priceSheetApi.list.mockResolvedValue({ data: [fullSheet()] });
    priceSheetApi.get.mockRejectedValue(notFound());

    render(<SetupPriceSection />);
    await clickOpen();

    const ws = await screen.findByTestId('workspace');
    expect(ws).toBeInTheDocument();
    // Mở đúng nội dung, không phải bảng trống — đây mới là điều quan trọng:
    // bảng trống mà Seller bấm Lưu là ghi đè mất bảng giá thật.
    expect(screen.getByTestId('ws-sizes')).toHaveTextContent('20');
    expect(screen.getByTestId('ws-name')).toHaveTextContent('Legend Shirt');
  });

  it('không mở bảng TRỐNG khi danh sách chỉ có bản rút gọn', async () => {
    // Backend mới (danh sách rút gọn) + endpoint chi tiết hỏng: không có gì để
    // mở an toàn → thà báo lỗi còn hơn mở bảng rỗng rồi để người dùng lưu đè.
    priceSheetApi.list.mockResolvedValue({ data: [summaryRow()] });
    priceSheetApi.get.mockRejectedValue(notFound());

    render(<SetupPriceSection />);
    await clickOpen();

    await waitFor(() => expect(priceSheetApi.get).toHaveBeenCalledWith('sheet_1'));
    expect(screen.queryByTestId('workspace')).not.toBeInTheDocument();
  });
});

describe('đường bình thường vẫn được ưu tiên', () => {
  it('gọi get(id) và mở bằng dữ liệu server, không dùng bản trong danh sách', async () => {
    const server = fullSheet();
    server.name = 'Ban tu server';
    priceSheetApi.list.mockResolvedValue({ data: [fullSheet()] });
    priceSheetApi.get.mockResolvedValue({ data: server });

    render(<SetupPriceSection />);
    await clickOpen();

    expect(await screen.findByTestId('ws-name')).toHaveTextContent('Ban tu server');
    expect(priceSheetApi.get).toHaveBeenCalledWith('sheet_1');
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
