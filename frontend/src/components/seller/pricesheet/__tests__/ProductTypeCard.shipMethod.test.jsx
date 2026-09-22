// ════════════════════════════════════════════════════════
//  SHIP METHOD TỰ NHẬN DIỆN + ITEM COST = TOTAL (FULFILL) trên Product Type Card
//
//  Card nhận PT ĐÃ resolve (đúng như PriceSheetWorkspace truyền xuống), nên
//  test dựng PT qua resolveSheet thật với một index thư viện dựng tay.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ProductTypeCard from '../ProductTypeCard';
import { resolveSheet } from '../../../../utils/resolveSheet';
import { findLibraryEntry } from '../../../../utils/vendorLibraryIndex';

const settings = { price: 20, quantity: 1, shipPerOrder: 0, shipPerItem: 0, couponUsd: 0, couponPct: 0, variableFeePct: 0, amzFeePct: 17, importTax: 0 };
const noop = () => {};
const baseProps = {
  settings,
  onRemovePT: noop, onAddSize: noop, onUpdateSize: noop, onRemoveSize: noop,
  onUpdateCustomize: noop, onAddCustomize: noop, onRenameCustomize: noop, onRemoveCustomize: noop,
};

const makeIndex = (rows) => {
  const bySize = {};
  const sizes = [];
  rows.forEach((r) => { bySize[r.size.toLowerCase()] = r; sizes.push(r.size); });
  return { tee: { productType: 'Tee', vendor: 'V1', filename: 'f', sizes, bySize, records: [] } };
};

/** Resolve PT như workspace rồi render card; trả onPT để kiểm lượt chọn Ship Method. */
const renderCard = (rows, ptOver = {}) => {
  const index = makeIndex(rows);
  const pt = resolveSheet({ settings, productTypes: [{
    id: 'pt_t', name: 'Tee', phoi: '0', shown: true, customizeInfos: [], sizes: [], ...ptOver,
  }] }, index).productTypes[0];
  const onPT = vi.fn();
  render(<ProductTypeCard {...baseProps} onPT={onPT} pt={pt} libEntry={findLibraryEntry(index, 'Tee')} />);
  return { onPT, pt };
};

const shipGroup = () => screen.queryByRole('group', { name: 'Ship Method' });
const itemCostInput = (size) => screen.getByLabelText(`Item cost — size ${size}`);

describe('Phôi có giá ở đúng 1 phương thức', () => {
  const rows = [
    { size: 'S', pricing1: 13.7, eco_total: 13.7 },
    { size: '2XL', pricing1: 15.2, eco_total: 15.2 },
  ];

  it('tự áp Economy: hiện chip "✓ Economy", KHÔNG có nhãn "Tự nhận diện", không bắt chọn', () => {
    renderCard(rows);
    expect(screen.getByText('✓ Economy')).toBeInTheDocument();
    expect(screen.queryByText(/tự nhận diện/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chọn 1 trong/)).not.toBeInTheDocument();
    expect(screen.queryByText('Chưa chọn')).not.toBeInTheDocument();
    expect(shipGroup()).not.toBeInTheDocument();          // không còn 5 nút để bấm
  });

  it('Item Cost = Total (Fulfill), tiêu đề cột ghi rõ nguồn', () => {
    renderCard(rows);
    expect(itemCostInput('S')).toHaveValue(13.7);
    expect(itemCostInput('2XL')).toHaveValue(15.2);
    expect(screen.getByText('Total (fulfill) · Economy')).toBeInTheDocument();
  });

  it('size thiếu giá: vẫn chỉ chip "✓ Economy" (không "Tự nhận diện"), đếm size thiếu, ô báo "Thiếu giá"', () => {
    renderCard([...rows, { size: '4XL', pricing1: 10.39 }, { size: '5XL', pricing1: 11.39 }]);
    expect(screen.getByText('✓ Economy')).toBeInTheDocument();
    expect(screen.queryByText(/tự nhận diện/i)).not.toBeInTheDocument();
    expect(screen.getByText('2 size thiếu giá Economy')).toBeInTheDocument();
    expect(screen.getAllByText('Thiếu giá')).toHaveLength(2);
  });

  it('phương thức đã lưu không còn giá → tự chuyển và báo rõ', () => {
    renderCard(rows, { shipMethod: 'express' });
    expect(screen.getByText('✓ Economy')).toBeInTheDocument();
    expect(screen.getByText('Đã chuyển Express → Economy')).toBeInTheDocument();
  });
});

describe('Phôi có giá ở 2+ phương thức', () => {
  const rows = [{ size: '3XL', pricing1: 14, eco_total: 14, ground_price: 5, ground_total: 19 }];

  it('chỉ cho chọn phương thức CÓ giá, kèm giá trên nút; chưa chọn → nhắc + Profit "—"', () => {
    renderCard(rows);
    const buttons = within(shipGroup()).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(['Economy$14.00', 'Ground$19.00']);
    expect(screen.getByText('Chọn 1 trong 2')).toBeInTheDocument();
    expect(screen.getByText('Chọn ship')).toBeInTheDocument();
    expect(screen.getByTitle('Chưa có Item Cost — chưa tính được Profit')).toHaveTextContent('—');
  });

  it('bấm Ground → ghi shipMethod = ground cho đúng Product Type', () => {
    const { onPT } = renderCard(rows);
    fireEvent.click(within(shipGroup()).getByRole('button', { name: /^Ground/ }));
    expect(onPT).toHaveBeenCalledWith('pt_t', { shipMethod: 'ground' });
  });

  it('đã chọn Ground → Item Cost = Total Ground, nút Ground sáng', () => {
    renderCard(rows, { shipMethod: 'ground' });
    expect(itemCostInput('3XL')).toHaveValue(19);
    expect(within(shipGroup()).getByRole('button', { name: /^Ground/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/Chọn 1 trong/)).not.toBeInTheDocument();
  });
});

describe('Phôi chưa có Total ở phương thức nào', () => {
  it('ẩn bộ chọn, cảnh báo đang tạm dùng P1', () => {
    renderCard([{ size: '8x10', pricing1: 4.2 }]);
    expect(shipGroup()).not.toBeInTheDocument();
    expect(screen.getByText('Chưa có Total (fulfill) · tạm dùng P1')).toBeInTheDocument();
    expect(itemCostInput('8x10')).toHaveValue(4.2);
  });
});

describe('Product Type nhập tay — giữ nguyên như trước', () => {
  it('vẫn là bộ chọn đủ 5 phương thức, Item Cost nhập được', () => {
    const pt = { id: 'pt_m', name: 'Phôi tự nhập', shown: true, customizeInfos: [],
      sizes: [{ id: 'sz1', label: 'One', sizeAdd: '1', itemCost: '5.5', customize: {} }] };
    render(<ProductTypeCard {...baseProps} onPT={noop} pt={pt} libEntry={null} />);
    expect(within(shipGroup()).getAllByRole('button')).toHaveLength(5);
    expect(itemCostInput('One')).toHaveValue(5.5);
    expect(itemCostInput('One')).not.toHaveAttribute('readonly');
  });
});
