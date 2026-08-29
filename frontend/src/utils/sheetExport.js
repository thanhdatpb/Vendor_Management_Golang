// ════════════════════════════════════════════════════════
//  SHEET EXPORT — dựng bảng dữ liệu (AOA) của một bảng tính giá.
//
//  Tách khỏi PriceSheetWorkspace theo T0 của kế hoạch fix: phần dựng dữ liệu
//  (buildSheetAoa) là hàm THUẦN nên test được nội dung export mà không cần ghi
//  file; exportSheetToExcel chỉ còn phần tải xlsx + XLSX.writeFile.
//
//  ⚠ Refactor KHÔNG đổi hành vi: thứ tự cột, số chữ số thập phân và cách gộp
//  cột customize giữ nguyên như bản trong component trước đây.
// ════════════════════════════════════════════════════════
import { computeSizeRow, num } from './pricingEngine';

/**
 * Danh sách cột Customize của cả bảng, gộp theo TÊN cột (một cột cùng tên ở
 * nhiều Product Type chỉ xuất hiện 1 lần trong file Excel).
 */
export function collectCustomizeColumns(sheet) {
  const all = [];
  (sheet?.productTypes || []).forEach((pt) =>
    (pt.customizeInfos || []).forEach((ci) => {
      if (!all.find((c) => c.name === ci.name)) all.push(ci);
    })
  );
  return all;
}

/**
 * Dựng toàn bộ nội dung file Excel dạng Array-of-Arrays.
 * @param {object} sheet — bảng tính giá ĐÃ resolve (xem utils/resolveSheet.js)
 * @returns {Array<Array>} aoa — 4 dòng Price Setting, 1 dòng trống, header, rồi từng size
 */
export function buildSheetAoa(sheet) {
  const s = sheet?.settings || {};
  const aoa = [];
  aoa.push(['Price Setting']);
  aoa.push(['Price', s.price, 'Quantity', s.quantity, 'Ship/Order', s.shipPerOrder, 'Ship/Item', s.shipPerItem]);
  aoa.push(['Coupon ($)', s.couponUsd, 'Coupon (%)', s.couponPct]);
  aoa.push(['Variable Fee (%)', s.variableFeePct, 'AMZ Fee (%)', s.amzFeePct, 'ImportTax/item', s.importTax]);
  aoa.push([]);

  const allCustomize = collectCustomizeColumns(sheet);
  const header = ['Product Type', 'Size', 'Giá Phôi', 'Giá Size',
    ...allCustomize.map((c) => c.name || 'Customize'),
    'Item Cost', 'Total Price', 'AMZ Fee', 'Coupon', 'Variable', 'Profit', 'Margin %', 'After Promo %'];
  aoa.push(header);

  (sheet?.productTypes || []).forEach((pt) => {
    (pt.sizes || []).forEach((sz) => {
      const r = computeSizeRow(sheet.settings, pt, sz);
      const custVals = allCustomize.map((c) => {
        const own = (pt.customizeInfos || []).find((x) => x.name === c.name);
        return own ? num(sz.customize?.[own.id]) : '';
      });
      aoa.push([
        pt.name, sz.label, num(pt.phoi), num(sz.sizeAdd), ...custVals, num(sz.itemCost),
        +r.totalPrice.toFixed(2), +r.amzFee.toFixed(2), +r.couponAmt.toFixed(2),
        +r.variableFee.toFixed(2), +r.profitAfter.toFixed(2), +r.margin.toFixed(2), +r.marginAfter.toFixed(2),
      ]);
    });
  });

  return aoa;
}

/** Tên file export: HC_Gia_<slug>_<yyyy-mm-dd>.xlsx */
export function exportFileName(sheet, date = new Date()) {
  const slug = (sheet?.name || 'BangGia').replace(/[^\w]+/g, '_').slice(0, 30);
  return `HC_Gia_${slug}_${date.toISOString().slice(0, 10)}.xlsx`;
}

/** Xuất bảng tính giá ra file Excel (tải xlsx động — giữ nguyên hành vi cũ). */
export async function exportSheetToExcel(sheet, showToast) {
  try {
    const xlsxMod = await import('xlsx');
    const XLSX = xlsxMod.default ?? xlsxMod;
    const aoa = buildSheetAoa(sheet);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheet.name || 'Gia').slice(0, 28));
    const fileName = exportFileName(sheet);
    XLSX.writeFile(wb, fileName);
  } catch (err) {
    console.error('exportSheetToExcel', err);
    showToast?.('error', 'Lỗi export', err.message || 'Không xuất được Excel');
  }
}
