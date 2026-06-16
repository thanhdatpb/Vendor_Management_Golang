// ════════════════════════════════════════════════════════
//  SELLER THEME — Màu sắc, cấu hình dùng chung
// ════════════════════════════════════════════════════════

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ─── LocalStorage Keys ──────────────────────────────────
export const LS_PRODUCT_VENDORS  = 'STAFF_PRODUCT_VENDORS_V1';
export const LS_A_SELECTIONS     = 'STAFF_A_SELECTIONS_V1';
export const LS_B_SELECTIONS     = 'STAFF_B_SELECTIONS_V1';
export const LS_SAMPLE_DECISIONS = 'SELLER_SAMPLE_DECISIONS_V1';
export const LS_B_SUBMITTED_FEEDBACK = 'STAFF_B_SUBMITTED_FEEDBACK_V1';
export const LS_A_FEEDBACK_RESPONSE  = 'STAFF_A_FEEDBACK_RESPONSE_V1';
export const LS_PRICE_KEY = 'SELLER_PRICE_LIST_V1';

// ─── Color Palette ──────────────────────────────────────
export const HC = {
  orange: '#F5A623', orangeDark: '#E09415', orangeDeep: '#C47F10',
  orangeLight: '#FEF3DC', orangeMid: '#FDE8B8', orangePale: '#FFFBF4',
  orangeGlow: 'rgba(245,166,35,0.15)', cream: '#FFF8EE', brown: '#7A5C32',
  brownLight: '#9C7A50', ink: '#1A0F00', ink2: '#3D2B0F', muted: '#B8956A',
  muted2: '#D4B896', surface: '#FFFFFF', surface2: '#FFFDF9', border: '#F0E4CC',
  borderStrong: '#E8D4A8', success: '#16a34a', danger: '#dc2626', warning: '#f59e0b', gold: '#B8860B',
  shadow: '0 10px 30px rgba(245,166,35,0.08)', shadowStrong: '0 20px 50px rgba(245,166,35,0.14)',
};

// ─── Status Config ──────────────────────────────────────
export const STATUS_CFG = {
  draft:    { bg: HC.orangeLight, text: HC.brown,    dot: HC.muted,    label: 'Draft'    },
  pending:  { bg: '#fffbeb',      text: '#92400e',   dot: '#f59e0b',   label: 'Pending'  },
  approved: { bg: '#ecfdf5',      text: '#065f46',   dot: '#16a34a',   label: 'Approved' },
  reject:   { bg: '#fef2f2',      text: '#991b1b',   dot: '#dc2626',   label: 'Rejected' },
};

// ─── Misc ────────────────────────────────────────────────
export const ITEMS_PER_PAGE = 20;

export const EMPTY_FORM = {
  product_type: '', mediaFiles: [],
  product_type_links: [],
  production_time: '', shipping_time: '', total_cost: '',
  other_specs: '', material: '', print_area: '',
  good_review: '', bad_review: '', packaging_links: '', other_packaging: '',
};
