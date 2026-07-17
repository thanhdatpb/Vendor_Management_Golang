// ════════════════════════════════════════════════════════
//  PRICING ENGINE — số hoá công thức tính giá của seller
//  (thay thao tác qua Google Sheet). Thuần logic, KHÔNG dính React.
//  Dùng chung cho: workspace tính giá, danh sách bảng giá, export Excel.
//
//  Cấu trúc dữ liệu:
//    sheet = {
//      id, name, project, vendorRef,
//      settings: { price, shipPerOrder, shipPerItem, couponUsd, couponPct,
//                  variableFeePct, amzFeePct, importTax },
//      productTypes: [
//        { id, name, phoi, shown,
//          customizeInfos: [{ id, name }],           // seller tự thêm, bao nhiêu tuỳ ý
//          sizes: [{ id, label, sizeAdd, itemCost, customize: { [name]: number } }]
//        }
//      ],
//      history: [ snapshot… ]
//    }
// ════════════════════════════════════════════════════════

/** Parse an ô nhập (chuỗi/số) → number an toàn (hỗ trợ "13,2"). */
export const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Định dạng tiền $x.xx */
export const usd = (v, digits = 2) => `$${(Number(v) || 0).toFixed(digits)}`;
/** Định dạng % */
export const pct = (v, digits = 2) => `${(Number(v) || 0).toFixed(digits)}%`;

// ─── Price Setting mặc định (khớp sheet mẫu CREATIVE_Hawaap22) ─────────────
export const DEFAULT_SETTINGS = {
  price: 0,
  quantity: 1,
  shipPerOrder: 0,
  shipPerItem: 0,
  couponUsd: 0,
  couponPct: 0,
  variableFeePct: 0,
  amzFeePct: 17,
  importTax: 0,
};

// Khai báo các trường Price Setting → UI render theo đây (thêm phí = thêm dòng)
export const SETTING_FIELDS = [
  { key: 'price', label: 'Price', unit: '$', icon: '💵' },
  { key: 'quantity', label: 'Quantity', unit: 'pcs', icon: '🔢', tooltip: 'Số sản phẩm trong 1 listing (multipack). Total Price = (Giá 1 sản phẩm + Ship/Item) × Quantity + Ship/Order; giá vốn (Item Cost + Ship/Item + ImportTax) cũng nhân theo Quantity. Để trống = 1.' },
  { key: 'shipPerOrder', label: 'Ship / Order', unit: '$', icon: '📦' },
  { key: 'shipPerItem', label: 'Ship / Item', unit: '$', icon: '📦' },
  { key: 'couponUsd', label: 'Coupon', unit: '$', icon: '🎫' },
  { key: 'couponPct', label: 'Coupon', unit: '%', icon: '🎫' },
  { key: 'variableFeePct', label: 'Variable Fee', unit: '%', icon: '⚙️' },
  { key: 'amzFeePct', label: 'AMZ Fee', unit: '%', icon: '🅰' },
  { key: 'importTax', label: 'ImportTax / item', unit: '$', icon: '🏷', tooltip: 'Thuế nhập khẩu / sản phẩm khi hàng nhập kho. Nếu không áp dụng, hãy nhập 0.' },
];

/**
 * Tính một dòng size → mọi cột "tự động tính".
 * Công thức theo bản chỉnh của Luận Nguyễn (Slack 2026-07-16 — 4 dòng bôi đen):
 *   qty         = Quantity của bảng (trống/≤0 → 1)
 *   Unit Price  = Price + Phôi + Giá Size + Σ Customize Info        (giá 1 sản phẩm, chưa ship)
 *   Total Price = (Unit Price + Ship/Item) × qty + Ship/Order        ★ ship/item nhân theo qty
 *   Coupon      = Coupon$ + Coupon% × Total Price
 *   AMZ Fee     = AMZ% × (Total Price − Coupon)                      ★ trừ coupon trước khi tính phí
 *   Variable    = Variable% × (Unit Price × qty − Coupon)            ★ theo giá hàng, không theo coupon
 *   Total Cost  = (Item Cost + Ship/Item + ImportTax) × qty + Ship/Order  ★ vốn+ship/item+thuế đều ×qty
 *   Profit      = Total Price − AMZ − Total Cost                     (trước khuyến mãi)
 *   Profit(KM)  = Total Price − AMZ − Variable − Coupon − Total Cost (sau khuyến mãi)
 *
 *   Lưu ý:
 *   • Quantity mô phỏng listing multipack. Trống = 1; với qty=1 và coupon=0 thì
 *     Total Price/Total Cost/Profit giữ NGUYÊN số như công thức cũ.
 *   • ⚠ Khác bản cũ: Variable Fee giờ ≠ 0 kể cả khi coupon = 0 (Variable% × Unit×qty),
 *     nên "After Promo" thấp hơn Margin ngay cả khi không chạy khuyến mãi.
 *   • "Item Cost" (giá vốn) là input tường minh ở đây — trong sheet nó bị ẩn.
 */
export function computeSizeRow(settings, productType, size) {
  const s = settings || {};
  const price = num(s.price);
  const shipPerItem = num(s.shipPerItem);
  const shipPerOrder = num(s.shipPerOrder);
  const importTax = num(s.importTax);
  const phoi = num(productType?.phoi);
  const sizeAdd = num(size?.sizeAdd);
  const itemCost = num(size?.itemCost);

  // Quantity: số sản phẩm/listing. Trống hoặc ≤0 → coi như 1 (không zero-hoá cả bảng).
  const qtyRaw = num(s.quantity);
  const qty = qtyRaw > 0 ? qtyRaw : 1;

  const customizeSum = (productType?.customizeInfos || []).reduce(
    (sum, ci) => sum + num(size?.customize?.[ci.id]),
    0
  );

  const unitPrice = price + phoi + sizeAdd + customizeSum;              // giá 1 sản phẩm (chưa ship)
  const totalPrice = (unitPrice + shipPerItem) * qty + shipPerOrder;    // ★ (Unit + Ship/Item)×qty + Ship/Order

  const couponAmt = num(s.couponUsd) + (num(s.couponPct) / 100) * totalPrice;
  const amzFee = (num(s.amzFeePct) / 100) * (totalPrice - couponAmt);          // ★ AMZ% × (Total − Coupon)
  const variableFee = (num(s.variableFeePct) / 100) * (unitPrice * qty - couponAmt); // ★ Var% × (Unit×qty − Coupon)

  const totalCost = (itemCost + shipPerItem + importTax) * qty + shipPerOrder; // ★ (vốn+ship/item+thuế)×qty + ship/order

  const profit = totalPrice - amzFee - totalCost;
  const profitAfter = totalPrice - amzFee - variableFee - couponAmt - totalCost;

  return {
    qty,
    shipping: shipPerItem * qty + shipPerOrder,   // tổng ship của đơn (informational — không nơi nào dùng để tính)
    customizeSum,
    unitPrice,
    totalPrice,
    couponAmt,
    amzFee,
    variableFee,
    totalCost,
    profit,
    profitAfter,
    margin: totalPrice ? (profit / totalPrice) * 100 : 0,
    marginAfter: totalPrice ? (profitAfter / totalPrice) * 100 : 0,
    ratioCost: totalCost ? (profit / totalCost) * 100 : 0,
  };
}

/** Tổng hợp một bảng tính giá: số size, khoảng giá, avg margin. */
export function summarizeSheet(sheet) {
  const rows = [];
  (sheet?.productTypes || []).forEach((pt) => {
    (pt.sizes || []).forEach((sz) => rows.push(computeSizeRow(sheet.settings, pt, sz)));
  });
  if (!rows.length) return { count: 0, minPrice: null, maxPrice: null, avgMargin: null };
  const prices = rows.map((r) => r.totalPrice);
  const margins = rows.map((r) => r.margin);
  return {
    count: rows.length,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgMargin: margins.reduce((a, b) => a + b, 0) / margins.length,
  };
}

// ─── Factory helpers ──────────────────────────────────────────────────────
let _seq = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(_seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const makeSize = (label = '', sizeAdd = '') => ({
  id: uid('sz'),
  label,
  sizeAdd: sizeAdd === '' ? '' : String(sizeAdd),
  itemCost: '',
  customize: {},
});

export const makeProductType = (name = '', phoi = '') => ({
  id: uid('pt'),
  name,
  phoi: phoi === '' ? '' : String(phoi),
  shown: true,
  customizeInfos: [],
  sizes: [makeSize()],
});

export const makeSheet = (name = 'Bảng tính giá mới', project = '') => ({
  id: uid('sheet'),
  name,
  project,
  vendorRef: '',
  settings: { ...DEFAULT_SETTINGS },
  productTypes: [makeProductType('Product Type 1')],
  history: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
