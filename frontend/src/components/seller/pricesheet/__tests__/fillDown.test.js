// ════════════════════════════════════════════════════════
//  FILL DOWN / CLEAR / UNDO — logic thuần cho mục 01, 06 và Milestone P.
//  Test ở đây xanh vì hàm đã tách sẵn (T0); phần NỐI VÀO UI (kéo chuột chỉ
//  chọn vùng, thanh hành động nổi, Ctrl+D/Ctrl+Z) vẫn còn ở
//  priceTableDrag.pending.test.jsx.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  selectionIds, computeFillDown, computeFillRight, computeClear,
  computeUndoPatches, applyPatches, pushUndo, UNDO_LIMIT, readCell,
} from '../fillDown';

const sizes = () => ([
  { id: 's1', label: 'S', sizeAdd: '2.5', itemCost: '8', customize: { ci1: '3' } },
  { id: 's2', label: 'M', sizeAdd: '', itemCost: '8', customize: {} },
  { id: 's3', label: 'L', sizeAdd: '4', itemCost: '', customize: { ci1: '1' } },
  { id: 's4', label: 'XL', sizeAdd: '', itemCost: '', customize: {} },
]);

describe('selectionIds', () => {
  it('chọn xuôi và chọn ngược cho cùng một vùng', () => {
    expect(selectionIds(sizes(), 0, 2)).toEqual(['s1', 's2', 's3']);
    expect(selectionIds(sizes(), 2, 0)).toEqual(['s1', 's2', 's3']);
  });

  it('kéo quá biên thì cắt theo số dòng thật', () => {
    expect(selectionIds(sizes(), 2, 99)).toEqual(['s3', 's4']);
    expect(selectionIds(sizes(), -5, 0)).toEqual(['s1']);
  });

  it('chưa chọn gì thì trả mảng rỗng', () => {
    expect(selectionIds(sizes(), null, 2)).toEqual([]);
  });
});

describe('computeFillDown', () => {
  it('sao chép giá trị ô ĐẦU vùng xuống các ô còn lại', () => {
    const patches = computeFillDown(sizes(), ['s1', 's2', 's3']);
    expect(patches).toEqual([
      { id: 's2', patch: { sizeAdd: '2.5' } },
      { id: 's3', patch: { sizeAdd: '2.5' } },
    ]);
  });

  it('KHÔNG đụng ô ngoài vùng chọn', () => {
    const after = applyPatches(sizes(), computeFillDown(sizes(), ['s1', 's2']));
    expect(after.find((s) => s.id === 's3').sizeAdd).toBe('4');
    expect(after.find((s) => s.id === 's4').sizeAdd).toBe('');
  });

  it('ô đã đúng giá trị thì không sinh patch thừa (số ô báo cho user khớp thực tế)', () => {
    const list = [{ id: 'a', sizeAdd: '1' }, { id: 'b', sizeAdd: '1' }, { id: 'c', sizeAdd: '' }];
    expect(computeFillDown(list, ['a', 'b', 'c'])).toEqual([{ id: 'c', patch: { sizeAdd: '1' } }]);
  });

  it('chọn 1 ô hoặc không chọn gì thì không làm gì', () => {
    expect(computeFillDown(sizes(), ['s1'])).toEqual([]);
    expect(computeFillDown(sizes(), [])).toEqual([]);
  });

  it('điền được cả cột Item Cost và cột Customize', () => {
    expect(computeFillDown(sizes(), ['s1', 's3'], 'itemCost')).toEqual([{ id: 's3', patch: { itemCost: '8' } }]);
    expect(computeFillDown(sizes(), ['s1', 's2'], 'customize:ci1')).toEqual([
      { id: 's2', patch: { customize: { ci1: '3' } } },
    ]);
  });

  it('điền cột customize giữ nguyên các cột customize khác của dòng', () => {
    const list = [
      { id: 'a', customize: { c1: '5', c2: '9' } },
      { id: 'b', customize: { c1: '', c2: '7' } },
    ];
    const [patch] = computeFillDown(list, ['a', 'b'], 'customize:c1');
    expect(patch.patch.customize).toEqual({ c1: '5', c2: '7' });
  });
});

describe('computeFillRight', () => {
  it('sao chép sang các cột nhập của cùng dòng', () => {
    const row = { id: 's1', sizeAdd: '2.5', customize: { c1: '', c2: '' } };
    const [patch] = computeFillRight(row, ['sizeAdd', 'customize:c1', 'customize:c2']);
    expect(patch.patch.customize).toEqual({ c1: '2.5', c2: '2.5' });
  });

  it('mọi ô đã bằng nhau thì không sinh patch', () => {
    const row = { id: 's1', sizeAdd: '1', itemCost: '1' };
    expect(computeFillRight(row, ['sizeAdd', 'itemCost'])).toEqual([]);
  });
});

describe('computeClear — xoá CÓ CHỦ ĐÍCH', () => {
  it('chỉ xoá ô trong vùng chọn và bỏ qua ô vốn đã trống', () => {
    const patches = computeClear(sizes(), ['s1', 's2', 's3']);
    expect(patches).toEqual([
      { id: 's1', patch: { sizeAdd: '' } },
      { id: 's3', patch: { sizeAdd: '' } },
    ]);
  });
});

describe('Undo', () => {
  it('patch nghịch đảo khôi phục đúng trạng thái trước đó, kể cả ô rỗng', () => {
    const before = sizes();
    const patches = computeFillDown(before, ['s1', 's2', 's3', 's4']);
    const undo = computeUndoPatches(before, patches);
    const after = applyPatches(before, patches);
    expect(applyPatches(after, undo)).toEqual(before);
  });

  it('undo của thao tác xoá trả lại đúng giá trị cũ', () => {
    const before = sizes();
    const patches = computeClear(before, ['s1', 's3']);
    const undo = computeUndoPatches(before, patches);
    expect(applyPatches(applyPatches(before, patches), undo)).toEqual(before);
  });

  it('undo của thao tác trên cột customize trả lại cả object customize cũ', () => {
    const before = sizes();
    const patches = computeFillDown(before, ['s3', 's4'], 'customize:ci1');
    const undo = computeUndoPatches(before, patches);
    expect(applyPatches(applyPatches(before, patches), undo)).toEqual(before);
  });

  it(`stack giữ tối đa ${UNDO_LIMIT} bước, bước mới nhất nằm đầu`, () => {
    let stack = [];
    for (let i = 0; i < UNDO_LIMIT + 5; i++) stack = pushUndo(stack, { step: i });
    expect(stack).toHaveLength(UNDO_LIMIT);
    expect(stack[0]).toEqual({ step: UNDO_LIMIT + 4 });
  });
});

describe('applyPatches / readCell', () => {
  it('applyPatches không mutate mảng gốc', () => {
    const before = sizes();
    const snapshot = JSON.stringify(before);
    applyPatches(before, computeClear(before, ['s1']));
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('readCell đọc được cả field thường lẫn cột customize', () => {
    expect(readCell(sizes()[0], 'sizeAdd')).toBe('2.5');
    expect(readCell(sizes()[0], 'customize:ci1')).toBe('3');
    expect(readCell(sizes()[1], 'customize:ci1')).toBe('');
  });
});
