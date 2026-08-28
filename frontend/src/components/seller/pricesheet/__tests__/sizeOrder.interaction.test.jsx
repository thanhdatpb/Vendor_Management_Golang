// ════════════════════════════════════════════════════════
//  MỤC 05/06 (tầng UI) — ĐỔI THỨ TỰ SIZE VÀ CỘT CUSTOMIZE
//
//  Ba đường vào phải cho ra ĐÚNG một kết quả: kéo tay cầm ⠿, bấm nút ▲▼/◀▶,
//  và Alt+mũi tên khi tay cầm đang giữ focus. Test ở đây chỉ đi qua đường nút
//  (dễ giả lập trong jsdom hơn native drag) và Alt+phím — đường kéo dùng cùng
//  handler `onMoveSize`/`onMoveCustomize` nên được phủ gián tiếp.
//
//  Bẫy phải giữ: đổi thứ tự dòng KHÔNG được đổi giá đã nhập của bất kỳ size
//  nào (giá bám theo `id`, không bám theo vị trí hiển thị).
// ════════════════════════════════════════════════════════
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PriceTable from '../PriceTable';
import { moveByDelta, moveById, orderIdsOf } from '../../../../utils/sheetStructure';

const settings = { price: 10, quantity: 1, shipPerOrder: 0, shipPerItem: 0, couponUsd: 0, couponPct: 0, variableFeePct: 0, amzFeePct: 17, importTax: 0 };

const ptOf = () => ({
  id: 'pt1', name: 'PT', phoi: '0',
  customizeInfos: [{ id: 'ci1', name: 'Face' }, { id: 'ci2', name: 'Name' }],
  sizes: [
    { id: 's1', label: 'S', sizeAdd: '1', itemCost: '5', customize: { ci1: '3', ci2: '1' } },
    { id: 's2', label: 'M', sizeAdd: '2', itemCost: '5', customize: { ci1: '4', ci2: '2' } },
    { id: 's3', label: 'L', sizeAdd: '3', itemCost: '5', customize: { ci1: '5', ci2: '3' } },
  ],
});

/** Harness state thật: onMoveSize/onMoveCustomize áp patch giống PriceSheetWorkspace. */
function Harness() {
  const [pt, setPt] = useState(ptOf);
  const onMoveSize = (ptId, szId, delta) => setPt((p) => {
    const idx = p.sizes.findIndex((s) => s.id === szId);
    return { ...p, sizes: moveByDelta(p.sizes, idx, delta) };
  });
  const onMoveCustomize = (ptId, ciId, delta) => setPt((p) => {
    const idx = p.customizeInfos.findIndex((c) => c.id === ciId);
    return { ...p, customizeInfos: moveByDelta(p.customizeInfos, idx, delta) };
  });
  return (
    <PriceTable pt={pt} settings={settings}
      onUpdateSize={(ptId, szId, patch) => setPt((p) => ({ ...p, sizes: p.sizes.map((s) => (s.id === szId ? { ...s, ...patch } : s)) }))}
      onRemoveSize={vi.fn()} onUpdateCustomize={vi.fn()} onRenameCustomize={vi.fn()} onRemoveCustomize={vi.fn()}
      onMoveSize={onMoveSize} onMoveCustomize={onMoveCustomize} />
  );
}

const labelOrder = () => screen.getAllByLabelText('Tên size').map((el) => el.value);

describe('Nút ▲▼ đổi thứ tự size', () => {
  it('bấm ▼ ở dòng đầu → đổi đúng 1 bậc', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Chuyển size S xuống dưới'));
    expect(labelOrder()).toEqual(['M', 'S', 'L']);
  });

  it('bấm ▲ ở dòng đầu → không làm gì (đã ở đầu)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Chuyển size S lên trên'));
    expect(labelOrder()).toEqual(['S', 'M', 'L']);
  });

  it('đổi thứ tự KHÔNG đổi giá đã nhập của bất kỳ size nào', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Chuyển size S xuống dưới'));

    const prices = new Map(
      screen.getAllByLabelText('Tên size').map((el, i) => [
        el.value,
        screen.getAllByLabelText(/^Giá size/)[i].value,
      ])
    );
    expect(prices.get('S')).toBe('1');
    expect(prices.get('M')).toBe('2');
    expect(prices.get('L')).toBe('3');
  });
});

describe('Alt+mũi tên đổi thứ tự size, focus ở lại tay cầm vừa di chuyển', () => {
  it('Alt+↓ trên tay cầm dòng S → đổi 1 bậc và giữ focus', () => {
    render(<Harness />);
    const handle = screen.getByLabelText('Đổi thứ tự size S');
    handle.focus();
    fireEvent.keyDown(handle, { key: 'ArrowDown', altKey: true });

    expect(labelOrder()).toEqual(['M', 'S', 'L']);
    expect(document.activeElement).toHaveAttribute('aria-label', 'Đổi thứ tự size S');
  });

  it('mũi tên KHÔNG giữ Alt thì không làm gì', () => {
    render(<Harness />);
    const handle = screen.getByLabelText('Đổi thứ tự size S');
    fireEvent.keyDown(handle, { key: 'ArrowDown' });
    expect(labelOrder()).toEqual(['S', 'M', 'L']);
  });
});

describe('Kéo-thả bắt đầu từ ô Giá Size KHÔNG kích hoạt sắp xếp', () => {
  it('mousedown trên ô giá vẫn chỉ chọn vùng (PR-A1), không đổi thứ tự dòng', () => {
    render(<Harness />);
    const priceCell = screen.getAllByLabelText(/^Giá size/)[0].parentElement;
    fireEvent.mouseDown(priceCell);
    fireEvent.mouseUp(window);
    expect(labelOrder()).toEqual(['S', 'M', 'L']);
  });
});

describe('Nút ◀▶ đổi thứ tự cột Customize', () => {
  const headerOrder = () => screen.getAllByLabelText('Tên cột customize').map((el) => el.value);

  it('bấm ▶ trên cột Face → Face và Name đổi chỗ', () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText('Chuyển cột Face sang phải'));
    expect(headerOrder()).toEqual(['Name', 'Face']);
  });

  it('hoán vị cột KHÔNG đổi giá của bất kỳ ô nào (bám theo ci.id, không theo vị trí)', () => {
    render(<Harness />);
    const before = screen.getAllByLabelText(/^Face — size/).map((el) => el.value);
    fireEvent.click(screen.getByLabelText('Chuyển cột Face sang phải'));
    const after = screen.getAllByLabelText(/^Face — size/).map((el) => el.value);
    expect(after).toEqual(before);
  });

  it('nút bên trái của cột đầu tiên bị disable', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Chuyển cột Face sang trái')).toBeDisabled();
  });
});

describe('sheetStructure — hàm thuần dùng chung cho cả 3 đường vào', () => {
  it('moveByDelta ra ngoài biên là no-op', () => {
    const arr = [{ id: 'a' }, { id: 'b' }];
    expect(moveByDelta(arr, 0, -1)).toBe(arr);
    expect(moveByDelta(arr, 1, 1)).toBe(arr);
  });

  it('moveById di chuyển đúng phần tử theo id, không cần biết index trước', () => {
    const arr = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(moveById(arr, 'c', 0).map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('orderIdsOf trả đúng danh sách id theo thứ tự hiển thị', () => {
    expect(orderIdsOf([{ id: 'x' }, { id: 'y' }])).toEqual(['x', 'y']);
  });
});
