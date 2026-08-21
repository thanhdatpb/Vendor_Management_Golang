// ════════════════════════════════════════════════════════
//  MỤC 17 — Danh sách bảng tính giá vẽ từ SỐ TỔNG HỢP, không từ nội dung bảng.
//
//  `GET /price-sheets` không còn trả settings/productTypes/history. Màn hình
//  danh sách vẫn phải vẽ đúng cho cả 3 nguồn: payload tổng hợp của server mới,
//  cache localStorage của bản cũ (sheet đầy đủ), và bảng vừa lưu ở máy này.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import {
  normalizeSheetRow, matchesSheetSearch, sheetInProject, toSummaryRow,
} from '../priceSheetSummary';
import { summarizeSheet } from '../pricingEngine';

const fullSheet = (overrides = {}) => ({
  id: 'sheet_1',
  name: 'Legend Shirt',
  project: 'happy',
  vendorRef: 'VN3',
  _sourceFile: 'HappyC_VendorLibrary_p.happy_2026-06',
  updatedAt: '2026-08-10T03:00:00.000Z',
  settings: { price: 19.9, quantity: 1, amzFeePct: 17, shipPerItem: 2 },
  productTypes: [
    {
      id: 'pt1', name: 'Football Jersey', phoi: 0, customizeInfos: [],
      sizes: [
        { id: 'sz1', label: 'S', sizeAdd: 1, itemCost: 8.2 },
        { id: 'sz2', label: 'M', sizeAdd: 3, itemCost: 8.6 },
      ],
    },
    { id: 'pt2', name: 'Night Light', phoi: 0, customizeInfos: [], sizes: [{ id: 'sz3', label: 'One Size', sizeAdd: 0, itemCost: 3.3 }] },
  ],
  ...overrides,
});

/**
 * Sheet như nó thật sự nằm trong DB: mỗi lần bấm Lưu nhét thêm một snapshot
 * ĐẦY ĐỦ vào `history`, giữ tới 20 bản. Đây chính là thứ làm payload danh sách
 * phình theo số lần lưu.
 */
const fullSheetWithHistory = (versions = 20) => {
  const sheet = fullSheet();
  sheet.history = Array.from({ length: versions }, (_, i) => ({
    version: versions - i,
    savedAt: '2026-08-10T03:00:00.000Z',
    savedBy: 'Seller',
    settings: sheet.settings,
    productTypes: sheet.productTypes,
  }));
  return sheet;
};

const summaryRow = (overrides = {}) => ({
  id: 'sheet_1',
  name: 'Legend Shirt',
  project: 'happy',
  version: 4,
  vendorRef: 'VN3',
  _sourceFile: 'HappyC_VendorLibrary_p.happy_2026-06',
  productTypeNames: ['Football Jersey', 'Night Light'],
  sizeCount: 3,
  minPrice: 21.9,
  maxPrice: 24.9,
  avgMargin: 42.5,
  updatedAt: '2026-08-10T03:00:00.000Z',
  updatedBy: 'Seller',
  _summary: true,
  ...overrides,
});

describe('normalizeSheetRow — payload tổng hợp của server', () => {
  it('đọc thẳng các con số, không cần nội dung bảng', () => {
    const row = normalizeSheetRow(summaryRow());

    expect(row.sizeCount).toBe(3);
    expect(row.minPrice).toBe(21.9);
    expect(row.maxPrice).toBe(24.9);
    expect(row.avgMargin).toBe(42.5);
    expect(row.productTypeNames).toEqual(['Football Jersey', 'Night Light']);
    expect(row.sourceFile).toBe('HappyC_VendorLibrary_p.happy_2026-06');
    expect(row.isFull).toBe(false);
  });

  it('bảng chưa có size trả null chứ không phải 0 — danh sách hiện "—"', () => {
    const row = normalizeSheetRow(summaryRow({ sizeCount: 0, minPrice: null, maxPrice: null, avgMargin: null }));

    expect(row.sizeCount).toBe(0);
    expect(row.minPrice).toBeNull();
    expect(row.avgMargin).toBeNull();
  });

  it('MySQL trả decimal dạng chuỗi — vẫn phải ra số', () => {
    const row = normalizeSheetRow(summaryRow({ minPrice: '21.9000', avgMargin: '42.5000' }));

    expect(row.minPrice).toBe(21.9);
    expect(row.avgMargin).toBe(42.5);
  });
});

describe('normalizeSheetRow — sheet đầy đủ (cache cũ / bảng vừa lưu)', () => {
  it('tính tại chỗ và ra đúng con số của pricingEngine', () => {
    const sheet = fullSheet();
    const row = normalizeSheetRow(sheet);
    const expected = summarizeSheet(sheet);

    expect(row.isFull).toBe(true);
    expect(row.sizeCount).toBe(expected.count);
    expect(row.minPrice).toBe(expected.minPrice);
    expect(row.maxPrice).toBe(expected.maxPrice);
    expect(row.avgMargin).toBe(expected.avgMargin);
    expect(row.productTypeNames).toEqual(['Football Jersey', 'Night Light']);
  });

  it('bỏ product type chưa đặt tên thay vì hiện chip rỗng', () => {
    const sheet = fullSheet();
    sheet.productTypes[1].name = '   ';

    expect(normalizeSheetRow(sheet).productTypeNames).toEqual(['Football Jersey']);
  });

  it('dòng rác không làm hỏng cả danh sách', () => {
    expect(normalizeSheetRow(null)).toBeNull();
    expect(normalizeSheetRow({})).toBeNull();
    expect(normalizeSheetRow('không phải object')).toBeNull();
  });
});

describe('toSummaryRow — cache localStorage chỉ giữ bản rút gọn', () => {
  it('không mang theo productTypes/settings/history', () => {
    const cached = toSummaryRow(normalizeSheetRow(fullSheet()));

    expect(cached).not.toHaveProperty('productTypes');
    expect(cached).not.toHaveProperty('settings');
    expect(cached).not.toHaveProperty('history');
    expect(JSON.stringify(cached)).not.toContain('sizeAdd');
  });

  it('đọc lại từ cache cho ra đúng những con số đã cache', () => {
    const original = normalizeSheetRow(fullSheet());
    const roundTripped = normalizeSheetRow(JSON.parse(JSON.stringify(toSummaryRow(original))));

    expect(roundTripped.sizeCount).toBe(original.sizeCount);
    expect(roundTripped.minPrice).toBe(original.minPrice);
    expect(roundTripped.maxPrice).toBe(original.maxPrice);
    expect(roundTripped.avgMargin).toBe(original.avgMargin);
    expect(roundTripped.productTypeNames).toEqual(original.productTypeNames);
  });

  it('bản rút gọn không phình theo số lần bấm Lưu', () => {
    const small = JSON.stringify(toSummaryRow(normalizeSheetRow(fullSheetWithHistory(1)))).length;
    const big = JSON.stringify(toSummaryRow(normalizeSheetRow(fullSheetWithHistory(20)))).length;

    expect(big).toBe(small);
    // Và nhỏ hơn hẳn sheet gốc — đây là thứ được cache thay cho nguyên bảng.
    expect(big).toBeLessThan(JSON.stringify(fullSheetWithHistory(20)).length / 10);
  });
});

describe('matchesSheetSearch', () => {
  const row = normalizeSheetRow(summaryRow());

  it('tìm được theo tên bảng, vendor và tên product type', () => {
    expect(matchesSheetSearch(row, 'legend')).toBe(true);
    expect(matchesSheetSearch(row, 'vn3')).toBe(true);
    // Tên product type vẫn tìm được dù danh sách không còn tải productTypes.
    expect(matchesSheetSearch(row, 'night')).toBe(true);
    expect(matchesSheetSearch(row, 'không có')).toBe(false);
  });

  it('ô tìm kiếm rỗng thì giữ nguyên cả danh sách', () => {
    expect(matchesSheetSearch(row, '')).toBe(true);
    expect(matchesSheetSearch(row, '   ')).toBe(true);
  });
});

describe('sheetInProject', () => {
  const row = normalizeSheetRow(summaryRow());

  it('role xem-tất-cả thấy hết', () => {
    expect(sheetInProject(normalizeSheetRow(summaryRow({ project: 'creative' })), 'happy', true)).toBe(true);
  });

  it('bảng không gắn project thì ai cũng thấy', () => {
    expect(sheetInProject(normalizeSheetRow(summaryRow({ project: '' })), 'happy', false)).toBe(true);
  });

  it('bảng của project khác bị lọc khỏi danh sách', () => {
    expect(sheetInProject(row, 'happy', false)).toBe(true);
    expect(sheetInProject(row, 'creative', false)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════
//  Chuẩn hoá khoá project (lỗi "chip project nào cũng đếm 0")
//
//  `price_sheets.project` lưu đúng chuỗi trong cột `users.project`, mà màn
//  Quản Lý Nhân Sự cho chọn dạng NHÃN ("Creative Project") → server hạ chữ
//  thường thành "creative project". Bộ lọc của Admin lại dùng id ngắn
//  ("creative"), nên so bằng `===` trượt hết: danh sách "Tất cả" có 44 bảng
//  nhưng mọi chip project đều hiện 0.
// ════════════════════════════════════════════════════════
describe('normalizeSheetRow — projectKey', () => {
  const keyOf = (project) => normalizeSheetRow(summaryRow({ project })).projectKey;

  it('nhận cả dạng nhãn, dạng nhãn hạ chữ thường, và id ngắn', () => {
    expect(keyOf('Creative Project')).toBe('creative');
    expect(keyOf('creative project')).toBe('creative');
    expect(keyOf('creative')).toBe('creative');
  });

  it('phủ đủ 4 project đang có', () => {
    expect(keyOf('Happy Project')).toBe('happy');
    expect(keyOf('Global Project')).toBe('global');
    expect(keyOf('Hapify84 Project')).toBe('hapify84');
  });

  it('không để id ngắn nuốt id dài — "hapify84" KHÔNG được hiểu thành "happy"', () => {
    expect(keyOf('hapify84 project')).toBe('hapify84');
    expect(keyOf('Hapify84')).toBe('hapify84');
  });

  it('project rỗng hoặc lạ trả chuỗi rỗng, không đoán bừa', () => {
    expect(keyOf('')).toBe('');
    expect(keyOf('Zeta Project')).toBe('');
    expect(normalizeSheetRow(summaryRow({ project: undefined })).projectKey).toBe('');
  });

  it('giữ nguyên chuỗi thô ở `project` để không phá dữ liệu cũ và cache', () => {
    const row = normalizeSheetRow(summaryRow({ project: 'Creative Project' }));
    expect(row.project).toBe('Creative Project');
    expect(row.projectKey).toBe('creative');
  });

  it('sheet đầy đủ (cache cũ / vừa lưu) cũng có projectKey', () => {
    expect(normalizeSheetRow(fullSheet({ project: 'Global Project' })).projectKey).toBe('global');
  });

  it('toSummaryRow mang theo projectKey để cache không mất khoá đã chuẩn hoá', () => {
    const cached = toSummaryRow(normalizeSheetRow(summaryRow({ project: 'Happy Project' })));
    expect(cached.projectKey).toBe('happy');
    expect(normalizeSheetRow(cached).projectKey).toBe('happy');
  });
});
