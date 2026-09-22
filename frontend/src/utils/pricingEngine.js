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
 *   qty         = Quantity của bảng (trống/≤0 → 1)
 *   Unit Price  = Price + Phôi + Giá Size + Σ Customize Info        (giá 1 sản phẩm, chưa ship)
 *   Total Price = (Unit Price + Ship/Item) × qty + Ship/Order        ★ ship/item nhân theo qty
 *   Coupon      = Coupon$ + Coupon% × ((Unit Price + Ship/Item) × qty)  ★ % áp trên phần hàng, KHÔNG gồm Ship/Order
 *   AMZ Fee     = AMZ% × (Total Price − Coupon)                      ★ trừ coupon trước khi tính phí
 *   Variable    = Variable% × (Unit Price × qty − Coupon)            ★ theo giá hàng, không theo coupon
 *   Total Cost  = xem 2 nhánh bên dưới (dòng thư viện / dòng nhập tay)
 *   Profit      = Total Price − AMZ − Total Cost                     (trước khuyến mãi)
 *   Profit(KM)  = Total Price − AMZ − Variable − Coupon − Total Cost (sau khuyến mãi)
 *   Margin      = (Profit(KM) + Coupon) / Total Price × 100
 *                 ≡ (Total Price − AMZ − Variable − Total Cost) / Total Price × 100
 *                 → đã trừ Variable Fee, nhưng cộng lại Coupon (coupon là khuyến mãi,
 *                   không tính là chi phí khi đo margin).
 *   Margin(KM)  = Profit(KM) / Total Price × 100
 *
 *   Total Cost của dòng THƯ VIỆN (`costBasis: 'fulfill'`, bản chỉnh 2026-09):
 *     Total Cost = (Item Cost + ImportTax) + (qty − 1) × (P1 + Ship cost/item + ImportTax)
 *     • Item Cost      ← cột "Total (Fulfill)" của Ship Method hiệu lực — giá vốn ĐÃ gồm ship,
 *                        nên KHÔNG cộng thêm Price Ship (cộng nữa là tính ship 2 lần)
 *     • P1             ← cột Pricing 1 — giá hàng thuần của mỗi sản phẩm thêm (multipack);
 *                        record không có P1 thì sản phẩm thêm tính bằng Item Cost (thà dư hơn thiếu)
 *     • Ship cost/item ← cột "Price Ship Item 2" (ship mỗi sản phẩm tăng thêm)
 *     Với qty=1: Total Cost = Item Cost + ImportTax — đúng số Seller thấy ở cột Item Cost.
 *     `costMissing` (size không có Total ở Ship Method hiệu lực, hoặc chưa chọn) → `costUnknown`:
 *     Profit/Margin của dòng không tính được, KHÔNG coi giá vốn là 0.
 *
 *   Dòng NHẬP TAY, và dòng thư viện lưu TRƯỚC bản chỉnh (không có `costBasis` — chỉ
 *   còn gặp ở Product Type mất record nguồn), giữ công thức 2026-07-17:
 *     Total Cost = (Item Cost + Ship cost/item + ImportTax) × qty + (Total Ship cost − Ship cost/item)
 *     (dòng nhập tay: Ship cost/item = Ship/Item, Total Ship cost = Ship/Order của Price Setting)
 *
 *   Lưu ý:
 *   • Ship phía CHI PHÍ (shipCostItem/totalShipCost) lấy từ THƯ VIỆN theo từng size —
 *     khác hẳn Ship/Item & Ship/Order trong Price Setting (đó là ship phía DOANH THU,
 *     dùng cho Total Price). Product Type nhập tay (không từ thư viện) dùng tạm
 *     Ship/Item & Ship/Order của Price Setting làm cost-ship.
 *   • ⚠ Khác bản cũ: Variable Fee ≠ 0 kể cả khi coupon = 0 (Variable% × Unit×qty).
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
  const goodsAmt = unitPrice * qty;                     // phần hàng * qty
  const totalPrice = (unitPrice + shipPerItem) * qty + shipPerOrder;   // ★ (Unit + Ship/Item)×qty + Ship/Order

  // ★ Coupon% áp trên phần hàng (goodsAmt), KHÔNG gồm Ship/Order.
  const couponAmt = num(s.couponUsd) + (num(s.couponPct) / 100) * goodsAmt;
  const amzFee = (num(s.amzFeePct) / 100) * (totalPrice - couponAmt);          // ★ AMZ% × (Total − Coupon)
  const variableFee = (num(s.variableFeePct) / 100) * (unitPrice * qty - couponAmt); // ★ Var% × (Unit×qty − Coupon)

  // ── Ship phía CHI PHÍ ──
  // Size từ thư viện (isLib): shipCostItem (Price Ship Item 2) + totalShipCost do resolveSheet
  //   nạp sẵn theo Ship Method hiệu lực (0 nếu thư viện chưa có).
  // Size nhập tay: dùng Ship/Item & Ship/Order của Price Setting làm cost-ship.
  const isLib = !!size?.isLib;
  const shipCostItem = isLib ? num(size?.shipCostItem) : shipPerItem;
  const fulfillBasis = isLib && size?.costBasis === 'fulfill';
  const totalShipCost = isLib && !fulfillBasis ? num(size?.totalShipCost) : (isLib ? 0 : shipPerOrder);

  let totalCost;
  if (fulfillBasis) {
    // ★ Item Cost = Total (Fulfill) đã gồm ship → sản phẩm đầu tính trọn, mỗi sản phẩm thêm P1 + ship/item.
    const extraItemCost = num(size?.p1) > 0 ? num(size.p1) : itemCost;
    totalCost = (itemCost + importTax) + (qty - 1) * (extraItemCost + shipCostItem + importTax);
  } else {
    // ★ Total Cost = (Item Cost + Ship cost/item + ImportTax) × qty + (Total Ship cost − Ship cost/item)
    totalCost = (itemCost + shipCostItem + importTax) * qty + (totalShipCost - shipCostItem);
  }

  const profit = totalPrice - amzFee - totalCost;
  const profitAfter = totalPrice - amzFee - variableFee - couponAmt - totalCost;

  return {
    qty,
    // Dòng thư viện chưa có giá vốn (size thiếu Total ở Ship Method hiệu lực / chưa chọn
    // Ship Method): Total Price vẫn đúng, nhưng Profit/Margin là số ảo — UI hiện "—",
    // summarizeSheet không tính vào Avg margin.
    costUnknown: isLib && !!size?.costMissing,
    shipping: shipPerItem * qty + shipPerOrder,   // tổng ship phía doanh thu (informational)
    shipCostItem,
    totalShipCost,
    customizeSum,
    unitPrice,
    totalPrice,
    couponAmt,
    amzFee,
    variableFee,
    totalCost,
    profit,
    profitAfter,
    margin: totalPrice ? ((profitAfter + couponAmt) / totalPrice) * 100 : 0,
    marginAfter: totalPrice ? (profitAfter / totalPrice) * 100 : 0,
    ratioCost: totalCost ? (profit / totalCost) * 100 : 0,
  };
}

/**
 * Tổng hợp một bảng tính giá: số size, khoảng giá, avg margin.
 * Dòng chưa có giá vốn (`costUnknown`) vẫn đếm size và vẫn góp Total Price vào
 * khoảng giá (giá bán không phụ thuộc giá vốn), nhưng KHÔNG góp vào Avg margin.
 */
export function summarizeSheet(sheet) {
  const rows = [];
  (sheet?.productTypes || []).forEach((pt) => {
    (pt.sizes || []).forEach((sz) => {
      rows.push(computeSizeRow(sheet.settings, pt, sz));
    });
  });
  if (!rows.length) return { count: 0, minPrice: null, maxPrice: null, avgMargin: null };
  const prices = rows.map((r) => r.totalPrice);
  const margins = rows.filter((r) => !r.costUnknown).map((r) => r.margin);
  return {
    count: rows.length,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    avgMargin: margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : null,
  };
}

/**
 * Đếm số Product Type cùng tên (chuẩn hoá trim+lowercase) trong 1 bảng —
 * dùng để gắn nhãn "So sánh · N" trên card khi Seller thêm nhiều block cùng
 * phôi (nhiều vendor) để so giá (vấn đề #3, mindmap 2026-08-28). Chỉ đếm
 * PT đang `shown` — card đang ẩn không cần tính vào, và không tính PT chưa
 * đặt tên (tên rỗng không phải một "nhóm" thật).
 */
export function productTypeCompareCounts(productTypes) {
  const counts = {};
  (productTypes || []).filter((pt) => pt.shown).forEach((pt) => {
    const key = (pt.name || '').trim().toLowerCase();
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
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
