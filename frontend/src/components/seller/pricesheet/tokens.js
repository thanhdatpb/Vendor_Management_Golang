// ════════════════════════════════════════════════════════
//  PRICE SHEET DESIGN TOKENS — spec redesign §2.2
//  Nguồn màu DUY NHẤT của màn "Bảng tính giá".
//  1 accent (amber = HC.orange) + neutral + semantic.
//  KHÔNG hardcode hex trong JSX — mọi màu lấy từ đây.
// ════════════════════════════════════════════════════════
import { HC } from '../../../constants/sellerTheme';

export const PS = {
  // ── Surface ──
  bgApp: '#FAFAFA',        // neutral-50 — nền body
  bgSurface: '#FFFFFF',    // card, header, footer
  bgSubtle: '#F5F5F5',     // neutral-100 — nền cột computed / header bảng
  bgSubtle2: '#EFEFEF',    // zebra của cột computed
  border: '#E5E5E5',       // neutral-200
  borderStrong: '#D4D4D4', // neutral-300 — divider Nhập | Tính

  // ── Brand — accent DUY NHẤT (amber, đồng bộ HC.orange) ──
  brand: HC.orange,          // #F5A623
  brandHover: HC.orangeDark, // #E09415
  brandDeep: HC.orangeDeep,  // #C47F10 — chữ brand trên nền sáng (contrast)
  brandSubtle: '#FFF8E6',
  brandBorder: '#F8E3B0',
  brandRing: 'rgba(245,166,35,0.30)',

  // ── Semantic — chỉ dùng cho GIÁ TRỊ, không làm nền khối ──
  positive: '#047857', positiveBg: '#ECFDF5',
  warning: '#B45309', warningBg: '#FFFBEB',
  negative: '#E11D48', negativeBg: '#FFF1F2',

  // ── Visual hierarchy zones (spec 2026-07-16) ──
  // Accent identity (amber): tên bảng, tên product type
  accentBar: '#FBBF24',    // amber-400 — thanh dọc bên trái tiêu đề
  accentBg: '#FFFBEB',     // amber-50  — nền header card product type
  accentBorder: '#FDE68A', // amber-200
  accentSoft: '#FEF3C7',   // amber-100 — border-b toolbar, badge đếm
  accentText: '#B45309',   // amber-700
  // Vùng NHẬP (blue)
  inBg: '#EFF6FF',    inBorder: '#BFDBFE', inText: '#1D4ED8', inDot: '#60A5FA',
  inZone: '#F7FAFF',  inZoneOdd: '#FCFDFF',   // blue-50/50 trên trắng · + white/60 dòng lẻ (đặc, an toàn sticky)
  // Vùng KẾT QUẢ (emerald)
  outBg: '#ECFDF5',   outBorder: '#A7F3D0', outText: '#047857', outDot: '#34D399',
  outZone: '#F7FEFB', outZoneOdd: '#FCFFFD',  // emerald-50/40 trên trắng · + white/60 dòng lẻ

  // ── Text ──
  text: '#171717',          // neutral-900
  textSecondary: '#525252', // neutral-600
  textMuted: '#A3A3A3',     // neutral-400

  // ── Elevation ──
  shadowCard: '0 1px 2px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.05)',
  shadowUp: '0 -4px 14px rgba(0,0,0,0.07)',
  shadowModal: '0 20px 60px rgba(0,0,0,0.20)',
  overlay: 'rgba(23,23,23,0.40)',
};

// Ngưỡng margin thống nhất toàn màn (spec §3.1):
//   ≥ 35% → positive · 20–35% → warning · < 20% → negative
export const marginTone = (v) =>
  v == null || Number.isNaN(v) ? 'muted' : v >= 35 ? 'positive' : v >= 20 ? 'warning' : 'negative';

export const toneColor = {
  positive: PS.positive, warning: PS.warning, negative: PS.negative, muted: PS.textMuted,
};
export const toneBg = {
  positive: PS.positiveBg, warning: PS.warningBg, negative: PS.negativeBg, muted: PS.bgSubtle,
};

// ════════════════════════════════════════════════════════
//  Stylesheet cho các state inline-style không làm được:
//  :focus ring, :hover, zebra, sticky column, reduced-motion.
//  Scoped bằng prefix .ps- , inject 1 lần trong PriceSheetWorkspace.
// ════════════════════════════════════════════════════════
export const PS_CSS = `
.ps-scope, .ps-scope * { box-sizing: border-box; }
.ps-scope button { font-family: inherit; }

/* ── Input ── */
.ps-input {
  width: 100%; padding: 8px 10px; font-size: 13px; color: ${PS.text};
  background: ${PS.bgSurface}; border: 1px solid ${PS.border}; border-radius: 8px;
  outline: none; transition: border-color .12s, box-shadow .12s;
}
.ps-input:hover { border-color: ${PS.borderStrong}; }
.ps-input:focus { border-color: ${PS.brand}; box-shadow: 0 0 0 2px ${PS.brandRing}; }
.ps-input[readonly] { background: ${PS.bgSubtle}; color: ${PS.textSecondary}; cursor: default; }
.ps-input--num { text-align: right; font-variant-numeric: tabular-nums; }
.ps-input--invalid { border-color: ${PS.negative}; }
.ps-input--invalid:focus { border-color: ${PS.negative}; box-shadow: 0 0 0 2px ${PS.negativeBg}; }

/* Input "tàng hình" — chỉ hiện viền khi hover/focus (tên sheet, tên PT) */
.ps-input-ghost {
  border-color: transparent; background: transparent; font-weight: 700;
}
.ps-input-ghost:hover { border-color: ${PS.border}; background: ${PS.bgSurface}; }
.ps-input-ghost:focus { background: ${PS.bgSurface}; }

/* ── Button hover ── */
.ps-btn { transition: background .12s, border-color .12s, color .12s, opacity .12s; }
.ps-btn:disabled { opacity: .45; cursor: not-allowed; }
.ps-btn-primary:not(:disabled):hover { background: ${PS.brandHover}; }
.ps-btn-outline:not(:disabled):hover { border-color: ${PS.brand}; color: ${PS.brandDeep}; background: ${PS.brandSubtle}; }
.ps-btn-ghost:not(:disabled):hover { background: ${PS.bgSubtle}; color: ${PS.text}; }
.ps-btn-dangerghost:not(:disabled):hover { background: ${PS.negativeBg}; color: ${PS.negative}; border-color: ${PS.negative}; }
.ps-scope button:focus-visible, .ps-scope input:focus-visible + span {
  outline: 2px solid ${PS.brand}; outline-offset: 2px; border-radius: 6px;
}

/* ── Bảng — 2 vùng tint: NHẬP (blue) | KẾT QUẢ (emerald) ── */
.ps-table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 13px; }
.ps-table td { border-bottom: 1px solid ${PS.border}; height: 40px; padding: 4px 10px; }
.ps-cell { background: ${PS.inZone}; }
.ps-cell-auto {
  background: ${PS.outZone}; text-align: right; font-variant-numeric: tabular-nums;
  color: ${PS.textSecondary};
}
/* Zebra kiểu odd:white/60 — dòng lẻ sáng hơn, dòng chẵn giữ tint đầy đủ */
.ps-tr:nth-child(odd) .ps-cell { background: ${PS.inZoneOdd}; }
.ps-tr:nth-child(odd) .ps-cell-auto { background: ${PS.outZoneOdd}; }
.ps-tr:hover .ps-cell, .ps-tr:hover .ps-cell-auto { background: ${PS.brandSubtle}; }
.ps-sticky-col { position: sticky; left: 0; z-index: 2; border-left: 2px solid ${PS.inBorder}; }
.ps-divider-l { border-left: 2px solid ${PS.outBorder}; }

/* Nút chip trung tính (Lịch sử tính giá) — không cạnh tranh accent */
.ps-btn-hist {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border-radius: 8px; cursor: pointer;
  font-size: 13px; font-weight: 650; color: ${PS.textSecondary};
  background: ${PS.bgSurface}; border: 1px solid ${PS.border};
  transition: background .12s;
}
.ps-btn-hist:hover { background: ${PS.bgApp}; }

/* ── Chip / segmented ── */
.ps-chip { transition: background .12s, border-color .12s, color .12s; }
.ps-chip:hover { border-color: ${PS.brand}; }
.ps-seg { transition: background .12s, color .12s; }
.ps-seg:not(.ps-seg--on):hover { background: ${PS.bgSubtle}; color: ${PS.text}; }

/* ── Modal / list ── */
.ps-overlay { background: ${PS.overlay}; backdrop-filter: blur(4px); }
.ps-listitem { transition: background .12s, border-color .12s; }
.ps-listitem:hover { background: ${PS.brandSubtle}; border-color: ${PS.brandBorder}; }

@media (prefers-reduced-motion: reduce) {
  .ps-scope *, .ps-overlay { transition: none !important; animation: none !important; }
}
`;
