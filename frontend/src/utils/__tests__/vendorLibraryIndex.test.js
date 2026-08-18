// ════════════════════════════════════════════════════════
//  INDEX THƯ VIỆN VENDOR — hành vi hiện có.
//  (Mục tiêu "2 vendor cùng tên phôi cùng tồn tại" của mục 03/04 nằm ở
//   vendorRecords.pending.test.js — hiện chưa đạt.)
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  loadVendorLibraryIndex, listLibraryProductTypes, findLibraryEntry,
  getLibraryItemCost, getLibraryShip, getLibraryShipItem2, getLibraryTotal,
  normalizeKey, shipMethodLabel, SHIP_METHODS,
} from '../vendorLibraryIndex';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

let indexHappy;
let indexAll;

beforeAll(async () => {
  indexHappy = await loadVendorLibraryIndex('happy');
  indexAll = await loadVendorLibraryIndex('', true);
});

describe('normalizeKey', () => {
  it('bỏ khoảng trắng thừa và không phân biệt hoa thường', () => {
    expect(normalizeKey('  Football Jersey ')).toBe('football jersey');
    expect(normalizeKey(null)).toBe('');
  });
});

describe('loadVendorLibraryIndex — lọc theo project', () => {
  it('chỉ lấy file thuộc project hiện tại (suy từ hậu tố tên file)', () => {
    expect(findLibraryEntry(indexHappy, 'Football Jersey')).toBeTruthy();
    expect(indexHappy['tumbler 20oz']).toBeUndefined();       // file p.creative bị loại
  });

  it('bỏ lọc (skip = true) thì thấy mọi project', () => {
    expect(indexAll['tumbler 20oz']).toBeTruthy();
    expect(indexAll['football jersey']).toBeTruthy();
  });

  it('bỏ dòng không có size hợp lệ (size trống hoặc "N/A")', () => {
    const mug = findLibraryEntry(indexHappy, 'Ceramic Mug 11oz');
    expect(mug.sizes).toEqual(['11oz', '15oz']);              // dòng "N/A" không thành size
  });

  it('mỗi size chỉ vào danh sách một lần, giữ thứ tự gặp trong file', () => {
    const jersey = findLibraryEntry(indexHappy, 'Football Jersey');
    expect(jersey.sizes).toEqual(['S', 'M', 'L', 'XL', '2XL']);
  });
});

describe('findLibraryEntry', () => {
  it('khớp đúng tên trước', () => {
    expect(findLibraryEntry(indexHappy, 'football jersey').productType).toBe('Football Jersey');
  });

  it('khớp mờ (substring) khi không có tên đúng', () => {
    expect(findLibraryEntry(indexHappy, 'Football Jersey - Custom').productType).toBe('Football Jersey');
  });

  it('không khớp thì trả null, không ném lỗi', () => {
    expect(findLibraryEntry(indexHappy, 'Phôi không tồn tại')).toBeNull();
    expect(findLibraryEntry(null, 'Football Jersey')).toBeNull();
    expect(findLibraryEntry(indexHappy, '')).toBeNull();
  });
});

describe('Đọc giá vốn và ship theo phương thức', () => {
  it('Item Cost lấy đúng cột P1 (pricing1), không phụ thuộc phương thức ship', () => {
    const jersey = findLibraryEntry(indexHappy, 'Football Jersey');
    expect(getLibraryItemCost(jersey, 'S')).toBe(8.2);
    expect(getLibraryItemCost(jersey, '2XL')).toBe(9.6);
  });

  it('Total Ship cost và Ship cost/item đổi theo phương thức ship', () => {
    const jersey = findLibraryEntry(indexHappy, 'Football Jersey');
    expect(getLibraryShip(jersey, 'S', 'eco')).toBe(4.1);
    expect(getLibraryShipItem2(jersey, 'S', 'eco')).toBe(1.1);
    expect(getLibraryShip(jersey, 'S', 'express')).toBe(9.8);
    expect(getLibraryShipItem2(jersey, 'S', 'express')).toBe(2.6);
  });

  it('size hoặc field không có trong thư viện trả null (để nơi gọi tự fallback)', () => {
    const jersey = findLibraryEntry(indexHappy, 'Football Jersey');
    expect(getLibraryItemCost(jersey, '5XL')).toBeNull();
    expect(getLibraryShip(jersey, 'S', 'overnight')).toBeNull();   // fixture không có cột overnight
    expect(getLibraryTotal(jersey, 'S', 'eco')).toBe(12.3);
  });

  it('tra size không phân biệt hoa thường / khoảng trắng', () => {
    const jersey = findLibraryEntry(indexHappy, 'Football Jersey');
    expect(getLibraryItemCost(jersey, ' s ')).toBe(8.2);
  });
});

describe('listLibraryProductTypes — nguồn cho picker "Thêm Product Type"', () => {
  it('trả tên phôi kèm vendor và số size, sắp theo tên', () => {
    const list = listLibraryProductTypes(indexHappy);
    expect(list.map((x) => x.productType)).toEqual(['Ceramic Mug 11oz', 'Football Jersey']);
    expect(list.find((x) => x.productType === 'Football Jersey')).toMatchObject({ vendor: 'VN3', sizeCount: 5 });
  });

  it('index rỗng trả mảng rỗng', () => {
    expect(listLibraryProductTypes(null)).toEqual([]);
  });
});

describe('SHIP_METHODS', () => {
  it('đủ 5 phương thức và tra được nhãn', () => {
    expect(SHIP_METHODS.map((m) => m.key)).toEqual(['eco', 'ground', 'express', 'twoday', 'overnight']);
    expect(shipMethodLabel('eco')).toBe('Economy');
    expect(shipMethodLabel('khong-co')).toBe('');
  });
});
