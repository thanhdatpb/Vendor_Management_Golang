// ════════════════════════════════════════════════════════
//  ITEM COST = TOTAL (FULFILL) + TỰ NHẬN DIỆN SHIP METHOD (2026-09)
//
//  Hai nhóm test:
//    1. Chức năng mới — Ship Method tự nhận diện theo cột Total (Fulfill) có
//       dữ liệu; 2+ phương thức thì Seller chọn; size thiếu giá / chưa chọn
//       không được coi giá vốn là 0.
//    2. Bảng tính giá CÓ SẴN không bị ảnh hưởng — mọi con số tiền giữ nguyên,
//       giá / customize / tên size / thứ tự Seller đã nhập không mất, dòng nhập
//       tay và Product Type mất record nguồn chạy y hệt trước.
// ════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll } from 'vitest';
import legacySheet from '../../test/fixtures/legacySheet.json';
import {
  loadVendorLibraryIndex, findLibraryEntry, availableShipMethods,
  getLibraryItemCost, getLibraryShip, getLibraryShipItem2,
} from '../vendorLibraryIndex';
import { resolveSheet, resolveShipMethod } from '../resolveSheet';
import { computeSizeRow, summarizeSheet } from '../pricingEngine';
import { serialize } from '../../test/roundTrip';

vi.mock('../../services/api', () => import('../../test/apiMock.js'));

let fixtureIndex;
beforeAll(async () => { fixtureIndex = await loadVendorLibraryIndex('happy'); });

// ── Index thư viện dựng tay: MỘT phôi "Tee" của vendor V1, dữ liệu tuỳ ca ──
const makeIndex = (rows, name = 'Tee') => {
  const bySize = {};
  const sizes = [];
  rows.forEach((r) => { bySize[r.size.toLowerCase()] = r; sizes.push(r.size); });
  const key = name.toLowerCase();
  const record = {
    recordKey: `f::V1::${key}`, productType: name, vendorCode: 'V1', vendor: 'V1', filename: 'f', sizes, bySize,
  };
  return { [key]: { productType: name, vendor: 'V1', filename: 'f', sizes: [...sizes], bySize, records: [record] } };
};
const teePT = (over = {}) => ({ id: 'pt_t', name: 'Tee', phoi: '0', shown: true, customizeInfos: [], sizes: [], ...over });
const resolveOne = (pt, index) => resolveSheet({ settings: {}, productTypes: [pt] }, index).productTypes[0];

// Phôi chỉ có giá Economy (đúng ca ảnh chụp VN3 — Football Jersey).
const ECO_ONLY = [
  { size: 'S', pricing1: 13.7, eco_total: 13.7 },
  { size: 'M', pricing1: 13.7, eco_total: 13.7 },
  { size: '2XL', pricing1: 15.2, eco_total: 15.2 },
];
// Phôi có giá ở cả Economy lẫn Ground (đúng ca ảnh chụp CN1 — A - Both fabric).
const ECO_GROUND = [{ size: '3XL', pricing1: 14, eco_price: 0, eco_total: 14, ground_price: 5, ground_total: 19 }];

describe('availableShipMethods — nhận diện phương thức có Total (Fulfill)', () => {
  it('chỉ trả phương thức có Total > 0, theo đúng thứ tự, kèm khoảng giá', () => {
    const entry = findLibraryEntry(makeIndex(ECO_ONLY), 'Tee');
    expect(availableShipMethods(entry)).toEqual([
      { key: 'eco', label: 'Economy', min: 13.7, max: 15.2, count: 3 },
    ]);
  });

  it('ô Total = $0.00 / trống / rác coi như KHÔNG có giá', () => {
    const entry = findLibraryEntry(makeIndex([
      { size: 'S', pricing1: 5, eco_total: 0, ground_total: '', express_total: 'abc', twoday_total: 9 },
    ]), 'Tee');
    expect(availableShipMethods(entry).map((o) => o.key)).toEqual(['twoday']);
  });

  it('chỉ xét size đang hiển thị — size Seller đã xoá không làm nảy ra phương thức', () => {
    const entry = findLibraryEntry(makeIndex([
      { size: 'S', eco_total: 10 },
      { size: 'XL', eco_total: 11, ground_total: 16 },
    ]), 'Tee');
    expect(availableShipMethods(entry, ['S']).map((o) => o.key)).toEqual(['eco']);
  });
});

describe('resolveShipMethod — trạng thái Ship Method', () => {
  const entryOf = (rows) => findLibraryEntry(makeIndex(rows), 'Tee');

  it('1 phương thức có giá, chưa chọn → tự áp, không bắt Seller bấm', () => {
    expect(resolveShipMethod(teePT(), entryOf(ECO_ONLY))).toMatchObject({ method: 'eco', state: 'single', previous: '' });
  });

  it('2+ phương thức, chưa chọn → KHÔNG tự chọn', () => {
    expect(resolveShipMethod(teePT(), entryOf(ECO_GROUND))).toMatchObject({ method: null, state: 'needs-choice' });
  });

  it('2+ phương thức, đã chọn một cái còn giá → giữ lựa chọn của Seller', () => {
    expect(resolveShipMethod(teePT({ shipMethod: 'ground' }), entryOf(ECO_GROUND)))
      .toMatchObject({ method: 'ground', state: 'chosen' });
  });

  it('cái đã lưu không còn giá, còn đúng 1 cái → tự chuyển và nhớ cái cũ để báo', () => {
    expect(resolveShipMethod(teePT({ shipMethod: 'express' }), entryOf(ECO_ONLY)))
      .toMatchObject({ method: 'eco', state: 'switched', previous: 'express' });
  });

  it('cái đã lưu không còn giá, còn 2+ cái → bắt chọn lại', () => {
    expect(resolveShipMethod(teePT({ shipMethod: 'overnight' }), entryOf(ECO_GROUND)))
      .toMatchObject({ method: null, state: 'needs-choice', previous: 'overnight' });
  });

  it('không phương thức nào có Total → none', () => {
    expect(resolveShipMethod(teePT(), entryOf([{ size: 'S', pricing1: 4.2 }])))
      .toMatchObject({ method: null, state: 'none', options: [] });
  });
});

describe('resolveSheet — Item Cost theo Ship Method hiệu lực', () => {
  it('1 phương thức: Item Cost = Total (Fulfill), shipMethod được ghi để lần lưu sau chốt luôn', () => {
    const pt = resolveOne(teePT(), makeIndex(ECO_ONLY));
    expect(pt.shipMethod).toBe('eco');
    expect(pt.shipMethodState).toBe('single');
    expect(pt.sizes.map((s) => s.itemCost)).toEqual([13.7, 13.7, 15.2]);
    expect(pt.sizes.every((s) => s.costBasis === 'fulfill' && !s.costMissing)).toBe(true);
  });

  it('2+ phương thức chưa chọn: Item Cost trống, costMissing — Profit không được là số ảo', () => {
    const pt = resolveOne(teePT(), makeIndex(ECO_GROUND));
    expect(pt.shipMethodState).toBe('needs-choice');
    expect(pt.shipMethodOptions.map((o) => o.key)).toEqual(['eco', 'ground']);
    expect(pt.sizes[0]).toMatchObject({ itemCost: '', costMissing: true });
    expect(computeSizeRow({}, pt, pt.sizes[0]).costUnknown).toBe(true);
  });

  it('2+ phương thức, chọn Ground → Item Cost = Total Ground (19), không phải P1 (14)', () => {
    const pt = resolveOne(teePT({ shipMethod: 'ground' }), makeIndex(ECO_GROUND));
    expect(pt.sizes[0]).toMatchObject({ itemCost: 19, p1: 14, costMissing: false });
  });

  it('size thiếu Total ở phương thức đang chọn → chỉ size đó thiếu giá, KHÔNG mượn phương thức khác', () => {
    const rows = [
      { size: 'S', pricing1: 5.79, eco_total: 10.98 },
      { size: '4XL', pricing1: 10.39, ground_total: 16 },   // chỉ có Ground
      { size: '5XL', pricing1: 11.39 },                      // không có gì
    ];
    expect(resolveOne(teePT(), makeIndex(rows)).shipMethodState).toBe('needs-choice');
    const chosen = resolveOne(teePT({ shipMethod: 'eco' }), makeIndex(rows));
    expect(chosen.sizes.map((s) => [s.label, s.itemCost, s.costMissing])).toEqual([
      ['S', 10.98, false], ['4XL', '', true], ['5XL', '', true],
    ]);
  });

  it('không có Total ở đâu: Item Cost tạm dùng P1, không coi là thiếu giá', () => {
    const pt = resolveOne(teePT(), makeIndex([{ size: '8x10', pricing1: 4.2 }]));
    expect(pt.shipMethodState).toBe('none');
    expect(pt.sizes[0]).toMatchObject({ itemCost: 4.2, costMissing: false, costBasis: 'fulfill' });
  });

  it('PT gắn libRef đọc Total của đúng record đó', () => {
    const pt = resolveOne(teePT({ libRef: { recordKey: 'f::V1::tee', vendorCode: 'V1' } }), makeIndex(ECO_ONLY));
    expect(pt.shipMethod).toBe('eco');
    expect(pt.sizes.map((s) => s.itemCost)).toEqual([13.7, 13.7, 15.2]);
  });

  it('phương thức tự nhận diện được lưu lại: vendor bổ sung Ground sau đó thì bảng vẫn giữ Economy', () => {
    const saved = serialize(resolveSheet({ settings: {}, productTypes: [teePT()] }, makeIndex(ECO_ONLY)));
    const later = makeIndex(ECO_ONLY.map((r) => ({ ...r, ground_total: r.eco_total + 5 })));
    const pt = resolveSheet(saved, later).productTypes[0];
    expect(pt.shipMethodState).toBe('chosen');
    expect(pt.shipMethod).toBe('eco');
    expect(pt.sizes[0].itemCost).toBe(13.7);
  });

  it('summarizeSheet: size thiếu giá không kéo Avg margin, bảng chỉ còn size thiếu giá → null', () => {
    const settings = { price: 20, quantity: 1, amzFeePct: 17 };
    const sheet = resolveSheet({ settings, productTypes: [teePT()] }, makeIndex(ECO_GROUND));
    expect(summarizeSheet(sheet)).toMatchObject({ count: 1, avgMargin: null });
    expect(summarizeSheet(sheet).minPrice).toBeCloseTo(20, 10);
  });
});

describe('Bảng tính giá CÓ SẴN — không bị ảnh hưởng', () => {
  // Giá vốn theo đúng cách tính TRƯỚC bản chỉnh: Item Cost = P1, Price Ship +
  // Price Ship Item 2 của phương thức ship nạp riêng (không có costBasis).
  const oldCostOf = (entry, sz, method) => ({
    ...sz,
    costBasis: undefined,
    itemCost: getLibraryItemCost(entry, sz.libLabel) || '',
    totalShipCost: getLibraryShip(entry, sz.libLabel, method) || 0,
    shipCostItem: getLibraryShipItem2(entry, sz.libLabel, method) || 0,
  });
  const MONEY = ['totalPrice', 'couponAmt', 'amzFee', 'variableFee', 'totalCost', 'profit', 'profitAfter', 'margin', 'marginAfter'];

  it.each(['eco', 'ground', 'express'])('bảng mẫu với Ship Method %s: mọi con số tiền giữ nguyên từng dòng', (method) => {
    const sheet = { ...legacySheet, productTypes: legacySheet.productTypes.map((pt) => ({ ...pt, shipMethod: method })) };
    const resolved = resolveSheet(sheet, fixtureIndex);
    let compared = 0;
    resolved.productTypes.forEach((pt) => {
      const entry = findLibraryEntry(fixtureIndex, pt.name);
      pt.sizes.forEach((sz) => {
        const now = computeSizeRow(resolved.settings, pt, sz);
        const before = computeSizeRow(resolved.settings, pt, sz.isLib ? oldCostOf(entry, sz, method) : sz);
        MONEY.forEach((k) => expect(now[k]).toBeCloseTo(before[k], 9));
        compared += 1;
      });
    });
    expect(compared).toBe(7);                                  // 5 size thư viện + 2 size nhập tay
  });

  it('giá size, customize, tên size đã đổi, thứ tự và size tự thêm của Seller không mất', () => {
    const libPt = legacySheet.productTypes[0];
    const sheet = { ...legacySheet, productTypes: [{
      ...libPt,
      sizeOrder: ['szlib_pt_legacy_lib_m', 'szlib_pt_legacy_lib_s'],
      sizes: [
        ...libPt.sizes.map((s) => (s.label === 'S' ? { ...s, overrides: { label: 'S (rộng)' } } : s)),
        { id: 'sz_extra', label: '6XL', sizeAdd: '9', itemCost: '15', customize: {}, origin: 'manual' },
      ],
    }, legacySheet.productTypes[1]] };
    const out = resolveSheet(serialize(sheet), fixtureIndex);
    const [lib, manual] = out.productTypes;

    expect(lib.sizes.slice(0, 2).map((s) => s.label)).toEqual(['M', 'S (rộng)']);
    const byId = new Map(lib.sizes.map((s) => [s.id, s]));
    libPt.sizes.forEach((s) => {
      expect(byId.get(s.id).sizeAdd).toBe(s.sizeAdd);
      expect(byId.get(s.id).customize).toEqual(s.customize);
    });
    // size Seller tự thêm giữ nguyên giá vốn nhập tay, không bị gắn cờ giá vốn thư viện
    expect(byId.get('sz_extra')).toMatchObject({ itemCost: '15', isLib: false });
    expect(byId.get('sz_extra').costBasis).toBeUndefined();
    // PT nhập tay: y nguyên, không có field Ship Method mới
    expect(manual).toEqual(legacySheet.productTypes[1]);
  });

  it('dòng từng là dòng thư viện nhưng thư viện đã bỏ size đó → thành dòng tự thêm, bỏ cờ giá vốn thư viện', () => {
    const sheet = { settings: {}, productTypes: [teePT({
      sizes: [{ id: 'x', label: '7XL', sizeAdd: '1', itemCost: 20, customize: {}, isLib: true, costBasis: 'fulfill', p1: 12, costMissing: false }],
    })] };
    const sz = resolveSheet(sheet, makeIndex(ECO_ONLY)).productTypes[0].sizes.find((s) => s.id === 'x');
    expect(sz).toMatchObject({ isLib: false, origin: 'manual', itemCost: 20 });
    expect(sz.costBasis).toBeUndefined();
    expect(sz.p1).toBeUndefined();
  });

  it('PT mất record nguồn: giữ nguyên số đã lưu (cả công thức cũ), bỏ field Ship Method đã resolve', () => {
    const sheet = { settings: { quantity: 2, importTax: 0.5 }, productTypes: [{
      id: 'pt_gone', name: 'Football Jersey', phoi: '0', shipMethod: 'eco', customizeInfos: [],
      libRef: { recordKey: 'file-da-xoa::VN9::football jersey', vendorCode: 'VN9' },
      shipMethodOptions: [{ key: 'eco' }], shipMethodState: 'single', shipMethodPrevious: '',
      sizes: [{ id: 'a', label: 'S', sizeAdd: '1', itemCost: 7.9, shipCostItem: 1.2, totalShipCost: 4.4, isLib: true, customize: {} }],
    }] };
    const pt = resolveSheet(sheet, fixtureIndex).productTypes[0];
    expect(pt.warning).toBe('record-missing');
    expect(pt.shipMethodOptions).toBeUndefined();
    expect(pt.shipMethodState).toBeUndefined();
    const r = computeSizeRow(sheet.settings, pt, pt.sizes[0]);
    expect(r.totalCost).toBeCloseTo((7.9 + 1.2 + 0.5) * 2 + (4.4 - 1.2), 10);   // công thức cũ, không đổi số
  });

  it('bảng chưa tải xong thư viện: PT nhập tay trả nguyên, không gắn gì mới', () => {
    expect(resolveSheet(legacySheet, null).productTypes[1]).toEqual(legacySheet.productTypes[1]);
  });
});
