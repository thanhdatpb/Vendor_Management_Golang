// ════════════════════════════════════════════════════════
//  PRICE SHEET WORKSPACE — bản số hoá của Google Sheet tính giá
//  Price Setting → Product Type (Phôi) → Size → Customize Info → kết quả
//
//  Redesign 2026-07: 1 hệ màu duy nhất (neutral + amber + semantic) —
//  tokens tập trung ở pricesheet/tokens.js, UI tách component:
//  PriceSettingPanel / ProductTypeCard / PriceTable / SummaryFooter /
//  AddCustomizeInfoModal / AddProductTypeModal / HistoryPanel.
//  LOGIC TÍNH GIÁ + STATE + API GIỮ NGUYÊN 100%.
// ════════════════════════════════════════════════════════
import { useState, useMemo, useEffect, useRef } from 'react';
import { HistoryOutlined } from '@ant-design/icons';
import {
  computeSizeRow, summarizeSheet, num, pct,
  makeSize, makeProductType, uid,
} from '../../utils/pricingEngine';
import { loadVendorLibraryIndex, findLibraryEntry, getLibraryItemCost, getLibraryShip, getLibraryShipItem2, normalizeKey } from '../../utils/vendorLibraryIndex';

import { PS, marginTone } from './pricesheet/tokens';
import { PsStyles, Btn, IconBtn, Badge, ConfirmDialog } from './pricesheet/primitives';
import PriceSettingPanel from './pricesheet/PriceSettingPanel';
import ProductTypeCard from './pricesheet/ProductTypeCard';
import AddCustomizeInfoModal from './pricesheet/AddCustomizeInfoModal';
import AddProductTypeModal from './pricesheet/AddProductTypeModal';
import HistoryPanel from './pricesheet/HistoryPanel';
import SummaryFooter from './pricesheet/SummaryFooter';

// ═══ Export ra Excel (GIỮ NGUYÊN — dùng lại xlsx đã có trong dự án) ═══
export async function exportSheetToExcel(sheet, showToast) {
  try {
    const xlsxMod = await import('xlsx');
    const XLSX = xlsxMod.default ?? xlsxMod;
    const s = sheet.settings || {};
    const aoa = [];
    aoa.push(['Price Setting']);
    aoa.push(['Price', s.price, 'Quantity', s.quantity, 'Ship/Order', s.shipPerOrder, 'Ship/Item', s.shipPerItem]);
    aoa.push(['Coupon ($)', s.couponUsd, 'Coupon (%)', s.couponPct]);
    aoa.push(['Variable Fee (%)', s.variableFeePct, 'AMZ Fee (%)', s.amzFeePct, 'ImportTax/item', s.importTax]);
    aoa.push([]);

    // header với các cột customize gộp chung theo tên
    const allCustomize = [];
    (sheet.productTypes || []).forEach((pt) =>
      (pt.customizeInfos || []).forEach((ci) => { if (!allCustomize.find((c) => c.name === ci.name)) allCustomize.push(ci); })
    );
    const header = ['Product Type', 'Size', 'Giá Phôi', 'Giá Size',
      ...allCustomize.map((c) => c.name || 'Customize'),
      'Item Cost', 'Total Price', 'AMZ Fee', 'Coupon', 'Variable', 'Profit', 'Margin %', 'After Promo %'];
    aoa.push(header);

    (sheet.productTypes || []).forEach((pt) => {
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

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheet.name || 'Gia').slice(0, 28));
    const slug = (sheet.name || 'BangGia').replace(/[^\w]+/g, '_').slice(0, 30);
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `HC_Gia_${slug}_${date}.xlsx`);
    showToast?.('success', 'Đã export', `Tải file HC_Gia_${slug}_${date}.xlsx`);
  } catch (err) {
    console.error('exportSheetToExcel', err);
    showToast?.('error', 'Lỗi export', err.message || 'Không xuất được Excel');
  }
}

// ── Size lấy từ thư viện vendor: id phải suy ra được từ (ptId + label) ──
// draftSheet dựng lại danh sách size từ thư viện ở MỖI render. Nếu dòng chưa có
// trong state mà lại sinh id ngẫu nhiên (makeSize → uid) thì id hiển thị trên UI
// không tồn tại trong state → onUpdateSize không tìm thấy dòng để patch, ô "Giá
// Size" gõ không ăn (và input còn bị remount vì React key đổi liên tục).
const libSizeId = (ptId, label) => `szlib_${ptId}_${normalizeKey(label)}`;

/**
 * Danh sách size của 1 Product Type theo đúng thư viện vendor.
 * Giữ nguyên dòng cũ khi khớp label (không mất giá đã nhập), dòng chưa có thì
 * tạo mới với id tiền định để state và UI luôn dùng chung một id.
 */
function libSizesOf(pt, libEntry) {
  return (libEntry.sizes || []).map((label) => {
    const existing = (pt.sizes || []).find((s) => s.label === label);
    return existing || { ...makeSize(label, ''), id: libSizeId(pt.id, label) };
  });
}

export default function PriceSheetWorkspace({ sheet, onSave, onClose, showToast }) {
  const [name, setName] = useState(sheet.name || '');
  // Quantity mặc định = 1; bảng cũ (tạo trước khi có Quantity) hiện trống → coi như 1.
  const [settings, setSettings] = useState(() => ({
    ...sheet.settings,
    quantity: num(sheet.settings?.quantity) > 0 ? sheet.settings.quantity : 1,
  }));
  const [productTypes, setProductTypes] = useState(() =>
    (sheet.productTypes?.length ? sheet.productTypes : [makeProductType('Product Type 1')]).map((pt) => ({
      ...pt, shown: pt.shown !== false,
    }))
  );
  const [showHistory, setShowHistory] = useState(false);
  const [libIndex, setLibIndex] = useState(null);
  const [showCustomizeDialog, setShowCustomizeDialog] = useState(null); // ptId
  const [showAddPTDialog, setShowAddPTDialog] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(null); // snapshot
  const [saving, setSaving] = useState(false);

  // Dirty-check: so state người dùng sửa được với snapshot lúc mở / lúc lưu.
  const snapshotOf = (n, st, pts) => JSON.stringify({ n, st, pts });
  const savedSnapRef = useRef(null);
  if (savedSnapRef.current == null) savedSnapRef.current = snapshotOf(name, settings, productTypes);
  const dirty = snapshotOf(name, settings, productTypes) !== savedSnapRef.current;

  useEffect(() => {
    loadVendorLibraryIndex(sheet.project || '', !sheet.project).then(setLibIndex).catch(console.error);
  }, [sheet.project]);

  const draftSheet = useMemo(() => {
    const computedPTs = productTypes.map((pt) => {
      const libEntry = findLibraryEntry(libIndex, pt.name);
      if (!libEntry) return pt;
      const sizes = libSizesOf(pt, libEntry).map((base) => {
        const label = base.label;
        // Bản chỉnh 2026-07-17: giá vốn = P1 (không còn cột Total); cost-ship lấy per-method.
        const itemCost = getLibraryItemCost(libEntry, label) || '';
        const totalShipCost = getLibraryShip(libEntry, label, pt.shipMethod) || 0;      // cột "Price Ship"
        const shipCostItem = getLibraryShipItem2(libEntry, label, pt.shipMethod) || 0;  // cột "Price Ship Item 2"
        return { ...base, label, itemCost, totalShipCost, shipCostItem, isLib: true };
      });
      return { ...pt, sizes };
    });
    return { ...sheet, name, settings, productTypes: computedPTs };
  }, [sheet, name, settings, productTypes, libIndex]);
  const summary = useMemo(() => summarizeSheet(draftSheet), [draftSheet]);

  // ── mutations (GIỮ NGUYÊN) ──
  const setSetting = (k, v) => setSettings((p) => ({ ...p, [k]: v }));
  const patchPT = (ptId, patch) => setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, ...patch } : pt)));
  const toggleShown = (ptId) => setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, shown: !pt.shown } : pt)));
  const addPT = () => setProductTypes((p) => [...p, makeProductType(`Product Type ${p.length + 1}`)]);
  // Thêm product type bằng cách CHỌN từ thư viện vendor: dùng đúng tên trong thư viện
  // → findLibraryEntry khớp chính xác, sizes + Item Cost tự nạp, tên khoá không sửa.
  const addPTFromLibrary = (nameFromLib) => {
    const libEntry = findLibraryEntry(libIndex, nameFromLib);
    const pt = { ...makeProductType(nameFromLib), shown: true };
    // Nạp sẵn size của thư viện vào state (giống luồng tạo bảng ở SetupPriceSection)
    // — nếu để mặc định 1 size rỗng thì các dòng size hiển thị chỉ là dữ liệu dựng
    // tạm của draftSheet, không có trong state để sửa.
    if (libEntry?.sizes?.length) pt.sizes = libSizesOf(pt, libEntry);
    setProductTypes((p) => [...p, pt]);
    setShowAddPTDialog(false);
  };
  // Confirm xoá đã chuyển vào ConfirmDialog trong ProductTypeCard
  const removePT = (ptId) => setProductTypes((p) => p.filter((pt) => pt.id !== ptId));
  const addSize = (ptId) => patchPTSizes(ptId, (sizes) => [...sizes, makeSize()]);
  const removeSize = (ptId, szId) => patchPTSizes(ptId, (sizes) => (sizes.length <= 1 ? sizes : sizes.filter((s) => s.id !== szId)));
  const updateSize = (ptId, szId, patch) => patchPTSizes(ptId, (sizes) => sizes.map((s) => (s.id === szId ? { ...s, ...patch } : s)));
  const updateSizeCustomize = (ptId, szId, ciId, val) =>
    patchPTSizes(ptId, (sizes) => sizes.map((s) => (s.id === szId ? { ...s, customize: { ...s.customize, [ciId]: val } } : s)));
  function patchPTSizes(ptId, fn) {
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, sizes: fn(baseSizesOf(pt)) } : pt)));
  }
  // Sizes dùng làm gốc khi ghi: với PT lấy từ thư viện thì đồng bộ theo thư viện
  // trước (id khớp với dòng đang hiển thị) — bảng cũ lưu thiếu size, hoặc thư viện
  // bổ sung size sau khi bảng được tạo, đều sửa được bình thường.
  function baseSizesOf(pt) {
    const libEntry = findLibraryEntry(libIndex, pt.name);
    return libEntry ? libSizesOf(pt, libEntry) : (pt.sizes || []);
  }
  const openAddCustomize = (ptId) => setShowCustomizeDialog(ptId);
  const addCustomize = (ptId, name, defaultPrice) => {
    const ciId = uid('ci');
    setProductTypes((p) => p.map((pt) => {
      if (pt.id !== ptId) return pt;
      const newSizes = baseSizesOf(pt).map(sz => ({
        ...sz,
        customize: { ...sz.customize, [ciId]: defaultPrice }
      }));
      return {
        ...pt,
        sizes: newSizes,
        customizeInfos: [...(pt.customizeInfos || []), { id: ciId, name }]
      };
    }));
  };
  const renameCustomize = (ptId, ciId, nm) =>
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, customizeInfos: pt.customizeInfos.map((c) => (c.id === ciId ? { ...c, name: nm } : c)) } : pt)));
  const removeCustomize = (ptId, ciId) =>
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, customizeInfos: pt.customizeInfos.filter((c) => c.id !== ciId) } : pt)));

  const shownPTs = productTypes.filter((pt) => pt.shown);

  // ── save (append version snapshot — GIỮ NGUYÊN, thêm saving state) ──
  const handleSave = async () => {
    const snap = {
      version: (sheet.history?.length || 0) + 1,
      savedAt: new Date().toISOString(),
      savedBy: (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').name || 'Seller'; } catch { return 'Seller'; } })(),
      avgMargin: summary.avgMargin, minPrice: summary.minPrice, maxPrice: summary.maxPrice, count: summary.count,
      settings: draftSheet.settings, productTypes: draftSheet.productTypes,
    };
    const history = [snap, ...(sheet.history || [])].slice(0, 20);
    setSaving(true);
    try {
      await Promise.resolve(onSave({ ...draftSheet, history, updatedAt: new Date().toISOString() }));
      savedSnapRef.current = snapshotOf(name, settings, productTypes);
      showToast?.('success', 'Đã lưu', `${name} · phiên bản v${snap.version}`);
    } finally {
      setSaving(false);
    }
  };

  const restoreVersion = (snap) => {
    setSettings({ ...snap.settings });
    setProductTypes(snap.productTypes.map((pt) => ({ ...pt, shown: pt.shown !== false })));
    setShowHistory(false);
    showToast?.('success', 'Đã khôi phục', `Về phiên bản v${snap.version}`);
  };

  const mTone = marginTone(summary.avgMargin);

  return (
    <div onClick={onClose} className="ps-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'stretch' }}>
      <div onClick={(e) => e.stopPropagation()} className="ps-scope" style={{
        width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
        background: PS.bgApp, overflow: 'hidden', color: PS.text,
        fontFamily: "-apple-system, 'Segoe UI', system-ui, Roboto, sans-serif",
      }}>
        <PsStyles />

        {/* ── Header — spec §3.1: nền trắng, border-bottom, meta badges ── */}
        <div style={{
          padding: '10px 20px', background: PS.bgSurface, borderBottom: `1px solid ${PS.border}`,
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          {/* Tên bảng tính — text-xl + thanh accent dọc amber-400 (spec §1) */}
          <div style={{ minWidth: 0, flex: 1, borderLeft: `4px solid ${PS.accentBar}`, paddingLeft: 12 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bảng tính giá"
              aria-label="Tên bảng tính giá"
              className="ps-input ps-input-ghost"
              style={{ fontSize: 20, fontWeight: 650, color: PS.text, padding: '3px 8px', marginLeft: -8, width: `${Math.max(24, (name || '').length + 2)}ch`, maxWidth: '100%' }} />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <Badge>{shownPTs.length}/{productTypes.length} product type · {summary.count} size</Badge>
              {summary.avgMargin != null && <Badge tone={mTone}>avg margin {pct(summary.avgMargin, 1)}</Badge>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {/* Chip trung tính + icon history + badge đếm (spec §2) */}
            <button type="button" className="ps-btn-hist" onClick={() => setShowHistory(true)}>
              <HistoryOutlined style={{ fontSize: 16 }} aria-hidden />
              Lịch sử tính giá
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                background: PS.accentSoft, color: PS.accentText,
                fontSize: 11, fontWeight: 650, fontVariantNumeric: 'tabular-nums',
              }}>{sheet.history?.length || 0}</span>
            </button>
            <Btn variant="outline" onClick={() => exportSheetToExcel(draftSheet, showToast)}>⬇ Export Excel</Btn>
            <IconBtn title="Đóng" onClick={onClose}>✕</IconBtn>
          </div>
        </div>

        {/* ── Price Setting — spec §3.2 ── */}
        <PriceSettingPanel settings={settings} onSet={setSetting} />

        {/* ── Chọn hiển thị Product Type (multi-select chip — GIỮ hành vi xếp chồng) ── */}
        <div style={{ padding: '10px 20px', flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: PS.textSecondary }}>
            Product Type
          </span>
          <span title="Chọn 1, 2 hay nhiều — bảng xếp chồng như sheet" aria-label="Gợi ý: chọn 1, 2 hay nhiều — bảng xếp chồng như sheet"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help',
              width: 15, height: 15, borderRadius: '50%', fontSize: 10, fontWeight: 700,
              border: `1px solid ${PS.borderStrong}`, color: PS.textMuted, marginRight: 4,
            }}>?</span>
          {productTypes.map((pt) => (
            <button key={pt.id} type="button" onClick={() => toggleShown(pt.id)} aria-pressed={pt.shown}
              className="ps-chip"
              style={{
                fontSize: 12.5, fontWeight: 650, padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
                border: `1px solid ${pt.shown ? PS.brandBorder : PS.border}`,
                background: pt.shown ? PS.brandSubtle : PS.bgSurface,
                color: pt.shown ? PS.brandDeep : PS.textSecondary, whiteSpace: 'nowrap',
              }}>
              {pt.shown ? '✓ ' : ''}{pt.name || 'Chưa đặt tên'}
            </button>
          ))}
          <Btn variant="dashed" size="sm" onClick={() => setShowAddPTDialog(true)}
            style={{ borderRadius: 999 }}>＋ Thêm Product Type</Btn>
        </div>

        {/* ── Body: các product type xếp chồng ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 20px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {shownPTs.length === 0 && (
            <div style={{
              textAlign: 'center', color: PS.textMuted, padding: '60px 20px', fontSize: 13.5,
              background: PS.bgSurface, border: `1.5px dashed ${PS.border}`, borderRadius: 12,
            }}>
              Chọn ít nhất một Product Type để hiển thị bảng tính giá.
            </div>
          )}
          {draftSheet.productTypes.filter(pt => pt.shown).map((pt) => {
            const libEntry = findLibraryEntry(libIndex, pt.name);
            return (
              <ProductTypeCard key={pt.id} pt={pt} settings={settings} libEntry={libEntry}
                onPT={patchPT} onRemovePT={removePT}
                onAddSize={addSize} onUpdateSize={updateSize} onRemoveSize={removeSize} onUpdateCustomize={updateSizeCustomize}
                onAddCustomize={openAddCustomize} onRenameCustomize={renameCustomize} onRemoveCustomize={removeCustomize} />
            );
          })}
        </div>

        {/* ── Footer — spec §3.7 ── */}
        <SummaryFooter summary={summary} dirty={dirty} saving={saving} onCancel={onClose} onSave={handleSave} />
      </div>

      {showHistory && (
        <HistoryPanel sheet={sheet} onClose={() => setShowHistory(false)}
          onRestore={(snap) => setConfirmRestore(snap)}
          onExportVersion={(snap) => exportSheetToExcel({ ...sheet, name: `${sheet.name}_v${snap.version}`, settings: snap.settings, productTypes: snap.productTypes }, showToast)} />
      )}

      {confirmRestore && (
        <ConfirmDialog title="Khôi phục phiên bản" confirmLabel="Khôi phục"
          message={`Khôi phục về phiên bản v${confirmRestore.version}? Các thay đổi chưa lưu sẽ mất.`}
          onConfirm={() => restoreVersion(confirmRestore)} onClose={() => setConfirmRestore(null)} />
      )}

      {showCustomizeDialog && (
        <AddCustomizeInfoModal onClose={() => setShowCustomizeDialog(null)} onConfirm={(name, defaultPrice) => {
          addCustomize(showCustomizeDialog, name, defaultPrice);
          setShowCustomizeDialog(null);
        }} />
      )}

      {showAddPTDialog && (
        <AddProductTypeModal
          libIndex={libIndex}
          existingKeys={new Set(productTypes.map((pt) => normalizeKey(pt.name)))}
          onPick={addPTFromLibrary}
          onManual={() => { addPT(); setShowAddPTDialog(false); }}
          onClose={() => setShowAddPTDialog(false)}
        />
      )}
    </div>
  );
}
