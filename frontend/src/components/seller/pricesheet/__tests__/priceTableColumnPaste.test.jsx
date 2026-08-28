// ════════════════════════════════════════════════════════
//  PR-A5 — VÙNG CHỌN + FILL DOWN + PASTE KIỂU GOOGLE SHEET CHO ITEM COST
//  VÀ CUSTOMIZE (trước đây chỉ có ở cột Giá Size).
//
//  Hạ tầng thuần (fillDown.js) đã hỗ trợ field 'itemCost' / 'customize:<ciId>'
//  từ trước — bộ test này khoá lại phần NỐI UI: kéo chọn vùng theo đúng cột
//  (không tràn sang cột khác), Fill Down/Ctrl+D, paste nhiều dòng rải tuần tự,
//  paste 1 giá trị vào cả vùng đã chọn, và Item Cost của dòng thư viện luôn bị
//  loại khỏi patch dù nằm trong vùng chọn.
// ════════════════════════════════════════════════════════
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PriceTable from '../PriceTable';

const settings = { price: 10, quantity: 1, shipPerOrder: 0, shipPerItem: 0, couponUsd: 0, couponPct: 0, variableFeePct: 0, amzFeePct: 17, importTax: 0 };
const basePt = () => ({
  id: 'pt1', name: 'PT', phoi: '0', customizeInfos: [{ id: 'ci1', name: 'Face' }],
  sizes: [
    { id: 's1', label: 'S', sizeAdd: '1', itemCost: '1', customize: { ci1: '1' } },
    { id: 's2', label: 'M', sizeAdd: '2', itemCost: '2', customize: { ci1: '2' }, isLib: true },
    { id: 's3', label: 'L', sizeAdd: '3', itemCost: '3', customize: { ci1: '3' } },
    { id: 's4', label: 'XL', sizeAdd: '4', itemCost: '4', customize: { ci1: '4' } },
  ],
});

/** Harness có state thật — onUpdateSize ghi ngược vào sizes như PriceSheetWorkspace thật. */
function Harness({ spy }) {
  const [pt, setPt] = useState(basePt);
  const handleUpdateSize = (ptId, szId, patch) => {
    spy(ptId, szId, patch);
    setPt((p) => ({ ...p, sizes: p.sizes.map((s) => (s.id === szId ? { ...s, ...patch } : s)) }));
  };
  return (
    <PriceTable pt={pt} settings={settings}
      onUpdateSize={handleUpdateSize} onRemoveSize={vi.fn()} onUpdateCustomize={vi.fn()}
      onRenameCustomize={vi.fn()} onRemoveCustomize={vi.fn()} />
  );
}

const renderTable = () => {
  const spy = vi.fn();
  render(<Harness spy={spy} />);
  return { onUpdateSize: spy };
};

const itemCostCells = () => screen.getAllByLabelText(/^Item cost/);
const customizeCells = () => screen.getAllByLabelText(/^Face — size/);
const dragSelect = (cellsFn, from, to) => {
  const cells = cellsFn();
  fireEvent.mouseDown(cells[from].parentElement);
  fireEvent.mouseEnter(cells[to].parentElement, { buttons: 1 });
  fireEvent.mouseUp(window);
};
const paste = (input, text) => {
  const data = { getData: () => text };
  fireEvent.paste(input, { clipboardData: data });
};

describe('Vùng chọn + Fill Down cho cột Item Cost', () => {
  it('kéo chọn rồi Fill Down chỉ ghi các dòng KHÔNG phải thư viện', () => {
    const props = renderTable();
    dragSelect(itemCostCells, 0, 3); // s1..s4, s2 là dòng thư viện (readOnly)
    fireEvent.click(screen.getByRole('button', { name: /Fill Down/i }));

    const calls = props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].itemCost]);
    expect(calls).toEqual([['s3', '1'], ['s4', '1']]); // s2 (isLib) bị lọc bỏ
  });

  it('kéo lệch sang cột khác giữa chừng không phá vùng chọn Item Cost', () => {
    renderTable();
    const cells = itemCostCells();
    const sizeCell = screen.getAllByLabelText(/^Giá size/)[1].parentElement;
    fireEvent.mouseDown(cells[0].parentElement);
    fireEvent.mouseEnter(sizeCell, { buttons: 1 }); // trôi sang cột Giá Size
    fireEvent.mouseEnter(cells[2].parentElement, { buttons: 1 }); // quay lại đúng cột
    fireEvent.mouseUp(window);

    expect(screen.getByText('3 ô đã chọn')).toBeInTheDocument();
  });
});

describe('Vùng chọn + Fill Down cho cột Customize', () => {
  it('Ctrl+D điền giá trị ô đầu vùng xuống các ô Customize còn lại', () => {
    const props = renderTable();
    dragSelect(customizeCells, 0, 2);
    props.onUpdateSize.mockClear();

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].customize]))
      .toEqual([['s2', { ci1: '1' }], ['s3', { ci1: '1' }]]);
  });
});

describe('Dán (Ctrl+V) kiểu Google Sheet cho Item Cost / Customize', () => {
  it('dán nhiều dòng vào Item Cost rải tuần tự xuống dưới, có Undo', () => {
    const props = renderTable();
    paste(itemCostCells()[2], '9\n8'); // bắt đầu ở dòng L (không phải thư viện)

    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].itemCost]))
      .toEqual([['s3', '9'], ['s4', '8']]);

    props.onUpdateSize.mockClear();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].itemCost]))
      .toEqual([['s3', '3'], ['s4', '4']]);
  });

  it('dán nhiều dòng vào cột Customize rải tuần tự xuống dưới', () => {
    const props = renderTable();
    paste(customizeCells()[1], '7\n6');

    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].customize]))
      .toEqual([['s2', { ci1: '7' }], ['s3', { ci1: '6' }]]);
  });

  it('dán 1 giá trị trong lúc đang chọn nhiều ô Item Cost → điền cho cả vùng', () => {
    const props = renderTable();
    dragSelect(itemCostCells, 0, 3); // s1..s4
    props.onUpdateSize.mockClear();

    paste(itemCostCells()[0], '12');

    const calls = props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].itemCost]);
    expect(calls).toEqual([['s1', '12'], ['s3', '12'], ['s4', '12']]); // s2 (isLib) bị lọc bỏ
  });

  it('paste sizeAdd nhiều dòng vẫn hoàn tác được (Ctrl+Z)', () => {
    const props = renderTable();
    paste(screen.getAllByLabelText(/^Giá size/)[0], '9\n8\n7');
    props.onUpdateSize.mockClear();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s1', '1'], ['s2', '2'], ['s3', '3']]);
  });
});
