// ════════════════════════════════════════════════════════
//  MỤC 01 — KÉO CHUỘT KHÔNG ĐƯỢC XOÁ GIÁ (regression 2026-08)
//  ⛔ ĐỎ LÀ ĐÚNG cho tới khi PR-A1 xong. Hiện PriceTable.jsx vẫn ghi
//     { sizeAdd: '' } cho mọi ô đã kéo qua khi thả chuột → mất dữ liệu thật,
//     không hoàn tác được, và Seller không còn bản Google Sheet để đối chiếu.
//
//  Khi PR-A1 merge: đổi tên file bỏ `.pending` → thành cổng chặn merge.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PriceTable from '../PriceTable';

const settings = { price: 10, quantity: 1, shipPerOrder: 0, shipPerItem: 0, couponUsd: 0, couponPct: 0, variableFeePct: 0, amzFeePct: 17, importTax: 0 };
const pt = () => ({
  id: 'pt1', name: 'PT', phoi: '0', customizeInfos: [],
  sizes: [   
    { id: 's1', label: 'S', sizeAdd: '1', itemCost: '5', customize: {} },
    { id: 's2', label: 'M', sizeAdd: '2', itemCost: '5', customize: {} },
    { id: 's3', label: 'L', sizeAdd: '3', itemCost: '5', customize: {} },
    { id: 's4', label: 'XL', sizeAdd: '4', itemCost: '5', customize: {} },
    { id: 's5', label: '2XL', sizeAdd: '5', itemCost: '5', customize: {} },
  ],
});

const renderTable = (over = {}) => {
  const props = {
    pt: pt(), settings, libEntry: null,
    onUpdateSize: vi.fn(), onRemoveSize: vi.fn(), onUpdateCustomize: vi.fn(),
    onRenameCustomize: vi.fn(), onRemoveCustomize: vi.fn(),
    ...over,
  };
  render(<PriceTable {...props} />);
  return props;
};

const priceCells = () => screen.getAllByLabelText(/^Giá size/);

describe('Mục 01 — kéo chuột qua cột Giá Size', () => {
  it('KHÔNG ĐƯỢC XOÁ khi kéo — regression 2026-08', () => {
    const props = renderTable();
    const cells = priceCells();

    fireEvent.mouseDown(cells[0].parentElement);
    fireEvent.mouseEnter(cells[2].parentElement, { buttons: 1 });
    fireEvent.mouseEnter(cells[4].parentElement, { buttons: 1 });
    fireEvent.mouseUp(window);

    expect(props.onUpdateSize).not.toHaveBeenCalled();
    expect(priceCells().map((el) => el.value)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('thả chuột chỉ để lại vùng chọn được tô sáng, không ghi gì', () => {
    renderTable();
    const cells = priceCells();
    fireEvent.mouseDown(cells[1].parentElement);
    fireEvent.mouseEnter(cells[3].parentElement, { buttons: 1 });
    fireEvent.mouseUp(window);

    // 3 ô (M, L, XL) đang được chọn
    expect(screen.getByText(/3 ô/)).toBeInTheDocument();
  });
});

describe('Mục 01 — thanh hành động của vùng chọn', () => {
  it('có nút Fill Down, Xoá và Bỏ chọn kèm số ô sẽ bị ảnh hưởng', () => {
    renderTable();
    const cells = priceCells();
    fireEvent.mouseDown(cells[0].parentElement);
    fireEvent.mouseEnter(cells[2].parentElement, { buttons: 1 });
    fireEvent.mouseUp(window);

    expect(screen.getByRole('button', { name: /Fill Down/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xoá/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bỏ chọn/i })).toBeInTheDocument();
  });

  it('Fill Down sao chép giá ô đầu vùng xuống các ô còn lại', () => {
    const props = renderTable();
    const cells = priceCells();
    fireEvent.mouseDown(cells[0].parentElement);
    fireEvent.mouseEnter(cells[2].parentElement, { buttons: 1 });
    fireEvent.mouseUp(window);
    fireEvent.click(screen.getByRole('button', { name: /Fill Down/i }));

    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s2', '1'], ['s3', '1']]);
  });

  it('Ctrl+Z hoàn tác lần thay đổi hàng loạt gần nhất', () => {
    const props = renderTable();
    const cells = priceCells();
    fireEvent.mouseDown(cells[0].parentElement);
    fireEvent.mouseEnter(cells[2].parentElement, { buttons: 1 });
    fireEvent.mouseUp(window);
    fireEvent.click(screen.getByRole('button', { name: /Fill Down/i }));
    props.onUpdateSize.mockClear();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s2', '2'], ['s3', '3']]);
  });
});

describe('Milestone P — thao tác kiểu bảng tính', () => {
  it('Ctrl+D điền xuống trong vùng chọn', () => {
    const props = renderTable();
    const cells = priceCells();
    fireEvent.mouseDown(cells[0].parentElement);
    fireEvent.mouseEnter(cells[2].parentElement, { buttons: 1 });
    fireEvent.mouseUp(window);
    props.onUpdateSize.mockClear();          // chọn vùng xong KHÔNG được ghi gì

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s2', '1'], ['s3', '1']]);
  });

  it('Delete xoá vùng chọn — có chủ đích, khác hẳn kéo chuột', () => {
    const props = renderTable();
    const cells = priceCells();
    fireEvent.mouseDown(cells[0].parentElement);
    fireEvent.mouseEnter(cells[1].parentElement, { buttons: 1 });
    fireEvent.mouseUp(window);
    props.onUpdateSize.mockClear();          // thả chuột không xoá — chỉ Delete mới xoá

    fireEvent.keyDown(window, { key: 'Delete' });
    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s1', ''], ['s2', '']]);
  });
});
