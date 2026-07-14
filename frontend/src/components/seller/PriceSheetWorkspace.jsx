// ════════════════════════════════════════════════════════
//  PRICE SHEET WORKSPACE — bản số hoá của Google Sheet tính giá
//  Price Setting → Product Type (Phôi) → Size → Customize Info → kết quả
// ════════════════════════════════════════════════════════
import { useState, useMemo } from 'react';
import { HC } from '../../constants/sellerTheme';
import {
  computeSizeRow, summarizeSheet, num, usd, pct,
  SETTING_FIELDS, makeSize, makeProductType, uid,
} from '../../utils/pricingEngine';

// ─── Palette phụ (tinh chỉnh cho dễ nhìn) ────────────────
const AUTO = {
  head: 'linear-gradient(135deg,#12A45A,#0A7D43)', ink: '#0A6B3A',
  bg: '#F3FCF7', bgStrong: '#E4F8EC', line: '#BFE9CF', total: '#0B7A43',
};
const VIO = { head: '#7C3AED', ink: '#6D28D9', bg: '#F7F3FF', line: '#E4D7FF' };
const IN = { head: HC.orangeDark, line: HC.borderStrong, bg: '#FFFDF9' };

const cellInput = {
  width: '100%', boxSizing: 'border-box', padding: '6px 8px', fontSize: 12,
  border: `1px solid ${HC.border}`, borderRadius: 6, background: HC.surface,
  color: HC.ink2, textAlign: 'right', outline: 'none', fontVariantNumeric: 'tabular-nums',
};
const th = { padding: '8px 9px', color: '#fff', fontWeight: 800, fontSize: 11, whiteSpace: 'nowrap', textAlign: 'center' };
const tdAuto = { padding: '7px 9px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 11.5, borderRight: `1px solid ${AUTO.line}` };

// ═══ Export ra Excel (dùng lại xlsx đã có trong dự án) ═══
export async function exportSheetToExcel(sheet, showToast) {
  try {
    const xlsxMod = await import('xlsx');
    const XLSX = xlsxMod.default ?? xlsxMod;
    const s = sheet.settings || {};
    const aoa = [];
    aoa.push(['Price Setting']);
    aoa.push(['Price', s.price, 'Ship/Order', s.shipPerOrder, 'Ship/Item', s.shipPerItem]);
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
  const [settings, setSettings] = useState({ ...sheet.settings });
  const [productTypes, setProductTypes] = useState(() =>
    (sheet.productTypes?.length ? sheet.productTypes : [makeProductType('Product Type 1')]).map((pt) => ({
      ...pt, shown: pt.shown !== false,
    }))
  );
  const [showHistory, setShowHistory] = useState(false);

  const draftSheet = useMemo(
    () => ({ ...sheet, name, settings, productTypes }),
    [sheet, name, settings, productTypes]
  );
  const summary = useMemo(() => summarizeSheet(draftSheet), [draftSheet]);

  // ── mutations ──
  const setSetting = (k, v) => setSettings((p) => ({ ...p, [k]: v }));
  const patchPT = (ptId, patch) => setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, ...patch } : pt)));
  const toggleShown = (ptId) => setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, shown: !pt.shown } : pt)));
  const addPT = () => setProductTypes((p) => [...p, makeProductType(`Product Type ${p.length + 1}`)]);
  const removePT = (ptId) => {
    if (!window.confirm('Xoá product type này khỏi bảng?')) return;
    setProductTypes((p) => p.filter((pt) => pt.id !== ptId));
  };
  const addSize = (ptId) => patchPTSizes(ptId, (sizes) => [...sizes, makeSize()]);
  const removeSize = (ptId, szId) => patchPTSizes(ptId, (sizes) => (sizes.length <= 1 ? sizes : sizes.filter((s) => s.id !== szId)));
  const updateSize = (ptId, szId, patch) => patchPTSizes(ptId, (sizes) => sizes.map((s) => (s.id === szId ? { ...s, ...patch } : s)));
  const updateSizeCustomize = (ptId, szId, ciId, val) =>
    patchPTSizes(ptId, (sizes) => sizes.map((s) => (s.id === szId ? { ...s, customize: { ...s.customize, [ciId]: val } } : s)));
  function patchPTSizes(ptId, fn) {
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, sizes: fn(pt.sizes || []) } : pt)));
  }
  const addCustomize = (ptId) =>
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, customizeInfos: [...(pt.customizeInfos || []), { id: uid('ci'), name: '' }] } : pt)));
  const renameCustomize = (ptId, ciId, nm) =>
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, customizeInfos: pt.customizeInfos.map((c) => (c.id === ciId ? { ...c, name: nm } : c)) } : pt)));
  const removeCustomize = (ptId, ciId) =>
    setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, customizeInfos: pt.customizeInfos.filter((c) => c.id !== ciId) } : pt)));

  const shownPTs = productTypes.filter((pt) => pt.shown);

  // ── save (append version snapshot) ──
  const handleSave = () => {
    const snap = {
      version: (sheet.history?.length || 0) + 1,
      savedAt: new Date().toISOString(),
      savedBy: (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').name || 'Seller'; } catch { return 'Seller'; } })(),
      avgMargin: summary.avgMargin, minPrice: summary.minPrice, maxPrice: summary.maxPrice, count: summary.count,
      settings, productTypes,
    };
    const history = [snap, ...(sheet.history || [])].slice(0, 20);
    onSave({ ...sheet, name, settings, productTypes, history, updatedAt: new Date().toISOString() });
    showToast?.('success', 'Đã lưu', `${name} · phiên bản v${snap.version}`);
  };

  const restoreVersion = (snap) => {
    if (!window.confirm(`Khôi phục về phiên bản v${snap.version}? Các thay đổi chưa lưu sẽ mất.`)) return;
    setSettings({ ...snap.settings });
    setProductTypes(snap.productTypes.map((pt) => ({ ...pt, shown: pt.shown !== false })));
    setShowHistory(false);
    showToast?.('success', 'Đã khôi phục', `Về phiên bản v${snap.version}`);
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,18,0,0.55)', backdropFilter: 'blur(3px)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'stretch' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', background: HC.cream, overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ padding: '12px 22px', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDeep})`, color: '#fff', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span style={{ fontSize: 20 }}>💲</span>
            <div style={{ minWidth: 0 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên bảng tính giá"
                style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontWeight: 800, fontSize: 15, borderRadius: 8, padding: '4px 10px', outline: 'none', maxWidth: 360 }} />
              <div style={{ fontSize: 11, opacity: 0.9, marginTop: 3 }}>
                {shownPTs.length}/{productTypes.length} product type hiển thị · {summary.count} size
                {summary.avgMargin != null && <> · avg margin <b>{pct(summary.avgMargin, 1)}</b></>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setShowHistory(true)} style={ghostBtn}>🕘 Lịch sử ({sheet.history?.length || 0})</button>
            <button onClick={() => exportSheetToExcel(draftSheet, showToast)} style={ghostBtn}>⬇ Export Excel</button>
            <button onClick={onClose} style={{ ...ghostBtn, width: 34, padding: 0, fontSize: 15 }}>✕</button>
          </div>
        </div>

        {/* ── Price Setting ── */}
        <div style={{ padding: '14px 22px', background: VIO.bg, borderBottom: `1px solid ${VIO.line}`, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em', color: VIO.ink, marginBottom: 10 }}>⚙️ Price Setting — áp cho cả bảng</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(96px,1fr))', gap: 10 }}>
            {SETTING_FIELDS.map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 750, color: HC.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.icon} {f.label} ({f.unit})</span>
                <input type="number" step="0.01" value={settings[f.key] ?? ''} onChange={(e) => setSetting(f.key, e.target.value)}
                  style={{ ...cellInput, textAlign: 'left', fontWeight: 700, background: HC.surface }} />
              </label>
            ))}
          </div>
        </div>

        {/* ── Chọn hiển thị Product Type ── */}
        <div style={{ padding: '10px 22px', background: HC.surface2, borderBottom: `1px solid ${HC.border}`, flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em', color: HC.muted, marginRight: 2 }}>Hiển thị Product Type</span>
          {productTypes.map((pt) => (
            <button key={pt.id} onClick={() => toggleShown(pt.id)}
              style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 9, cursor: 'pointer',
                border: `1.5px solid ${pt.shown ? 'transparent' : HC.borderStrong}`,
                background: pt.shown ? `linear-gradient(135deg,${HC.orange},${HC.orangeDark})` : HC.surface,
                color: pt.shown ? '#fff' : HC.muted, whiteSpace: 'nowrap' }}>
              {pt.shown ? '☑' : '☐'} {pt.name || 'Chưa đặt tên'}
            </button>
          ))}
          <button onClick={addPT} style={{ fontSize: 12.5, fontWeight: 700, padding: '6px 13px', borderRadius: 9, cursor: 'pointer', border: `1.5px dashed ${HC.orangeMid}`, background: HC.orangeLight, color: HC.orangeDark }}>＋ Thêm Product Type</button>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: HC.muted }}>Chọn 1, 2 hay nhiều — bảng xếp chồng như sheet</span>
        </div>

        {/* ── Body: các product type xếp chồng ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 40px', display: 'flex', flexDirection: 'column', gap: 22 }}>
          {shownPTs.length === 0 && (
            <div style={{ textAlign: 'center', color: HC.muted, padding: 50 }}>Chọn ít nhất một Product Type để hiển thị bảng tính giá.</div>
          )}
          {shownPTs.map((pt) => (
            <ProductTypeBlock key={pt.id} pt={pt} settings={settings}
              onPT={patchPT} onRemovePT={removePT}
              onAddSize={addSize} onUpdateSize={updateSize} onRemoveSize={removeSize} onUpdateCustomize={updateSizeCustomize}
              onAddCustomize={addCustomize} onRenameCustomize={renameCustomize} onRemoveCustomize={removeCustomize} />
          ))}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '12px 22px', borderTop: `1px solid ${HC.border}`, background: HC.surface, flexShrink: 0, display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
          {summary.avgMargin != null && (
            <div style={{ marginRight: 'auto', display: 'flex', gap: 16, fontSize: 12.5, color: HC.muted, fontVariantNumeric: 'tabular-nums' }}>
              <span>Khoảng giá <b style={{ color: HC.ink }}>{usd(summary.minPrice)} – {usd(summary.maxPrice)}</b></span>
              <span>Avg margin <b style={{ color: summary.avgMargin > 25 ? AUTO.total : HC.warning }}>{pct(summary.avgMargin, 1)}</b></span>
            </div>
          )}
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, background: HC.cream, border: `1px solid ${HC.border}`, color: HC.brown, cursor: 'pointer', fontWeight: 700 }}>Hủy</button>
          <button onClick={handleSave} style={{ padding: '9px 26px', borderRadius: 10, background: `linear-gradient(135deg,${HC.success},#0f6b31)`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800 }}>💾 Lưu bảng tính giá</button>
        </div>
      </div>

      {/* ── History panel ── */}
      {showHistory && (
        <HistoryPanel sheet={sheet} onClose={() => setShowHistory(false)} onRestore={restoreVersion} onExportVersion={(snap) => exportSheetToExcel({ ...sheet, name: `${sheet.name}_v${snap.version}`, settings: snap.settings, productTypes: snap.productTypes }, showToast)} />
      )}
    </div>
  );
}

const ghostBtn = { background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', height: 34, whiteSpace: 'nowrap' };

// ════════════════════════════════════════════════════════
//  Một khối Product Type = tiêu đề (Phôi) + bảng size
// ════════════════════════════════════════════════════════
function ProductTypeBlock({ pt, settings, onPT, onRemovePT, onAddSize, onUpdateSize, onRemoveSize, onUpdateCustomize, onAddCustomize, onRenameCustomize, onRemoveCustomize }) {
  const customs = pt.customizeInfos || [];
  const rows = (pt.sizes || []).map((sz) => ({ sz, calc: computeSizeRow(settings, pt, sz) }));

  return (
    <div style={{ border: `1px solid ${HC.border}`, borderRadius: 14, background: HC.surface, boxShadow: HC.shadow, overflow: 'hidden' }}>
      {/* header */}
      <div style={{ padding: '12px 16px', background: HC.surface2, borderBottom: `1px solid ${HC.border}`, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 15 }}>📊</span>
        <input value={pt.name} onChange={(e) => onPT(pt.id, { name: e.target.value })} placeholder="Tên Product Type (VD: T-shirt)"
          style={{ fontWeight: 800, fontSize: 14, color: HC.ink, border: `1px solid ${HC.border}`, borderRadius: 8, padding: '6px 10px', outline: 'none', background: HC.surface, minWidth: 180 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, borderRadius: 8, padding: '4px 10px' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: HC.orangeDark }}>Phôi ($)</span>
          <input type="number" step="0.01" value={pt.phoi ?? ''} onChange={(e) => onPT(pt.id, { phoi: e.target.value })} placeholder="0"
            style={{ width: 72, textAlign: 'right', border: `1px solid ${HC.orangeMid}`, borderRadius: 6, padding: '4px 7px', fontSize: 12, fontWeight: 700, color: HC.orangeDeep, background: HC.surface, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: HC.muted }}>{pt.sizes?.length || 0} size</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => onAddSize(pt.id)} style={miniBtn}>＋ Thêm Size</button>
          <button onClick={() => onAddCustomize(pt.id)} style={{ ...miniBtn, color: VIO.ink, borderColor: VIO.line, background: VIO.bg }}>＋ Add Customize Info</button>
          <button onClick={() => onRemovePT(pt.id)} style={{ ...miniBtn, color: HC.danger, borderColor: '#fbcfcf', background: '#fef2f2' }}>🗑</button>
        </div>
      </div>

      {/* table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 880, fontSize: 12 }}>
          <thead>
            <tr>
              <th colSpan={2 + customs.length + 1} style={{ ...th, background: IN.head, textAlign: 'left', paddingLeft: 12, borderTopLeftRadius: 0 }}>✏️ Nhập tay</th>
              <th colSpan={5} style={{ ...th, background: AUTO.head, textAlign: 'left', paddingLeft: 12 }}>📐 Tự động tính</th>
              <th style={{ ...th, background: HC.surface2, color: HC.muted, width: 40 }}></th>
            </tr>
            <tr>
              <th style={{ ...th, background: IN.head, textAlign: 'left' }}>Size</th>
              <th style={{ ...th, background: IN.head }}>Giá Size ($)</th>
              {customs.map((ci) => (
                <th key={ci.id} style={{ ...th, background: VIO.head, padding: '4px 5px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <input value={ci.name} onChange={(e) => onRenameCustomize(pt.id, ci.id, e.target.value)} placeholder="Tên (VD: Color: Black)"
                      style={{ width: 92, fontSize: 10.5, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', borderRadius: 5, padding: '3px 5px', outline: 'none' }} />
                    <span onClick={() => onRemoveCustomize(pt.id, ci.id)} title="Xoá cột" style={{ cursor: 'pointer', fontSize: 12, opacity: 0.85 }}>✕</span>
                  </div>
                </th>
              ))}
              <th style={{ ...th, background: IN.head }}>Item Cost ($)</th>
              <th style={{ ...th, background: AUTO.head, minWidth: 86 }}>Total Price</th>
              <th style={{ ...th, background: AUTO.head }}>AMZ Fee</th>
              <th style={{ ...th, background: AUTO.head }}>Profit</th>
              <th style={{ ...th, background: AUTO.head }}>Margin</th>
              <th style={{ ...th, background: AUTO.head }}>After Promo</th>
              <th style={{ ...th, background: HC.surface2, color: HC.muted }}>Xoá</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sz, calc }, i) => (
              <tr key={sz.id} style={{ background: i % 2 === 0 ? HC.surface : IN.bg }}>
                <td style={{ padding: '5px 6px', borderBottom: `1px solid ${HC.border}` }}>
                  <input value={sz.label} onChange={(e) => onUpdateSize(pt.id, sz.id, { label: e.target.value })} placeholder="S / M / L…"
                    style={{ ...cellInput, textAlign: 'left', fontWeight: 700 }} />
                </td>
                <td style={{ padding: '5px 6px', borderBottom: `1px solid ${HC.border}` }}>
                  <input type="number" step="0.01" value={sz.sizeAdd} onChange={(e) => onUpdateSize(pt.id, sz.id, { sizeAdd: e.target.value })} placeholder="0" style={cellInput} />
                </td>
                {customs.map((ci) => (
                  <td key={ci.id} style={{ padding: '5px 6px', borderBottom: `1px solid ${HC.border}`, background: VIO.bg }}>
                    <input type="number" step="0.01" value={sz.customize?.[ci.id] ?? ''} onChange={(e) => onUpdateCustomize(pt.id, sz.id, ci.id, e.target.value)} placeholder="0"
                      style={{ ...cellInput, borderColor: VIO.line }} />
                  </td>
                ))}
                <td style={{ padding: '5px 6px', borderBottom: `1px solid ${HC.border}` }}>
                  <input type="number" step="0.01" value={sz.itemCost} onChange={(e) => onUpdateSize(pt.id, sz.id, { itemCost: e.target.value })} placeholder="0" style={cellInput} />
                </td>

                {/* ── Auto zone (nổi bật) ── */}
                <td style={{ ...tdAuto, background: AUTO.bgStrong, fontWeight: 900, fontSize: 13.5, color: AUTO.total, borderLeft: `2px solid ${AUTO.line}` }}>{usd(calc.totalPrice)}</td>
                <td style={{ ...tdAuto, background: AUTO.bg, color: HC.muted }}>{usd(calc.amzFee)}</td>
                <td style={{ ...tdAuto, background: AUTO.bg, fontWeight: 900, fontSize: 13, color: calc.profit >= 0 ? AUTO.total : HC.danger }}>{usd(calc.profit)}</td>
                <td style={{ ...tdAuto, background: AUTO.bgStrong, fontWeight: 800, color: calc.margin >= 25 ? AUTO.total : calc.margin >= 0 ? HC.warning : HC.danger }}>{pct(calc.margin, 1)}</td>
                <td style={{ ...tdAuto, background: AUTO.bg, fontWeight: 700, color: calc.marginAfter >= 25 ? AUTO.total : calc.marginAfter >= 0 ? HC.warning : HC.danger }}>{pct(calc.marginAfter, 1)}</td>

                <td style={{ padding: '5px 6px', textAlign: 'center', borderBottom: `1px solid ${HC.border}` }}>
                  <button onClick={() => onRemoveSize(pt.id, sz.id)} disabled={(pt.sizes?.length || 0) <= 1}
                    style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #fbcfcf', background: (pt.sizes?.length || 0) <= 1 ? HC.surface2 : '#fef2f2', color: (pt.sizes?.length || 0) <= 1 ? HC.muted2 : HC.danger, cursor: (pt.sizes?.length || 0) <= 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const miniBtn = { fontSize: 11.5, fontWeight: 700, padding: '6px 11px', borderRadius: 8, border: `1px solid ${HC.borderStrong}`, background: HC.surface, color: HC.muted, cursor: 'pointer', whiteSpace: 'nowrap' };

// ════════════════════════════════════════════════════════
//  History panel
// ════════════════════════════════════════════════════════
function HistoryPanel({ sheet, onClose, onRestore, onExportVersion }) {
  const hist = sheet.history || [];
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,18,0,0.5)', zIndex: 2100, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 94vw)', height: '100%', background: HC.surface, boxShadow: HC.shadowStrong, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontWeight: 800, fontSize: 14 }}>🕘 Lịch sử phiên bản</div><div style={{ fontSize: 11, opacity: 0.9 }}>{sheet.name} · {hist.length} bản đã lưu</div></div>
          <button onClick={onClose} style={{ ...ghostBtn, width: 32, padding: 0 }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {hist.length === 0 && <div style={{ textAlign: 'center', color: HC.muted, padding: 40 }}>Chưa có phiên bản nào. Bấm "Lưu bảng tính giá" để tạo mốc so sánh.</div>}
          {hist.map((snap, i) => (
            <div key={snap.savedAt + i} style={{ border: `1px solid ${i === 0 ? HC.orangeMid : HC.border}`, borderRadius: 12, padding: '12px 14px', background: i === 0 ? HC.orangeLight : HC.surface2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, color: HC.ink }}>v{snap.version}{i === 0 && ' · mới nhất'}</span>
                  <span style={{ fontSize: 11, color: HC.muted, fontVariantNumeric: 'tabular-nums' }}>{new Date(snap.savedAt).toLocaleString('vi-VN')}</span>
                </div>
                <span style={{ fontSize: 11, color: HC.muted }}>{snap.savedBy}</span>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: 12, color: HC.ink2, fontVariantNumeric: 'tabular-nums' }}>
                <span>Avg margin <b style={{ color: AUTO.total }}>{snap.avgMargin != null ? pct(snap.avgMargin, 1) : '—'}</b></span>
                <span>Giá <b>{snap.minPrice != null ? `${usd(snap.minPrice)}–${usd(snap.maxPrice)}` : '—'}</b></span>
                <span>{snap.count} size</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button onClick={() => onExportVersion(snap)} style={miniBtn}>⬇ Export</button>
                {i !== 0 && <button onClick={() => onRestore(snap)} style={{ ...miniBtn, color: HC.orangeDark, borderColor: HC.orangeMid, background: HC.orangeLight }}>↩ Khôi phục</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
