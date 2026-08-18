// ════════════════════════════════════════════════════════
//  PR-S3 (tầng client) — GIÁ KHÔNG ĐƯỢC LỌT VÀO PROPS CỦA CSF / PD / MARVEL
//  ⛔ ĐỎ LÀ ĐÚNG cho tới khi `utils/pricePrivacy.js` tồn tại.
//
//  CLAUDE.md §6.5: không lộ trường giá "trong props, response hay markup".
//  Hôm nay VendorLibraryCsfPdViewer chỉ ẩn ở tầng render — dữ liệu giá vẫn đi
//  nguyên vẹn xuống props. Lọc ở server là PR-S3 (backend), đây là lớp thứ hai.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import libraryFixture from '../../test/fixtures/vendorLibrary.sample.json';

const load = () => import('../pricePrivacy');

describe('Danh sách khoá cấm', () => {
  it('phủ mọi họ trường giá đang có trong thư viện', async () => {
    const { isPriceKey } = await load();
    ['pricing1', 'pricing2', 'eco_price', 'eco_total', 'eco_price_item2',
      'express_price', 'overnight_total', 'avgVendor', 'avgActual', 'itemCost', 'targetCost',
    ].forEach((key) => expect(isPriceKey(key)).toBe(true));
  });

  it('không nhận nhầm trường không phải giá', async () => {
    const { isPriceKey } = await load();
    ['productType', 'size', 'kyHieu', 'chatLieu', 'linkFolder', 'printSafeArea']
      .forEach((key) => expect(isPriceKey(key)).toBe(false));
  });
});

describe('stripPriceFields', () => {
  it('xoá sạch mọi khoá giá ở mọi độ sâu của dữ liệu thư viện', async () => {
    const { stripPriceFields, findPriceLeak } = await load();
    const safe = stripPriceFields(libraryFixture);
    expect(findPriceLeak(safe)).toBeNull();
  });

  it('giữ nguyên các trường nghiệp vụ CSF/PD cần', async () => {
    const { stripPriceFields } = await load();
    const safe = stripPriceFields(libraryFixture);
    const row = safe[0].pricing[0];
    expect(row.productType).toBe('Football Jersey');
    expect(row.size).toBe('S');
    expect(row.kyHieu).toBe('VN3');
  });

  it('không mutate dữ liệu gốc (role khác vẫn cần giá)', async () => {
    const { stripPriceFields } = await load();
    const before = JSON.stringify(libraryFixture);
    stripPriceFields(libraryFixture);
    expect(JSON.stringify(libraryFixture)).toBe(before);
  });
});

describe('findPriceLeak — dùng chung cho mọi test chống rò rỉ giá', () => {
  it('chỉ ra đúng đường dẫn khoá bị rò', async () => {
    const { findPriceLeak } = await load();
    const leak = findPriceLeak({ rows: [{ size: 'S', eco_price: 4.1 }] });
    expect(leak).toBe('rows.0.eco_price');
  });

  it('dữ liệu sạch trả null', async () => {
    const { findPriceLeak } = await load();
    expect(findPriceLeak({ rows: [{ size: 'S', chatLieu: 'Cotton' }] })).toBeNull();
  });
});

describe('Props truyền xuống viewer của CSF/PD', () => {
  it('hàng dựng cho bảng CSF/PD không chứa khoá giá nào', async () => {
    const { buildCsfPdRows } = await import('../../components/csfpd/csfPdRows');
    const { findPriceLeak } = await load();
    expect(findPriceLeak(buildCsfPdRows(libraryFixture))).toBeNull();
  });
});
