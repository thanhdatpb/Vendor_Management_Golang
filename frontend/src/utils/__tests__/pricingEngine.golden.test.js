// ════════════════════════════════════════════════════════
//  GOLDEN TEST HỒI QUY (T1) — ⛔ KHÔNG SỬA SNAPSHOT TRONG CÁC PR SAU.
//
//  Chạy toàn bộ dòng size của một bảng giá "kiểu cũ" qua đúng đường đi thật:
//      thư viện Vendor → resolveSheet → computeSizeRow
//  Snapshot đỏ nghĩa là một refactor đã làm ĐỔI SỐ TIỀN của bảng giá đang chạy
//  trên production. Seller đã bỏ hẳn Google Sheet nên không còn bản đối chiếu —
//  đây là lưới an toàn duy nhất trước khi deploy.
//
//  Muốn thay fixture bằng dữ liệu production thật: xem src/test/fixtures/README.md.
//
//  ── Lần cập nhật snapshot có chủ đích ──────────────────────────────────────
//  2026-09-19 — ĐỔI ĐỊNH NGHĨA `margin` (không phải refactor làm lệch tiền):
//      cũ : margin = (Profit + Coupon) / Total Price × 100
//      mới: margin = (Profit(KM) + Coupon) / Total Price × 100
//           ≡ (Total Price − AMZ − Variable − Total Cost) / Total Price × 100
//      → margin nay ĐÃ trừ Variable Fee, nên tụt đúng bằng Variable / Total Price.
//      Chỉ cột `margin` (và `avgMargin`) trong snapshot đổi. Mọi con số TIỀN
//      (totalPrice, couponAmt, amzFee, variableFee, totalCost, profit, profitAfter)
//      và `marginAfter` giữ nguyên — đó là bằng chứng thay đổi này không đụng tiền.
//  2026-09-22 — ĐỔI NGUỒN hiển thị Item Cost (không phải refactor làm lệch tiền):
//      cũ : Item Cost = P1, Price Ship của phương thức ship cộng riêng vào Total Cost
//      mới: Item Cost = Total (Fulfill) của phương thức ship (đã gồm ship), KHÔNG
//           cộng Price Ship lần nữa.
//      → Chỉ cột `itemCost` của dòng thư viện đổi (8.2 → 12.3 …). Mọi con số TIỀN
//      (totalCost, profit, profitAfter, margin…) giữ nguyên từng chữ số: bảng giá
//      có sẵn không đổi kết quả, chỉ hiện Item Cost đã gồm ship.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import legacySheet from '../../test/fixtures/legacySheet.json';
import { loadVendorLibraryIndex } from '../vendorLibraryIndex';
import { resolveSheet } from '../resolveSheet';
import { computeSizeRow, summarizeSheet } from '../pricingEngine';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

let resolved;

beforeAll(async () => {
  const index = await loadVendorLibraryIndex('happy');
  resolved = resolveSheet(legacySheet, index);
});

const money = (v) => +Number(v).toFixed(4);

describe('Golden — bảng giá cũ giữ nguyên từng con số', () => {
  it('mọi dòng size cho ra đúng bảng số đã chốt', () => {
    const rows = resolved.productTypes.flatMap((pt) =>
      (pt.sizes || []).map((sz) => {
        const r = computeSizeRow(resolved.settings, pt, sz);
        return {
          pt: pt.name,
          size: sz.label,
          itemCost: sz.itemCost,
          totalPrice: money(r.totalPrice),
          couponAmt: money(r.couponAmt),
          amzFee: money(r.amzFee),
          variableFee: money(r.variableFee),
          totalCost: money(r.totalCost),
          profit: money(r.profit),
          profitAfter: money(r.profitAfter),
          margin: money(r.margin),
          marginAfter: money(r.marginAfter),
        };
      })
    );
    expect(rows).toMatchInlineSnapshot(`
      [
        {
          "amzFee": 2.3137,
          "couponAmt": 1.29,
          "itemCost": 12.3,
          "margin": -2.7651,
          "marginAfter": -11.4228,
          "profit": -0.0637,
          "profitAfter": -1.702,
          "pt": "Football Jersey",
          "size": "S",
          "totalCost": 12.65,
          "totalPrice": 14.9,
          "variableFee": 0.3483,
        },
        {
          "amzFee": 2.3137,
          "couponAmt": 1.29,
          "itemCost": 12.3,
          "margin": -2.7651,
          "marginAfter": -11.4228,
          "profit": -0.0637,
          "profitAfter": -1.702,
          "pt": "Football Jersey",
          "size": "M",
          "totalCost": 12.65,
          "totalPrice": 14.9,
          "variableFee": 0.3483,
        },
        {
          "amzFee": 2.5432,
          "couponAmt": 1.44,
          "itemCost": 12.7,
          "margin": 2.5488,
          "marginAfter": -6.2317,
          "profit": 0.8068,
          "profitAfter": -1.022,
          "pt": "Football Jersey",
          "size": "L",
          "totalCost": 13.05,
          "totalPrice": 16.4,
          "variableFee": 0.3888,
        },
        {
          "amzFee": 2.6962,
          "couponAmt": 1.54,
          "itemCost": 13.4,
          "margin": 3.092,
          "marginAfter": -5.7586,
          "profit": 0.9538,
          "profitAfter": -1.002,
          "pt": "Football Jersey",
          "size": "XL",
          "totalCost": 13.75,
          "totalPrice": 17.4,
          "variableFee": 0.4158,
        },
        {
          "amzFee": 2.8492,
          "couponAmt": 1.64,
          "itemCost": 13.9,
          "margin": 4.663,
          "marginAfter": -4.25,
          "profit": 1.3008,
          "profitAfter": -0.782,
          "pt": "Football Jersey",
          "size": "2XL",
          "totalCost": 14.25,
          "totalPrice": 18.4,
          "variableFee": 0.4428,
        },
        {
          "amzFee": 2.5279,
          "couponAmt": 1.43,
          "itemCost": "6.1",
          "margin": 42.5521,
          "marginAfter": 33.7791,
          "profit": 7.3221,
          "profitAfter": 5.506,
          "pt": "Custom Tumbler (nhap tay)",
          "size": "20oz",
          "totalCost": 6.45,
          "totalPrice": 16.3,
          "variableFee": 0.3861,
        },
        {
          "amzFee": 2.8033,
          "couponAmt": 1.61,
          "itemCost": "7.2",
          "margin": 40.3978,
          "marginAfter": 31.5028,
          "profit": 7.7467,
          "profitAfter": 5.702,
          "pt": "Custom Tumbler (nhap tay)",
          "size": "30oz",
          "totalCost": 7.55,
          "totalPrice": 18.1,
          "variableFee": 0.4347,
        },
      ]
    `);
  });

  it('tổng hợp bảng (số size, khoảng giá, avg margin) không đổi', () => {
    const s = summarizeSheet(resolved);
    expect({
      count: s.count,
      minPrice: money(s.minPrice),
      maxPrice: money(s.maxPrice),
      avgMargin: money(s.avgMargin),
    }).toMatchInlineSnapshot(`
      {
        "avgMargin": 12.5319,
        "count": 7,
        "maxPrice": 18.4,
        "minPrice": 14.9,
      }
    `);
  });
});

describe('Golden — bản chỉnh Luận Nguyễn 2026-07-16', () => {
  it('qty = 1 và coupon = 0 thì Total / Cost / Profit đúng bằng công thức cũ', () => {
    const settings = { ...legacySheet.settings, quantity: 1, couponUsd: 0, couponPct: 0 };
    const pt = resolved.productTypes[1];             // Product Type nhập tay
    const sz = pt.sizes[0];
    const r = computeSizeRow(settings, pt, sz);

    const unit = 9.9 + 1.2 + 0 + (2 + 1.2);          // price + phôi + sizeAdd + Σ customize
    const totalPriceOld = unit + settings.shipPerItem + settings.shipPerOrder;
    const totalCostOld = 6.1 + settings.shipPerItem + settings.importTax + (settings.shipPerOrder - settings.shipPerItem);

    expect(r.couponAmt).toBe(0);
    expect(money(r.totalPrice)).toBe(money(totalPriceOld));
    expect(money(r.totalCost)).toBe(money(totalCostOld));
    expect(money(r.profit)).toBe(money(totalPriceOld - 0.17 * totalPriceOld - totalCostOld));
  });

  it('Variable Fee vẫn khác 0 khi coupon = 0 (khác hẳn bản cũ)', () => {
    const settings = { ...legacySheet.settings, couponUsd: 0, couponPct: 0, variableFeePct: 3 };
    const pt = resolved.productTypes[0];
    const r = computeSizeRow(settings, pt, pt.sizes[0]);
    expect(r.couponAmt).toBe(0);
    expect(r.variableFee).toBeGreaterThan(0);
  });
});
