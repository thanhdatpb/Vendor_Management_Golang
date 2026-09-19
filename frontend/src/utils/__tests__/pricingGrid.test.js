// ════════════════════════════════════════════════════════
//  PRICING GRID — Total (fulfill) tự nhảy + copy/paste kiểu Google Sheets
//  Khoá hành vi: Total = P1 + Price Ship + Price Ship Item 2, CHỈ tính lại
//  nhóm vận chuyển vừa bị sửa (dòng Excel cũ không bị ghi đè hàng loạt).
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  SHIP_METHODS, PRICING_GRID_COLUMNS,
  computeTotalFulfill, withRecalculatedTotals,
  parseClipboardMatrix, buildClipboardText, rangeToMatrix,
  normalizeRange, applyMatrixToRows, clearRangeInRows, toNumberOrNull,
} from '../pricingGrid';

const ground = SHIP_METHODS.find(m => m.label === 'Ground');
const eco = SHIP_METHODS.find(m => m.label === 'Economy');

const mkRow = (over = {}) => ({
  id: 'p1', productType: 'Sweatshirt', size: 'S', optional: '',
  pricing1: 11, pricing2: null,
  eco_price: null, eco_price_item2: null, eco_total: null,
  ground_price: 8.49, ground_price_item2: null, ground_total: 19.49,
  express_price: null, express_price_item2: null, express_total: null,
  twoday_price: null, twoday_price_item2: null, twoday_total: null,
  overnight_price: null, overnight_price_item2: null, overnight_total: null,
  linkTemplate: '', ...over,
});

const colIndex = (key) => PRICING_GRID_COLUMNS.findIndex(c => c.key === key);

describe('computeTotalFulfill', () => {
  it('cộng P1 + Price Ship + Price Ship Item 2', () => {
    expect(computeTotalFulfill(mkRow({ ground_price_item2: 2.4 }), ground)).toBe(21.89);
  });

  it('ô trống coi như 0', () => {
    expect(computeTotalFulfill(mkRow(), ground)).toBe(19.49);
  });

  it('cả ba ô trống → null (hiển thị "—", không phải $0.00)', () => {
    expect(computeTotalFulfill(mkRow({ pricing1: null }), eco)).toBeNull();
  });

  it('không sinh sai số dấu phẩy động', () => {
    expect(computeTotalFulfill(mkRow({ pricing1: 0.1, ground_price: 0.2, ground_price_item2: null }), ground)).toBe(0.3);
  });
});

describe('withRecalculatedTotals', () => {
  it('sửa Price Ship Item 2 → Total nhóm đó nhảy', () => {
    const next = withRecalculatedTotals(mkRow({ ground_price_item2: 2.4 }), ['ground_price_item2']);
    expect(next.ground_total).toBe(21.89);
  });

  it('chỉ đụng nhóm bị sửa, các nhóm khác giữ nguyên', () => {
    const row = mkRow({ eco_price: 5, eco_total: 99, ground_price_item2: 2.4 });
    const next = withRecalculatedTotals(row, ['ground_price_item2']);
    expect(next.ground_total).toBe(21.89);
    expect(next.eco_total).toBe(99); // Total Economy cũ từ Excel không bị ghi đè
  });

  it('sửa P1 → mọi nhóm đang có dữ liệu đều tính lại', () => {
    const row = mkRow({ pricing1: 12, eco_price: 5, eco_total: 16 });
    const next = withRecalculatedTotals(row, ['pricing1']);
    expect(next.ground_total).toBe(20.49);
    expect(next.eco_total).toBe(17);
  });

  it('sửa tay ô Total thì giữ nguyên giá trị người dùng nhập', () => {
    const row = mkRow({ ground_total: 50, ground_price_item2: 2.4 });
    const next = withRecalculatedTotals(row, ['ground_total', 'ground_price_item2']);
    expect(next.ground_total).toBe(50);
  });

  it('không có thay đổi thì trả về đúng object cũ (không render thừa)', () => {
    const row = mkRow();
    expect(withRecalculatedTotals(row, [])).toBe(row);
    expect(withRecalculatedTotals(row, ['size'])).toBe(row);
  });

  it('blank rỗng cho form nhập tay (chuỗi, không phải null)', () => {
    const row = { pricing1: '', ground_price: '', ground_price_item2: '', ground_total: '5' };
    const next = withRecalculatedTotals(row, ['ground_price'], { blank: '' });
    expect(next.ground_total).toBe('');
  });
});

describe('clipboard TSV', () => {
  it('tách dòng/cột và bỏ dòng trống cuối', () => {
    expect(parseClipboardMatrix('1\t2\n3\t4\n')).toEqual([['1', '2'], ['3', '4']]);
  });

  it('nhận xuống dòng kiểu Windows', () => {
    expect(parseClipboardMatrix('1\r\n2')).toEqual([['1'], ['2']]);
  });

  it('xuất vùng chọn ra TSV, ô trống thành chuỗi rỗng', () => {
    const rows = [mkRow(), mkRow({ ground_price: 4.95, ground_price_item2: 2.4 })];
    const range = normalizeRange(
      { r: 0, c: colIndex('ground_price') },
      { r: 1, c: colIndex('ground_price_item2') },
    );
    expect(buildClipboardText(rangeToMatrix(rows, PRICING_GRID_COLUMNS, range))).toBe('8.49\t\n4.95\t2.4');
  });

  it('toNumberOrNull bỏ $ và nhận dấu phẩy thập phân', () => {
    expect(toNumberOrNull('$8.49')).toBe(8.49);
    expect(toNumberOrNull(' 12,5 ')).toBe(12.5);
    expect(toNumberOrNull('abc')).toBeNull();
  });
});

describe('applyMatrixToRows', () => {
  const rows = () => [mkRow({ id: 'a' }), mkRow({ id: 'b' }), mkRow({ id: 'c' })];
  const item2Col = colIndex('ground_price_item2');

  it('dán 1 ô vào vùng nhiều dòng → điền cả vùng và Total nhảy theo', () => {
    const range = normalizeRange({ r: 0, c: item2Col }, { r: 2, c: item2Col });
    const out = applyMatrixToRows({ rows: rows(), columns: PRICING_GRID_COLUMNS, range, matrix: [['2.4']] });
    expect(out.changed).toBe(3);
    expect(out.rows.map(r => r.ground_price_item2)).toEqual([2.4, 2.4, 2.4]);
    expect(out.rows.map(r => r.ground_total)).toEqual([21.89, 21.89, 21.89]);
  });

  it('dán nhiều dòng 1 cột → rải tuần tự xuống dưới từ ô đang chọn', () => {
    const range = normalizeRange({ r: 1, c: item2Col }, { r: 1, c: item2Col });
    const out = applyMatrixToRows({ rows: rows(), columns: PRICING_GRID_COLUMNS, range, matrix: [['1'], ['2']] });
    expect(out.rows.map(r => r.ground_price_item2)).toEqual([null, 1, 2]);
    expect(out.rows.map(r => r.ground_total)).toEqual([19.49, 20.49, 21.49]);
  });

  it('dán quá số dòng hiện có → cắt, không tự thêm dòng', () => {
    const range = normalizeRange({ r: 2, c: item2Col }, { r: 2, c: item2Col });
    const out = applyMatrixToRows({ rows: rows(), columns: PRICING_GRID_COLUMNS, range, matrix: [['1'], ['2'], ['3']] });
    expect(out.rows).toHaveLength(3);
    expect(out.clipped).toBe(true);
    expect(out.rows[2].ground_price_item2).toBe(1);
  });

  it('dán nhiều cột: Price Ship + Item 2 cùng lúc', () => {
    const range = normalizeRange({ r: 0, c: colIndex('ground_price') }, { r: 0, c: colIndex('ground_price') });
    const out = applyMatrixToRows({ rows: rows(), columns: PRICING_GRID_COLUMNS, range, matrix: [['5', '1.5']] });
    expect(out.rows[0].ground_price).toBe(5);
    expect(out.rows[0].ground_price_item2).toBe(1.5);
    expect(out.rows[0].ground_total).toBe(17.5);
  });

  it('ô chữ dán vào cột số bị bỏ qua, giá trị cũ giữ nguyên', () => {
    const range = normalizeRange({ r: 0, c: item2Col }, { r: 0, c: item2Col });
    const out = applyMatrixToRows({ rows: rows(), columns: PRICING_GRID_COLUMNS, range, matrix: [['abc']] });
    expect(out.changed).toBe(0);
    expect(out.skipped).toBe(1);
  });

  it('dán đúng giá trị cũ → không tạo mảng mới (không lưu thừa)', () => {
    const src = rows();
    const range = normalizeRange({ r: 0, c: colIndex('ground_price') }, { r: 0, c: colIndex('ground_price') });
    const out = applyMatrixToRows({ rows: src, columns: PRICING_GRID_COLUMNS, range, matrix: [['8.49']] });
    expect(out.rows).toBe(src);
  });
});

describe('clearRangeInRows', () => {
  it('xoá Price Ship → Total tính lại theo phần còn lại', () => {
    const range = normalizeRange({ r: 0, c: colIndex('ground_price') }, { r: 0, c: colIndex('ground_price') });
    const out = clearRangeInRows({ rows: [mkRow()], columns: PRICING_GRID_COLUMNS, range });
    expect(out.rows[0].ground_price).toBeNull();
    expect(out.rows[0].ground_total).toBe(11); // còn lại P1
  });
});
