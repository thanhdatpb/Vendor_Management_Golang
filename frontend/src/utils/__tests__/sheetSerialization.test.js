// ════════════════════════════════════════════════════════
//  SAVE → RELOAD → EXPORT — mục tiêu lặp lại ở mục 02/05/06/08.
//  Dùng helper chung src/test/roundTrip.js thay vì viết lại từng mục.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import legacySheet from '../../test/fixtures/legacySheet.json';
import { loadVendorLibraryIndex } from '../vendorLibraryIndex';
import { resolveSheet } from '../resolveSheet';
import { buildSheetAoa, collectCustomizeColumns, exportFileName } from '../sheetExport';
import { computeSizeRow } from '../pricingEngine';
import { roundTrip, sizeInputMap } from '../../test/roundTrip';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

let libIndex;
beforeAll(async () => { libIndex = await loadVendorLibraryIndex('happy'); });

describe('Round-trip save → reload', () => {
  it('giá Size và mapping cột Customize không đổi sau khi lưu rồi tải lại', () => {
    const before = resolveSheet(legacySheet, libIndex);
    const after = roundTrip(legacySheet, libIndex);

    before.productTypes.forEach((pt, i) => {
      expect(sizeInputMap(after.productTypes[i])).toEqual(sizeInputMap(pt));
    });
  });

  it('mapping customize bám theo ci.id, không bám theo vị trí cột', () => {
    const after = roundTrip(legacySheet, libIndex);
    const manual = after.productTypes[1];
    const ids = manual.customizeInfos.map((c) => c.id);
    expect(ids).toEqual(['ci_engrave', 'ci_giftbox']);
    expect(manual.sizes[0].customize).toEqual({ ci_engrave: '2', ci_giftbox: '1.2' });
  });

  it('số tiền tính lại sau reload đúng bằng trước khi lưu', () => {
    const before = resolveSheet(legacySheet, libIndex);
    const after = roundTrip(legacySheet, libIndex);
    before.productTypes.forEach((pt, i) => {
      pt.sizes.forEach((sz, j) => {
        const a = computeSizeRow(before.settings, pt, sz);
        const b = computeSizeRow(after.settings, after.productTypes[i], after.productTypes[i].sizes[j]);
        expect(b.totalPrice).toBeCloseTo(a.totalPrice, 10);
        expect(b.profitAfter).toBeCloseTo(a.profitAfter, 10);
      });
    });
  });
});

describe('buildSheetAoa — nội dung file Excel', () => {
  const aoa = () => buildSheetAoa(resolveSheet(legacySheet, libIndex));

  it('4 dòng Price Setting, 1 dòng trống, rồi header', () => {
    const rows = aoa();
    expect(rows[0]).toEqual(['Price Setting']);
    expect(rows[1].slice(0, 2)).toEqual(['Price', 9.9]);
    expect(rows[4]).toEqual([]);
    expect(rows[5][0]).toBe('Product Type');
  });

  it('cột Customize gộp theo TÊN, xuất hiện đúng một lần', () => {
    const cols = collectCustomizeColumns(resolveSheet(legacySheet, libIndex));
    expect(cols.map((c) => c.name)).toEqual(['Add Custom Face', 'Laser Engrave', 'Gift Box']);
    const header = aoa()[5];
    expect(header).toEqual([
      'Product Type', 'Size', 'Giá Phôi', 'Giá Size',
      'Add Custom Face', 'Laser Engrave', 'Gift Box',
      'Item Cost', 'Total Price', 'AMZ Fee', 'Coupon', 'Variable', 'Profit', 'Margin %', 'After Promo %',
    ]);
  });

  it('mỗi size một dòng, ô customize của Product Type khác để trống', () => {
    const resolved = resolveSheet(legacySheet, libIndex);
    const total = resolved.productTypes.reduce((n, pt) => n + pt.sizes.length, 0);
    const rows = aoa();
    expect(rows).toHaveLength(6 + total);

    const jerseyRow = rows[6];
    expect(jerseyRow[0]).toBe('Football Jersey');
    expect(jerseyRow[4]).toBe(3);       // Add Custom Face của chính nó
    expect(jerseyRow[5]).toBe('');      // cột của Product Type khác → trống
    expect(jerseyRow[6]).toBe('');
  });

  it('số tiền trong file khớp computeSizeRow (làm tròn 2 chữ số)', () => {
    const resolved = resolveSheet(legacySheet, libIndex);
    const rows = aoa();
    const pt = resolved.productTypes[0];
    const r = computeSizeRow(resolved.settings, pt, pt.sizes[0]);
    const row = rows[6];
    expect(row[8]).toBe(+r.totalPrice.toFixed(2));      // Total Price
    expect(row[9]).toBe(+r.amzFee.toFixed(2));          // AMZ Fee
    expect(row[10]).toBe(+r.couponAmt.toFixed(2));      // Coupon
    expect(row[11]).toBe(+r.variableFee.toFixed(2));    // Variable
    expect(row[12]).toBe(+r.profitAfter.toFixed(2));    // Profit (sau khuyến mãi)
  });

  it('export sau khi lưu-tải-lại giống hệt export trước đó', () => {
    const before = buildSheetAoa(resolveSheet(legacySheet, libIndex));
    const after = buildSheetAoa(roundTrip(legacySheet, libIndex));
    expect(after).toEqual(before);
  });

  it('bảng rỗng vẫn xuất được phần Price Setting + header', () => {
    const rows = buildSheetAoa({ settings: legacySheet.settings, productTypes: [] });
    expect(rows).toHaveLength(6);
  });
});

describe('exportFileName', () => {
  it('slug hoá tên bảng và gắn ngày', () => {
    expect(exportFileName({ name: 'Bảng giá #1 / Q3' }, new Date('2026-08-13T00:00:00Z')))
      .toBe('HC_Gia_B_ng_gi_1_Q3_2026-08-13.xlsx');
  });
});
