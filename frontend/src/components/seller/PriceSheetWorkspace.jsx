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
import {
  computeSizeRow, summarizeSheet, num, pct,
  makeSize, makeProductType, uid, DEFAULT_SETTINGS
} from '../../utils/pricingEngine';
import { loadVendorLibraryIndex, findLibraryEntry, getLibraryTotal, normalizeKey } from '../../utils/vendorLibraryIndex';

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
          +r.variableFee.toFixed(2), +r.profit.toFixed(2), +r.margin.toFixed(2), +r.marginAfter.toFixed(2),
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

export default function PriceSheetWorkspace({ sheet, onSave, onClose, showToast }) {
  const [name, setName] = useState(sheet.name || '');
  // Quantity mặc định = 1; bảng cũ (tạo trước khi có Quantity) hiện trống → coi như 1.
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...sheet.settings,
    quantity: num(sheet.settings?.quantity) > 0 ? sheet.settings.quantity : DEFAULT_SETTINGS.quantity,
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
      const sizes = libEntry.sizes.map((label) => {
        const existing = (pt.sizes || []).find((s) => s.label === label);
        const itemCost = getLibraryTotal(libEntry, label, pt.shipMethod) || '';
        return { ...(existing || makeSize(label, '')), label, itemCost, isLib: true };
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
    setProductTypes((p) => [...p, { ...makeProductType(nameFromLib), shown: true }]);
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
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, sizes: fn(pt.sizes || []) } : pt)));
  }
  const openAddCustomize = (ptId) => setShowCustomizeDialog(ptId);
  const addCustomize = (ptId, name, defaultPrice) => {
    const ciId = uid('ci');
    setProductTypes((p) => p.map((pt) => {
      if (pt.id !== ptId) return pt;
      const newSizes = (pt.sizes || []).map(sz => ({
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

        {/* ── Header — tên bảng tính nổi bật, gradient amber ── */}
        <div style={{
          padding: '12px 20px',
          background: `linear-gradient(135deg, ${PS.brand} 0%, ${PS.brandHover} 60%, ${PS.brandDeep} 100%)`,
          borderBottom: `2px solid ${PS.brandDeep}`,
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          boxShadow: '0 2px 8px rgba(196,127,16,0.25)',
        }}>
          <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>📊</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bảng tính giá"
                aria-label="Tên bảng tính giá"
                style={{
                  fontSize: 20, fontWeight: 800, padding: '4px 10px', borderRadius: 8, outline: 'none',
                  background: 'rgba(255,255,255,0.18)', border: '1.5px solid rgba(255,255,255,0.35)',
                  color: '#fff', width: `${Math.max(20, (name || '').length + 2)}ch`, maxWidth: '100%',
                  letterSpacing: '-0.01em',
                }} />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                  {shownPTs.length}/{productTypes.length} product type · {summary.count} size
                </span>
                {summary.avgMargin != null && (
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.22)', color: '#fff',
                  }}>avg margin {pct(summary.avgMargin, 1)}</span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button type="button" onClick={() => setShowHistory(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.32)', color: '#fff',
              }}>
              🕘 Lịch sử tính giá ({sheet.history?.length || 0})
            </button>
            <button type="button" onClick={() => exportSheetToExcel(draftSheet, showToast)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 13px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.32)', color: '#fff',
              }}>
              ⬇ Export Excel
            </button>
            <button type="button" onClick={onClose} aria-label="Đóng"
              style={{
                width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 700,
                background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.32)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
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
