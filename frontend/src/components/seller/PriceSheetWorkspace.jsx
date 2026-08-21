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
  summarizeSheet, num, pct,
  makeSize, makeProductType, uid,
} from '../../utils/pricingEngine';
import { loadVendorLibraryIndex, findLibraryEntry, findLibraryRecord } from '../../utils/vendorLibraryIndex';
import { resolveSheet, baseSizesOf as baseSizesOfLib, libSizesOf } from '../../utils/resolveSheet';
import { exportSheetToExcel } from '../../utils/sheetExport';

import { PS, marginTone } from './pricesheet/tokens';
import { PsStyles, Btn, IconBtn, Badge, ConfirmDialog, ModalShell } from './pricesheet/primitives';
import PriceSettingPanel from './pricesheet/PriceSettingPanel';
import ProductTypeCard from './pricesheet/ProductTypeCard';
import AddCustomizeInfoModal from './pricesheet/AddCustomizeInfoModal';
import AddProductTypeModal from './pricesheet/AddProductTypeModal';
import HistoryPanel from './pricesheet/HistoryPanel';
import SummaryFooter from './pricesheet/SummaryFooter';

// ═══ Export ra Excel — logic dựng dữ liệu nằm ở utils/sheetExport.js (T0) ═══
// Re-export để SetupPriceSection giữ nguyên đường import cũ.
export { exportSheetToExcel };

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
  // Xung đột phiên bản (mục 16): { updatedBy, updatedAt, currentVersion, current }
  const [conflict, setConflict] = useState(null);

  // Dirty-check: so state người dùng sửa được với snapshot lúc mở / lúc lưu.
  const snapshotOf = (n, st, pts) => JSON.stringify({ n, st, pts });
  const savedSnapRef = useRef(null);
  if (savedSnapRef.current == null) savedSnapRef.current = snapshotOf(name, settings, productTypes);
  const dirty = snapshotOf(name, settings, productTypes) !== savedSnapRef.current;

  useEffect(() => {
    loadVendorLibraryIndex(sheet.project || '', !sheet.project).then(setLibIndex).catch(console.error);
  }, [sheet.project]);

  const draftSheet = useMemo(
    () => resolveSheet({ ...sheet, name, settings, productTypes }, libIndex),
    [sheet, name, settings, productTypes, libIndex]
  );
  const summary = useMemo(() => summarizeSheet(draftSheet), [draftSheet]);

  // ── mutations (GIỮ NGUYÊN) ──
  const setSetting = (k, v) => setSettings((p) => ({ ...p, [k]: v }));
  const patchPT = (ptId, patch) => setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, ...patch } : pt)));
  const toggleShown = (ptId) => setProductTypes((p) => p.map((pt) => (pt.id === ptId ? { ...pt, shown: !pt.shown } : pt)));
  const addPT = () => setProductTypes((p) => [...p, makeProductType(`Product Type ${p.length + 1}`)]);
  // Thêm product type bằng cách CHỌN MỘT RECORD cụ thể từ thư viện vendor
  // (mục 03/04) — record đã gồm sẵn vendor + file nguồn, gắn thẳng vào
  // `pt.libRef` để resolveSheet tra đúng record đó, không tra lại theo tên.
  // Nhờ vậy 2 vendor cùng tên phôi thêm được thành 2 block riêng, không đè nhau.
  const addPTFromLibrary = (record) => {
    const pt = {
      ...makeProductType(record.productType), shown: true,
      libRef: { recordKey: record.recordKey, vendorCode: record.vendorCode, filename: record.filename },
    };
    // Nạp sẵn size của thư viện vào state (giống luồng tạo bảng ở SetupPriceSection)
    // — nếu để mặc định 1 size rỗng thì các dòng size hiển thị chỉ là dữ liệu dựng
    // tạm của draftSheet, không có trong state để sửa.
    if (record?.sizes?.length) pt.sizes = libSizesOf(pt, record);
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
  // Sizes dùng làm gốc khi ghi — logic ở utils/resolveSheet.js (T0), gắn libIndex hiện tại.
  const baseSizesOf = (pt) => baseSizesOfLib(pt, libIndex);
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
  // `force` = người dùng đã xem cảnh báo xung đột và cố ý ghi đè (mục 16).
  const handleSave = async (force = false) => {
    const snap = {
      // Lịch sử không còn đi kèm bảng (mục 17) — số bản đọc từ `historyCount`
      // của server; server mới cũng tự đánh lại số version khi ghi.
      version: (sheet.historyCount ?? sheet.history?.length ?? 0) + 1,
      savedAt: new Date().toISOString(),
      savedBy: (() => { try { return JSON.parse(localStorage.getItem('user') || '{}').name || 'Seller'; } catch { return 'Seller'; } })(),
      avgMargin: summary.avgMargin, minPrice: summary.minPrice, maxPrice: summary.maxPrice, count: summary.count,
      settings: draftSheet.settings, productTypes: draftSheet.productTypes,
    };
    const history = [snap, ...(sheet.history || [])].slice(0, 20);
    setSaving(true);
    try {
      await Promise.resolve(onSave(
        { ...draftSheet, history, updatedAt: new Date().toISOString() },
        { force }
      ));
      savedSnapRef.current = snapshotOf(name, settings, productTypes);
      setConflict(null);
      showToast?.('success', 'Đã lưu', `${name} · phiên bản v${snap.version}`);
    } catch (err) {
      // 409: có người khác đã lưu bảng này sau lúc ta mở nó. TUYỆT ĐỐI không
      // ghi đè im lặng — trước đây server là last-write-wins nên toàn bộ thay
      // đổi của người kia biến mất mà không ai biết.
      if (err?.response?.status === 409) {
        const info = err.response.data || {};
        setConflict({
          updatedBy: info.updatedBy || 'người khác',
          updatedAt: info.updatedAt || null,
          currentVersion: info.currentVersion,
          current: info.current || null,
        });
      } else {
        showToast?.('error', 'Lưu thất bại', err?.message || 'Không lưu được lên server.');
      }
    } finally {
      setSaving(false);
    }
  };

  /** Bỏ thay đổi đang gõ, lấy bản mới nhất trên server. */
  const takeServerVersion = () => {
    const srv = conflict?.current;
    if (!srv) { onClose?.(); return; }
    setName(srv.name || '');
    setSettings({ ...srv.settings });
    setProductTypes((srv.productTypes || []).map((pt) => ({ ...pt, shown: pt.shown !== false })));
    savedSnapRef.current = snapshotOf(srv.name || '', srv.settings, srv.productTypes || []);
    setConflict(null);
    showToast?.('success', 'Đã tải lại', `Đang xem bản v${conflict.currentVersion} của ${conflict.updatedBy}`);
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
              }}>{sheet.historyCount ?? sheet.history?.length ?? 0}</span>
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
            // PT gắn `libRef` (mục 03/04) tra ĐÚNG record đã chốt, không tra lại
            // theo tên — 2 block cùng tên phôi mới không lấy nhầm vendor của nhau.
            const libEntry = pt.libRef?.recordKey
              ? findLibraryRecord(libIndex, pt.libRef.recordKey)
              : findLibraryEntry(libIndex, pt.name);
            return (
              <ProductTypeCard key={pt.id} pt={pt} settings={settings} libEntry={libEntry}
                onPT={patchPT} onRemovePT={removePT}
                onAddSize={addSize} onUpdateSize={updateSize} onRemoveSize={removeSize} onUpdateCustomize={updateSizeCustomize}
                onAddCustomize={openAddCustomize} onRenameCustomize={renameCustomize} onRemoveCustomize={removeCustomize} />
            );
          })}
        </div>

        {/* ── Footer — spec §3.7 ── */}
        <SummaryFooter summary={summary} dirty={dirty} saving={saving} onCancel={onClose} onSave={() => handleSave(false)} />
      </div>

      {/* ── Xung đột phiên bản (mục 16) ──────────────────────────────────────
          Hiện khi server trả 409: có người khác đã lưu bảng này sau lúc ta mở.
          Ba lựa chọn đều tường minh — không có nhánh nào âm thầm mất dữ liệu. */}
      {conflict && (
        <ModalShell title="⚠ Bảng này vừa được người khác cập nhật" width={460} zIndex={2500}
          onClose={() => setConflict(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setConflict(null)}>Để tôi xem lại</Btn>
            <Btn variant="outline" onClick={takeServerVersion}>Tải bản mới</Btn>
            <Btn variant="primary" disabled={saving}
              style={{ background: PS.negative, borderColor: PS.negative }}
              onClick={() => handleSave(true)}>
              {saving ? 'Đang ghi đè…' : 'Ghi đè bằng bản của tôi'}
            </Btn>
          </>}>
          <div style={{ padding: 16, fontSize: 13.5, color: PS.textSecondary, lineHeight: 1.7 }}>
            <p style={{ margin: '0 0 12px' }}>
              <b style={{ color: PS.text }}>{conflict.updatedBy}</b> đã lưu bảng này
              {conflict.updatedAt ? ` lúc ${new Date(conflict.updatedAt).toLocaleString('vi-VN')}` : ''}
              {conflict.currentVersion ? ` (phiên bản v${conflict.currentVersion})` : ''}.
            </p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li><b>Tải bản mới</b> — bỏ thay đổi đang gõ, lấy bản trên server.</li>
              <li><b>Ghi đè</b> — giữ bản của bạn. Bản của {conflict.updatedBy} vẫn nằm trong Lịch sử tính giá, không mất hẳn.</li>
              <li><b>Để tôi xem lại</b> — đóng hộp thoại, chưa lưu gì.</li>
            </ul>
          </div>
        </ModalShell>
      )}

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
          onPick={addPTFromLibrary}
          onManual={() => { addPT(); setShowAddPTDialog(false); }}
          onClose={() => setShowAddPTDialog(false)}
        />
      )}
    </div>
  );
}
