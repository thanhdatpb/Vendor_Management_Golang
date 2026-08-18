// ════════════════════════════════════════════════════════
//  DÁN NHIỀU GIÁ TỪ GOOGLE SHEET — tính năng Seller đang dùng hằng ngày.
//  PR-A1 (bỏ hành vi kéo-để-xoá) và Milestone P (paste vùng nhiều cột) KHÔNG
//  được làm hỏng phần này.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { parsePastedPrices, distributeSizeAddValues } from '../PriceTable';

describe('parsePastedPrices', () => {
  it('dán 1 cột số (mỗi dòng 1 giá)', () => {
    expect(parsePastedPrices('1.5\n2\n3.25')).toEqual([{ price: '1.5' }, { price: '2' }, { price: '3.25' }]);
  });

  it('dán 2 cột TSV (tên size + giá) → giữ được nhãn size', () => {
    expect(parsePastedPrices('S\t1.5\nM\t2\nL\t2.5')).toEqual([
      { label: 'S', price: '1.5' }, { label: 'M', price: '2' }, { label: 'L', price: '2.5' },
    ]);
  });

  it('dán nhiều cột thì lấy cột CUỐI làm giá', () => {
    expect(parsePastedPrices('S\tCotton\t1.5')).toEqual([{ label: 'S', price: '1.5' }]);
  });

  it('dán 1 dòng nhiều giá cách nhau bằng dấu phẩy', () => {
    expect(parsePastedPrices('1.5, 2, 2.5')).toEqual([{ price: '1.5' }, { price: '2' }, { price: '2.5' }]);
  });

  it('bỏ qua dòng trống và dòng không có chữ số', () => {
    expect(parsePastedPrices('\n\nS\tabc\nM\t2\n   \n')).toEqual([{ label: 'M', price: '2' }]);
  });
});

describe('distributeSizeAddValues', () => {
  const makePT = () => ({
    id: 'pt1',
    sizes: [
      { id: 's1', label: 'S' }, { id: 's2', label: 'M' },
      { id: 's3', label: 'L' }, { id: 's4', label: 'XL' },
    ],
  });

  it('ưu tiên khớp theo TÊN size, không phụ thuộc thứ tự dán', () => {
    const onUpdate = vi.fn();
    const applied = distributeSizeAddValues(makePT(), parsePastedPrices('L\t9\nS\t7'), null, onUpdate);
    expect(applied).toBe(2);
    expect(onUpdate).toHaveBeenCalledWith('pt1', 's3', { sizeAdd: '9' });
    expect(onUpdate).toHaveBeenCalledWith('pt1', 's1', { sizeAdd: '7' });
  });

  it('giá không có nhãn được gán tuần tự từ ô đang đứng', () => {
    const onUpdate = vi.fn();
    const applied = distributeSizeAddValues(makePT(), parsePastedPrices('1\n2'), 's3', onUpdate);
    expect(applied).toBe(2);
    expect(onUpdate.mock.calls.map((c) => [c[1], c[2].sizeAdd])).toEqual([['s3', '1'], ['s4', '2']]);
  });

  it('dán nhiều hơn số dòng còn lại thì cắt, không tạo dòng mới', () => {
    const onUpdate = vi.fn();
    const applied = distributeSizeAddValues(makePT(), parsePastedPrices('1\n2\n3\n4\n5\n6'), 's3', onUpdate);
    expect(applied).toBe(2);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it('không ghi đè dòng đã khớp theo tên khi rải phần dư', () => {
    const onUpdate = vi.fn();
    distributeSizeAddValues(makePT(), parsePastedPrices('M\t8\n1\n2'), 's1', onUpdate);
    const ids = onUpdate.mock.calls.map((c) => c[1]);
    expect(ids.filter((id) => id === 's2')).toHaveLength(1);   // M chỉ bị ghi 1 lần
  });

  it('không có size hoặc không có dữ liệu dán thì không gọi update', () => {
    const onUpdate = vi.fn();
    expect(distributeSizeAddValues({ id: 'pt1', sizes: [] }, [{ price: '1' }], null, onUpdate)).toBe(0);
    expect(distributeSizeAddValues(makePT(), [], null, onUpdate)).toBe(0);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
