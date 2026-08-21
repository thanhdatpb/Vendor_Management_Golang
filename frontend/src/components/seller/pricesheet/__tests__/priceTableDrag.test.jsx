// ════════════════════════════════════════════════════════
//  MỤC 01 — KÉO CHUỘT KHÔNG ĐƯỢC XOÁ GIÁ (regression 2026-08)
//
//  Bug thật: Seller quen kéo chuột qua cột Giá Size để copy giá như trên Excel
//  / Google Sheet. Hệ thống lại hiểu kéo là XOÁ, không hoàn tác được, và Seller
//  đã bỏ hẳn Google Sheet nên không còn bản đối chiếu — mất là mất vĩnh viễn.
//
//  PR-A1 đã nối logic thuần (pricesheet/fillDown.js) vào PriceTable: kéo giờ
//  CHỈ chọn vùng (tô sáng), thả chuột KHÔNG ghi gì. Thay đổi hàng loạt đi qua
//  thanh hành động nổi hoặc phím tắt, luôn hoàn tác được.
//
//  Render qua một harness CÓ STATE THẬT (không chỉ mock rỗng): `onUpdateSize`
//  ghi patch ngược vào `sizes` giống hệt cách PriceSheetWorkspace vận hành.
//  Bắt buộc phải vậy để test Redo đúng — Redo cần tính nghịch đảo của Undo dựa
//  trên state SAU khi Undo đã áp, không phải state gốc lúc mount.
// ════════════════════════════════════════════════════════
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import PriceTable from '../PriceTable';

const settings = { price: 10, quantity: 1, shipPerOrder: 0, shipPerItem: 0, couponUsd: 0, couponPct: 0, variableFeePct: 0, amzFeePct: 17, importTax: 0 };
const basePt = () => ({
  id: 'pt1', name: 'PT', phoi: '0', customizeInfos: [],
  sizes: [
    { id: 's1', label: 'S', sizeAdd: '1', itemCost: '5', customize: {} },
    { id: 's2', label: 'M', sizeAdd: '2', itemCost: '5', customize: {} },
    { id: 's3', label: 'L', sizeAdd: '3', itemCost: '5', customize: {} },
    { id: 's4', label: 'XL', sizeAdd: '4', itemCost: '5', customize: {} },
    { id: 's5', label: '2XL', sizeAdd: '5', itemCost: '5', customize: {} },
  ],
});

/** Harness có state thật — onUpdateSize ghi ngược vào sizes như workspace thật. */
function Harness({ spy, onRemoveSize = vi.fn() }) {
  const [pt, setPt] = useState(basePt);
  const handleUpdateSize = (ptId, szId, patch) => {
    spy(ptId, szId, patch);
    setPt((p) => ({ ...p, sizes: p.sizes.map((s) => (s.id === szId ? { ...s, ...patch } : s)) }));
  };
  return (
    <PriceTable pt={pt} settings={settings} libEntry={null}
      onUpdateSize={handleUpdateSize} onRemoveSize={onRemoveSize} onUpdateCustomize={vi.fn()}
      onRenameCustomize={vi.fn()} onRemoveCustomize={vi.fn()} />
  );
}

const renderTable = () => {
  const spy = vi.fn();
  render(<Harness spy={spy} />);
  return { onUpdateSize: spy };
};

const priceCells = () => screen.getAllByLabelText(/^Giá size/);
const dragSelect = (from, to) => {
  const cells = priceCells();
  fireEvent.mouseDown(cells[from].parentElement);
  fireEvent.mouseEnter(cells[to].parentElement, { buttons: 1 });
  fireEvent.mouseUp(window);
};
const toolbar = () => within(screen.getByTestId('ps-selection-toolbar'));

describe('Mục 01 — kéo chuột qua cột Giá Size', () => {
  it('KHÔNG ĐƯỢC XOÁ khi kéo — regression 2026-08', () => {
    const props = renderTable();
    dragSelect(0, 4);

    expect(props.onUpdateSize).not.toHaveBeenCalled();
    expect(priceCells().map((el) => el.value)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('kéo ngược (từ dưới lên trên) cũng không xoá và chọn đúng vùng', () => {
    const props = renderTable();
    dragSelect(4, 2);

    expect(props.onUpdateSize).not.toHaveBeenCalled();
    expect(toolbar().getByText('3 ô đã chọn')).toBeInTheDocument();
  });

  it('thả chuột chỉ để lại vùng chọn được tô sáng, không ghi gì', () => {
    renderTable();
    dragSelect(1, 3);

    // 3 ô (M, L, XL) đang được chọn
    expect(screen.getByText(/3 ô/)).toBeInTheDocument();
  });

  it('nhấc chuột ra khỏi vùng bảng rồi thả (mouseup ngoài) vẫn không xoá gì', () => {
    const props = renderTable();
    const cells = priceCells();
    fireEvent.mouseDown(cells[0].parentElement);
    fireEvent.mouseEnter(cells[2].parentElement, { buttons: 1 });
    // buttons=0 nghĩa là nút chuột đã nhả ở đâu đó ngoài bảng (VD ngoài cửa sổ)
    fireEvent.mouseEnter(cells[4].parentElement, { buttons: 0 });
    fireEvent.mouseUp(window);

    expect(props.onUpdateSize).not.toHaveBeenCalled();
  });

  it('click 1 ô (không kéo) vẫn tạo vùng chọn 1 ô, không tự xoá', () => {
    const props = renderTable();
    const cells = priceCells();
    fireEvent.mouseDown(cells[2].parentElement);
    fireEvent.mouseUp(window);

    expect(props.onUpdateSize).not.toHaveBeenCalled();
    expect(toolbar().getByText('1 ô đã chọn')).toBeInTheDocument();
  });
});

describe('Mục 01 — thanh hành động của vùng chọn', () => {
  it('có nút Fill Down, Xoá và Bỏ chọn kèm số ô đã chọn', () => {
    renderTable();
    dragSelect(0, 2);

    const tb = toolbar();
    expect(tb.getByRole('button', { name: /Fill Down/i })).toBeInTheDocument();
    expect(tb.getByRole('button', { name: 'Xoá' })).toBeInTheDocument();
    expect(tb.getByRole('button', { name: /Bỏ chọn/i })).toBeInTheDocument();
    expect(tb.getByText('3 ô đã chọn')).toBeInTheDocument();
  });

  it('Fill Down sao chép giá ô đầu vùng xuống các ô còn lại', () => {
    const props = renderTable();
    dragSelect(0, 2);
    fireEvent.click(toolbar().getByRole('button', { name: /Fill Down/i }));

    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s2', '1'], ['s3', '1']]);
    expect(priceCells().map((el) => el.value)).toEqual(['1', '1', '1', '4', '5']);
  });

  it('Xoá vùng chọn — CÓ CHỦ ĐÍCH, khác hẳn kéo chuột cũ', () => {
    const props = renderTable();
    dragSelect(0, 1);
    fireEvent.click(toolbar().getByRole('button', { name: 'Xoá' }));

    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s1', ''], ['s2', '']]);
  });

  it('Bỏ chọn đóng thanh hành động, không gọi onUpdateSize', () => {
    const props = renderTable();
    dragSelect(0, 2);
    fireEvent.click(toolbar().getByRole('button', { name: /Bỏ chọn/i }));

    expect(screen.queryByTestId('ps-selection-toolbar')).not.toBeInTheDocument();
    expect(props.onUpdateSize).not.toHaveBeenCalled();
  });

  it('Ctrl+Z hoàn tác lần Fill Down gần nhất', () => {
    const props = renderTable();
    dragSelect(0, 2);
    fireEvent.click(toolbar().getByRole('button', { name: /Fill Down/i }));
    props.onUpdateSize.mockClear();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s2', '2'], ['s3', '3']]);
    expect(priceCells().map((el) => el.value)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('Ctrl+Shift+Z (redo) làm lại đúng thao tác vừa undo', () => {
    const props = renderTable();
    dragSelect(0, 2);
    fireEvent.click(toolbar().getByRole('button', { name: /Fill Down/i }));
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); // undo
    props.onUpdateSize.mockClear();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true }); // redo
    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s2', '1'], ['s3', '1']]);
    expect(priceCells().map((el) => el.value)).toEqual(['1', '1', '1', '4', '5']);
  });

  it('Ctrl+Z khi chưa có thao tác nào thì không gọi onUpdateSize', () => {
    const props = renderTable();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(props.onUpdateSize).not.toHaveBeenCalled();
  });

  it('thao tác mới sau khi Undo làm mất Redo cũ (đúng ngữ nghĩa Excel)', () => {
    const props = renderTable();
    dragSelect(0, 2);
    fireEvent.click(toolbar().getByRole('button', { name: /Fill Down/i })); // s2,s3 = 1
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true }); // undo -> s2=2,s3=3

    dragSelect(2, 3); // chọn s3,s4 rồi xoá — một nhánh lịch sử MỚI
    fireEvent.click(toolbar().getByRole('button', { name: 'Xoá' }));
    props.onUpdateSize.mockClear();

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true }); // redo cũ không còn hợp lệ
    expect(props.onUpdateSize).not.toHaveBeenCalled();
  });
});

describe('Milestone P — thao tác kiểu bảng tính', () => {
  it('Ctrl+D điền xuống trong vùng chọn', () => {
    const props = renderTable();
    dragSelect(0, 2);
    props.onUpdateSize.mockClear(); // chọn vùng xong KHÔNG được ghi gì

    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });
    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s2', '1'], ['s3', '1']]);
  });

  it('Delete xoá vùng chọn — có chủ đích, khác hẳn kéo chuột', () => {
    const props = renderTable();
    dragSelect(0, 1);
    props.onUpdateSize.mockClear(); // thả chuột không xoá — chỉ Delete mới xoá

    fireEvent.keyDown(window, { key: 'Delete' });
    expect(props.onUpdateSize.mock.calls.map((c) => [c[1], c[2].sizeAdd]))
      .toEqual([['s1', ''], ['s2', '']]);
  });

  it('Escape bỏ chọn, không ghi gì', () => {
    renderTable();
    dragSelect(0, 2);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('ps-selection-toolbar')).not.toBeInTheDocument();
  });

  it('phím tắt KHÔNG chạy khi người dùng đang gõ ở ô khác (VD tên Product Type)', () => {
    const props = renderTable();
    dragSelect(0, 2);
    props.onUpdateSize.mockClear();

    // Giả lập đang gõ trong 1 input khác (không phải ô của PriceTable này) —
    // Delete/Ctrl+D lúc này phải là thao tác sửa text bình thường, không được
    // "cướp" để xoá/điền vùng giá đang chọn dở từ trước.
    const outsideInput = document.createElement('input');
    document.body.appendChild(outsideInput);
    outsideInput.focus();

    fireEvent.keyDown(window, { key: 'Delete' });
    fireEvent.keyDown(window, { key: 'd', ctrlKey: true });

    expect(props.onUpdateSize).not.toHaveBeenCalled();
    document.body.removeChild(outsideInput);
  });
});
