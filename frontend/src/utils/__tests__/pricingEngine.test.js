// ════════════════════════════════════════════════════════
//  CÔNG THỨC TÍNH GIÁ — chốt bản chỉnh của Luận Nguyễn (Slack 2026-07-16).
//  Đây là lưới an toàn cho mọi refactor sau này: công thức sai = tiền sai.
// ════════════════════════════════════════════════════════
import { describe, it, expect } from 'vitest';
import { computeSizeRow, summarizeSheet, num, DEFAULT_SETTINGS, productTypeCompareCounts } from '../pricingEngine';

const settings = {
  ...DEFAULT_SETTINGS,
  price: 10,
  quantity: 1,
  shipPerOrder: 1.5,
  shipPerItem: 2,
  couponUsd: 0,
  couponPct: 0,
  variableFeePct: 3,
  amzFeePct: 17,
  importTax: 0.5,
};
const pt = { id: 'pt1', name: 'PT', phoi: 1, customizeInfos: [{ id: 'ci1', name: 'Face' }] };
const size = { id: 'sz1', label: 'M', sizeAdd: 2, itemCost: 6, customize: { ci1: 1.5 } };

describe('num()', () => {
  it('đọc được số kiểu "13,2" và bỏ ký tự lạ', () => {
    expect(num('13,2')).toBe(13.2);
    expect(num('$ 4.50')).toBe(4.5);
    expect(num('')).toBe(0);
    expect(num(null)).toBe(0);
    expect(num('abc')).toBe(0);
  });
});

describe('computeSizeRow — cấu trúc công thức', () => {
  it('Unit Price = Price + Phôi + Giá Size + Σ Customize', () => {
    const r = computeSizeRow(settings, pt, size);
    expect(r.unitPrice).toBeCloseTo(10 + 1 + 2 + 1.5, 10);
    expect(r.customizeSum).toBeCloseTo(1.5, 10);
  });

  it('Total Price = (Unit + Ship/Item) × qty + Ship/Order', () => {
    const r = computeSizeRow({ ...settings, quantity: 3 }, pt, size);
    expect(r.totalPrice).toBeCloseTo((14.5 + 2) * 3 + 1.5, 10);
  });

  it('Quantity trống hoặc ≤ 0 được coi như 1 (không zero-hoá cả bảng)', () => {
    const base = computeSizeRow({ ...settings, quantity: 1 }, pt, size);
    ['', 0, -5, null, undefined].forEach((q) => {
      const r = computeSizeRow({ ...settings, quantity: q }, pt, size);
      expect(r.qty).toBe(1);
      expect(r.totalPrice).toBeCloseTo(base.totalPrice, 10);
    });
  });

  it('Coupon% chỉ áp trên phần hàng (Unit × qty), KHÔNG gồm Ship/Order', () => {
    const s = { ...settings, quantity: 2, couponUsd: 1, couponPct: 10 };
    const r = computeSizeRow(s, pt, size);
    const goods = 14.5 * 2;                       // Unit × qty, không có Ship/Order
    expect(r.couponAmt).toBeCloseTo(1 + 0.1 * goods, 10);
  });

  it('AMZ Fee = AMZ% × (Total Price − Coupon)', () => {
    const s = { ...settings, couponUsd: 2 };
    const r = computeSizeRow(s, pt, size);
    expect(r.amzFee).toBeCloseTo(0.17 * (r.totalPrice - r.couponAmt), 10);
  });

  it('Variable Fee = Var% × (Unit × qty − Coupon) và KHÁC 0 kể cả khi coupon = 0', () => {
    const r = computeSizeRow(settings, pt, size);          // coupon = 0
    expect(r.couponAmt).toBe(0);
    expect(r.variableFee).toBeCloseTo(0.03 * 14.5, 10);
    expect(r.variableFee).not.toBe(0);
  });

  it('Total Cost dòng nhập tay dùng Ship/Item + Ship/Order của Price Setting', () => {
    const r = computeSizeRow({ ...settings, quantity: 2 }, pt, size);
    // (itemCost + shipCostItem + importTax) × qty + (totalShipCost − shipCostItem)
    expect(r.totalCost).toBeCloseTo((6 + 2 + 0.5) * 2 + (1.5 - 2), 10);
  });

  it('Total Cost dòng từ thư viện dùng ship cost của thư viện, không dùng ship doanh thu', () => {
    const libSize = { ...size, isLib: true, shipCostItem: 1.1, totalShipCost: 4.1 };
    const r = computeSizeRow({ ...settings, quantity: 2 }, pt, libSize);
    expect(r.shipCostItem).toBe(1.1);
    expect(r.totalShipCost).toBe(4.1);
    expect(r.totalCost).toBeCloseTo((6 + 1.1 + 0.5) * 2 + (4.1 - 1.1), 10);
  });

  it('Profit trước/sau khuyến mãi khác nhau đúng bằng Variable + Coupon', () => {
    const s = { ...settings, couponUsd: 1.2, couponPct: 5 };
    const r = computeSizeRow(s, pt, size);
    expect(r.profit - r.profitAfter).toBeCloseTo(r.variableFee + r.couponAmt, 10);
  });

  it('Margin và Margin sau khuyến mãi tính theo Total Price', () => {
    const r = computeSizeRow({ ...settings, couponUsd: 1.2, couponPct: 5 }, pt, size);
    expect(r.couponAmt).toBeGreaterThan(0);
    // Margin đi từ Profit sau khuyến mãi rồi cộng lại Coupon:
    // (Profit(KM) + Coupon) / Total Price — tức đã trừ Variable Fee, chưa trừ Coupon.
    expect(r.margin).toBeCloseTo(((r.profitAfter + r.couponAmt) / r.totalPrice) * 100, 10);
    expect(r.margin).toBeCloseTo(
      ((r.totalPrice - r.amzFee - r.variableFee - r.totalCost) / r.totalPrice) * 100,
      10
    );
    expect(r.marginAfter).toBeCloseTo((r.profitAfter / r.totalPrice) * 100, 10);
  });

  it('Total Price = 0 thì margin trả 0, không NaN', () => {
    const zero = computeSizeRow({ ...DEFAULT_SETTINGS }, { id: 'p', customizeInfos: [] }, { id: 's', sizeAdd: '', itemCost: '' });
    expect(zero.totalPrice).toBe(0);
    expect(zero.margin).toBe(0);
    expect(Number.isNaN(zero.marginAfter)).toBe(false);
  });
});

describe('summarizeSheet', () => {
  const sheet = {
    settings,
    productTypes: [
      { id: 'a', name: 'A', phoi: 0, customizeInfos: [], sizes: [
        { id: 'a1', label: 'S', sizeAdd: 1, itemCost: 5, customize: {} },
        { id: 'a2', label: 'M', sizeAdd: 3, itemCost: 5, customize: {} },
      ] },
      { id: 'b', name: 'B', phoi: 0, customizeInfos: [], sizes: [
        { id: 'b1', label: 'L', sizeAdd: 5, itemCost: 5, customize: {} },
      ] },
    ],
  };

  it('đếm đủ size của mọi Product Type và trả khoảng giá', () => {
    const s = summarizeSheet(sheet);
    expect(s.count).toBe(3);
    expect(s.minPrice).toBeCloseTo(computeSizeRow(settings, sheet.productTypes[0], sheet.productTypes[0].sizes[0]).totalPrice, 10);
    expect(s.maxPrice).toBeCloseTo(computeSizeRow(settings, sheet.productTypes[1], sheet.productTypes[1].sizes[0]).totalPrice, 10);
  });

  it('bảng rỗng trả count = 0, không vỡ', () => {
    expect(summarizeSheet({ settings, productTypes: [] })).toEqual({ count: 0, minPrice: null, maxPrice: null, avgMargin: null });
    expect(summarizeSheet(null).count).toBe(0);
  });

  // Dòng chưa nhập giá (sizeAdd = 0, profit âm) vẫn được tính vào avgMargin —
  // không có cờ nào loại trừ khỏi tổng hợp (đã bỏ mục "Bỏ tổng hợp"), muốn số
  // liệu chuẩn thì phải dọn size dư bằng cách xoá hẳn dòng.
  it('avgMargin hiện tính trên MỌI dòng, kể cả dòng chưa nhập giá', () => {
    const withJunk = {
      settings,
      productTypes: [{ id: 'a', name: 'A', phoi: 0, customizeInfos: [], sizes: [
        { id: 'a1', label: 'S', sizeAdd: 5, itemCost: 5, customize: {} },
        { id: 'a2', label: 'XS', sizeAdd: 0, itemCost: 5, customize: {} }, // dòng rác
      ] }],
    };
    const clean = { settings, productTypes: [{ ...withJunk.productTypes[0], sizes: [withJunk.productTypes[0].sizes[0]] }] };
    expect(summarizeSheet(withJunk).avgMargin).toBeLessThan(summarizeSheet(clean).avgMargin);
  });
});

// Vấn đề #3 (mindmap 2026-08-28) — nhãn "So sánh · N" khi Seller thêm nhiều
// Product Type block cùng tên phôi (mỗi block 1 vendor) để so giá.
describe('productTypeCompareCounts', () => {
  it('2 PT cùng tên (khác vendor) → cả 2 đếm 2', () => {
    const productTypes = [
      { id: 'a', name: 'Poster', shown: true, vendorCode: 'VN3' },
      { id: 'b', name: 'Poster', shown: true, vendorCode: 'VN7' },
      { id: 'c', name: 'Ceramic Mug', shown: true, vendorCode: 'VN3' },
    ];
    const counts = productTypeCompareCounts(productTypes);
    expect(counts['poster']).toBe(2);
    expect(counts['ceramic mug']).toBe(1);
  });

  it('chuẩn hoá trim + hoa/thường — "Poster" và " poster " tính chung một nhóm', () => {
    const counts = productTypeCompareCounts([
      { id: 'a', name: 'Poster', shown: true },
      { id: 'b', name: ' poster ', shown: true },
    ]);
    expect(counts['poster']).toBe(2);
  });

  it('PT đang ẩn (shown: false) không tính vào', () => {
    const counts = productTypeCompareCounts([
      { id: 'a', name: 'Poster', shown: true },
      { id: 'b', name: 'Poster', shown: false },
    ]);
    expect(counts['poster']).toBe(1);
  });

  it('PT chưa đặt tên (rỗng) không tạo nhóm', () => {
    const counts = productTypeCompareCounts([
      { id: 'a', name: '', shown: true },
      { id: 'b', name: '  ', shown: true },
    ]);
    expect(counts).toEqual({});
  });

  it('mảng rỗng / undefined không vỡ', () => {
    expect(productTypeCompareCounts([])).toEqual({});
    expect(productTypeCompareCounts(undefined)).toEqual({});
  });
});
