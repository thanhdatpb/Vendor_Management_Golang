// ════════════════════════════════════════════════════════
//  BẢNG GIÁ THƯ VIỆN — Total (fulfill) tự nhảy + dán nhiều dòng như Google Sheet
//
//  Điều bộ test này canh (yêu cầu của Vendor):
//    1. Sửa Price Ship Item 2 → Total (fulfill) của ĐÚNG nhóm đó tự tính lại
//       (= P1 + Price Ship + Price Ship Item 2), nhóm khác không đụng tới.
//    2. Kéo chọn nhiều dòng trong một cột rồi Ctrl+V: nhiều giá trị thì rải
//       tuần tự, một giá trị thì điền cả vùng — Total nhảy theo từng dòng.
//    3. Role chỉ-đọc (Seller/CSF/PD) double-click không mở được ô sửa.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
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

let currentUser = { role: 'vendor', name: 'US1' };
vi.stubGlobal('localStorage', {
  getItem: (k) => (k === 'user' ? JSON.stringify(currentUser) : null),
  setItem: () => {}, removeItem: () => {}, clear: () => {},
});

const priceRow = (size, pricing1) => ({
  kyHieu: 'US1', productType: 'Sweatshirt Crewneck', size,
  pricing1, pricing2: null,
  eco_price: 5, eco_price_item2: null, eco_total: 77,   // Total Economy "cũ" từ Excel
  ground_price: 8.49, ground_price_item2: null, ground_total: 19.49,
});

const FILE = {
  id: 'f_sweat',
  filename: 'HC_Sweatshirt_P.Happy',
  importedAt: '2026-08-21T10:03:00.000Z',
  title: 'Sweatshirt',
  generalInfo: [{ id: 'g_us1', kyHieu: 'US1', vendorName: 'US1', productType: 'Sweatshirt Crewneck', chatLieu: 'Cotton' }],
  pricing: [priceRow('S', 11), priceRow('M', 11), priceRow('L', 11)],
  sourceTab: 'all',
  projects: [],
};

// Thứ tự ô trong một dòng: Vendor, Product Type, Size, Optional, P1, P2,
// rồi 3 ô mỗi nhóm vận chuyển (Price Ship / Item 2 / Total).
const CELL = { p1: 4, ecoTotal: 8, groundPrice: 9, groundItem2: 10, groundTotal: 11 };

const renderViewer = (props = {}) => render(
  <MemoryRouter initialEntries={['/vendor/library']}>
    <VendorLibraryViewer {...props} />
  </MemoryRouter>
);

// Mở file → tab "Về giá" → trả về các dòng dữ liệu của bảng giá.
const openPricingTab = async () => {
  await userEvent.click(await screen.findByText('HC_Sweatshirt_P.Happy'));
  const dialog = await screen.findByRole('dialog', { name: 'HC_Sweatshirt_P.Happy' });
  await userEvent.click(within(dialog).getByRole('button', { name: /Về giá/ }));
  const table = within(dialog).getByRole('table');
  const bodyRows = within(table).getAllByRole('row').slice(2); // bỏ 2 dòng header
  return { dialog, bodyRows };
};

const cellAt = (bodyRows, rowIdx, cellIdx) => within(bodyRows[rowIdx]).getAllByRole('cell')[cellIdx];
const savedPricing = () => vendorLibraryApi.save.mock.calls.at(-1)[0][0].pricing;
const paste = (el, text) => fireEvent.paste(el, { clipboardData: { getData: () => text } });

beforeEach(() => {
  currentUser = { role: 'vendor', name: 'US1' };
  vendorLibraryApi.get.mockReset();
  vendorLibraryApi.save.mockReset();
  vendorLibraryApi.get.mockResolvedValue({ data: [FILE] });
  vendorLibraryApi.save.mockResolvedValue({ data: { message: 'ok' } });
});

describe('Total (fulfill) tự nhảy khi sửa ô', () => {
  it('nhập Price Ship Item 2 → Total nhóm đó = P1 + Price Ship + Item 2', async () => {
    renderViewer();
    const { bodyRows } = await openPricingTab();

    const cell = cellAt(bodyRows, 0, CELL.groundItem2);
    fireEvent.doubleClick(cell);
    const input = within(cell).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '2.4' } });
    fireEvent.blur(input);

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    expect(savedPricing()[0].ground_total).toBe(21.89);
  });

  it('không đụng Total của nhóm vận chuyển khác', async () => {
    renderViewer();
    const { bodyRows } = await openPricingTab();

    const cell = cellAt(bodyRows, 0, CELL.groundPrice);
    fireEvent.doubleClick(cell);
    const input = within(cell).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    const row = savedPricing()[0];
    expect(row.ground_total).toBe(20);
    expect(row.eco_total).toBe(77); // giá trị cũ từ Excel giữ nguyên
  });

  it('sửa P1 → Total của mọi nhóm đang có dữ liệu cùng nhảy', async () => {
    renderViewer();
    const { bodyRows } = await openPricingTab();

    const cell = cellAt(bodyRows, 0, CELL.p1);
    fireEvent.doubleClick(cell);
    const input = within(cell).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.blur(input);

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    const row = savedPricing()[0];
    expect(row.ground_total).toBe(20.49);
    expect(row.eco_total).toBe(17);
  });
});

describe('Chọn vùng + dán nhiều dòng như Google Sheet', () => {
  const dragSelect = (bodyRows, fromRow, toRow, cellIdx) => {
    fireEvent.mouseDown(cellAt(bodyRows, fromRow, cellIdx), { button: 0 });
    fireEvent.mouseEnter(cellAt(bodyRows, toRow, cellIdx), { buttons: 1 });
    fireEvent.mouseUp(window);
  };

  it('dán nhiều dòng vào một cột → rải tuần tự, Total từng dòng nhảy theo', async () => {
    renderViewer();
    const { bodyRows } = await openPricingTab();

    fireEvent.mouseDown(cellAt(bodyRows, 0, CELL.groundItem2), { button: 0 });
    fireEvent.mouseUp(window);
    paste(cellAt(bodyRows, 0, CELL.groundItem2), '1\n2\n3');

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    expect(savedPricing().map(r => r.ground_price_item2)).toEqual([1, 2, 3]);
    expect(savedPricing().map(r => r.ground_total)).toEqual([20.49, 21.49, 22.49]);
  });

  it('dán 1 giá trị vào vùng đã chọn → điền cả vùng', async () => {
    renderViewer();
    const { bodyRows } = await openPricingTab();

    dragSelect(bodyRows, 0, 2, CELL.groundItem2);
    paste(cellAt(bodyRows, 2, CELL.groundItem2), '2.4');

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    expect(savedPricing().map(r => r.ground_price_item2)).toEqual([2.4, 2.4, 2.4]);
    expect(savedPricing().map(r => r.ground_total)).toEqual([21.89, 21.89, 21.89]);
  });

  it('Delete xoá cả vùng chọn và tính lại Total', async () => {
    renderViewer();
    const { bodyRows } = await openPricingTab();

    dragSelect(bodyRows, 0, 1, CELL.groundPrice);
    fireEvent.keyDown(cellAt(bodyRows, 0, CELL.groundPrice), { key: 'Delete' });

    await waitFor(() => expect(vendorLibraryApi.save).toHaveBeenCalled());
    expect(savedPricing().map(r => r.ground_price)).toEqual([null, null, 8.49]);
    expect(savedPricing().map(r => r.ground_total)).toEqual([11, 11, 19.49]);
  });

  it('dán chữ vào cột số → không ghi gì, báo cho người dùng', async () => {
    renderViewer();
    const { bodyRows } = await openPricingTab();

    fireEvent.mouseDown(cellAt(bodyRows, 0, CELL.groundItem2), { button: 0 });
    fireEvent.mouseUp(window);
    paste(cellAt(bodyRows, 0, CELL.groundItem2), 'abc');

    expect(await screen.findByText(/không phải số/i)).toBeInTheDocument();
    expect(vendorLibraryApi.save).not.toHaveBeenCalled();
  });
});

describe('Role chỉ đọc', () => {
  it('Seller double-click không mở được ô sửa', async () => {
    currentUser = { role: 'seller', name: 'Seller' };
    renderViewer({ readOnly: true });
    const { bodyRows } = await openPricingTab();

    const cell = cellAt(bodyRows, 0, CELL.groundItem2);
    fireEvent.doubleClick(cell);

    expect(within(cell).queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(vendorLibraryApi.save).not.toHaveBeenCalled();
  });
});
