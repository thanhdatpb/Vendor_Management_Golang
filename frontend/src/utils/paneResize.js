// ════════════════════════════════════════════════════════
//  PANE RESIZE — phép tính thuần cho khung chia đôi kéo được (không dính
//  React) dùng ở modal chi tiết request: nửa trên là thông tin request,
//  nửa dưới là bảng vendor. Tách riêng để test được bằng unit test và tái
//  dùng cho các modal khác có cùng kiểu bố cục.
//
//  Tỷ lệ (ratio) = chiều cao nửa trên / chiều cao khung chứa, lưu ở dạng
//  tỷ lệ chứ không phải px để đổi cỡ cửa sổ vẫn giữ đúng bố cục.
// ════════════════════════════════════════════════════════

export const PANE_DEFAULT_RATIO = 0.52;      // bằng maxHeight 52vh của bản cũ
export const PANE_MIN_TOP_PX = 120;          // vẫn đọc được tiêu đề + 1 dòng
export const PANE_MIN_BOTTOM_PX = 170;       // chừa đủ chỗ cho header bảng vendor
export const PANE_STEP = 0.03;               // phím mũi tên
export const PANE_PAGE_STEP = 0.1;           // PageUp / PageDown

// Khung chưa đo được (jsdom, lần render đầu) → dùng biên an toàn theo tỷ lệ.
const FALLBACK_BOUNDS = { min: 0.15, max: 0.85 };

const clamp01 = (n) => Math.min(1, Math.max(0, n));

// Biên trên/dưới của ratio, quy từ ngưỡng px tối thiểu của 2 nửa.
export function paneRatioBounds(containerPx, opts = {}) {
  const { minTopPx = PANE_MIN_TOP_PX, minBottomPx = PANE_MIN_BOTTOM_PX } = opts;
  if (!Number.isFinite(containerPx) || containerPx <= 0) return { ...FALLBACK_BOUNDS };
  const min = clamp01(minTopPx / containerPx);
  const max = clamp01((containerPx - minBottomPx) / containerPx);
  // Khung quá thấp để chứa cả 2 ngưỡng → chia đôi thay vì trả biên đảo ngược.
  if (min > max) return { min: 0.5, max: 0.5 };
  return { min, max };
}

export function clampPaneRatio(ratio, containerPx, opts = {}) {
  const { min, max } = paneRatioBounds(containerPx, opts);
  const value = Number.isFinite(ratio) ? ratio : PANE_DEFAULT_RATIO;
  return Math.min(max, Math.max(min, value));
}

// Vị trí con trỏ (clientY) → ratio mới. containerTop là rect.top của khung.
export function ratioFromPointer(clientY, containerTop, containerPx, opts = {}) {
  if (!Number.isFinite(containerPx) || containerPx <= 0) return null;
  return clampPaneRatio((clientY - containerTop) / containerPx, containerPx, opts);
}

// ── Lưu trạng thái (localStorage) ────────────────────────────────────────────
// Key mới hoàn toàn, không đụng tới các key đang dùng để chuyển dữ liệu giữa
// các role. Dữ liệu hỏng/không đúng kiểu → rơi về mặc định.
export function readPaneState(key, fallback = {}) {
  const base = { ratio: PANE_DEFAULT_RATIO, collapsed: false, ...fallback };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    const ratio = Number(parsed.ratio);
    return {
      ratio: Number.isFinite(ratio) && ratio > 0 && ratio < 1 ? ratio : base.ratio,
      collapsed: parsed.collapsed === true,
    };
  } catch { return base; }
}

export function writePaneState(key, state) {
  try {
    localStorage.setItem(key, JSON.stringify({
      ratio: Number(state?.ratio) || PANE_DEFAULT_RATIO,
      collapsed: state?.collapsed === true,
    }));
  } catch { /* storage bị chặn (private mode) → bỏ qua, chỉ mất phần ghi nhớ */ }
}
