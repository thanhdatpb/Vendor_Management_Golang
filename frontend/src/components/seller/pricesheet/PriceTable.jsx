// ════════════════════════════════════════════════════════
//  PRICE TABLE — spec §3.5. Bảng size của 1 Product Type.
//  GIỮ NGUYÊN 100% hành vi: drag dọc xoá nhanh Giá Size,
//  bulk-paste TSV từ Google Sheet, onWheel blur, lib-locked size.
//  Chỉ thay lớp trình bày: 1 hệ màu neutral + amber, group header
//  2 tầng không nền màu, zebra, dot ngưỡng margin.
// ════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { PS, marginTone, toneColor } from './tokens';
import { Dot, IconBtn } from './primitives';
import { computeSizeRow, usd, pct, num } from '../../../utils/pricingEngine';
import { normalizeKey, shipMethodLabel } from '../../../utils/vendorLibraryIndex';

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

// ─── Styles dùng chung ───────────────────────────────────
const thTier1 = {
  padding: '6px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
  textTransform: 'uppercase', color: PS.textMuted, textAlign: 'left',
  background: PS.bgSurface, borderBottom: `1px solid ${PS.border}`, whiteSpace: 'nowrap',
};
const thTier2 = {
  padding: '7px 10px', fontSize: 11, fontWeight: 650, letterSpacing: '0.05em',
  textTransform: 'uppercase', color: PS.textSecondary, textAlign: 'right',
  background: PS.bgSubtle, borderBottom: `1.5px solid ${PS.borderStrong}`, whiteSpace: 'nowrap',
};

function MarginCell({ value }) {
  const tone = marginTone(value);
  return (
    <span style={{ fontWeight: 650, color: toneColor[tone] }}>
      <Dot tone={tone} />{pct(value, 1)}
    </span>
  );
}

export default function PriceTable({ pt, settings, libEntry, onUpdateSize, onRemoveSize, onUpdateCustomize, onRenameCustomize, onRemoveCustomize }) {
  const customs = pt.customizeInfos || [];
  const sizes = pt.sizes || [];
  const rows = sizes.map((sz) => ({ sz, calc: computeSizeRow(settings, pt, sz) }));

  // ── Kéo dọc qua các ô "Giá Size" để xoá nhanh (GIỮ NGUYÊN) ──
  const dragStartIdx = useRef(null);
  const [dragIds, setDragIds] = useState(null);

  const onPriceMouseDown = (idx) => { dragStartIdx.current = idx; };
  const onPriceMouseEnter = (idx, e) => {
    if (dragStartIdx.current == null) return;
    if (e.buttons !== 1) { dragStartIdx.current = null; setDragIds(null); return; }
    const a = Math.min(dragStartIdx.current, idx);
    const b = Math.max(dragStartIdx.current, idx);
    const ids = new Set();
    for (let k = a; k <= b; k++) if (sizes[k]) ids.add(sizes[k].id);
    setDragIds(ids);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.getSelection?.()?.removeAllRanges?.();
  };

  useEffect(() => {
    const finish = () => {
      if (dragIds && dragIds.size) dragIds.forEach((id) => onUpdateSize(pt.id, id, { sizeAdd: '' }));
      dragStartIdx.current = null;
      setDragIds(null);
    };
    window.addEventListener('mouseup', finish);
    return () => window.removeEventListener('mouseup', finish);
  }, [dragIds, onUpdateSize, pt.id]);

  // Số cột 2 nhóm (giữ nguyên cấu trúc cột cũ)
  const nInput = 2 + customs.length + (libEntry ? 0 : 1);
  const nAuto = 5 + (libEntry ? 1 : 0);

  // Tooltip cột Ship Cost khi trống
  const shipEmptyHint = !pt.shipMethod
    ? 'Chưa chọn Ship Method — chọn ở thanh công cụ phía trên để nạp giá vốn từ thư viện.'
    : `Thư viện vendor chưa có giá ${shipMethodLabel(pt.shipMethod)} cho size này.`;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="ps-table" style={{ minWidth: 880 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
          {/* Tầng 1: nhóm cột — chữ nhỏ, KHÔNG nền màu */}
          <tr>
            <th colSpan={nInput} style={thTier1}>Thông tin giá cần nhập</th>
            <th colSpan={nAuto} className="ps-divider-l" style={thTier1}>Giá tính được</th>
            {!libEntry && <th style={{ ...thTier1, width: 44 }} aria-label="Thao tác" />}
          </tr>
          {/* Tầng 2: tên cột */}
          <tr>
            <th className="ps-sticky-col" style={{ ...thTier2, textAlign: 'left', minWidth: 76, zIndex: 3, left: 0, position: 'sticky' }}>Size</th>
            <th style={{ ...thTier2, minWidth: 96 }}>Giá Size ($)</th>
            {customs.map((ci) => (
              <th key={ci.id} style={{ ...thTier2, minWidth: 100, padding: '4px 6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input value={ci.name} onChange={(e) => onRenameCustomize(pt.id, ci.id, e.target.value)}
                    placeholder="Tên (VD: Color: Black)" aria-label="Tên cột customize"
                    className="ps-input" style={{ fontSize: 11, fontWeight: 650, padding: '4px 6px', textTransform: 'none' }} />
                  <IconBtn variant="dangerghost" title="Xoá cột" onClick={() => onRemoveCustomize(pt.id, ci.id)}
                    style={{ width: 22, height: 22, fontSize: 11, flexShrink: 0 }}>✕</IconBtn>
                </div>
              </th>
            ))}
            {!libEntry && <th style={{ ...thTier2, minWidth: 90 }}>Item Cost ($)</th>}

            {libEntry && <th className="ps-divider-l" style={{ ...thTier2, minWidth: 90 }}>Ship Cost ($)</th>}
            <th className={libEntry ? undefined : 'ps-divider-l'} style={{ ...thTier2, minWidth: 96 }}>Total Price</th>
            <th style={{ ...thTier2, minWidth: 80 }}>AMZ Fee</th>
            <th style={{ ...thTier2, minWidth: 84 }}>Profit</th>
            <th style={{ ...thTier2, minWidth: 84 }}>Margin</th>
            <th style={{ ...thTier2, minWidth: 96 }}>After Promo</th>
            {!libEntry && <th style={{ ...thTier2, textAlign: 'center' }}>Xoá</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ sz, calc }, i) => {
            const dragging = dragIds?.has(sz.id);
            return (
              <tr key={sz.id} className="ps-tr">
                {/* Size — sticky trái, semibold */}
                <td className="ps-cell ps-sticky-col" style={{ minWidth: 76 }}>
                  <input value={sz.label} onChange={(e) => onUpdateSize(pt.id, sz.id, { label: e.target.value })}
                    placeholder="S / M / L…" readOnly={sz.isLib} aria-label="Tên size"
                    className="ps-input" style={{ fontWeight: 650, padding: '5px 8px', fontSize: 12.5 }} />
                </td>

                {/* Giá Size — Ô NHẬP NỔI BẬT NHẤT (spec §3.5) */}
                <td className="ps-cell"
                  onMouseDown={() => onPriceMouseDown(i)} onMouseEnter={(e) => onPriceMouseEnter(i, e)}
                  style={{ userSelect: dragIds ? 'none' : undefined }}>
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
                    title="Kéo dọc qua nhiều ô để xoá nhanh (như bôi đen trên sheet). Dán nhiều giá cùng lúc cũng được."
                    placeholder="0"
                    className={`ps-input ps-input--num${num(sz.sizeAdd) < 0 ? ' ps-input--invalid' : ''}`}
                    style={dragging ? { background: PS.brandSubtle, borderColor: PS.brand } : undefined} />
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

                {/* Item Cost (nhập tay) */}
                {!libEntry && (
                  <td className="ps-cell">
                    <input type="number" step="0.01" value={sz.itemCost} aria-label={`Item cost — size ${sz.label || i + 1}`}
                      onChange={(e) => onUpdateSize(pt.id, sz.id, { itemCost: e.target.value })}
                      onWheel={(e) => e.target.blur()} placeholder="0"
                      className="ps-input ps-input--num" style={{ padding: '5px 8px', fontSize: 12.5 }} />
                  </td>
                )}

                {/* ── Nhóm computed: nền subtle, chữ mảnh, KHÔNG nền màu đậm ── */}
                {libEntry && (
                  <td className="ps-cell-auto ps-divider-l"
                    title={sz.itemCost ? undefined : shipEmptyHint}
                    style={sz.itemCost ? undefined : { color: PS.textMuted, cursor: 'help' }}>
                    {sz.itemCost ? usd(sz.itemCost) : '—'}
                  </td>
                )}
                <td className={`ps-cell-auto${libEntry ? '' : ' ps-divider-l'}`}
                  style={{ fontWeight: 700, color: PS.text }}>{usd(calc.totalPrice)}</td>
                <td className="ps-cell-auto" style={{ color: PS.textMuted }}>{usd(calc.amzFee)}</td>
                <td className="ps-cell-auto"
                  style={{ fontWeight: 650, color: calc.profit >= 0 ? PS.text : PS.negative }}>{usd(calc.profit)}</td>
                <td className="ps-cell-auto"><MarginCell value={calc.margin} /></td>
                <td className="ps-cell-auto"><MarginCell value={calc.marginAfter} /></td>

                {/* Xoá size (nhập tay) */}
                {!libEntry && (
                  <td className="ps-cell" style={{ textAlign: 'center' }}>
                    {!sz.isLib && (
                      <IconBtn variant="dangerghost" title="Xoá size"
                        disabled={(pt.sizes?.length || 0) <= 1}
                        onClick={() => onRemoveSize(pt.id, sz.id)}
                        style={{ width: 26, height: 26, fontSize: 12 }}>✕</IconBtn>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
