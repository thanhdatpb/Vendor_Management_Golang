// ════════════════════════════════════════════════════════
//  MỤC 08 — CLONE BẢNG TÍNH GIÁ
//  ⛔ ĐỎ LÀ ĐÚNG cho tới khi PR-A2 xong (`cloneSheet` chưa tồn tại trong
//     pricingEngine.js). Bẫy lớn nhất: đổi id mà quên remap `customize[ciId]`
//     → bản clone mất sạch giá cột customize.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import legacySheet from '../../test/fixtures/legacySheet.json';
import { loadVendorLibraryIndex } from '../vendorLibraryIndex';
import { resolveSheet } from '../resolveSheet';
import { summarizeSheet } from '../pricingEngine';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

let libIndex;
let source;
beforeAll(async () => {
  libIndex = await loadVendorLibraryIndex('happy');
  source = resolveSheet(legacySheet, libIndex);
});

const clone = async (sheet = source, name = 'Bảng giá (Copy)') => {
  const { cloneSheet } = await import('../pricingEngine');
  return cloneSheet(sheet, name);
};

describe('Mục 08 — bản clone độc lập hoàn toàn', () => {
  it('mọi id (sheet / product type / size / customize) đều mới', async () => {
    const c = await clone();
    expect(c.id).not.toBe(source.id);
    source.productTypes.forEach((pt, i) => {
      expect(c.productTypes[i].id).not.toBe(pt.id);
      pt.sizes.forEach((sz, j) => expect(c.productTypes[i].sizes[j].id).not.toBe(sz.id));
      (pt.customizeInfos || []).forEach((ci, k) => expect(c.productTypes[i].customizeInfos[k].id).not.toBe(ci.id));
    });
  });

  it('không còn tham chiếu object chung ở bất kỳ tầng nào', async () => {
    const c = await clone();
    expect(c.settings).not.toBe(source.settings);
    expect(c.productTypes[0]).not.toBe(source.productTypes[0]);
    expect(c.productTypes[0].sizes[0]).not.toBe(source.productTypes[0].sizes[0]);
    expect(c.productTypes[0].sizes[0].customize).not.toBe(source.productTypes[0].sizes[0].customize);
  });

  it('sửa bản gốc sau khi clone không làm đổi số liệu bản clone', async () => {
    const c = await clone();
    const before = summarizeSheet(c);
    source.productTypes[0].sizes[0].sizeAdd = '999';
    expect(summarizeSheet(c)).toEqual(before);
    source.productTypes[0].sizes[0].sizeAdd = '0';        // trả lại fixture
  });
});

describe('Mục 08 — nội dung bản clone khớp bản gốc', () => {
  it('giá customize được remap đúng theo id mới', async () => {
    const c = await clone();
    const ptSrc = source.productTypes[1];
    const ptDst = c.productTypes[1];
    ptSrc.customizeInfos.forEach((ci, k) => {
      const newId = ptDst.customizeInfos[k].id;
      ptSrc.sizes.forEach((sz, j) => {
        expect(ptDst.sizes[j].customize[newId]).toBe(sz.customize[ci.id]);
      });
    });
  });

  it('summarize và export của bản clone bằng đúng bản gốc', async () => {
    const { buildSheetAoa } = await import('../sheetExport');
    const c = await clone();
    expect(summarizeSheet(c)).toEqual(summarizeSheet(source));

    const stripName = (rows) => rows.map((r, i) => (i >= 6 ? r : r));
    expect(stripName(buildSheetAoa(c)).slice(5)).toEqual(stripName(buildSheetAoa(source)).slice(5));
  });

  it('tên mới mặc định có hậu tố Copy, lịch sử để trống, ghi lại nguồn clone', async () => {
    const c = await clone(source, `${source.name} (Copy)`);
    expect(c.name).toBe(`${source.name} (Copy)`);
    expect(c.history).toEqual([]);
    expect(c.cloneFromId).toBe(source.id);
  });

  it('giữ nguyên project của bản gốc khi không chỉ định project khác', async () => {
    const c = await clone();
    expect(c.project).toBe(source.project);
  });
});
