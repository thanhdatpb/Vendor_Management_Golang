// ════════════════════════════════════════════════════════
//  MỤC 02 (tầng UI) — THÊM / SỬA / XOÁ SIZE Ở CẢ HAI LOẠI PRODUCT TYPE
//
//  Trước PR-A4, nút "＋ Thêm Size" và cột Xoá bị gate `!libEntry`: Product Type
//  lấy từ thư viện không thêm được size, không xoá được size dư, tên size khoá
//  cứng. Thực tế một phôi dùng chung nhiều project thì size dư là bình thường —
//  Seller phải dọn được TRONG bảng tính giá của mình, và thao tác đó KHÔNG
//  được đụng tới file thư viện Vendor gốc (xem libraryReadonly.test.js).
//
//  `describe.each` chạy cùng một bộ assertion cho cả 2 loại Product Type: bất
//  cứ gate nào quay lại chỉ ở một chế độ đều bị bắt ngay.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PriceTable from '../PriceTable';
import ProductTypeCard from '../ProductTypeCard';

const settings = { price: 10, quantity: 1, shipPerOrder: 0, shipPerItem: 0, couponUsd: 0, couponPct: 0, variableFeePct: 0, amzFeePct: 17, importTax: 0 };

const rows = (isLib) => [
  { id: 's1', label: 'S', sizeAdd: '1', itemCost: '5', customize: {}, isLib },
  { id: 's2', label: 'M', sizeAdd: '', itemCost: '5', customize: {}, isLib },
  { id: 's3', label: 'L', sizeAdd: '3', itemCost: '5', customize: {}, isLib },
];
const ptOf = (isLib) => ({ id: 'pt1', name: 'PT', phoi: '0', customizeInfos: [], sizes: rows(isLib) });

const cardProps = {
  settings,
  onPT: vi.fn(), onRemovePT: vi.fn(), onAddSize: vi.fn(), onUpdateSize: vi.fn(), onRemoveSize: vi.fn(),
  onUpdateCustomize: vi.fn(), onAddCustomize: vi.fn(), onRenameCustomize: vi.fn(), onRemoveCustomize: vi.fn(),
  onMoveSize: vi.fn(), onReorderSizes: vi.fn(), onMoveCustomize: vi.fn(), onReorderCustomize: vi.fn(),
  onRestoreFromLibrary: vi.fn(),
};

const renderTable = (isLib, over = {}) => {
  const handlers = {
    onUpdateSize: vi.fn(), onRemoveSize: vi.fn(), onUpdateCustomize: vi.fn(),
    onRenameCustomize: vi.fn(), onRemoveCustomize: vi.fn(), ...over,
  };
  render(<PriceTable pt={ptOf(isLib)} settings={settings} {...handlers} />);
  return handlers;
};

describe.each([
  ['Product Type lấy từ thư viện', true, { vendor: 'VN3', sizes: ['S', 'M', 'L'] }],
  ['Product Type nhập tay', false, null],
])('%s', (_label, isLib, libEntry) => {
  it('nút ＋ Thêm Size luôn có mặt', () => {
    const onAddSize = vi.fn();
    render(<ProductTypeCard {...cardProps} onAddSize={onAddSize} pt={ptOf(isLib)} libEntry={libEntry} />);

    fireEvent.click(screen.getByText('＋ Thêm Size'));
    expect(onAddSize).toHaveBeenCalledWith('pt1');
  });

  it('mỗi dòng đều có nút xoá', () => {
    renderTable(isLib);
    expect(screen.getAllByTitle(/^Xoá size .* khỏi bảng tính giá$/)).toHaveLength(3);
  });

  it('xoá dòng CHƯA có dữ liệu → xoá luôn, không hỏi lại', () => {
    const { onRemoveSize } = renderTable(isLib);
    fireEvent.click(screen.getByTitle('Xoá size M khỏi bảng tính giá'));

    expect(onRemoveSize).toHaveBeenCalledWith('pt1', 's2');
    expect(screen.queryByText('Xoá size khỏi bảng tính giá')).not.toBeInTheDocument();
  });

  it('xoá dòng ĐÃ có giá → hỏi xác nhận trước, huỷ thì không xoá gì', () => {
    const { onRemoveSize } = renderTable(isLib);
    fireEvent.click(screen.getByTitle('Xoá size S khỏi bảng tính giá'));

    expect(screen.getByText('Xoá size khỏi bảng tính giá')).toBeInTheDocument();
    expect(onRemoveSize).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Huỷ'));
    expect(onRemoveSize).not.toHaveBeenCalled();
  });

  it('xác nhận trong hộp thoại mới thực sự xoá', () => {
    const { onRemoveSize } = renderTable(isLib);
    fireEvent.click(screen.getByTitle('Xoá size S khỏi bảng tính giá'));
    fireEvent.click(screen.getByText('Xoá dòng'));

    expect(onRemoveSize).toHaveBeenCalledWith('pt1', 's1');
  });

});

describe('Sửa tên size', () => {
  it('dòng thư viện ghi vào overrides.label (giữ đường khôi phục), KHÔNG ghi đè label', () => {
    const { onUpdateSize } = renderTable(true);
    fireEvent.change(screen.getAllByLabelText('Tên size')[0], { target: { value: 'S (rộng)' } });

    expect(onUpdateSize).toHaveBeenCalledWith('pt1', 's1', { overrides: { label: 'S (rộng)' } });
  });

  it('dòng tự thêm ghi thẳng vào label', () => {
    const { onUpdateSize } = renderTable(false);
    fireEvent.change(screen.getAllByLabelText('Tên size')[0], { target: { value: 'Size riêng' } });

    expect(onUpdateSize).toHaveBeenCalledWith('pt1', 's1', { label: 'Size riêng' });
  });

  it('ô tên size của dòng thư viện KHÔNG còn readOnly', () => {
    renderTable(true);
    expect(screen.getAllByLabelText('Tên size')[0]).not.toHaveAttribute('readonly');
  });
});

describe('Item Cost theo từng dòng', () => {
  it('dòng thư viện chỉ đọc (giá vốn thuộc về thư viện)', () => {
    renderTable(true);
    expect(screen.getAllByLabelText(/^Item cost/)[0]).toHaveAttribute('readonly');
  });

  it('dòng tự thêm nhập tay được — nếu không Profit của dòng đó sai', () => {
    const { onUpdateSize } = renderTable(false);
    fireEvent.change(screen.getAllByLabelText(/^Item cost/)[1], { target: { value: '7.5' } });

    expect(onUpdateSize).toHaveBeenCalledWith('pt1', 's2', { itemCost: '7.5' });
  });
});

describe('Khôi phục theo thư viện', () => {
  it('chỉ hiện với Product Type có nguồn thư viện', () => {
    const { rerender } = render(<ProductTypeCard {...cardProps} pt={ptOf(true)} libEntry={{ vendor: 'VN3', sizes: [] }} />);
    expect(screen.getByText('↺ Khôi phục theo thư viện')).toBeInTheDocument();

    rerender(<ProductTypeCard {...cardProps} pt={ptOf(false)} libEntry={null} />);
    expect(screen.queryByText('↺ Khôi phục theo thư viện')).not.toBeInTheDocument();
  });

  it('hỏi xác nhận trước khi khôi phục', () => {
    const onRestoreFromLibrary = vi.fn();
    render(<ProductTypeCard {...cardProps} onRestoreFromLibrary={onRestoreFromLibrary}
      pt={ptOf(true)} libEntry={{ vendor: 'VN3', sizes: [] }} />);

    fireEvent.click(screen.getByText('↺ Khôi phục theo thư viện'));
    expect(onRestoreFromLibrary).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Khôi phục'));
    expect(onRestoreFromLibrary).toHaveBeenCalledWith('pt1');
  });
});
