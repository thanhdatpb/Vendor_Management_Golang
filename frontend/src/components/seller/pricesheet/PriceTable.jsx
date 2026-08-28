// ════════════════════════════════════════════════════════
//  PRICE TABLE — spec §3.5. Bảng size của 1 Product Type.
//
//  PR-A1 (2026-08): bỏ hành vi "kéo dọc = xoá" — đây từng là bug mất dữ liệu
//  thật (Seller kéo chuột theo thói quen Excel/Google Sheet để copy giá, hệ
//  thống lại hiểu là xoá, không hoàn tác được). Kéo giờ CHỈ chọn vùng; mọi
//  thay đổi hàng loạt đi qua thanh hành động nổi hoặc phím tắt, và luôn hoàn
//  tác được (Ctrl+Z / Ctrl+Shift+Z, tối đa 20 bước — xem pricesheet/fillDown.js).
//  Giữ nguyên 100%: bulk-paste TSV từ Google Sheet, onWheel blur.
//
//  PR-A4 (mục 02/05/06): Product Type lấy từ thư viện KHÔNG còn bị khoá cấu
//  trúc. Seller sửa được tên size (ghi vào `overrides.label`), xoá được size
//  dư, tick "bỏ khỏi tổng hợp", và đổi được thứ tự dòng / thứ tự cột Customize.
//  Mọi thao tác chỉ sống trong bảng tính giá — thư viện Vendor không bị ghi.
//
//  ⚠ Kéo để SẮP XẾP phải đi qua tay cầm ⠿ riêng ở cột đầu. Ô "Giá Size" đã
//  dùng mousedown cho việc chọn vùng (PR-A1); bắt thêm sự kiện kéo trên cả
//  dòng sẽ đập vỡ đúng tính năng vừa sửa xong.
// ════════════════════════════════════════════════════════
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { PS, marginTone, toneColor } from './tokens';
import { Dot, IconBtn, Btn, ConfirmDialog } from './primitives';
import { computeSizeRow, usd, pct, num } from '../../../utils/pricingEngine';
import { normalizeKey } from '../../../utils/vendorLibraryIndex';
import {
  selectionIds, computeFillDown, computeFillRight, computeClear, computeUndoPatches, pushUndo,
} from './fillDown';

// ─── Bulk paste giá size (GIỮ NGUYÊN logic cũ) ───────────
// Hỗ trợ dán cả vùng nhiều cột từ sheet (TSV) hoặc 1 dòng nhiều giá
// cách nhau bằng dấu phẩy.
export function parsePastedPrices(rawText) {
  const entries = [];
  rawText.split(/\r\n|\r|\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.includes('\t')) {
      const cells = trimmed.split('\t').map((c) => c.trim()).filter((c) => c !== '');
      if (cells.length >= 2) {
        const price = cells[cells.length - 1];
        if (/\d/.test(price)) entries.push({ label: cells[0], price });
      } else if (cells.length === 1 && /\d/.test(cells[0])) {
        entries.push({ price: cells[0] });
      }
    } else if (trimmed.includes(',')) {
      trimmed.split(',').map((c) => c.trim()).filter((c) => c !== '' && /\d/.test(c))
        .forEach((v) => entries.push({ price: v }));
    } else if (/\d/.test(trimmed)) {
      entries.push({ price: trimmed });
    }
  });
  return entries;
}

// Áp entries vào size: ưu tiên khớp tên Size, phần dư gán tuần tự (GIỮ NGUYÊN).
export function distributeSizeAddValues(pt, entries, startSizeId, onUpdateSize) {
  const sizes = pt.sizes || [];
  if (!sizes.length || !entries.length) return 0;
  const usedIds = new Set();
  const leftover = [];
  let applied = 0;

  entries.forEach((entry) => {
    if (entry.label) {
      const match = sizes.find((s) => !usedIds.has(s.id) && normalizeKey(s.label) === normalizeKey(entry.label));
      if (match) {
        usedIds.add(match.id);
        onUpdateSize(pt.id, match.id, { sizeAdd: entry.price });
        applied++;
        return;
      }
    }
    leftover.push(entry);
  });

  if (leftover.length) {
    const startIdx = startSizeId ? Math.max(0, sizes.findIndex((s) => s.id === startSizeId)) : 0;
    let cursor = startIdx;
    for (const entry of leftover) {
      while (cursor < sizes.length && usedIds.has(sizes[cursor].id)) cursor++;
      if (cursor >= sizes.length) break;
      onUpdateSize(pt.id, sizes[cursor].id, { sizeAdd: entry.price });
      usedIds.add(sizes[cursor].id);
      applied++;
      cursor++;
    }
  }
  return applied;
}

/** Phần tử đang giữ focus có phải ô nhập liệu không — dùng để không cướp phím
 * tắt của người dùng khi họ đang gõ ở nơi khác (VD sửa tên Product Type). */
function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

/** Dòng đã có dữ liệu người dùng nhập → xoá phải hỏi lại (mục 02). */
function sizeRowHasData(sz) {
  const filled = (v) => v !== '' && v !== null && v !== undefined;
  return filled(sz?.sizeAdd) || Object.values(sz?.customize || {}).some(filled);
}

// ─── Styles dùng chung — header theo 2 vùng màu ──────────
const thTier1Base = {
  padding: '7px 12px', fontSize: 11, fontWeight: 650, letterSpacing: '0.08em',
  textTransform: 'uppercase', textAlign: 'left', whiteSpace: 'nowrap',
};
// Tầng 1 — vùng NHẬP (blue)
const thTier1In = {
  ...thTier1Base, color: PS.inText, background: PS.inZone,
  borderBottom: `1px solid ${PS.inBorder}`, borderLeft: `2px solid ${PS.inBorder}`,
};
// Tầng 1 — vùng KẾT QUẢ (emerald)
const thTier1Out = {
  ...thTier1Base, color: PS.outText, background: PS.outZone,
  borderBottom: `1px solid ${PS.outBorder}`,
};
const thTier2Base = {
  padding: '7px 10px', fontSize: 11, fontWeight: 650, letterSpacing: '0.05em',
  textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap',
};
// Tầng 2 — tên cột vùng NHẬP / vùng KẾT QUẢ (85% để đạt AA thay vì /70)
const thTier2In = {
  ...thTier2Base, color: 'rgba(29,78,216,0.85)', background: PS.inBg,
  borderBottom: `1.5px solid ${PS.inBorder}`,
};
const thTier2Out = {
  ...thTier2Base, color: 'rgba(4,120,87,0.85)', background: PS.outBg,
  borderBottom: `1.5px solid ${PS.outBorder}`,
};

/** Chấm tròn 6px đứng trước label nhóm cột. */
function ZoneDot({ color }) {
  return <span aria-hidden style={{
    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
    background: color, marginRight: 6, verticalAlign: 'middle',
  }} />;
}

function MarginCell({ value }) {
  const tone = marginTone(value);
  return (
    <span style={{ fontWeight: 650, color: toneColor[tone] }}>
      <Dot tone={tone} />{pct(value, 1)}
    </span>
  );
}

/** Thanh hành động nổi khi có vùng chọn — spec mục 01 + Milestone P. */
function SelectionToolbar({ count, onFillDown, onClear, onDismiss }) {
  return (
    <div data-testid="ps-selection-toolbar" role="toolbar" aria-label="Hành động cho vùng đã chọn"
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', margin: '0 0 8px',
        borderRadius: 10, background: PS.brandSubtle, border: `1px solid ${PS.brandBorder}`,
      }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: PS.brandDeep }}>{count} ô đã chọn</span>
      <Btn size="sm" variant="primary" onClick={onFillDown}>⬇ Fill Down</Btn>
      <Btn size="sm" variant="outline" onClick={onClear}>Xoá</Btn>
      <Btn size="sm" variant="ghost" onClick={onDismiss}>Bỏ chọn</Btn>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: PS.textMuted }}>
        Ctrl+D điền xuống · Ctrl+R điền phải · Delete xoá · Ctrl+Z hoàn tác
      </span>
    </div>
  );
}

/** Nút nhỏ dùng cho ▲ ▼ ◀ ▶ của thao tác sắp xếp. */
const arrowBtnStyle = {
  width: 18, height: 16, padding: 0, lineHeight: 1, fontSize: 9,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: `1px solid ${PS.border}`, borderRadius: 4, background: PS.bgSurface,
  color: PS.textSecondary, cursor: 'pointer', flexShrink: 0,
};

/**
 * Tay cầm kéo-sắp-xếp (mục 05/06). Ba đường vào cho cùng một kết quả: kéo bằng
 * chuột, nút mũi tên, và Alt+mũi tên khi tay cầm đang giữ focus. Đặt riêng ở
 * cột đầu / đầu ô header để không đụng thao tác chọn vùng ở cột "Giá Size".
 */
function DragHandle({ label, onDragStart, onKeyMove }) {
  return (
    <span
      draggable
      role="button"
      tabIndex={0}
      aria-label={label}
      title={`${label} — kéo, hoặc Alt + mũi tên khi đang chọn tay cầm này`}
      onDragStart={onDragStart}
      onKeyDown={onKeyMove}
      style={{
        cursor: 'grab', userSelect: 'none', color: PS.textMuted,
        fontSize: 13, lineHeight: 1, padding: '2px 3px', borderRadius: 4, flexShrink: 0,
      }}
    >⠿</span>
  );
}

export default function PriceTable({
  // `libEntry` không còn quyết định cột nào hiện nữa (PR-A4): mọi cột thao tác
  // đều mở cho cả hai loại Product Type, khác biệt nằm ở từng DÒNG (`sz.isLib`).
  pt, settings, onUpdateSize, onRemoveSize, onUpdateCustomize,
  onRenameCustomize, onRemoveCustomize,
  onMoveSize = () => {}, onReorderSizes = () => {},
  onMoveCustomize = () => {}, onReorderCustomize = () => {},
}) {
  const customs = pt.customizeInfos || [];
  const sizes = useMemo(() => pt.sizes || [], [pt.sizes]);
  const rows = useMemo(() => sizes.map((sz) => ({ sz, calc: computeSizeRow(settings, pt, sz) })), [sizes, settings, pt]);

  // ── Vùng chọn qua cột "Giá Size" (PR-A1) ──
  // Kéo CHỈ đánh dấu vùng — không còn nhánh nào ghi giá trị khi thả chuột.
  const [selection, setSelection] = useState(null); // { anchor, focus } theo chỉ số dòng
  const draggingRef = useRef(false);

  const onPriceMouseDown = (idx) => {
    draggingRef.current = true;
    setSelection({ anchor: idx, focus: idx });
  };
  const onPriceMouseEnter = (idx, e) => {
    if (!draggingRef.current) return;
    if (e.buttons !== 1) { draggingRef.current = false; return; }
    setSelection((sel) => (sel ? { ...sel, focus: idx } : { anchor: idx, focus: idx }));
    // Kéo chuột dễ vô tình bôi đen chữ của trang (native text selection) và để
    // lại focus trên ô vừa rời qua — dọn cả hai để trải nghiệm giống bảng tính.
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.getSelection?.()?.removeAllRanges?.();
  };
  useEffect(() => {
    const finish = () => { draggingRef.current = false; };
    window.addEventListener('mouseup', finish);
    return () => window.removeEventListener('mouseup', finish);
  }, []);

  const selectedIds = useMemo(
    () => (selection ? selectionIds(sizes, selection.anchor, selection.focus) : []),
    [selection, sizes]
  );
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const clearSelection = useCallback(() => setSelection(null), []);

  // ── Undo / Redo cho thao tác hàng loạt (Ctrl+Z / Ctrl+Shift+Z, tối đa 20 bước) ──
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const applyBulk = useCallback((patches) => {
    if (!patches.length) return;
    const undo = computeUndoPatches(sizes, patches);
    setUndoStack((s) => pushUndo(s, undo));
    setRedoStack([]); // hành động mới làm redo cũ không còn hợp lệ
    patches.forEach(({ id, patch }) => onUpdateSize(pt.id, id, patch));
  }, [sizes, pt.id, onUpdateSize]);

  const runFillDown = useCallback(() => applyBulk(computeFillDown(sizes, selectedIds, 'sizeAdd')), [applyBulk, sizes, selectedIds]);
  const runClear = useCallback(() => applyBulk(computeClear(sizes, selectedIds, 'sizeAdd')), [applyBulk, sizes, selectedIds]);

  // ⚠ KHÔNG gọi onUpdateSize (setState của component cha) bên trong hàm
  // updater của setUndoStack/setRedoStack — React coi updater phải THUẦN,
  // gọi side-effect trong đó gây cảnh báo "Cannot update a component while
  // rendering a different component" và có thể chạy 2 lần dưới StrictMode.
  // Đọc undoStack/redoStack trực tiếp từ closure, side-effect nằm NGOÀI updater.
  const undo = useCallback(() => {
    if (!undoStack.length) return;
    const [step, ...rest] = undoStack;
    const redoStep = computeUndoPatches(sizes, step); // nghịch đảo của nghịch đảo = trạng thái hiện tại
    setRedoStack((r) => pushUndo(r, redoStep));
    setUndoStack(rest);
    step.forEach(({ id, patch }) => onUpdateSize(pt.id, id, patch));
  }, [undoStack, sizes, pt.id, onUpdateSize]);

  const redo = useCallback(() => {
    if (!redoStack.length) return;
    const [step, ...rest] = redoStack;
    const undoStep = computeUndoPatches(sizes, step);
    setUndoStack((u) => pushUndo(u, undoStep));
    setRedoStack(rest);
    step.forEach(({ id, patch }) => onUpdateSize(pt.id, id, patch));
  }, [redoStack, sizes, pt.id, onUpdateSize]);

  // ── Phím tắt kiểu bảng tính (Milestone P) — chỉ bắt khi không đang gõ nơi khác ──
  useEffect(() => {
    const onKeyDown = (e) => {
      if (isTypingTarget(document.activeElement)) return;
      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        if (!undoStack.length) return;
        e.preventDefault();
        undo();
        return;
      }
      if (ctrl && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        if (!redoStack.length) return;
        e.preventDefault();
        redo();
        return;
      }
      if (!selection || !selectedIds.length) return; // các thao tác dưới đây cần vùng chọn
      if (ctrl && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        runFillDown();
        return;
      }
      if (ctrl && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        applyBulk(computeFillRight(sizes.find((s) => s.id === selectedIds[0]), ['sizeAdd']));
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        runClear();
        return;
      }
      if (e.key === 'Escape') {
        clearSelection();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, selectedIds, undoStack, redoStack, undo, redo, runFillDown, runClear, applyBulk, sizes, clearSelection]);

  // ── Sắp xếp dòng size & cột customize (mục 05/06) ──
  // Kéo bằng HTML5 drag: tay cầm là nguồn kéo, cả dòng / ô header là đích thả.
  const dragSizeId = useRef(null);
  const dragCiId = useRef(null);

  const onSizeDrop = (toIndex) => {
    const id = dragSizeId.current;
    dragSizeId.current = null;
    if (id) onReorderSizes(pt.id, id, toIndex);
  };
  const onCustomizeDrop = (toIndex) => {
    const id = dragCiId.current;
    dragCiId.current = null;
    if (id) onReorderCustomize(pt.id, id, toIndex);
  };
  // Alt+↑/↓ (dòng) và Alt+←/→ (cột) — React giữ nguyên node DOM khi đổi thứ tự
  // theo key nên focus ở lại đúng tay cầm vừa di chuyển, gõ liên tiếp được.
  const sizeKeyMove = (szId) => (e) => {
    if (!e.altKey) return;
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    onMoveSize(pt.id, szId, delta);
  };
  const customizeKeyMove = (ciId) => (e) => {
    if (!e.altKey) return;
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!delta) return;
    e.preventDefault();
    onMoveCustomize(pt.id, ciId, delta);
  };

  // ── Xoá dòng: hỏi lại khi dòng đã có dữ liệu (mục 02) ──
  const [confirmDeleteSz, setConfirmDeleteSz] = useState(null);
  const requestRemoveSize = (sz) => {
    if (sizeRowHasData(sz)) setConfirmDeleteSz(sz);
    else onRemoveSize(pt.id, sz.id);
  };

  // Tên size: dòng thư viện ghi vào `overrides.label` để còn khôi phục được,
  // dòng tự thêm ghi thẳng vào `label`.
  const changeLabel = (sz, value) => {
    if (sz.isLib) onUpdateSize(pt.id, sz.id, { overrides: { ...(sz.overrides || {}), label: value } });
    else onUpdateSize(pt.id, sz.id, { label: value });
  };

  // Số cột 2 nhóm. Nhóm computed = Coupon + Total + AMZ + Profit + Margin + AfterPromo = 6.
  const nInput = 3 + customs.length;   // Size · Giá Size · Item Cost + các cột customize
  const nAuto = 6;
  const canDelete = sizes.length > 1;

  return (
    <div>
      {selection && selectedIds.length > 0 && (
        <SelectionToolbar count={selectedIds.length} onFillDown={runFillDown} onClear={runClear} onDismiss={clearSelection} />
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="ps-table" style={{ minWidth: 980 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            {/* Tầng 1: nhóm cột — tint theo vùng + chấm tròn nhận diện */}
            <tr>
              <th style={{ ...thTier1In, width: 62 }} aria-label="Thứ tự dòng" />
              <th colSpan={nInput} style={thTier1In}>
                <ZoneDot color={PS.inDot} />Thông tin giá cần nhập
              </th>
              <th colSpan={nAuto} className="ps-divider-l" style={thTier1Out}>
                <ZoneDot color={PS.outDot} />Giá tính được
              </th>
              <th colSpan={2} style={{ ...thTier1Out, width: 110 }} aria-label="Thao tác" />
            </tr>
            {/* Tầng 2: tên cột */}
            <tr>
              <th style={{ ...thTier2In, textAlign: 'center', width: 62 }}
                title="Kéo tay cầm ⠿ hoặc dùng nút ▲ ▼ để đổi thứ tự size">Thứ tự</th>
              <th className="ps-sticky-col" style={{ ...thTier2In, textAlign: 'left', minWidth: 76, zIndex: 3, left: 0, position: 'sticky' }}>Size</th>
              <th style={{ ...thTier2In, minWidth: 96 }}>Giá Size ($)</th>
              {customs.map((ci, ciIdx) => (
                <th key={ci.id} style={{ ...thTier2In, minWidth: 132, padding: '4px 6px' }}
                  onDragOver={(e) => { if (dragCiId.current) e.preventDefault(); }}
                  onDrop={() => onCustomizeDrop(ciIdx)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <DragHandle label={`Đổi thứ tự cột ${ci.name || 'customize'}`}
                      onDragStart={() => { dragCiId.current = ci.id; }}
                      onKeyMove={customizeKeyMove(ci.id)} />
                    <input value={ci.name} onChange={(e) => onRenameCustomize(pt.id, ci.id, e.target.value)}
                      placeholder="Tên (VD: Color: Black)" aria-label="Tên cột customize"
                      className="ps-input" style={{ fontSize: 11, fontWeight: 650, padding: '4px 6px', textTransform: 'none' }} />
                    <button type="button" aria-label={`Chuyển cột ${ci.name || 'customize'} sang trái`}
                      title="Sang trái (Alt+←)" disabled={ciIdx === 0}
                      onClick={() => onMoveCustomize(pt.id, ci.id, -1)}
                      style={{ ...arrowBtnStyle, opacity: ciIdx === 0 ? 0.35 : 1 }}>◀</button>
                    <button type="button" aria-label={`Chuyển cột ${ci.name || 'customize'} sang phải`}
                      title="Sang phải (Alt+→)" disabled={ciIdx === customs.length - 1}
                      onClick={() => onMoveCustomize(pt.id, ci.id, 1)}
                      style={{ ...arrowBtnStyle, opacity: ciIdx === customs.length - 1 ? 0.35 : 1 }}>▶</button>
                    <IconBtn variant="dangerghost" title="Xoá cột" onClick={() => onRemoveCustomize(pt.id, ci.id)}
                      style={{ width: 22, height: 22, fontSize: 11, flexShrink: 0 }}>✕</IconBtn>
                  </div>
                </th>
              ))}
              <th style={{ ...thTier2In, minWidth: 90 }}>Item Cost ($)</th>

              <th className="ps-divider-l" style={{ ...thTier2Out, minWidth: 90 }}>Coupon ($)</th>
              <th style={{ ...thTier2Out, minWidth: 96 }}>Total Price</th>
              <th style={{ ...thTier2Out, minWidth: 80 }}>AMZ Fee</th>
              <th style={{ ...thTier2Out, minWidth: 84 }}>Profit</th>
              <th style={{ ...thTier2Out, minWidth: 84 }}>Margin</th>
              <th style={{ ...thTier2Out, minWidth: 96 }}>After Promo</th>
              <th style={{ ...thTier2Out, textAlign: 'center', minWidth: 74 }}
                title="Dòng được tick sẽ KHÔNG tính vào Avg Margin / khoảng giá của bảng, nhưng vẫn hiện ở đây và trong file export.">Bỏ tổng hợp</th>
              <th style={{ ...thTier2Out, textAlign: 'center' }}>Xoá</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ sz, calc }, i) => {
              const selected = selectedIdSet.has(sz.id);
              return (
                <tr key={sz.id} className="ps-tr"
                  onDragOver={(e) => { if (dragSizeId.current) e.preventDefault(); }}
                  onDrop={() => onSizeDrop(i)}
                  style={sz.excluded ? { opacity: 0.62 } : undefined}>
                  {/* Tay cầm sắp xếp — cột riêng, KHÔNG đụng thao tác chọn vùng */}
                  <td className="ps-cell" style={{ width: 62 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <DragHandle label={`Đổi thứ tự size ${sz.label || i + 1}`}
                        onDragStart={() => { dragSizeId.current = sz.id; }}
                        onKeyMove={sizeKeyMove(sz.id)} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <button type="button" aria-label={`Chuyển size ${sz.label || i + 1} lên trên`}
                          title="Lên trên (Alt+↑)" disabled={i === 0}
                          onClick={() => onMoveSize(pt.id, sz.id, -1)}
                          style={{ ...arrowBtnStyle, opacity: i === 0 ? 0.35 : 1 }}>▲</button>
                        <button type="button" aria-label={`Chuyển size ${sz.label || i + 1} xuống dưới`}
                          title="Xuống dưới (Alt+↓)" disabled={i === rows.length - 1}
                          onClick={() => onMoveSize(pt.id, sz.id, 1)}
                          style={{ ...arrowBtnStyle, opacity: i === rows.length - 1 ? 0.35 : 1 }}>▼</button>
                      </div>
                    </div>
                  </td>

                  {/* Size — sticky trái, semibold. Dòng thư viện sửa được tên (ghi
                      vào overrides.label), nút ↺ trên card lấy lại tên gốc. */}
                  <td className="ps-cell ps-sticky-col" style={{ minWidth: 76 }}>
                    <input value={sz.label} onChange={(e) => changeLabel(sz, e.target.value)}
                      placeholder="S / M / L…" aria-label="Tên size"
                      title={sz.isLib ? 'Tên size của thư viện — sửa ở đây chỉ đổi trong bảng tính giá này' : undefined}
                      className="ps-input" style={{ fontWeight: 650, padding: '5px 8px', fontSize: 12.5 }} />
                  </td>

                  {/* Giá Size — Ô NHẬP NỔI BẬT NHẤT (spec §3.5). Kéo qua nhiều ô CHỈ chọn
                      vùng (tô sáng) — thả chuột không ghi gì. Mọi thay đổi hàng loạt đi
                      qua thanh hành động phía trên hoặc phím tắt, luôn hoàn tác được. */}
                  <td className="ps-cell"
                    onMouseDown={() => onPriceMouseDown(i)} onMouseEnter={(e) => onPriceMouseEnter(i, e)}
                    style={{ background: selected ? PS.brandSubtle : undefined }}>
                    <input type="number" step="0.01" value={sz.sizeAdd} aria-label={`Giá size ${sz.label || i + 1}`}
                      onChange={(e) => onUpdateSize(pt.id, sz.id, { sizeAdd: e.target.value })}
                      onWheel={(e) => e.target.blur()}
                      onPaste={(e) => {
                        const raw = e.clipboardData.getData('text');
                        const entries = parsePastedPrices(raw);
                        if (entries.length > 1) {
                          e.preventDefault();
                          distributeSizeAddValues(pt, entries, sz.id, onUpdateSize);
                        }
                      }}
                      title="Kéo dọc qua nhiều ô để CHỌN VÙNG (không xoá) — dùng Fill Down hoặc Ctrl+D để điền. Dán nhiều giá cùng lúc cũng được."
                      placeholder="0"
                      className={`ps-input ps-input--num${num(sz.sizeAdd) < 0 ? ' ps-input--invalid' : ''}`}
                      style={selected ? { background: 'transparent', borderColor: PS.brand } : undefined} />
                  </td>

                  {/* Customize inputs */}
                  {customs.map((ci) => (
                    <td key={ci.id} className="ps-cell">
                      <input type="number" step="0.01" value={sz.customize?.[ci.id] ?? ''} aria-label={`${ci.name || 'Customize'} — size ${sz.label || i + 1}`}
                        onChange={(e) => onUpdateCustomize(pt.id, sz.id, ci.id, e.target.value)}
                        onWheel={(e) => e.target.blur()} placeholder="0"
                        className="ps-input ps-input--num" style={{ padding: '5px 8px', fontSize: 12.5 }} />
                    </td>
                  ))}

                  {/* Item Cost — dòng thư viện lấy giá vốn từ thư viện (chỉ đọc), dòng
                      Seller tự thêm phải nhập tay, nếu không Profit của dòng đó sai. */}
                  <td className="ps-cell">
                    <input type="number" step="0.01" value={sz.itemCost ?? ''} aria-label={`Item cost — size ${sz.label || i + 1}`}
                      onChange={(e) => onUpdateSize(pt.id, sz.id, { itemCost: e.target.value })}
                      onWheel={(e) => e.target.blur()} placeholder="0" readOnly={sz.isLib}
                      title={sz.isLib ? 'Giá vốn lấy từ thư viện Vendor (cột P1) — không sửa ở đây' : undefined}
                      className="ps-input ps-input--num" style={{ padding: '5px 8px', fontSize: 12.5 }} />
                  </td>

                  {/* ── Nhóm computed: nền subtle, chữ mảnh, KHÔNG nền màu đậm ── */}
                  {/* Coupon (thay cột Ship Cost cũ) — số tiền giảm giá của dòng */}
                  <td className="ps-cell-auto ps-divider-l"
                    style={{ color: calc.couponAmt ? PS.textSecondary : PS.textMuted }}>
                    {usd(calc.couponAmt)}
                  </td>
                  <td className="ps-cell-auto"
                    style={{ fontWeight: 700, color: PS.text }}>{usd(calc.totalPrice)}</td>
                  <td className="ps-cell-auto" style={{ color: PS.textMuted }}>{usd(calc.amzFee)}</td>
                  <td className="ps-cell-auto"
                    style={{ fontWeight: 650, color: calc.profitAfter >= 0 ? PS.text : PS.negative }}>{usd(calc.profitAfter)}</td>
                  <td className="ps-cell-auto"><MarginCell value={calc.margin} /></td>
                  <td className="ps-cell-auto"><MarginCell value={calc.marginAfter} /></td>

                  {/* Loại khỏi tổng hợp — giữ dòng lại nhưng không kéo tụt Avg Margin */}
                  <td className="ps-cell" style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={!!sz.excluded}
                      aria-label={`Loại size ${sz.label || i + 1} khỏi tổng hợp`}
                      onChange={(e) => onUpdateSize(pt.id, sz.id, { excluded: e.target.checked })}
                      style={{ width: 15, height: 15, cursor: 'pointer', accentColor: PS.brand }} />
                  </td>

                  {/* Xoá size — dùng được cho CẢ dòng thư viện: phôi dùng chung nhiều
                      project có size dư là bình thường, xoá ở đây KHÔNG đụng file thư
                      viện Vendor gốc. Nút ↺ trên card lấy lại đủ size bất cứ lúc nào. */}
                  <td className="ps-cell" style={{ textAlign: 'center' }}>
                    <IconBtn variant="dangerghost" title={`Xoá size ${sz.label || i + 1} khỏi bảng tính giá`}
                      disabled={!canDelete}
                      onClick={() => requestRemoveSize(sz)}
                      style={{ width: 26, height: 26, fontSize: 12 }}>✕</IconBtn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirmDeleteSz && (
        <ConfirmDialog title="Xoá size khỏi bảng tính giá" confirmLabel="Xoá dòng"
          message={`Dòng "${confirmDeleteSz.label || 'size chưa đặt tên'}" đã có giá. Xoá khỏi bảng tính giá này? Thư viện Vendor không bị ảnh hưởng.`}
          onConfirm={() => { onRemoveSize(pt.id, confirmDeleteSz.id); setConfirmDeleteSz(null); }}
          onClose={() => setConfirmDeleteSz(null)} />
      )}
    </div>
  );
}
