// ════════════════════════════════════════════════════════
//  KINH DOANH DASHBOARD — TechStore Hub
// ════════════════════════════════════════════════════════════
import { AppstoreOutlined, ShopOutlined, BellOutlined, DollarOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined, CalendarOutlined, ToolOutlined, LeftOutlined, RightOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { productApi, notificationApi, vendorApi } from '../services/api';

// ─── CẤU HÌNH ─────────────────────────────────────────────
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
// const API_BASE_URL = 'http://localhost:8000/api';
const LS_PRODUCT_VENDORS = 'STAFF_PRODUCT_VENDORS_V1';
const LS_A_SELECTIONS = 'STAFF_A_SELECTIONS_V1';
const LS_B_SELECTIONS = 'STAFF_B_SELECTIONS_V1';
const LS_SAMPLE_DECISIONS = 'SELLER_SAMPLE_DECISIONS_V1';
const LS_B_SUBMITTED_FEEDBACK = 'STAFF_B_SUBMITTED_FEEDBACK_V1';
const LS_A_FEEDBACK_RESPONSE = 'STAFF_A_FEEDBACK_RESPONSE_V1';
const getMediaUrls = (product) => {
  if (!product) return [];

  if (product.media_urls && Array.isArray(product.media_urls) && product.media_urls.length) {
    return product.media_urls.map(url =>
      url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
    );
  }

  if (product.media_url) {
    const full = product.media_url.startsWith('http')
      ? product.media_url
      : `${API_BASE_URL}${product.media_url.startsWith('/') ? '' : '/'}${product.media_url}`;
    return [full];
  }

  if (product.media_path) {
    let cleanPath = product.media_path;
    if (cleanPath.startsWith('storage/')) {
      cleanPath = cleanPath.replace('storage/', '');
    }
    if (cleanPath.startsWith('/storage/')) {
      cleanPath = cleanPath.replace('/storage/', '');
    }
    const full = `${API_BASE_URL}/storage/${cleanPath}`;
    return [full];
  }

  return [];
};

const fmtDate = iso => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return iso; }
};

const ITEMS_PER_PAGE = 20;

const getMediaUrl = (product) => {
  const urls = getMediaUrls(product);
  return urls.length ? urls[0] : null;
};

const lsGet = (key, fallback) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
};

const lsSet = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { } };

const HC = {
  orange: '#F5A623', orangeDark: '#E09415', orangeDeep: '#C47F10',
  orangeLight: '#FEF3DC', orangeMid: '#FDE8B8', orangePale: '#FFFBF4',
  orangeGlow: 'rgba(245,166,35,0.15)', cream: '#FFF8EE', brown: '#7A5C32',
  brownLight: '#9C7A50', ink: '#1A0F00', ink2: '#3D2B0F', muted: '#B8956A',
  muted2: '#D4B896', surface: '#FFFFFF', surface2: '#FFFDF9', border: '#F0E4CC',
  borderStrong: '#E8D4A8', success: '#16a34a', danger: '#dc2626', warning: '#f59e0b', gold: '#B8860B',
  shadow: '0 10px 30px rgba(245,166,35,0.08)', shadowStrong: '0 20px 50px rgba(245,166,35,0.14)',
};

const MENU = [
  { id: 'products', icon: <AppstoreOutlined />, label: 'Quản Lý Sản Phẩm', desc: 'Quản lý yêu cầu từ Sales' },
  { id: 'vendors', icon: <ShopOutlined />, label: 'Thư Viện Vendor', desc: 'Danh mục nhà cung cấp' },
  { id: 'setup_price', icon: <DollarOutlined />, label: 'Thiết Lập Giá', desc: 'Cấu hình giá bán' },
];

function HCLogo({ size = 32, color = '#F5A623' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <path d="M168 44 A88 88 0 1 0 168 156" stroke={color} strokeWidth="20" strokeLinecap="round" fill="none" />
      <path d="M118 128 Q130 142 145 132" stroke={color} strokeWidth="18" strokeLinecap="round" fill="none" />
    </svg>
  );
}
const EMPTY_FORM = {
  product_type: '', mediaFiles: [],
  product_type_links: [],  // ← ĐỔI THÀNH MẢNG
  other_specs: '', material: '', print_area: '',
  good_review: '', bad_review: '', packaging_links: '', other_packaging: '',
};
// ─── COMPONENT GALLERY ẢNH (prev/next) ─────────────────────────────────────
function MediaGallery({ mediaUrls = [] }) {
  if (!mediaUrls.length) return <span style={{ color: HC.muted2, fontSize: 11 }}>—</span>;

  const firstUrl = mediaUrls[0];
  const isVideo = firstUrl && (firstUrl.match(/\.(mp4|webm|mov)$/i) || firstUrl.includes('video'));

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{
        width: 60,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#2a1a00',
        border: `1.5px solid ${HC.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {isVideo ? (
          <video src={firstUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <img src={firstUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      {mediaUrls.length > 1 && (
        <span style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: 9,
          padding: '1px 5px',
          borderRadius: 10,
          pointerEvents: 'none'
        }}>
          +{mediaUrls.length - 1}
        </span>
      )}
    </div>
  );
}
// ─── EXCEL EXPORT ─────────────────────────────────────────
function exportProductsToExcel(products, productVendors, filename) {
  filename = filename || 'products.xlsx';
  productVendors = productVendors || {};

  const bdr = {
    top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
    left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } },
  };
  const hStyle = (bg) => ({
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Arial' },
    fill: { fgColor: { rgb: bg || 'F59E0B' }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: bdr,
  });
  const dStyle = (even, txtRgb, center) => ({
    font: { sz: 10, name: 'Arial', color: { rgb: txtRgb || '3D2B0F' } },
    fill: { fgColor: { rgb: even ? 'FFFBF4' : 'FFFFFF' }, patternType: 'solid' },
    alignment: { horizontal: center ? 'center' : 'left', vertical: 'center', wrapText: true }, border: bdr,
  });
  const fmtNum = v => (v !== null && v !== undefined && v !== '') ? Number(v).toFixed(2) : '';

  const PROD_COLS = [
    'Date Request', 'Deadline Date', 'Product Type', 'Image',
    'Product Type Link', 'Đặc tính kĩ thuật', 'Chất liệu',
    'Vùng In/Thiết kế', 'Good Review', 'Bad Review',
    'Packing', 'Other Packing', 'Approve the request',
  ];

  const row1 = ['No', 'Seller', ...Array(12).fill('')];
  const row2 = ['', ...PROD_COLS];
  const prodRows = products.map((p, i) => {
    const img = getMediaUrl(p) || '';
    return [
      i + 1, fmtDate(p.created_at) || '', fmtDate(p.deadline_date) || '',
      p.product_type || '', img, p.product_type_link || '',
      p.other_specs || '', p.material || '', p.print_area || '',
      p.good_review || '', p.bad_review || '',
      p.packaging_links || '', p.other_packaging || '', p.status || 'draft',
    ];
  });

  const vHdr1 = ['Z', 'Vendor Type', 'Detail', '', 'Pricing', '', 'Economy', '', 'Fast', '', 'Express', '', 'Overnight', ''];
  const vHdr2 = ['', '', 'Size', 'Optional', 'Pricing 1', 'Pricing 2', 'Ship', 'Total', 'Ship', 'Total', 'Ship', 'Total', 'Ship', 'Total'];

  const vendorRows = products
    .filter(p => {
      const vendors = productVendors[p.id];
      return vendors && vendors.length > 0;
    })
    .map(p => {
      const vendors = productVendors[p.id] || [];
      const aSelections = lsGet(LS_A_SELECTIONS, {})[p.id] || {};
      const selectedVendors = vendors.filter((v, i) => {
        const key = v.id ? String(v.id) : `idx_${i}`;
        return aSelections[key]?.checked;
      });
      const av = selectedVendors[0] || vendors[0];
      return [
        p.product_type || '', av.vendor_type || '', av.size || '', av.optional || '',
        fmtNum(av.pricing1), fmtNum(av.pricing2),
        fmtNum(av.eco_price), fmtNum(av.eco_total),
        fmtNum(av.fast_price), fmtNum(av.fast_total),
        fmtNum(av.express_price), fmtNum(av.express_total),
        fmtNum(av.overnight_price), fmtNum(av.overnight_total),
      ];
    });

  const sepRow = Array(14).fill('');
  const aoa = [row1, row2, ...prodRows, sepRow, vHdr1, vHdr2, ...vendorRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const np = prodRows.length; const vs = np + 3;

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 0, c: 13 } },
    { s: { r: vs, c: 0 }, e: { r: vs + 1, c: 0 } }, { s: { r: vs, c: 1 }, e: { r: vs + 1, c: 1 } },
    { s: { r: vs, c: 2 }, e: { r: vs, c: 3 } }, { s: { r: vs, c: 4 }, e: { r: vs, c: 5 } },
    { s: { r: vs, c: 6 }, e: { r: vs, c: 7 } }, { s: { r: vs, c: 8 }, e: { r: vs, c: 9 } },
    { s: { r: vs, c: 10 }, e: { r: vs, c: 11 } }, { s: { r: vs, c: 12 }, e: { r: vs, c: 13 } },
  ];
  ws['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 34 }, { wch: 22 },
    { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ];
  ws['!rows'] = [
    { hpt: 28 }, { hpt: 32 }, ...prodRows.map(() => ({ hpt: 22 })),
    { hpt: 8 }, { hpt: 28 }, { hpt: 28 }, ...vendorRows.map(() => ({ hpt: 22 })),
  ];

  try {
    const enc = (r, c) => XLSX.utils.encode_cell({ r, c });
    const setStyle = (ref, style) => { if (ws[ref]) ws[ref].s = style; };
    for (let c = 0; c < 14; c++) { setStyle(enc(0, c), hStyle('F59E0B')); setStyle(enc(1, c), hStyle('F59E0B')); }
    prodRows.forEach((_, i) => { const even = i % 2 === 0; for (let c = 0; c < 14; c++)setStyle(enc(2 + i, c), dStyle(even, null, c === 0)); });
    for (let c = 0; c < 14; c++) { const isDark = (c >= 8 && c <= 9) || (c >= 12 && c <= 13); const bg = isDark ? 'E09415' : 'F59E0B'; setStyle(enc(vs, c), hStyle(bg)); setStyle(enc(vs + 1, c), hStyle(bg)); }
    vendorRows.forEach((_, i) => {
      const even = i % 2 === 0;
      for (let c = 0; c < 14; c++) {
        const ref = enc(vs + 2 + i, c); if (!ws[ref]) continue;
        if (c === 0) ws[ref].s = dStyle(even, 'E09415', false);
        else if (c === 4 || c === 5) ws[ref].s = dStyle(even, 'E09415', true);
        else if (c === 7 || c === 9 || c === 11 || c === 13) ws[ref].s = dStyle(even, '16a34a', true);
        else ws[ref].s = dStyle(even, null, c >= 2);
      }
    });
  } catch (styleErr) { console.warn('[exportExcel] Cell styles skipped:', styleErr.message); }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, filename);
}

// ─── UI COMPONENTS ────────────────────────────────────────
function Spinner() { return (<div style={{ textAlign: 'center', padding: 60, color: HC.muted }}><HCLogo size={36} color={HC.orange} /><div>Đang tải...</div></div>); }
function EmptyState({ msg }) { return (<div style={{ textAlign: 'center', padding: 60, color: HC.muted }}><HCLogo size={40} color={HC.orangeMid} /><div>{msg}</div></div>); }
function Field({ label, hint, required, error, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{
        fontSize: 10,
        fontWeight: 800,
        color: error ? HC.danger : HC.muted
      }}>
        {label}
        {required && <span style={{ color: HC.danger }}>*</span>}
        {hint && <span style={{ marginLeft: 4, fontWeight: 400 }}>({hint})</span>}
      </label>
      {children}
      {error && (
        <span style={{ color: HC.danger, fontSize: 10, marginTop: 2 }}>
          ⚠ {error}
        </span>
      )}
    </div>
  );
}
const inp = { padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${HC.border}`, fontSize: 13, color: HC.ink2, background: HC.surface2, outline: 'none', width: '100%', boxSizing: 'border-box' };
function Pagination({ currentPage, totalPages, totalItems, onPageChange, itemsPerPage = 10 }) {
  if (totalPages <= 1) return null;
  const from = (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, totalItems);
  const pages = [];
  const push = n => { if (!pages.includes(n)) pages.push(n); };
  push(1);
  if (currentPage > 3) pages.push('...');
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) push(i);
  if (currentPage < totalPages - 2) pages.push('...');
  if (totalPages > 1) push(totalPages);

  const btn = (ex = {}) => ({
    minWidth: 32, height: 32, borderRadius: 8,
    border: `1.5px solid ${HC.border}`, fontSize: 12,
    fontWeight: 700, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', padding: '0 8px',
    fontFamily: "'Nunito',sans-serif", ...ex
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 10, marginTop: 14, padding: '10px 16px',
      background: HC.surface, borderRadius: 12, border: `1.5px solid ${HC.border}`,
      boxShadow: HC.shadow
    }}>
      <div style={{ fontSize: 12, color: HC.muted, fontWeight: 600, fontFamily: "'Nunito Sans',sans-serif" }}>
        Hiển thị <b style={{ color: HC.ink }}>{from}–{to}</b> / <b style={{ color: HC.ink }}>{totalItems}</b>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} style={btn({ background: HC.cream, color: HC.muted2, opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' })}>‹</button>
        {pages.map((p, i) => p === '...' ? <span key={`g${i}`} style={{ fontSize: 12, color: HC.muted2 }}>…</span> :
          <button key={p} onClick={() => onPageChange(p)} style={btn({
            background: currentPage === p ? HC.orange : HC.surface,
            color: currentPage === p ? '#fff' : HC.ink2,
            border: `1.5px solid ${currentPage === p ? HC.orange : HC.border}`,
            fontWeight: currentPage === p ? 900 : 700
          })}>{p}</button>
        )}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} style={btn({ background: HC.cream, color: HC.muted2, opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' })}>›</button>
      </div>
    </div>
  );
}
const STATUS_CFG = { draft: { bg: HC.orangeLight, text: HC.brown, dot: HC.muted, label: 'Draft' }, pending: { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b', label: 'Pending' }, approved: { bg: '#ecfdf5', text: '#065f46', dot: '#16a34a', label: 'Approved' }, reject: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626', label: 'Rejected' }, };

function Badge({ status }) { const c = STATUS_CFG[status] || STATUS_CFG.draft; return <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${HC.border}` }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />{c.label}</span>; }

function CardHeader({ icon, title, subtitle, badge, dimmed = false }) {
  const bg = dimmed
    ? `linear-gradient(135deg,${HC.muted},${HC.brownLight})`
    : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`;
  return (
    <div style={{ padding: '12px 14px', background: bg, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 10, color: '#fff', fontFamily: "'Nunito',sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontFamily: "'Nunito Sans',sans-serif", marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
      </div>
      {badge && <span style={{ flexShrink: 0, padding: '2px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 10, fontWeight: 900, fontFamily: "'Nunito',sans-serif", border: '1px solid rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{badge}</span>}
    </div>
  );
}

function InfoRow({ label, value, valueColor, valueBold, idx, isLast }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 12px', borderBottom: isLast ? 'none' : `1px solid ${HC.border}`, background: idx % 2 === 0 ? HC.surface : HC.surface2, minHeight: 34 }}>
      <span style={{ minWidth: 108, flexShrink: 0, fontWeight: 800, color: HC.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2, fontFamily: "'Nunito',sans-serif", lineHeight: 1.4 }}>{label}</span>
      <span style={{ color: valueColor || HC.ink2, fontWeight: valueBold ? 700 : 400, flex: 1, wordBreak: 'break-word', fontFamily: "'Nunito Sans',sans-serif", fontSize: 12, lineHeight: 1.4 }}>{value || '—'}</span>
    </div>
  );
}
// ══════════════════════════════════════════════════════════
//  PRODUCT VIEWER MODAL (Seller) - GIỐNG STAFF B
// ══════════════════════════════════════════════════════════
function ProductViewerModal({ product, productVendors, onClose, getStatus }) {
  const [vendors, setVendors] = useState(() => productVendors[product?.id] || []);
  const [selections, setSelections] = useState(() => lsGet(LS_A_SELECTIONS, {})[product?.id] || {});
  const [bFeedbacks, setBFeedbacks] = useState(() => lsGet('STAFF_B_SUBMITTED_FEEDBACK_V1', {})[product?.id] || {});
  const [aResponses, setAResponses] = useState(() => lsGet(LS_A_FEEDBACK_RESPONSE, {})[product?.id] || {});
  const [savingKey, setSavingKey] = useState(null);
  const [submittingKey, setSubmittingKey] = useState(null);
  const [showSampleModal, setShowSampleModal] = useState(null);
  const [tempSampleDetails, setTempSampleDetails] = useState('');
  const [sendingKey, setSendingKey] = useState(null);
  const [tempDecision, setTempDecision] = useState('');
  const [sampleDecisions, setSampleDecisions] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_SAMPLE_DECISIONS);
      const all = raw ? JSON.parse(raw) : {};
      return all[product?.id] || {};
    } catch { return {}; }
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const mediaUrls = getMediaUrls(product);

  useEffect(() => {
    setVendors(productVendors[product?.id] || []);
  }, [product?.id, productVendors]);

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem(LS_SAMPLE_DECISIONS);
        const all = raw ? JSON.parse(raw) : {};
        setSampleDecisions(all[product?.id] || {});
        const responses = lsGet(LS_A_FEEDBACK_RESPONSE, {});
        setAResponses(responses[product?.id] || {});
      } catch { }
    };
    window.addEventListener('storage', sync);
    const id = setInterval(sync, 4000);
    return () => { window.removeEventListener('storage', sync); clearInterval(id); };
  }, [product?.id]);

  if (!product) return null;

  const vendorKey = (v, i) => v.id ? String(v.id) : `idx_${i}`;

  const toggleCheck = (key) => {
    setSelections(prev => {
      const updated = { ...prev, [key]: { ...prev[key], checked: !prev[key]?.checked } };
      const all = lsGet(LS_A_SELECTIONS, {});
      all[product.id] = updated;
      lsSet(LS_A_SELECTIONS, all);
      window.dispatchEvent(new StorageEvent('storage', { key: LS_A_SELECTIONS }));
      return updated;
    });
  };
  const sendFeedbackWithDecision = (key, vendor) => {
    const feedback = selections[key]?.feedback?.trim();
    const isChecked = selections[key]?.checked;

    if (!isChecked) {
      showToastMessage('Vui lòng tích chọn vendor trước khi gửi', 'warning');
      return;
    }

    if (!feedback) {
      showToastMessage('Vui lòng nhập nội dung phản hồi trước khi gửi', 'warning');
      return;
    }

    setShowSampleModal({ key, vendor, action: 'ask_decision' });
  };
  // Hàm xử lý sau khi chọn quyết định
  const submitFeedbackWithDecision = (key, vendor, decision, sampleDetails = '') => {
    const feedback = selections[key]?.feedback?.trim();
    const isChecked = selections[key]?.checked;

    if (!isChecked) {
      showToastMessage('Vui lòng tích chọn vendor trước khi gửi', 'warning');
      return;
    }

    setSubmittingKey(key);

    const allSelections = lsGet(LS_A_SELECTIONS, {});
    allSelections[product.id] = selections;
    lsSet(LS_A_SELECTIONS, allSelections);

    const newDecision = {
      decision: decision,
      vendorType: vendor.vendor_type,
      vendorId: vendor.id,
      time: new Date().toISOString(),
      productId: product.id,
      productType: product.product_type,
      is_read: false,
      sampleDetails: sampleDetails,
      sellerFeedback: feedback,
      staff_a_approved: true
    };

    // Lưu sample decision
    const allSampleDecisions = JSON.parse(localStorage.getItem(LS_SAMPLE_DECISIONS) || '{}');
    if (!allSampleDecisions[product.id]) allSampleDecisions[product.id] = {};
    allSampleDecisions[product.id][key] = newDecision;
    localStorage.setItem(LS_SAMPLE_DECISIONS, JSON.stringify(allSampleDecisions));

    const allResponses = lsGet(LS_A_FEEDBACK_RESPONSE, {});
    if (!allResponses[product.id]) allResponses[product.id] = {};
    allResponses[product.id][key] = {
      decision: decision,
      sampleDetails: sampleDetails,
      sellerFeedback: feedback,
      respondedAt: new Date().toISOString(),
      status: decision === 'dat' ? 'approved' : 'rejected'  // ✅ Thêm status
    };
    lsSet(LS_A_FEEDBACK_RESPONSE, allResponses);

    setSampleDecisions(prev => ({ ...prev, [key]: newDecision }));
    setAResponses(prev => ({ ...prev, [key]: allResponses[product.id][key] }));
    try {
      const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      staffANotifs.unshift({
        id: Date.now() + 1,  // Dùng ID khác để tránh trùng
        icon: '📝',
        title: '📝 Phản hồi mới về Vendor',
        message: `Bộ phận Kinh doanh đã ${decision === 'dat' ? 'đồng ý đặt sample' : 'từ chối đặt sample'} cho vendor "${vendor.vendor_type}" của sản phẩm "${product.product_type}". ${decision === 'dat' ? `Chi tiết: ${sampleDetails.substring(0, 100)}...` : ''}`,
        time: new Date().toLocaleString('vi-VN'),
        is_read: false,
        productId: product.id,
        productType: product.product_type,
        vendorType: vendor.vendor_type,
        decision: decision,
        sampleDetails: sampleDetails,
        sellerFeedback: feedback  // Thêm cả nội dung feedback của seller
      });
      localStorage.setItem('STAFF_A_NOTIFICATIONS', JSON.stringify(staffANotifs.slice(0, 100)));
      window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_A_NOTIFICATIONS' }));
    } catch (err) {
      console.error('Lỗi gửi thông báo cho Staff A:', err);
    }
    try {
      const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
      const notification = {
        id: Date.now(),
        time: new Date().toLocaleString('vi-VN'),
        is_read: false,
        productId: product.id,
        productName: product.product_type,
        vendorId: vendor.id,
        vendorType: vendor.vendor_type,
        vendorKey: key,
        sellerFeedback: feedback,
        staff_a_approved: true,
        type: 'staff_a_approved_vendor',
        icon: '✅',
        title: '✅ Kinh doanh đã xác nhận vendor',
        message: `Bộ phận Kinh doanh đã xác nhận vendor "${vendor.vendor_type}" cho sản phẩm "${product.product_type}".`
      };
      staffBNotifs.unshift(notification);
      localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(staffBNotifs.slice(0, 50)));
      window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS' }));
    } catch (err) { }

    // 2. ✅ THÊM MỚI: GỬI THÔNG BÁO CHO STAFF A

  }
  const setFeedback = (key, text) => {
    setSelections(prev => ({ ...prev, [key]: { ...prev[key], feedback: text } }));
  };

  const saveFeedback = (key) => {
    if (!selections[key]?.feedback?.trim()) {
      showToastMessage('Vui lòng nhập nội dung phản hồi', 'warning');
      return;
    }
    setSavingKey(key);
    const all = lsGet(LS_A_SELECTIONS, {});
    all[product.id] = { ...selections };
    lsSet(LS_A_SELECTIONS, all);
    window.dispatchEvent(new StorageEvent('storage', { key: LS_A_SELECTIONS }));
    showToastMessage('Đã lưu phản hồi', 'success');
    setTimeout(() => setSavingKey(null), 800);
  };

  const showToastMessage = (message, type = 'info') => {
    const bgColor = type === 'success' ? '#16a34a' : type === 'error' ? '#dc2626' : '#f59e0b';
    const toastDiv = document.createElement('div');
    toastDiv.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; background: ${bgColor};
      color: white; padding: 12px 20px; border-radius: 8px; z-index: 10000;
      font-family: 'Nunito Sans', sans-serif; font-size: 13px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: slideIn 0.3s ease-out;
    `;
    toastDiv.textContent = message;
    document.body.appendChild(toastDiv);
    setTimeout(() => toastDiv.remove(), 3000);
  };

  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));
  const fmt = n => (n != null && n !== '') ? `$${Number(n).toFixed(2)}` : '—';
  const selectedCount = Object.values(selections).filter(s => s?.checked).length;

  const productRows = [
    { label: 'Date Request', value: fmtDate(product.created_at) },
    { label: 'Deadline', value: fmtDate(product.deadline_date), bold: true, color: HC.danger },
    { label: 'Product Type', value: product.product_type, bold: true, color: HC.orangeDark },
    { label: 'Đặc tính KT', value: product.other_specs },
    { label: 'Chất liệu', value: product.material },
    { label: 'Vùng In', value: product.print_area },
    { label: 'Good Review', value: product.good_review, color: HC.success },
    { label: 'Bad Review', value: product.bad_review, color: HC.danger },
    { label: 'Packing', value: product.packaging_links },
    { label: 'Other Packing', value: product.other_packaging },
    {
      label: 'Link',
      value: (() => {
        let links = [];
        if (product.product_type_links) {
          if (Array.isArray(product.product_type_links)) {
            links = product.product_type_links;
          } else if (typeof product.product_type_links === 'string') {
            try {
              links = JSON.parse(product.product_type_links);
            } catch {
              links = [product.product_type_links];
            }
          }
        } else if (product.product_type_link) {
          links = [product.product_type_link];
        }

        if (links.length === 0) return '—';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  color: HC.orange,
                  textDecoration: 'none',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  wordBreak: 'break-all'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = HC.orangeDark;
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = HC.orange;
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                🔗 {link.length > 60 ? link.substring(0, 60) + '...' : link}
              </a>
            ))}
          </div>
        );
      })(),
      color: HC.orange,
      bold: false
    },
    { label: 'Status', value: product.status || 'draft', bold: true, color: HC.brown },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999, backdropFilter: 'blur(2px)', padding: '16px' }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1400, height: '92vh', background: HC.orangePale, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ padding: '13px 20px', background: HC.ink, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 4, height: 22, borderRadius: 99, background: `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Chi tiết sản phẩm</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'Nunito Sans',sans-serif", marginTop: 1 }}>{product.product_type || `#${product.id}`}</div>
            </div>
            <Badge status={getStatus(product)} />
            {selectedCount > 0 && <span style={{ padding: '3px 12px', borderRadius: 999, background: 'rgba(22,163,74,0.25)', border: '1px solid rgba(22,163,74,0.5)', color: '#4ade80', fontSize: 11, fontWeight: 800 }}>✓ Đã chọn {selectedCount} nhà cung cấp</span>}
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>✕</button>
          </div>

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* LEFT COLUMN: Media & Product Info */}
            <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1.5px solid ${HC.border}`, overflow: 'hidden', background: HC.surface }}>
              <div style={{ height: 220, flexShrink: 0, background: '#2a1a00', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: mediaUrls.length ? 'pointer' : 'default' }}
                onClick={() => { if (mediaUrls.length) { setLightboxIndex(0); setLightboxOpen(true); } }}>
                {mediaUrls.length > 0 ? (
                  isVideo(mediaUrls[0]) ? (
                    <video src={mediaUrls[0]} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={mediaUrls[0]} alt="" style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                  )
                ) : (
                  <div style={{ color: HC.muted2, textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 8 }}>📷</div><div>Không có ảnh</div></div>
                )}
                {mediaUrls.length > 1 && (
                  <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#fff' }}>
                    {mediaUrls.length} media
                  </div>
                )}
              </div>
              {mediaUrls.length > 1 && (
                <div style={{ display: 'flex', gap: 6, padding: '8px', overflowX: 'auto', background: '#1f1400', borderTop: `1px solid ${HC.border}` }}>
                  {mediaUrls.map((url, idx) => (
                    <div key={idx} onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }} style={{ width: 50, height: 50, borderRadius: 6, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${idx === lightboxIndex ? HC.orange : 'transparent'}`, flexShrink: 0 }}>
                      {isVideo(url) ? <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '10px 14px', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span>📦</span>
                  <div style={{ fontWeight: 900, fontSize: 10, color: '#fff' }}>Thông tin sản phẩm</div>
                </div>
                {productRows.map((r, idx) => (<InfoRow key={r.label} label={r.label} value={r.value} valueColor={r.color} valueBold={r.bold} idx={idx} isLast={idx === productRows.length - 1} />))}
              </div>
            </div>

            {/* RIGHT COLUMN: Vendors List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
              <div style={{ padding: '12px 20px', background: `linear-gradient(135deg,${HC.orangeDark},${HC.orangeDeep})`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🏪</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 12, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Danh sách nhà phân phối đã gán</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>✓ Chọn nhà cung cấp → Nhập phản hồi → Gửi quyết định</div>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                {vendors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, background: HC.surface, borderRadius: 16, border: `1.5px dashed ${HC.border}` }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🏪</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.brown }}>Chưa có nhà phân phối nào được gán</div>
                    <div style={{ fontSize: 12, color: HC.muted2, marginTop: 6 }}>Bộ phận Vận hành sẽ gán nhà cung cấp sau khi xem xét sản phẩm này.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {vendors.map((v, i) => {
                      const key = vendorKey(v, i);
                      const sel = selections[key];
                      const isChecked = !!sel?.checked;
                      const feedback = sel?.feedback || '';
                      const bFeedback = bFeedbacks[key];
                      const aResponse = aResponses[key];
                      const sampleDecision = sampleDecisions[key];
                      const hasSubmitted = !!aResponse || !!sampleDecision;

                      return (
                        <div key={key} style={{
                          background: isChecked ? '#ecfdf5' : HC.surface,
                          borderRadius: 16,
                          border: `1.5px solid ${isChecked ? '#bbf7d0' : HC.border}`,
                          overflow: 'hidden',
                          transition: 'all 0.2s ease',
                          boxShadow: isChecked ? '0 4px 12px rgba(22,163,74,0.1)' : '0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                          {/* Vendor Header */}
                          <div style={{
                            padding: '14px 20px',
                            background: isChecked ? '#ecfdf5' : HC.cream,
                            borderBottom: `1px solid ${isChecked ? '#bbf7d0' : HC.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 12
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <button
                                  onClick={() => !hasSubmitted && toggleCheck(key)}
                                  style={{
                                    width: 28, height: 28, borderRadius: 8,
                                    background: isChecked ? HC.success : 'transparent',
                                    border: `2px solid ${isChecked ? HC.success : HC.muted2}`,
                                    cursor: !hasSubmitted ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    transition: 'all 0.15s', opacity: hasSubmitted ? 0.5 : 1
                                  }}
                                >
                                  {isChecked && <span style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>✓</span>}
                                </button>
                                <span style={{ fontWeight: 800, fontSize: 13, color: HC.muted }}>#{i + 1}</span>
                              </div>
                              <div>
                                <div style={{ fontWeight: 900, fontSize: 16, color: HC.orangeDark }}>{v.vendor_type || '—'}</div>
                                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: HC.muted2 }}>
                                  {v.size && <span>📏 Size: {v.size}</span>}
                                  {v.optional && <span>🎨 Optional: {v.optional}</span>}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 11, color: HC.muted }}>Pricing 1+2</div>
                              <div style={{ fontWeight: 800, fontSize: 16, color: HC.orange }}>
                                ${((v.pricing1 || 0) + (v.pricing2 || 0)).toFixed(2)}
                              </div>
                            </div>
                          </div>

                          {/* Pricing Grid */}
                          <div style={{ padding: '16px 20px', background: HC.surface2, borderBottom: `1px solid ${HC.border}` }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                              {[
                                { label: '🚚 ECONOMY', price: v.eco_price, total: v.eco_total },
                                { label: '⚡ FAST', price: v.fast_price, total: v.fast_total },
                                { label: '✈️ EXPRESS', price: v.express_price, total: v.express_total },
                                { label: '🌙 OVERNIGHT', price: v.overnight_price, total: v.overnight_total }
                              ].map((item, idx) => (
                                <div key={idx} style={{
                                  background: HC.surface, borderRadius: 10, padding: '8px 12px',
                                  border: `1px solid ${HC.border}`
                                }}>
                                  <div style={{ fontWeight: 800, fontSize: 10, color: HC.muted, marginBottom: 4 }}>{item.label}</div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 11, color: HC.muted2 }}>Ship:</span>
                                    <span style={{ fontWeight: 700 }}>{fmt(item.price)}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                                    <span style={{ fontSize: 11, color: HC.muted2 }}>Total:</span>
                                    <span style={{ fontWeight: 800, color: HC.success }}>{fmt(item.total)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Feedback Section - 2 cột */}
                          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, borderBottom: `1px solid ${HC.border}` }}>
                            {/* Staff B Feedback */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                <span style={{ fontSize: 14 }}>💬</span>
                                <span style={{ fontWeight: 800, fontSize: 11, color: HC.muted, textTransform: 'uppercase' }}>Phản hồi từ Staff B</span>
                              </div>
                              {bFeedback ? (
                                <div style={{
                                  background: '#ecfdf5', borderRadius: 12, padding: '12px',
                                  border: `1px solid #bbf7d0`
                                }}>
                                  <div style={{ fontSize: 12, color: '#065f46', lineHeight: 1.5 }}>{bFeedback.feedback}</div>
                                  <div style={{ marginTop: 6, fontSize: 9, color: '#059669' }}>{new Date(bFeedback.submittedAt).toLocaleString('vi-VN')}</div>
                                </div>
                              ) : (
                                <div style={{
                                  padding: '20px', textAlign: 'center', background: HC.orangePale,
                                  borderRadius: 12, border: `1px dashed ${HC.border}`, color: HC.muted2, fontSize: 11
                                }}>⏳ Chưa có phản hồi</div>
                              )}
                            </div>

                            {/* Seller Feedback */}
                            {/* Seller Feedback - NEW with radio buttons */}
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                <span style={{ fontSize: 14 }}>✏️</span>
                                <span style={{ fontWeight: 800, fontSize: 11, color: HC.muted, textTransform: 'uppercase' }}>Phản hồi của bạn</span>
                              </div>

                              {hasSubmitted ? (
                                <div style={{
                                  background: sampleDecision?.decision === 'dat' || aResponse?.decision === 'dat' ? '#ecfdf5' : '#fef2f2',
                                  borderRadius: 12, padding: '12px',
                                  border: `1px solid ${sampleDecision?.decision === 'dat' || aResponse?.decision === 'dat' ? '#bbf7d0' : '#fecaca'}`
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                    {sampleDecision?.decision === 'dat' || aResponse?.decision === 'dat' ? (
                                      <><span style={{ fontSize: 18 }}>✅</span><span style={{ fontWeight: 800, color: '#065f46' }}>Đã chọn đặt Sample</span></>
                                    ) : (
                                      <><span style={{ fontSize: 18 }}>❌</span><span style={{ fontWeight: 800, color: '#991b1b' }}>Đã từ chối đặt Sample</span></>
                                    )}
                                  </div>
                                  {(aResponse?.sampleDetails || sampleDecision?.sampleDetails) && (sampleDecision?.decision === 'dat' || aResponse?.decision === 'dat') && (
                                    <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff', borderRadius: 8 }}>
                                      <div style={{ fontWeight: 700, fontSize: 10, color: HC.orange }}>📦 Chi tiết Sample:</div>
                                      <div style={{ fontSize: 11, marginTop: 4, whiteSpace: 'pre-wrap' }}>{(aResponse?.sampleDetails || sampleDecision?.sampleDetails)}</div>
                                    </div>
                                  )}
                                  <div style={{ marginTop: 6, fontSize: 9, color: '#059669', textAlign: 'right' }}>
                                    {new Date(aResponse?.respondedAt || sampleDecision?.time).toLocaleString('vi-VN')}
                                  </div>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  {/* Textarea feedback */}
                                  <textarea
                                    placeholder="Nhập phản hồi của bạn về vendor này..."
                                    value={feedback}
                                    onChange={e => setFeedback(key, e.target.value)}
                                    rows={3}
                                    style={{
                                      padding: '8px 12px', borderRadius: 10,
                                      border: `1.5px solid ${feedback ? HC.orange : HC.border}`,
                                      fontSize: 12, width: '100%', resize: 'vertical',
                                      fontFamily: "'Nunito Sans',sans-serif", outline: 'none'
                                    }}
                                  />

                                  {/* Radio buttons for sample decision */}
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 800, color: HC.muted, marginBottom: 8 }}>📦 Quyết định đặt Sample:</div>
                                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                        <input
                                          type="radio"
                                          name={`sample_decision_${key}`}
                                          value="dat"
                                          checked={tempDecision === 'dat'}
                                          onChange={() => setTempDecision('dat')}
                                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: 12, fontWeight: 600 }}>✅ Đặt Sample</span>
                                      </label>
                                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                                        <input
                                          type="radio"
                                          name={`sample_decision_${key}`}
                                          value="khong"
                                          checked={tempDecision === 'khong'}
                                          onChange={() => setTempDecision('khong')}
                                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: 12, fontWeight: 600 }}>❌ Không đặt Sample</span>
                                      </label>
                                    </div>
                                  </div>

                                  {/* Conditional textarea for sample details */}
                                  {tempDecision === 'dat' && (
                                    <div>
                                      <textarea
                                        placeholder="Nhập chi tiết Sample muốn đặt (số lượng, màu sắc, kích thước, yêu cầu...)"
                                        value={tempSampleDetails}
                                        onChange={e => setTempSampleDetails(e.target.value)}
                                        rows={3}
                                        style={{
                                          padding: '8px 12px', borderRadius: 10,
                                          border: `1.5px solid ${tempSampleDetails ? HC.orange : HC.border}`,
                                          fontSize: 12, width: '100%', resize: 'vertical',
                                          fontFamily: "'Nunito Sans',sans-serif", outline: 'none'
                                        }}
                                      />
                                      <div style={{ fontSize: 10, color: HC.muted2, marginTop: 4 }}>
                                        💡 Thông tin này sẽ được gửi đến Staff B để xử lý đặt hàng
                                      </div>
                                    </div>
                                  )}

                                  {!isChecked && (
                                    <div style={{ fontSize: 10, color: HC.warning, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span>⚠️</span>
                                      <span>Vui lòng tích chọn vendor trước khi gửi</span>
                                    </div>
                                  )}

                                  <button
                                    onClick={() => {
                                      if (!isChecked) {
                                        showToastMessage('Vui lòng tích chọn vendor trước khi gửi', 'warning');
                                        return;
                                      }
                                      if (!feedback.trim()) {
                                        showToastMessage('Vui lòng nhập nội dung phản hồi', 'warning');
                                        return;
                                      }
                                      if (!tempDecision) {
                                        showToastMessage('Vui lòng chọn quyết định đặt Sample', 'warning');
                                        return;
                                      }
                                      if (tempDecision === 'dat' && !tempSampleDetails.trim()) {
                                        showToastMessage('Vui lòng nhập chi tiết Sample', 'warning');
                                        return;
                                      }
                                      // Gửi trực tiếp
                                      submitFeedbackWithDecision(key, v, tempDecision, tempSampleDetails);
                                      // Reset local state
                                      setTempDecision('');
                                      setTempSampleDetails('');
                                    }}
                                    disabled={sendingKey === key}
                                    style={{
                                      padding: '10px 16px', borderRadius: 10, border: 'none',
                                      background: (!isChecked || !feedback.trim() || !tempDecision) ? HC.muted2 :
                                        (sendingKey === key ? HC.success : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`),
                                      color: '#fff', fontSize: 12, fontWeight: 700,
                                      cursor: (!isChecked || !feedback.trim() || !tempDecision) ? 'not-allowed' : 'pointer',
                                      opacity: (!isChecked || !feedback.trim() || !tempDecision) ? 0.5 : 1,
                                      transition: 'all 0.2s ease'
                                    }}
                                  >
                                    {sendingKey === key ? '✓ Đã gửi' : '📤 Gửi cho Staff B'}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '12px 20px', background: HC.surface, borderTop: `1.5px solid ${HC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: HC.muted }}>
              {selectedCount > 0 && <span style={{ color: HC.success, fontWeight: 800 }}>✓ Đã chọn {selectedCount} vendor</span>}
            </div>
            <button onClick={onClose} style={{
              padding: '8px 24px', borderRadius: 10, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`,
              color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13
            }}>Đóng</button>
          </div>
        </div>
      </div>

      {/* Modal chọn quyết định đặt sample */}
      {showSampleModal && showSampleModal.action === 'ask_decision' && (
        <div onClick={() => setShowSampleModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1001, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 500, maxWidth: '90%', background: HC.surface, borderRadius: 20, boxShadow: HC.shadowStrong, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff' }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>📦 Quyết định đặt Sample</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>Vendor: {showSampleModal.vendor?.vendor_type || '—'}</div>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
                  Phản hồi của bạn:
                </label>
                <div style={{
                  padding: '10px 12px',
                  background: HC.orangeLight,
                  borderRadius: 10,
                  border: `1px solid ${HC.orangeMid}`,
                  fontSize: 12,
                  color: HC.ink2
                }}>
                  {selections[showSampleModal.key]?.feedback || 'Chưa có phản hồi'}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
                  Bạn muốn đặt Sample không?
                </label>

                <button
                  onClick={() => {
                    setShowSampleModal({
                      key: showSampleModal.key,
                      vendor: showSampleModal.vendor,
                      action: 'dat'
                    });
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    background: `linear-gradient(135deg,${HC.success},#15803d)`,
                    color: '#fff',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    marginBottom: 12
                  }}
                >
                  ✅ Có, tôi muốn đặt Sample
                </button>

                <button
                  onClick={() => {
                    submitFeedbackWithDecision(showSampleModal.key, showSampleModal.vendor, 'khong', '');
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 10,
                    background: `linear-gradient(135deg,${HC.danger},#b91c1c)`,
                    color: '#fff',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  ❌ Không, tôi không đặt Sample
                </button>
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: `1px solid ${HC.border}`, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowSampleModal(null)} style={{ padding: '8px 20px', borderRadius: 8, background: HC.cream, border: `1px solid ${HC.border}`, color: HC.brown, cursor: 'pointer', fontWeight: 700 }}>Hủy</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal nhập chi tiết Sample */}
      {showSampleModal && showSampleModal.action === 'dat' && (
        <div onClick={() => setShowSampleModal(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1002, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 500, maxWidth: '90%', background: HC.surface, borderRadius: 20, boxShadow: HC.shadowStrong, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: `linear-gradient(135deg,${HC.success},#15803d)`, color: '#fff' }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>📦 Nhập chi tiết đặt Sample</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>Vendor: {showSampleModal.vendor?.vendor_type || '—'}</div>
            </div>
            <div style={{ padding: '24px' }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
                Chi tiết Sample muốn đặt <span style={{ color: HC.danger }}>*</span>
              </label>
              <textarea
                autoFocus
                rows={5}
                placeholder="Vui lòng mô tả chi tiết sample muốn đặt:&#10;- Số lượng:&#10;- Màu sắc:&#10;- Kích thước:&#10;- Yêu cầu đặc biệt:&#10;- ..."
                value={tempSampleDetails}
                onChange={e => setTempSampleDetails(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1.5px solid ${tempSampleDetails.trim() ? HC.orange : HC.border}`,
                  fontSize: 13,
                  resize: 'vertical',
                  fontFamily: "'Nunito Sans',sans-serif",
                  outline: 'none'
                }}
              />
              <div style={{ marginTop: 12, fontSize: 11, color: HC.muted2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>💡</span>
                <span>Thông tin này sẽ được gửi đến Staff B để xử lý đặt hàng</span>
              </div>
            </div>
            <div style={{ padding: '16px 20px', borderTop: `1px solid ${HC.border}`, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowSampleModal({
                    key: showSampleModal.key,
                    vendor: showSampleModal.vendor,
                    action: 'ask_decision'
                  });
                  setTempSampleDetails('');
                }}
                style={{ padding: '8px 20px', borderRadius: 8, background: HC.cream, border: `1px solid ${HC.border}`, color: HC.brown, cursor: 'pointer', fontWeight: 700 }}
              >
                Quay lại
              </button>
              <button
                onClick={() => {
                  if (tempSampleDetails.trim()) {
                    submitFeedbackWithDecision(
                      showSampleModal.key,
                      showSampleModal.vendor,
                      'dat',
                      tempSampleDetails.trim()
                    );
                  }
                }}
                disabled={!tempSampleDetails.trim()}
                style={{
                  padding: '8px 24px',
                  borderRadius: 8,
                  background: !tempSampleDetails.trim() ? HC.muted2 : `linear-gradient(135deg,${HC.success},#15803d)`,
                  color: '#fff',
                  border: 'none',
                  cursor: !tempSampleDetails.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 700
                }}
              >
                Xác nhận đặt Sample
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && mediaUrls.length > 0 && (
        <div onClick={() => setLightboxOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)', cursor: 'pointer'
        }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            {isVideo(mediaUrls[lightboxIndex]) ? (
              <video src={mediaUrls[lightboxIndex]} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12 }} />
            ) : (
              <img src={mediaUrls[lightboxIndex]} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
            )}
            {mediaUrls.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev - 1 + mediaUrls.length) % mediaUrls.length); }} style={{
                  position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
                  width: 48, height: 48, cursor: 'pointer', color: '#fff', fontSize: 28
                }}>‹</button>
                <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev + 1) % mediaUrls.length); }} style={{
                  position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
                  width: 48, height: 48, cursor: 'pointer', color: '#fff', fontSize: 28
                }}>›</button>
                <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: 20, color: '#fff' }}>
                  {lightboxIndex + 1} / {mediaUrls.length}
                </div>
              </>
            )}
            <button onClick={() => setLightboxOpen(false)} style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
              width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 20
            }}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}
// ══════════════════════════════════════════════════════════
//  PRODUCTS SECTION (Seller)
// ══════════════════════════════════════════════════════════
// ─── PRODUCTS SECTION (Seller) - VỚI MODAL TẠO SẢN PHẨM ─────────────────────────────────
function ProductsSection({ highlightedProductId, onHighlightCleared }) {
  const { user } = useAuth();
  const [viewProduct, setViewProduct] = useState(null);
  const [submittedProducts, setSubmittedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);  // Đổi thành showFormModal
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState({ ...EMPTY_FORM, mediaFiles: [] });
  const [editingProduct, setEditingProduct] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [toast, setToast] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [productVendors, setProductVendors] = useState(() => lsGet(LS_PRODUCT_VENDORS, {}));
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [formErrors, setFormErrors] = useState({});
  const processedProductIdRef = useRef(null);
  const [tempLink, setTempLink] = useState('');

  // Thêm link mới
  const addLink = () => {
    console.log("addLink clicked!", tempLink); // ✅ Thêm log để debug
    if (tempLink.trim()) {
      let url = tempLink.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      setForm(prev => ({
        ...prev,
        product_type_links: [...prev.product_type_links, url]
      }));
      setTempLink('');
    }
  };

  // Xóa link
  const removeLink = (indexToRemove) => {
    setForm(prev => ({
      ...prev,
      product_type_links: prev.product_type_links.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  // Mở link
  const openLink = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Reset form
  const resetForm = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setForm({ ...EMPTY_FORM, mediaFiles: [], product_type_links: [] });
    setPreviewUrls([]);
    setTempLink('');
    setFormErrors({});
    setIsEditing(false);
    setEditingProduct(null);
  };

  // Mở modal tạo mới
  const openCreateModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  // Mở modal chỉnh sửa
  const openEditModal = (product) => {
    setIsEditing(true);
    setEditingProduct(product);

    let links = [];
    if (product.product_type_links) {
      if (Array.isArray(product.product_type_links)) {
        links = product.product_type_links;
      } else if (typeof product.product_type_links === 'string') {
        try {
          links = JSON.parse(product.product_type_links);
        } catch {
          links = [product.product_type_links];
        }
      }
    } else if (product.product_type_link) {
      links = [product.product_type_link];
    }

    const existingMediaUrls = product.media_urls || (product.media_url ? [product.media_url] : []);
    setPreviewUrls(existingMediaUrls);
    setForm({
      deadline_date: product.deadline_date || '',
      product_type: product.product_type || '',
      mediaFiles: [],
      product_type_links: links,
      other_specs: product.other_specs || '',
      material: product.material || '',
      print_area: product.print_area || '',
      good_review: product.good_review || '',
      bad_review: product.bad_review || '',
      packaging_links: product.packaging_links || '',
      other_packaging: product.other_packaging || '',
    });
    setShowFormModal(true);
  };

  // Đóng modal
  const closeModal = () => {
    setShowFormModal(false);
    resetForm();
  };

  useEffect(() => {
    if (!highlightedProductId) return;

    const productId = parseInt(highlightedProductId, 10);
    console.log('🔍 Looking for product with ID:', productId);
    console.log('📋 Submitted products:', submittedProducts);

    const openProductModal = () => {
      const product = submittedProducts.find(p => String(p.id) === String(productId));
      if (product) {
        console.log('✅ Found product:', product);
        setViewProduct(product);
        if (onHighlightCleared) onHighlightCleared();
        return true;
      }
      return false;
    };

    if (submittedProducts.length > 0) {
      if (!openProductModal()) {
        console.log('⚠️ Product not found in current list, will retry...');
      }
      return;
    }

    let retryCount = 0;
    const maxRetries = 10;
    const interval = setInterval(() => {
      retryCount++;
      console.log(`🔄 Retry ${retryCount}/${maxRetries} to find product...`);

      if (submittedProducts.length > 0) {
        const product = submittedProducts.find(p => String(p.id) === String(productId));
        if (product) {
          clearInterval(interval);
          console.log('✅ Found product after retry:', product);
          setViewProduct(product);
          if (onHighlightCleared) onHighlightCleared();
        } else if (retryCount >= maxRetries) {
          clearInterval(interval);
          console.log('❌ Max retries reached, product not found');
        }
      } else if (retryCount >= maxRetries) {
        clearInterval(interval);
        console.log('❌ Max retries reached, no products loaded');
      }
    }, 500);

    return () => clearInterval(interval);
  }, [highlightedProductId, submittedProducts, onHighlightCleared]);

  const fld = key => e => {
    setForm(p => ({ ...p, [key]: e.target.value }));
    if (formErrors[key]) {
      setFormErrors(prev => ({ ...prev, [key]: null }));
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const newPreviewUrls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    setForm(prev => ({
      ...prev,
      mediaFiles: [...prev.mediaFiles, ...files]
    }));

    if (formErrors.media) {
      setFormErrors(prev => ({ ...prev, media: null }));
    }
  };

  const removeFile = (indexToRemove) => {
    URL.revokeObjectURL(previewUrls[indexToRemove]);
    setPreviewUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setForm(prev => ({
      ...prev,
      mediaFiles: prev.mediaFiles.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const validateForm = () => {
    const errors = {};

    if (!form.product_type?.trim()) {
      errors.product_type = 'Vui lòng nhập loại sản phẩm';
    }
    if (!form.product_type_links || form.product_type_links.length === 0) {
      errors.product_type_links = 'Vui lòng thêm ít nhất 1 link sản phẩm';
    }
    if (!form.other_specs?.trim()) {
      errors.other_specs = 'Vui lòng nhập đặc tính kỹ thuật';
    }
    if (!form.material?.trim()) {
      errors.material = 'Vui lòng nhập chất liệu';
    }
    if (!form.print_area?.trim()) {
      errors.print_area = 'Vui lòng nhập vùng in/thiết kế';
    }
    if (!form.good_review?.trim()) {
      errors.good_review = 'Vui lòng nhập good review';
    }
    if (!form.bad_review?.trim()) {
      errors.bad_review = 'Vui lòng nhập bad review';
    }
    if (form.mediaFiles.length === 0 && previewUrls.length === 0) {
      errors.media = 'Vui lòng chọn ít nhất 1 file media';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getStatus = p => { const s = p.status || 'draft'; return s === 'rejected' ? 'reject' : s; };

  const normalizeList = resp => {
    try {
      if (!resp) return [];
      const body = resp.data !== undefined ? resp.data : resp;
      if (Array.isArray(body?.data?.data)) return body.data.data;
      if (Array.isArray(body?.data)) return body.data;
      if (Array.isArray(body)) return body;
      return [];
    } catch { return []; }
  };

  const loadProducts = useCallback(() => {
    setLoading(true);
    setApiError('');
    return productApi.mySubmitted().then(r => {
      const data = normalizeList(r);
      console.log('📦 Loaded products from API:', data);

      const enriched = data.map(p => {
        let links = [];
        if (p.product_type_links) {
          if (Array.isArray(p.product_type_links)) {
            links = p.product_type_links;
          } else if (typeof p.product_type_links === 'string') {
            try { links = JSON.parse(p.product_type_links); }
            catch { links = [p.product_type_links]; }
          }
        } else if (p.product_type_link) {
          links = [p.product_type_link];
        }
        return {
          ...p,
          product_type_links: links,
          media_urls: p.media_urls || (p.media_url ? [p.media_url] : [])
        };
      });
      setSubmittedProducts(enriched);
      return enriched;
    })
      .catch(err => {
        setApiError(err.response?.data?.message || err.message || 'Lỗi tải dữ liệu');
        setSubmittedProducts([]);
        return [];
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const showToast = (type, title, message, duration = 3000) => {
    setToast({ type, title, message, duration });
    setTimeout(() => setToast(null), duration);
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', '❌ Thiếu thông tin', 'Vui lòng điền đầy đủ tất cả các trường bắt buộc');
      return;
    }

    setSubmitting(true);
    const data = new FormData();
    ['product_type', 'other_specs', 'material', 'print_area', 'good_review', 'bad_review', 'packaging_links', 'other_packaging']
      .forEach(k => { if (form[k]) data.append(k, form[k]); });

    if (form.product_type_links && form.product_type_links.length > 0) {
      data.append('product_type_links', JSON.stringify(form.product_type_links));
    }

    if (user?.sellerName || user?.seller_name) {
      data.append('seller_name', user.sellerName || user.seller_name);
      console.log('📤 Đang gửi seller_name:', user.sellerName || user.seller_name);
    }

    form.mediaFiles.forEach(file => {
      data.append('media[]', file);
    });

    for (let pair of data.entries()) {
      console.log(pair[0], pair[1]);
    }

    try {
      await productApi.create(data);
      await loadProducts();

      const savedFormLinks = [...form.product_type_links];
      const savedMaterial = form.material;
      const savedOtherSpecs = form.other_specs;
      const savedPrintArea = form.print_area;
      setSubmittedProducts(prev => prev.map((p, idx) => {
        if (idx !== 0) return p;
        return {
          ...p,
          material: savedMaterial || p.material,
          other_specs: savedOtherSpecs || p.other_specs,
          print_area: savedPrintArea || p.print_area,
          product_type_links: savedFormLinks.length ? savedFormLinks : p.product_type_links,
        };
      }));

      closeModal();
      showToast('success', '✅ Tạo mới thành công!', `Sản phẩm được tạo bởi: ${user?.sellerName || user?.seller_name || user?.email}`);
    } catch (err) {
      showToast('error', '❌ Lỗi tạo sản phẩm!', err.response?.data?.message || err.message || 'Không thể tạo sản phẩm');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async e => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('error', '❌ Thiếu thông tin', 'Vui lòng điền đầy đủ tất cả các trường bắt buộc');
      return;
    }

    const savedFormData = {
      product_type: form.product_type,
      other_specs: form.other_specs,
      material: form.material,
      print_area: form.print_area,
      good_review: form.good_review,
      bad_review: form.bad_review,
      packaging_links: form.packaging_links,
      other_packaging: form.other_packaging,
      product_type_links: [...form.product_type_links],
    };
    const savedProductId = editingProduct.id;

    setSubmitting(true);
    const data = new FormData();
    ['product_type', 'other_specs', 'material', 'print_area', 'good_review', 'bad_review', 'packaging_links', 'other_packaging']
      .forEach(k => { if (form[k]) data.append(k, form[k]); });

    if (form.product_type_links && form.product_type_links.length > 0) {
      data.append('product_type_links', JSON.stringify(form.product_type_links));
    }

    form.mediaFiles.forEach(file => { data.append('media[]', file); });

    try {
      await productApi.update(savedProductId, data);
      await loadProducts();

      setSubmittedProducts(prev => prev.map(p => {
        if (p.id !== savedProductId) return p;
        return { ...p, ...savedFormData };
      }));

      closeModal();
      showToast('success', '✅ Cập nhật thành công!', 'Sản phẩm đã được cập nhật.');
    } catch (err) {
      showToast('error', '❌ Lỗi cập nhật!', err.response?.data?.message || err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async id => {
    setProcessingId(id);
    try {
      await productApi.delete(id);
      await loadProducts();
      setConfirmDeleteId(null);
      showToast('success', '🗑 Đã xóa!', 'Sản phẩm đã được xóa thành công.');
    } catch (err) {
      showToast('error', '❌ Lỗi xóa!', err.response?.data?.message || err.message);
    } finally { setProcessingId(null); }
  };

  const handleSendToAdmin = async id => {
    setProcessingId(id);
    try {
      await productApi.sendToAdmin(id);
      await loadProducts();
      showToast('success', '📤 Đã gửi!', 'Form đã được gửi đến Admin để xét duyệt.');
    } catch (err) {
      showToast('error', '❌ Lỗi gửi!', err.response?.data?.message || err.message);
    } finally { setProcessingId(null); }
  };

  const handleExport = () => {
    if (!filteredProducts.length) {
      showToast('warning', '⚠️ Không có dữ liệu', 'Không có sản phẩm nào để xuất!');
      return;
    }
    const d = new Date().toLocaleDateString('vi-VN').replace(/\//g, '-');
    exportProductsToExcel(filteredProducts, productVendors, `products_${d}.xlsx`);
  };

  const filteredProducts = submittedProducts.filter(p => {
    const hay = `${p.product_type || ''} ${p.other_specs || ''}`.toLowerCase();
    const status = getStatus(p);
    return (!search || hay.includes(search.toLowerCase())) && (!filterStatus || status === filterStatus);
  });

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus]);
  const hasFilter = search || filterStatus;
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const renderVendorBadge = (p) => {
    const vendors = productVendors[p.id] || [];
    const aSelections = lsGet(LS_A_SELECTIONS, {})[p.id] || {};
    const selectedCount = Object.values(aSelections).filter(s => s?.checked).length;
    if (vendors.length === 0) return <span style={{ color: HC.muted2, fontSize: 11, fontStyle: 'italic' }}>Chưa gán</span>;
    return (<div><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: '#ecfdf5', border: '1px solid #bbf7d0', fontSize: 11, fontWeight: 800, color: '#065f46' }}>Assigned · {vendors.length} vendor</span>{selectedCount > 0 && <span style={{ fontSize: 10, color: HC.success, marginLeft: 8 }}>✓ Đã chọn {selectedCount}</span>}</div>);
  };

  if (loading) return <Spinner />;

  return (
    <div>
      {toast && (<div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, animation: 'slideIn 0.3s ease-out, fadeOut 0.3s ease-out 4.7s forwards', maxWidth: 380 }}><div style={{ background: toast.type === 'success' ? `linear-gradient(135deg, ${HC.success}, #15803d)` : toast.type === 'error' ? `linear-gradient(135deg, ${HC.danger}, #b91c1c)` : `linear-gradient(135deg, ${HC.warning}, #d97706)`, color: '#fff', borderRadius: 12, boxShadow: HC.shadowStrong, overflow: 'hidden' }}><div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontSize: 24 }}>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}</span><div><div style={{ fontWeight: 900, fontSize: 13 }}>{toast.title}</div><div style={{ fontSize: 11, opacity: 0.9 }}>{toast.message}</div></div><button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button></div><div style={{ height: 3, background: 'rgba(255,255,255,0.5)', animation: `progressBar ${(toast.duration || 5000) / 1000}s linear forwards`, transformOrigin: 'left' }} /></div></div>)}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: HC.ink }}>Danh Sách Sản Phẩm</h3>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 11, background: HC.success, color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>⬇ Xuất Excel{hasFilter && <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '1px 6px', fontSize: 10 }}>{filteredProducts.length}</span>}</button>
          <button onClick={openCreateModal} style={{ padding: '9px 16px', borderRadius: 11, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>+ Tạo Sản Phẩm Mới</button>
        </div>
      </div>

      {apiError && <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700 }}>⚠️ {apiError}<button onClick={loadProducts} style={{ marginLeft: 12, padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer' }}>Thử lại</button></div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, padding: '12px 16px', background: HC.surface, borderRadius: 14, border: `1.5px solid ${HC.border}` }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: HC.muted }}>🔍</span>
          <input type="text" placeholder="Tìm loại sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, paddingLeft: 34 }} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: '1 1 150px', minWidth: 130, padding: '9px 12px', borderRadius: 9, border: `1.5px solid ${HC.border}`, fontSize: 12, background: HC.surface2 }}>
          <option value="">Tất cả trạng thái</option>
          <option value="draft">📝 Draft (Chưa gửi)</option>
          <option value="pending">⏳ Pending (Chờ duyệt)</option>
          <option value="approved">✅ Approved (Đã duyệt)</option>
          <option value="reject">❌ Rejected (Từ chối)</option>
        </select>
        {hasFilter && <button onClick={() => { setSearch(''); setFilterStatus(''); }} style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #fecaca', background: '#fef2f2', color: HC.danger, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>✕ Xóa lọc</button>}
        <div style={{ fontSize: 11, color: HC.muted, fontWeight: 700 }}>{filteredProducts.length} / {submittedProducts.length} sản phẩm</div>
      </div>

      {filteredProducts.length === 0 ? <EmptyState msg={submittedProducts.length === 0 ? 'Chưa có sản phẩm nào. Hãy tạo sản phẩm mới!' : 'Không tìm thấy kết quả phù hợp'} /> : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 14, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, background: HC.surface }}>
              <thead>
                <tr>
                  {['STT', 'Product Type', 'Hình ảnh', 'Date Request', 'Deadline', 'Trạng thái', 'Lý do', 'Nhà phân phối', 'Thao tác'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: HC.brown, fontWeight: 900, borderBottom: `1.5px solid ${HC.border}`, fontSize: 10, textTransform: 'uppercase', background: HC.cream }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedProducts.map((p, i) => {
                  const mediaUrls = getMediaUrls(p);
                  const status = getStatus(p);
                  const isDraft = status === 'draft';
                  const isRejected = status === 'reject';
                  return (
                    <tr key={p.id || i} style={{ borderBottom: `1px solid ${HC.border}`, background: isRejected ? '#fef2f2' : 'transparent' }}>
                      <td style={{ padding: '12px 14px', color: HC.muted, fontWeight: 700 }}>{(currentPage - 1) * ITEMS_PER_PAGE + i + 1}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: HC.ink2 }}>{p.product_type || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <MediaGallery mediaUrls={mediaUrls} />
                      </td>
                      <td style={{ padding: '12px 14px' }}>{fmtDate(p.created_at) || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>{fmtDate(p.deadline_date) || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <Badge status={status} />
                      </td>
                      <td style={{ padding: '12px 14px', maxWidth: 200, wordBreak: 'break-word' }}>
                        {isRejected ? (p.rejection_reason || p.reason || '—') : '—'}
                      </td>
                      <td style={{ padding: '12px 14px' }}>{renderVendorBadge(p)}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => setViewProduct(p)} style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${HC.border}`, background: HC.cream, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: HC.brown }}>👁 Xem</button>
                          {isDraft && <button onClick={() => handleSendToAdmin(p.id)} disabled={processingId === p.id} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #bbf7d0', background: processingId === p.id ? '#d1fae5' : '#ecfdf5', cursor: processingId === p.id ? 'wait' : 'pointer', fontSize: 11, fontWeight: 800, color: '#065f46' }}>{processingId === p.id ? '⟳ Đang gửi...' : '📤 Gửi Admin'}</button>}
                          {isDraft && <button onClick={() => openEditModal(p)} style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${HC.orangeMid}`, background: HC.orangeLight, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: HC.orangeDark }}>✏️ Sửa</button>}
                          {isDraft && <button onClick={() => handleDelete(p.id)} disabled={processingId === p.id} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #fecaca', background: processingId === p.id ? '#fee2e2' : '#fef2f2', cursor: processingId === p.id ? 'wait' : 'pointer', fontSize: 11, fontWeight: 800, color: HC.danger }}>{processingId === p.id ? '⟳ Đang xóa...' : '🗑 Xóa'}</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            onPageChange={setCurrentPage}
            itemsPerPage={20}
          />
        </>
      )}

      {/* MODAL TẠO/SỬA SẢN PHẨM */}
      {showFormModal && (
        <div onClick={closeModal} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 900, maxHeight: '85vh', overflowY: 'auto', background: HC.surface, borderRadius: 20, boxShadow: HC.shadowStrong, border: `1.5px solid ${HC.border}` }}>

            {/* Modal Header */}
            <div style={{ padding: '16px 24px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, borderRadius: '20px 20px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>
                  {isEditing ? '✏️ Chỉnh sửa sản phẩm' : '➕ Thêm sản phẩm mới'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
                  {isEditing ? 'Cập nhật thông tin sản phẩm' : 'Điền đầy đủ thông tin để tạo sản phẩm mới'}
                </div>
              </div>
              <button onClick={closeModal} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Modal Body */}
            <form onSubmit={isEditing ? handleUpdate : handleSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: 16 }}>
                <Field label="Product Type" required error={formErrors.product_type}>
                  <input
                    type="text"
                    placeholder="VD: Áo thun, Cốc sứ..."
                    value={form.product_type}
                    onChange={fld('product_type')}
                    style={{
                      ...inp,
                      borderColor: formErrors.product_type ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Field label="Hình ảnh / Video (nhiều file)" required error={formErrors.media}>
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm"
                    multiple
                    onChange={handleFileChange}
                    style={{
                      ...inp,
                      padding: '7px 10px',
                      cursor: 'pointer',
                      borderColor: formErrors.media ? HC.danger : HC.border
                    }}
                  />
                  {previewUrls.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {previewUrls.map((url, idx) => (
                        <div key={idx} style={{ position: 'relative', width: 70, height: 70, borderRadius: 8, overflow: 'hidden', border: `1px solid ${HC.border}`, background: '#2a1a00' }}>
                          {url.match(/\.(mp4|webm|mov)$/i) || url.includes('video') ? (
                            <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                          <button type="button" onClick={() => removeFile(idx)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: 20, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 10 }}><DeleteOutlined /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </Field>

                <Field label="Product Type Link" required error={formErrors.product_type_links}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="url"
                      placeholder="https://example.com"
                      value={tempLink}
                      onChange={e => setTempLink(e.target.value)}
                      onKeyPress={e => e.key === 'Enter' && addLink()}
                      style={{
                        ...inp,
                        flex: 1,
                        borderColor: formErrors.product_type_links ? HC.danger : HC.border
                      }}
                    />
                    <button
                      type="button"
                      onClick={addLink}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 9,
                        background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`,
                        color: '#fff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      + Thêm link
                    </button>
                  </div>

                  {form.product_type_links.length > 0 && (
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {form.product_type_links.map((link, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: HC.orangeLight, borderRadius: 20, border: `1px solid ${HC.orangeMid}` }}>
                          <a href="#" onClick={(e) => { e.preventDefault(); openLink(link); }} style={{ color: HC.orangeDark, fontSize: 12, fontWeight: 600, textDecoration: 'none', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }} title={link}>
                            🔗 {link.length > 40 ? link.substring(0, 40) + '...' : link}
                          </a>
                          <button type="button" onClick={() => removeLink(idx)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: HC.danger, fontSize: 12, display: 'flex', alignItems: 'center', padding: 0 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {formErrors.product_type_links && (
                    <span style={{ color: HC.danger, fontSize: 10, marginTop: 2 }}>⚠ {formErrors.product_type_links}</span>
                  )}
                </Field>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Field label="Đặc tính kĩ thuật" required error={formErrors.other_specs}>
                  <textarea
                    placeholder="Mô tả yêu cầu kỹ thuật..."
                    value={form.other_specs}
                    onChange={fld('other_specs')}
                    style={{
                      ...inp,
                      minHeight: 72,
                      resize: 'vertical',
                      borderColor: formErrors.other_specs ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Field label="Chất liệu" required error={formErrors.material}>
                  <input
                    type="text"
                    placeholder="VD: Cotton 100%..."
                    value={form.material}
                    onChange={fld('material')}
                    style={{
                      ...inp,
                      borderColor: formErrors.material ? HC.danger : HC.border
                    }}
                  />
                </Field>
                <Field label="Vùng In/Thiết kế" required error={formErrors.print_area}>
                  <input
                    type="text"
                    placeholder="VD: Ngực trái, Full lưng..."
                    value={form.print_area}
                    onChange={fld('print_area')}
                    style={{
                      ...inp,
                      borderColor: formErrors.print_area ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <Field label="Good Review" required error={formErrors.good_review}>
                  <textarea
                    placeholder="Ưu điểm..."
                    value={form.good_review}
                    onChange={fld('good_review')}
                    style={{
                      ...inp,
                      minHeight: 70,
                      resize: 'vertical',
                      borderColor: formErrors.good_review ? HC.danger : HC.border
                    }}
                  />
                </Field>
                <Field label="Bad Review" required error={formErrors.bad_review}>
                  <textarea
                    placeholder="Nhược điểm..."
                    value={form.bad_review}
                    onChange={fld('bad_review')}
                    style={{
                      ...inp,
                      minHeight: 70,
                      resize: 'vertical',
                      borderColor: formErrors.bad_review ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <Field label="Packing">
                  <input
                    type="text"
                    placeholder="VD: Túi zip..."
                    value={form.packaging_links}
                    onChange={fld('packaging_links')}
                    style={{
                      ...inp,
                      borderColor: formErrors.packaging_links ? HC.danger : HC.border
                    }}
                  />
                </Field>
                <Field label="Other Packing">
                  <input
                    type="text"
                    placeholder="Đóng gói khác..."
                    value={form.other_packaging}
                    onChange={fld('other_packaging')}
                    style={{
                      ...inp,
                      borderColor: formErrors.other_packaging ? HC.danger : HC.border
                    }}
                  />
                </Field>
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${HC.border}` }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    padding: '10px 20px',
                    borderRadius: 10,
                    background: HC.cream,
                    border: `1.5px solid ${HC.border}`,
                    color: HC.brown,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    background: submitting ? HC.muted2 : `linear-gradient(135deg,${HC.success},#15803d)`,
                    color: '#fff',
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  {submitting ? '⟳ Đang xử lý...' : isEditing ? '✓ Cập nhật' : '💾 Lưu (Draft)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewProduct && <ProductViewerModal product={viewProduct} productVendors={productVendors} onClose={() => setViewProduct(null)} getStatus={getStatus} />}

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeOut { to { opacity: 0; transform: translateX(100%); } }
        @keyframes progressBar { from { width: 100%; } to { width: 0%; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  VENDORS SECTION (Seller - Read-only)
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  VENDORS SECTION (Seller - Read-only)
// ══════════════════════════════════════════════════════════
function BestSellerBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 999,
      background: 'linear-gradient(135deg,#FFF8DC,#FFE97A)',
      border: '1.5px solid #D4A017',
      color: HC.gold, fontSize: 10, fontWeight: 900,
      fontFamily: "'Nunito',sans-serif", letterSpacing: '0.04em',
    }}>
      ⭐ Best Seller
    </span>
  );
}
function VendorsSection() {
  const [vendorList, setVendorList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await vendorApi.list({ per_page: 10000 });

      let list = [];
      if (res.data?.data?.data && Array.isArray(res.data.data.data)) {
        list = res.data.data.data;
      } else if (res.data?.data && Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data)) {
        list = res.data;
      }

      setVendorList(list);
    } catch (err) {
      setApiError(err.response?.data?.message || err.message || 'Lỗi tải dữ liệu');
      setVendorList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  // Refresh mỗi 30 giây
  useEffect(() => {
    const interval = setInterval(loadVendors, 30000);
    return () => clearInterval(interval);
  }, [loadVendors]);

  const TH = (extra = {}) => ({
    padding: '8px 10px',
    fontWeight: 900,
    fontSize: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: '#fff',
    background: HC.orangeDark,
    border: `1px solid ${HC.orange}`,
    ...extra
  });
  const TD = (extra = {}) => ({
    padding: '9px 10px',
    fontSize: 12,
    color: HC.ink2,
    border: `1px solid ${HC.border}`,
    textAlign: 'center',
    verticalAlign: 'middle',
    background: HC.surface2,
    ...extra
  });
  const TDalt = (extra = {}) => ({ ...TD(extra), background: HC.orangePale });
  const fmt = n => (n != null && n !== '') ? Number(n).toFixed(2) : '—';

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>Danh sách Vendor</div>
          <div style={{ padding: '7px 14px', borderRadius: 10, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, fontSize: 11, fontWeight: 700, color: HC.brown }}>👁 Chế độ chỉ xem</div>
        </div>
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 15 }}>Danh sách Vendor <span style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 999, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, color: HC.orangeDark, fontSize: 11 }}>{vendorList.length} vendor</span></div>
        <div style={{ padding: '7px 14px', borderRadius: 10, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, fontSize: 11, fontWeight: 700, color: HC.brown }}>👁 Chế độ chỉ xem</div>
      </div>

      {apiError && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {apiError}</span>
          <button onClick={loadVendors} style={{ padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Thử lại</button>
        </div>
      )}

      <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 12, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, fontSize: 11, color: HC.brown, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>💡</span>
        <span>Danh sách vendor được quản lý bởi <b>Staff Dashboard B</b>. Trang này chỉ hiển thị để tham khảo.</span>
      </div>

      {vendorList.length === 0 ? (
        <EmptyState msg="Chưa có vendor nào được thêm vào hệ thống" />
      ) : (
        <div style={{ overflowX: 'auto', boxShadow: HC.shadow, borderRadius: 16, border: `1.5px solid ${HC.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
            <thead>
              {/* Hàng 1 */}
              <tr>
                <th rowSpan={2} style={{ ...TH(), minWidth: 50 }}>STT</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 150 }}>Vendor Name</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 120 }}>Vendor Type</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 150 }}>Product Type</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 100, background: HC.orange }}>💰 Pricing</th>  {/* ← Cột Pricing gộp */}
                <th colSpan={2} style={TH()}>Detail</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orange }}>Economy</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orangeDark }}>Fast</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orange }}>Express</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orangeDark }}>Overnight</th>
              </tr>
              {/* Hàng 2 */}
              <tr>
                <th style={TH({ minWidth: 80 })}>Size</th>
                <th style={TH({ minWidth: 90 })}>Optional</th>
                <th style={TH({ minWidth: 85 })}>Ship</th>
                <th style={TH({ minWidth: 100 })}>Total</th>
                <th style={TH({ minWidth: 85 })}>Ship</th>
                <th style={TH({ minWidth: 100 })}>Total</th>
                <th style={TH({ minWidth: 85 })}>Ship</th>
                <th style={TH({ minWidth: 100 })}>Total</th>
                <th style={TH({ minWidth: 85 })}>Ship</th>
                <th style={TH({ minWidth: 100 })}>Total</th>
              </tr>
            </thead>
            <tbody>
              {vendorList.map((v, i) => {
                const C = i % 2 === 0 ? TD : TDalt;
                const totalPricing = (v.pricing1 || 0) + (v.pricing2 || 0);

                return (
                  <tr key={v.id || i}>
                    <td style={{ ...C(), color: HC.muted, fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ ...C(), fontWeight: 800, color: HC.ink2 }}>{v.name || v.vendor_type || '—'}</td>
                    <td style={{ ...C(), fontWeight: 800 }}>
                      {v.vendor_type === 'Best Seller' ? <BestSellerBadge /> : (v.vendor_type || '—')}
                    </td>
                    <td style={{ ...C(), fontWeight: 800, color: HC.orange }}>{v.product_type || '—'}</td>
                    {/* Cột Pricing gộp */}
                    <td style={{ ...C(), fontWeight: 800, color: HC.success, fontSize: 13, background: i % 2 === 0 ? '#ecfdf5' : '#d1fae5' }}>
                      ${totalPricing.toFixed(2)}
                    </td>
                    <td style={C()}>{v.size || '—'}</td>
                    <td style={C()}>{v.optional || '—'}</td>
                    <td style={C()}>{fmt(v.eco_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.eco_total)}</td>
                    <td style={C()}>{fmt(v.fast_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.fast_total)}</td>
                    <td style={C()}>{fmt(v.express_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.express_total)}</td>
                    <td style={C()}>{fmt(v.overnight_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.overnight_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════
//  SETUP PRICE SECTION (FIXED - chỉ giữ Vendor từ Staff B gán)
// ══════════════════════════════════════════════════════════
function SetupPriceSection() {
  const LS_PRICE_KEY = 'STAFF_PRICE_LIST_V3';

  const [assignedPriceList, setAssignedPriceList] = useState([]);
  const [search, setSearch] = useState('');
  const [filterProductType, setFilterProductType] = useState('');
  const [currentPageAssigned, setCurrentPageAssigned] = useState(1);
  const ITEMS_PER_PAGE_PRICE = 10;
  const [toast, setToast] = useState(null);
  const selectedIndexRef = useRef(-1);
  const [approvedVendors, setApprovedVendors] = useState([]);
  const [productVendors, setProductVendors] = useState(() => lsGet(LS_PRODUCT_VENDORS, {}));
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [componentError, setComponentError] = useState(null);


  // State cho nhiều giá trị
  const [displayPrices, setDisplayPrices] = useState([0]);
  const [customizePrices, setCustomizePrices] = useState([0]);
  const [shipPrices, setShipPrices] = useState([0]);

  const [setupForm, setSetupForm] = useState({
    shipping_method: 'economy',
    size: '',
    final_price: 0,
    profit: 0,
    profit_margin: 0,
    coupon_percent: 0,
    coupon_fee: 0  // Thêm coupon_fee
  });

  // Thông tin ship price và total price theo phương thức
  const [shipInfo, setShipInfo] = useState({
    ship_price: 0,
    total_price: 0
  });

  // Hàm thêm giá trị mới
  const addPriceField = (type) => {
    switch (type) {
      case 'display':
        setDisplayPrices([...displayPrices, 0]);
        break;
      case 'customize':
        setCustomizePrices([...customizePrices, 0]);
        break;
      case 'ship':
        setShipPrices([...shipPrices, 0]);
        break;
      default:
        break;
    }
  };

  // Hàm xóa giá trị
  const removePriceField = (type, index) => {
    switch (type) {
      case 'display':
        if (displayPrices.length > 1) {
          const newPrices = [...displayPrices];
          newPrices.splice(index, 1);
          setDisplayPrices(newPrices);
        }
        break;
      case 'customize':
        if (customizePrices.length > 1) {
          const newPrices = [...customizePrices];
          newPrices.splice(index, 1);
          setCustomizePrices(newPrices);
        }
        break;
      case 'ship':
        if (shipPrices.length > 1) {
          const newPrices = [...shipPrices];
          newPrices.splice(index, 1);
          setShipPrices(newPrices);
        }
        break;
      default:
        break;
    }
  };

  // Hàm cập nhật giá trị
  const updatePriceField = (type, index, value) => {
    switch (type) {
      case 'display':
        const newDisplayPrices = [...displayPrices];
        newDisplayPrices[index] = parseFloat(value) || 0;
        setDisplayPrices(newDisplayPrices);
        break;
      case 'customize':
        const newCustomizePrices = [...customizePrices];
        newCustomizePrices[index] = parseFloat(value) || 0;
        setCustomizePrices(newCustomizePrices);
        break;
      case 'ship':
        const newShipPrices = [...shipPrices];
        newShipPrices[index] = parseFloat(value) || 0;
        setShipPrices(newShipPrices);
        break;
      default:
        break;
    }
  };

  // Tính tổng các giá trị
  const getTotalDisplayPrice = () => {
    return displayPrices.reduce((sum, price) => sum + price, 0);
  };

  const getTotalCustomizePrice = () => {
    return customizePrices.reduce((sum, price) => sum + price, 0);
  };

  const getTotalShipMin = () => {
    return shipPrices.reduce((sum, price) => sum + price, 0);
  };

  const [sampleDecisions, setSampleDecisions] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_SAMPLE_DECISIONS);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [aFeedbackResponses, setAFeedbackResponses] = useState(() => lsGet(LS_A_FEEDBACK_RESPONSE, {}));

  const isInitializedRef = useRef(false);

  // Hàm lấy ship price và total price theo phương thức
  const getShipInfoByMethod = (vendor, method) => {
    switch (method) {
      case 'economy':
        return { ship_price: vendor?.eco_price || 0, total_price: vendor?.eco_total || 0 };
      case 'fast':
        return { ship_price: vendor?.fast_price || 0, total_price: vendor?.fast_total || 0 };
      case 'express':
        return { ship_price: vendor?.express_price || 0, total_price: vendor?.express_total || 0 };
      case 'overnight':
        return { ship_price: vendor?.overnight_price || 0, total_price: vendor?.overnight_total || 0 };
      default:
        return { ship_price: vendor?.eco_price || 0, total_price: vendor?.eco_total || 0 };
    }
  };

  // Hàm mở modal setup giá
  const handleOpenSetupModal = (vendor) => {
    const foundIndex = assignedPriceList.findIndex(
      item => item.id === vendor.id ||
        (item.product_type === vendor.product_type && item.vendor_type === vendor.vendor_type)
    );
    selectedIndexRef.current = foundIndex;
    const gia_hien_thi = vendor.gia_hien_thi ?? ((vendor.pricing1 || 0) + (vendor.pricing2 || 0));
    const total_customize_price = vendor.gia_customsize !== undefined
      ? vendor.gia_customsize
      : (vendor.size && vendor.size.trim() !== '' ? 5 : 0);

    const defaultMethod = vendor.shipping_method || 'economy';
    const defaultShipInfo = getShipInfoByMethod(vendor, defaultMethod);
    const initShipPrice = vendor.ship_prices
      ? vendor.ship_prices[0]
      : (vendor.gia_ship !== undefined ? vendor.gia_ship : defaultShipInfo.ship_price);

    setSelectedVendor(vendor);
    setShipInfo(defaultShipInfo);
    setDisplayPrices(vendor.display_prices || [gia_hien_thi]);
    setCustomizePrices(vendor.customize_prices || [total_customize_price]);
    setShipPrices(vendor.ship_prices || [initShipPrice]);
    setSetupForm({
      shipping_method: defaultMethod,
      size: vendor.size || '',
      final_price: vendor.final_price || 0,
      profit: vendor.profit || 0,
      profit_margin: vendor.profit_margin || 0,
      coupon_percent: vendor.coupon_percent || 0,
      coupon_amount: vendor.coupon_amount || 0,
      coupon_fee: vendor.coupon_fee || 0,
    });
    setShowSetupModal(true);
  };

  // Hàm xóa setup giá
  const handleDeletePriceSetup = (vendor) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa cấu hình giá của "${vendor.vendor_name || vendor.vendor_type}" - "${vendor.product_type}"?`)) {
      const savedSetups = JSON.parse(localStorage.getItem('VENDOR_PRICE_SETUPS') || '[]');
      const newSetups = savedSetups.filter(s => !(s.vendor_id === vendor.id && s.product_type === vendor.product_type));
      localStorage.setItem('VENDOR_PRICE_SETUPS', JSON.stringify(newSetups));

      loadApprovedVendors();
      showToastMsg('success', '🗑 Đã xóa', `Đã xóa cấu hình giá của "${vendor.vendor_name || vendor.vendor_type}"`);
    }
  };

  // Hàm tính toán lại giá khi thay đổi
  const calculateSetupPrices = useCallback(() => {
    if (!selectedVendor || selectedIndexRef.current === -1) return;

    const total_display = getTotalDisplayPrice();
    const total_customize = getTotalCustomizePrice();
    const total_ship = getTotalShipMin();

    // Total price (1) = Total Giá hiển thị + Total Giá Customsize + Total Giá Ship
    const total_price_1 = total_display + total_customize + total_ship;

    // Total Price (2) là của Phương thức vận chuyển đã chọn (shipInfo.total_price)
    const total_price_2 = shipInfo.total_price || 0;

    const coupon_pct = setupForm.coupon_percent || 0;

    // Coupon = %Coupon × (Total price (1) - Total Giá Ship)
    const coupon_amount = coupon_pct * (total_price_1 - total_ship) / 100;

    // After price = Total Price (1) - Coupon
    const after_price = total_price_1 - coupon_amount;

    // Coupon Fee (2.5%) = 2.5% × (Total Price(1) - Total Giá Ship - Coupon)
    const coupon_fee = 0.025 * (total_price_1 - total_ship - coupon_amount);

    // AMZ fee = 17% × After price
    const amz_fee = after_price * 0.17;

    // Base Cost = Total Price (2)
    const base_cost = total_price_2;

    // Profit = Total Price (1) - Coupon - Coupon Fee - AMZ fee - Base cost
    const profit = total_price_1 - coupon_amount - coupon_fee - amz_fee - base_cost;

    // Profit Margin = Profit / Total Price (1)
    const profit_margin = total_price_1 > 0 ? (profit / total_price_1) * 100 : 0;

    // Cập nhật modal
    setSetupForm(prev => ({
      ...prev,
      final_price: total_price_1,
      coupon_amount: coupon_amount,
      coupon_fee: coupon_fee,
      profit: profit,
      profit_margin: profit_margin,
    }));

    // Cập nhật assignedPriceList
    setAssignedPriceList(prev => prev.map((item, index) => {
      if (index !== selectedIndexRef.current) return item;
      return {
        ...item,
        gia_hien_thi: total_display,
        gia_customsize: total_customize,
        gia_ship: total_ship,
        total_price_2: total_price_2,
        coupon_percent: coupon_pct,
        coupon_amount: coupon_amount,
        coupon_fee: coupon_fee,
        amz_fee: amz_fee,
        profit: profit,
        profit_margin: profit_margin,
        after_price: after_price,
        final_price: total_price_1,
      };
    }));

  }, [selectedVendor, displayPrices, customizePrices, shipPrices, setupForm.coupon_percent, shipInfo.total_price]);
  // Hàm xử lý thay đổi shipping method
  const handleShippingMethodChange = (method) => {
    const newShipInfo = getShipInfoByMethod(selectedVendor, method);
    setShipInfo(newShipInfo);
    setShipPrices([newShipInfo.ship_price]);
    setSetupForm(prev => ({
      ...prev,
      shipping_method: method
    }));
  };

  // Hàm lưu setup giá
  const handleSaveSetupPrice = () => {
    const total_display = getTotalDisplayPrice();
    const total_customize = getTotalCustomizePrice();
    const total_ship = getTotalShipMin();

    // Total price (1) = Tổng giá hiển thị + Tổng Customize + Tổng Ship
    const total_price_1 = total_display + total_customize + total_ship;

    // Total Price (2) là của Phương thức vận chuyển đã chọn
    const total_price_2 = shipInfo.total_price || 0;

    const coupon_pct = setupForm.coupon_percent || 0;

    // Coupon = %Coupon × (Total price (1) - Tổng Ship)
    const coupon_amount = coupon_pct * (total_price_1 - total_ship) / 100;

    // After price = Total Price (1) - Coupon
    const after_price = total_price_1 - coupon_amount;

    // Coupon Fee (2.5%) = 2.5% × (Total Price(1) - Tổng Ship - Coupon)
    // = 2.5% × (Tổng giá hiển thị + Tổng Customize - Coupon)
    const coupon_fee_val = 0.025 * (total_price_1 - total_ship - coupon_amount);

    // AMZ fee = 17% × After price
    const amz_fee_val = after_price * 0.17;

    // Base Cost = Total Price (2)
    const base_cost_val = total_price_2;

    // Profit = Total Price (1) - Coupon - Coupon Fee - AMZ fee - Base cost
    const profit_val = total_price_1 - coupon_amount - coupon_fee_val - amz_fee_val - base_cost_val;

    // Profit Margin = Profit / Total Price (1)
    const profit_margin_val = total_price_1 > 0 ? (profit_val / total_price_1) * 100 : 0;

    const savedData = {
      id: Date.now(),
      vendor_id: selectedVendor?.vendor_id,
      vendor_name: selectedVendor?.vendor_name || selectedVendor?.vendor_type,
      vendor_type: selectedVendor?.vendor_type,
      product_type: selectedVendor?.product_type,
      original_size: selectedVendor?.size,
      shipping_method: setupForm.shipping_method,
      shipping_method_label: getShippingMethodLabel(setupForm.shipping_method),
      ship_price: shipInfo.ship_price,
      ship_total: total_price_2,  // Total Price (2)
      display_prices: [...displayPrices],
      customize_prices: [...customizePrices],
      ship_prices: [...shipPrices],
      total_display_price: total_display,
      total_customize_price: total_customize,
      total_ship_min: total_ship,
      total_price_1: total_price_1,
      total_price_2: total_price_2,
      size: setupForm.size,
      final_price: total_price_1,
      coupon_percent: coupon_pct,
      coupon_amount: coupon_amount,
      coupon_fee: coupon_fee_val,
      amz_fee: amz_fee_val,
      profit: profit_val,
      profit_margin: profit_margin_val,
      after_price: after_price,
      base_cost: base_cost_val,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Lưu localStorage
    let savedSetups = JSON.parse(localStorage.getItem('VENDOR_PRICE_SETUPS') || '[]');
    const existingIndex = savedSetups.findIndex(
      s => s.vendor_id === selectedVendor?.vendor_id && s.product_type === selectedVendor?.product_type
    );
    if (existingIndex !== -1) {
      savedSetups[existingIndex] = savedData;
    } else {
      savedSetups.push(savedData);
    }
    localStorage.setItem('VENDOR_PRICE_SETUPS', JSON.stringify(savedSetups));

    // Cập nhật state bảng chính
    setAssignedPriceList(prev => prev.map(item => {
      if (item.vendor_id === selectedVendor?.vendor_id && item.product_type === selectedVendor?.product_type) {
        return {
          ...item,
          ...savedData,
          gia_hien_thi: total_display,
          gia_customsize: total_customize,
          gia_ship: total_ship,
        };
      }
      return item;
    }));

    showToastMsg('success', '✅ Lưu thành công', `Đã lưu cấu hình giá cho ${selectedVendor?.vendor_type || 'vendor'}`);
    setShowSetupModal(false);
    setSelectedVendor(null);
    setDisplayPrices([0]);
    setCustomizePrices([0]);
    setShipPrices([0]);
    selectedIndexRef.current = -1;
  };

  const getShippingMethodLabel = (method) => {
    switch (method) {
      case 'economy': return 'Economy (Chậm)';
      case 'fast': return 'Ground/Fast (TB)';
      case 'express': return 'Express (Nhanh)';
      case 'overnight': return 'Overnight (Qua đêm)';
      default: return 'Economy';
    }
  };

  const generatePriceListFromApprovedVendors = useCallback((vendors) => {
    if (!vendors || vendors.length === 0) return;

    const savedSetups = JSON.parse(localStorage.getItem('VENDOR_PRICE_SETUPS') || '[]');

    const newPriceList = vendors.map((vendor, idx) => {
      const gia_hien_thi = (parseFloat(vendor.pricing1) || 0) + (parseFloat(vendor.pricing2) || 0);
      const gia_customsize = vendor.size && vendor.size.trim() !== '' ? 5 : 0;

      let gia_ship = 0;
      if (vendor.eco_price && parseFloat(vendor.eco_price) > 0) gia_ship = parseFloat(vendor.eco_price);
      else if (vendor.fast_price && parseFloat(vendor.fast_price) > 0) gia_ship = parseFloat(vendor.fast_price);
      else if (vendor.express_price && parseFloat(vendor.express_price) > 0) gia_ship = parseFloat(vendor.express_price);
      else if (vendor.overnight_price && parseFloat(vendor.overnight_price) > 0) gia_ship = parseFloat(vendor.overnight_price);

      let default_coupon_pct = 0;
      if (vendor.vendor_type === 'Best Seller') default_coupon_pct = 10;
      else if (vendor.vendor_type === 'New') default_coupon_pct = 5;
      else if (vendor.vendor_type === 'Old') default_coupon_pct = 3;

      const existingSetup = savedSetups.find(s => s.vendor_id === vendor.id && s.product_type === vendor.product_type);

      if (existingSetup) {
        const ed = existingSetup.total_display_price ?? gia_hien_thi;
        const ec = existingSetup.total_customize_price ?? gia_customsize;
        const es = existingSetup.total_ship_min ?? gia_ship;
        const ep = existingSetup.coupon_percent ?? default_coupon_pct;  // ✅ Lấy % đã lưu
        const e_coupon_val = ep * (ed + ec) / 100;
        const e_after = (ed + ec + es) - e_coupon_val;
        const e_coupon_fee = existingSetup.coupon_fee ?? (0.025 * (ed + ec + es - es - e_coupon_val));
        const e_amz = existingSetup.amz_fee ?? (e_after * 0.17);
        const e_profit = existingSetup.profit ?? (e_after - e_coupon_fee - e_amz - e_after * 0.4);
        const e_margin = existingSetup.profit_margin ?? ((ed + ec + es) > 0 ? (e_profit / (ed + ec + es)) * 100 : 0);

        return {
          ...existingSetup,
          eco_price: vendor.eco_price || 0, eco_total: vendor.eco_total || 0,
          fast_price: vendor.fast_price || 0, fast_total: vendor.fast_total || 0,
          express_price: vendor.express_price || 0, express_total: vendor.express_total || 0,
          overnight_price: vendor.overnight_price || 0, overnight_total: vendor.overnight_total || 0,
          pricing1: vendor.pricing1 || 0, pricing2: vendor.pricing2 || 0,
          id: existingSetup.id,
          vendor_name: vendor.vendor_name || vendor.vendor_type,
          vendor_type: vendor.vendor_type,
          product_type: vendor.product_type,
          size: existingSetup.size || vendor.size,
          gia_hien_thi: existingSetup.total_display_price || gia_hien_thi,
          gia_customsize: existingSetup.total_customize_price || gia_customsize,
          gia_ship: existingSetup.total_ship_min || gia_ship,
          coupon_percent: ep,  // ✅ Lưu %
          coupon_fee: existingSetup.coupon_fee || e_coupon_fee,
          total_price: existingSetup.final_price || (ed + ec + es),
          profit: existingSetup.profit || e_profit,
          profit_margin: existingSetup.profit_margin || e_margin,
          after_price: existingSetup.after_price || e_after,
          approved_at: vendor.approvedAt,
          source: 'assigned'
        };
      }

      return {
        id: Date.now() + idx + Math.random(),
        vendor_id: vendor.id,
        vendor_name: vendor.vendor_name || vendor.vendor_type || 'Unknown',
        vendor_type: vendor.vendor_type || '',
        product_type: vendor.productType || vendor.product_type || '',
        size: vendor.size || '',
        approved_by: 'Staff A',
        approved_at: vendor.approvedAt,
        sample_details: vendor.sampleDetails || '',
        gia_hien_thi: gia_hien_thi,
        gia_customsize: gia_customsize,
        gia_ship: gia_ship,
        coupon_percent: default_coupon_pct,  // ✅ Lưu %
        coupon_fee: 0,
        total_price: gia_hien_thi + gia_customsize + gia_ship,
        profit: 0,
        profit_margin: 0,
        after_price: gia_hien_thi + gia_customsize + gia_ship,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        eco_price: vendor.eco_price || 0, eco_total: vendor.eco_total || 0,
        fast_price: vendor.fast_price || 0, fast_total: vendor.fast_total || 0,
        express_price: vendor.express_price || 0, express_total: vendor.express_total || 0,
        overnight_price: vendor.overnight_price || 0, overnight_total: vendor.overnight_total || 0,
        pricing1: vendor.pricing1 || 0, pricing2: vendor.pricing2 || 0,
        source: 'assigned'
      };
    });

    const uniquePriceList = newPriceList.filter((item, index, self) =>
      index === self.findIndex((t) => (
        t.product_type === item.product_type && t.vendor_type === item.vendor_type
      ))
    );

    if (uniquePriceList.length > 0) {
      setAssignedPriceList(uniquePriceList);
      localStorage.setItem(LS_PRICE_KEY, JSON.stringify(uniquePriceList));
    }
  }, []);

  const loadApprovedVendors = useCallback(() => {
    try {
      const vendors = [];

      const currentProductVendors = lsGet(LS_PRODUCT_VENDORS, {});

      if (typeof currentProductVendors !== 'object' || currentProductVendors === null) {
        console.warn('currentProductVendors is not an object:', currentProductVendors);
        return;
      }

      const currentSampleDecisions = (() => {
        try {
          const raw = localStorage.getItem(LS_SAMPLE_DECISIONS);
          return raw ? JSON.parse(raw) : {};
        } catch {
          console.error('Error parsing LS_SAMPLE_DECISIONS');
          return {};
        }
      })();

      const currentAFeedbackResponses = lsGet(LS_A_FEEDBACK_RESPONSE, {});
      const currentBSubmittedFeedbacks = lsGet('STAFF_B_SUBMITTED_FEEDBACK_V1', {});

      Object.entries(currentProductVendors).forEach(([productId, vendorList]) => {
        if (!Array.isArray(vendorList)) return;

        const productDecisions = currentSampleDecisions[productId] || {};
        const productResponses = currentAFeedbackResponses[productId] || {};
        const productBFeedbacks = currentBSubmittedFeedbacks[productId] || {};

        vendorList.forEach((vendor, idx) => {
          if (!vendor) return;

          const key = vendor.id ? String(vendor.id) : `idx_${idx}`;

          // ✅ ĐIỀU KIỆN MỚI: Cả Staff B và Staff A đều approve
          const staffBApproved = productBFeedbacks[key]?.staff_b_approved === true;
          const staffAApproved = productResponses[key]?.staff_a_approved === true ||
            productDecisions[key]?.staff_a_approved === true;

          // Chỉ hiển thị khi CẢ HAI đều đã approve
          const isFullyApproved = staffBApproved && staffAApproved;

          if (isFullyApproved) {
            vendors.push({
              ...vendor,
              productId: productId,
              productType: vendor.product_type,
              approvedAt: productResponses[key]?.respondedAt || productDecisions[key]?.time || new Date().toISOString(),
              sampleDetails: productDecisions[key]?.sampleDetails || productResponses[key]?.sampleDetails || '',
              vendorKey: key,
              source: 'assigned',
              staff_b_approved: true,
              staff_a_approved: true
            });
          }
        });
      });

      if (vendors.length > 0) {
        setApprovedVendors(vendors);
        generatePriceListFromApprovedVendors(vendors);
      } else {
        setApprovedVendors([]);
        setAssignedPriceList([]);
      }
    } catch (err) {
      console.error('loadApprovedVendors error:', err);
      setComponentError(err.message);
    }
  }, [generatePriceListFromApprovedVendors]);

  useEffect(() => {
    try {
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        loadApprovedVendors();
      }

      const sync = () => {
        try {
          loadApprovedVendors();
        } catch (err) {
          console.error('Sync error:', err);
          setComponentError(err.message);
        }
      };

      window.addEventListener('storage', sync);
      return () => {
        window.removeEventListener('storage', sync);
      };
    } catch (err) {
      console.error('SetupPriceSection initialization error:', err);
      setComponentError(err.message);
    }
  }, [loadApprovedVendors]);
  if (componentError) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: HC.danger }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Có lỗi xảy ra</div>
        <div style={{ fontSize: 13, marginTop: 8, color: HC.muted }}>{componentError}</div>
        <button
          onClick={() => window.location.reload()}
          style={{ marginTop: 20, padding: '8px 20px', borderRadius: 8, background: HC.orange, color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Tải lại trang
        </button>
      </div>
    );
  }
  const showToastMsg = (type, title, message, duration = 3000) => {
    setToast({ type, title, message, duration });
    setTimeout(() => setToast(null), duration);
  };

  // Filter
  const filteredAssignedList = assignedPriceList.filter(p => {
    const matchSearch = !search || p.product_type.toLowerCase().includes(search.toLowerCase());
    const matchFilter = !filterProductType || p.product_type.toLowerCase().includes(filterProductType.toLowerCase());
    return matchSearch && matchFilter;
  });

  const totalPagesAssigned = Math.ceil(filteredAssignedList.length / ITEMS_PER_PAGE_PRICE);
  const pagedAssignedList = filteredAssignedList.slice((currentPageAssigned - 1) * ITEMS_PER_PAGE_PRICE, currentPageAssigned * ITEMS_PER_PAGE_PRICE);

  const productTypes = [...new Set(assignedPriceList.map(p => p.product_type))];

  // Component PriceTable có thêm cột Coupon Fee
  const PriceTable = ({ data, onSetupPrice, onDelete }) => (
    <div style={{ overflowX: 'auto', borderRadius: 14, border: `1.5px solid ${HC.border}`, background: HC.surface, boxShadow: `0 4px 12px rgba(0,0,0,0.05)`, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
        <thead>
          <tr style={{ background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})` }}>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>STT</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'left' }}>Vendor Name</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'left' }}>Vendor Type</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'left' }}>Product Type</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'center' }}>Size</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Total giá hiển thị</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Total Customize</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Total Ship</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Total Price</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Coupon</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Coupon Fee (2.5%)</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>AMZ (17%)</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Profit</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>Margin %</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'right' }}>After Price</th>
            <th style={{ padding: '12px 10px', color: '#fff', fontWeight: 700, textAlign: 'center', minWidth: 120 }}>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p, idx) => {
            // Tính Total Price = Total giá hiển thị + Total Customize + Total Ship
            const totalPrice = (p.gia_hien_thi || 0) + (p.gia_customsize || 0) + (p.gia_ship || 0);

            return (
              <tr key={p.id} style={{ borderBottom: `1px solid ${HC.border}`, background: idx % 2 === 0 ? '#ffffff' : HC.surface2 }}>
                <td style={{ padding: '10px 10px', textAlign: 'center', color: HC.muted, fontWeight: 600 }}>{idx + 1}</td>
                <td style={{ padding: '10px 10px', fontWeight: 700, color: HC.ink2 }}>{p.vendor_name || '—'}</td>
                <td style={{ padding: '10px 10px', fontWeight: 700, color: p.vendor_type === 'Best Seller' ? '#D4A017' : HC.orange }}>
                  {p.vendor_type || '—'}
                  {p.vendor_type === 'Best Seller' && <span style={{ marginLeft: 6, fontSize: 11 }}>⭐</span>}
                </td>
                <td style={{ padding: '10px 10px', color: HC.ink2, fontWeight: 600 }}>{p.product_type || '—'}</td>
                <td style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 600, color: HC.muted }}>{p.size || '—'}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: HC.orangeDark }}>${(p.gia_hien_thi || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: HC.brown }}>${(p.gia_customsize || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700 }}>${(p.gia_ship || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 800, color: HC.success, background: '#ecfdf5' }}>${totalPrice.toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: HC.warning }}>
                  ${((p.coupon_percent || 0) * ((p.gia_hien_thi || 0) + (p.gia_customsize || 0)) / 100).toFixed(2)}
                  <span style={{ fontSize: 10, color: HC.muted2, marginLeft: 4 }}>({p.coupon_percent || 0}%)</span>
                </td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: '#d97706' }}>${(p.coupon_fee || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: HC.orangeDark }}>${(p.amz_fee || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: (p.profit || 0) > 0 ? HC.success : HC.danger }}>${(p.profit || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: (p.profit_margin || 0) > 20 ? HC.success : HC.warning }}>{(p.profit_margin || 0).toFixed(2)}%</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 700, color: HC.success }}>${(p.after_price || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button onClick={() => onSetupPrice(p)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>⚙️ Setup giá</button>
                    <button onClick={() => onDelete(p)} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#fef2f2', color: HC.danger, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>🗑 Xóa</button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Component PriceInputGroup
  const PriceInputGroup = ({ label, icon, prices, onUpdate, onAdd, onRemove, unit = '$' }) => (
    <div style={{ marginBottom: 20 }}>
      <label style={{ fontSize: 12, fontWeight: 800, color: HC.muted, marginBottom: 8, display: 'block' }}>
        {icon} {label}
      </label>
      {prices.map((price, idx) => (
        <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => onUpdate(idx, e.target.value)}
            placeholder={`${label} ${idx + 1}`}
            style={{ ...inp, padding: '10px 12px', flex: 1 }}
          />
          {prices.length > 1 && (
            <button
              type="button"
              onClick={() => onRemove(idx)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: HC.danger,
                cursor: 'pointer',
                fontSize: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        style={{
          marginTop: 8,
          padding: '8px 16px',
          borderRadius: 8,
          background: HC.orangeLight,
          border: `1.5px solid ${HC.orangeMid}`,
          color: HC.orangeDark,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <span style={{ fontSize: 14 }}>+</span> Thêm {label}
      </button>
      <div style={{ marginTop: 8, fontSize: 11, color: HC.success, fontWeight: 600 }}>
        Tổng: {unit}{prices.reduce((sum, p) => sum + p, 0).toFixed(2)}
      </div>
    </div>
  );

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 2000, animation: 'slideIn 0.3s ease-out, fadeOut 0.3s ease-out 4.7s forwards', maxWidth: 380 }}>
          <div style={{ background: toast.type === 'success' ? `linear-gradient(135deg, ${HC.success}, #15803d)` : toast.type === 'error' ? `linear-gradient(135deg, ${HC.danger}, #b91c1c)` : `linear-gradient(135deg, ${HC.warning}, #d97706)`, color: '#fff', borderRadius: 12, boxShadow: HC.shadowStrong, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : '⚠️'}</span>
              <div><div style={{ fontWeight: 900, fontSize: 13 }}>{toast.title}</div><div style={{ fontSize: 11, opacity: 0.9 }}>{toast.message}</div></div>
              <button onClick={() => setToast(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.5)', animation: `progressBar ${(toast.duration || 5000) / 1000}s linear forwards`, transformOrigin: 'left' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: HC.ink }}>📊 Setup Giá bán</div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, padding: '12px 16px', background: HC.surface, borderRadius: 12, border: `1px solid ${HC.border}` }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: HC.muted }}>🔍</span>
          <input type="text" placeholder="Tìm product type..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, paddingLeft: 34 }} />
        </div>
        {productTypes.length > 0 && (
          <select value={filterProductType} onChange={e => setFilterProductType(e.target.value)} style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${HC.border}`, fontSize: 12, background: HC.surface2, minWidth: 130 }}>
            <option value="">Tất cả loại</option>
            {productTypes.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
          </select>
        )}
        {(search || filterProductType) && (
          <button onClick={() => { setSearch(''); setFilterProductType(''); }} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #fecaca', background: '#fef2f2', color: HC.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✕ Xóa lọc</button>
        )}
      </div>

      {/* Bảng Vendor từ Staff B gán */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 6, height: 24, borderRadius: 99, background: `linear-gradient(to bottom, ${HC.orange}, ${HC.orangeDark})` }} />
          <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink }}>🏪 Vendor từ Staff B gán</div>
          <span style={{ padding: '2px 10px', borderRadius: 20, background: HC.orangeLight, color: HC.orangeDark, fontSize: 11, fontWeight: 700 }}>{filteredAssignedList.length} vendor</span>
        </div>
        {filteredAssignedList.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: HC.surface, borderRadius: 12, border: `1px solid ${HC.border}` }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>🏪</div>
            <div style={{ fontWeight: 600, color: HC.muted }}>Chưa có vendor nào được Staff B gán và duyệt</div>
            <div style={{ fontSize: 12, color: HC.muted2, marginTop: 4 }}>Vui lòng chờ Staff B gán vendor cho sản phẩm</div>
          </div>
        ) : (
          <>
            <PriceTable
              data={pagedAssignedList}
              onSetupPrice={handleOpenSetupModal}
              onDelete={handleDeletePriceSetup}
            />
            {totalPagesAssigned > 1 && (
              <Pagination
                currentPage={currentPageAssigned}
                totalPages={totalPagesAssigned}
                totalItems={filteredAssignedList.length}
                onPageChange={setCurrentPageAssigned}
                itemsPerPage={10}
              />
            )}
          </>
        )}
      </div>

      {/* Modal Setup Giá */}
      {showSetupModal && selectedVendor && (
        <div onClick={() => setShowSetupModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 700, maxWidth: '90%', maxHeight: '85vh', overflowY: 'auto', background: HC.surface, borderRadius: 20, boxShadow: HC.shadowStrong }}>

            <div style={{ padding: '16px 24px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', borderRadius: '20px 20px 0 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 16 }}>⚙️ Setup Giá Bán</div>
                  <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
                    {selectedVendor.vendor_type || '—'} · {selectedVendor.product_type || '—'}
                  </div>
                </div>
                <button onClick={() => setShowSetupModal(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              {/* Size */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>📏 Size</label>
                <input
                  type="text"
                  value={setupForm.size}
                  onChange={(e) => setSetupForm(prev => ({ ...prev, size: e.target.value }))}
                  placeholder="Nhập size (VD: S, M, L, XL...)"
                  style={{ ...inp, padding: '10px 12px' }}
                />
              </div>

              {/* 3 nhóm input */}
              <PriceInputGroup
                label="Total Giá hiển thị"
                icon="💰"
                prices={displayPrices}
                onUpdate={(idx, val) => updatePriceField('display', idx, val)}
                onAdd={() => addPriceField('display')}
                onRemove={(idx) => removePriceField('display', idx)}
              />

              <PriceInputGroup
                label="Total giá Customize"
                icon="🎨"
                prices={customizePrices}
                onUpdate={(idx, val) => updatePriceField('customize', idx, val)}
                onAdd={() => addPriceField('customize')}
                onRemove={(idx) => removePriceField('customize', idx)}
              />

              <PriceInputGroup
                label="Total giá Ship "
                icon="🚚"
                prices={shipPrices}
                onUpdate={(idx, val) => updatePriceField('ship', idx, val)}
                onAdd={() => addPriceField('ship')}
                onRemove={(idx) => removePriceField('ship', idx)}
              />

              {/* Dropdown chọn phương thức vận chuyển */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: HC.muted, marginBottom: 4, display: 'block' }}>📦 Chọn phương thức vận chuyển</label>
                <select
                  value={setupForm.shipping_method}
                  onChange={(e) => handleShippingMethodChange(e.target.value)}
                  style={{ ...inp, padding: '10px 12px', cursor: 'pointer' }}
                >
                  <option value="economy">🚚 Economy (Chậm nhất, rẻ nhất)</option>
                  <option value="fast">⚡ Ground/Fast (Trung bình)</option>
                  <option value="express">✈️ Express (Nhanh)</option>
                  <option value="overnight">🌙 Overnight (Qua đêm)</option>
                </select>

                <div style={{ marginTop: 12, padding: '12px 16px', background: HC.orangeLight, borderRadius: 10, border: `1px solid ${HC.orangeMid}` }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: HC.orangeDark, marginBottom: 8 }}>📊 Thông tin từ Vendor:</div>

                  {/* Bố cục 2 cột đều nhau */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

                    {/* Cột 1: Vendor Name (full width) */}
                    <div style={{ gridColumn: '1 / -1', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: HC.muted }}>🏪 Vendor Name:</span>
                      <div style={{ fontWeight: 800, fontSize: 15, color: HC.orangeDark, marginTop: 2 }}>
                        {selectedVendor?.vendor_name || selectedVendor?.name || selectedVendor?.vendor_type || 'Chưa có thông tin'}
                      </div>
                    </div>

                    {/* Hàng 2: Loại Ship + Price Ship */}
                    <div>
                      <span style={{ fontSize: 11, color: HC.muted }}>🚚 Loại Ship:</span>
                      <div style={{ fontWeight: 700, fontSize: 14, color: HC.orangeDark, marginTop: 2 }}>
                        {getShippingMethodLabel(setupForm.shipping_method)}
                      </div>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: HC.muted }}>💰 Price Ship:</span>
                      <div style={{ fontWeight: 800, fontSize: 16, color: HC.success, marginTop: 2 }}>
                        ${shipInfo.ship_price.toFixed(2)}
                      </div>
                    </div>

                    {/* Hàng 3: Total Price (Fulfill) - chiếm 2 cột */}
                    <div style={{ gridColumn: '1 / -1', marginTop: 4 }}>
                      <span style={{ fontSize: 11, color: HC.muted }}>📦 Total Price (Fulfill):</span>
                      <div style={{ fontWeight: 800, fontSize: 18, color: HC.success, marginTop: 2 }}>
                        ${shipInfo.total_price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trường Coupon nhập tay */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 800, color: HC.muted, marginBottom: 4, display: 'block' }}>🎫 Coupon % (nhập tay)</label>
                <input
                  type="number"
                  step="0.01"
                  value={setupForm.coupon_percent}
                  onChange={(e) => {
                    const newPercent = parseFloat(e.target.value) || 0;
                    setSetupForm(prev => ({ ...prev, coupon_percent: newPercent }));
                    setTimeout(() => calculateSetupPrices(), 0);
                  }}
                  placeholder="Nhập % coupon (VD: 5, 10, 15...)"
                  style={{ ...inp, padding: '10px 12px' }}
                />
                <div style={{ fontSize: 10, color: HC.muted2, marginTop: 4 }}>
                  💡 Công thức: <strong>Coupon = % × (Total Price - Giá Ship)</strong>
                </div>
              </div>
              {/* Kết quả tính toán - thêm dòng Coupon Fee */}
              <div style={{ background: '#ecfdf5', borderRadius: 12, padding: '16px', border: '1px solid #bbf7d0', marginBottom: 20 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#065f46', marginBottom: 12 }}>💰 Kết quả tính toán:</div>

                {/* Dòng 1: 3 cột */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, color: HC.muted }}>Tổng giá hiển thị:</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.orangeDark }}>${getTotalDisplayPrice().toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: HC.muted }}>Tổng giá Customize:</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.orangeDark }}>${getTotalCustomizePrice().toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: HC.muted }}>Tổng giá Ship:</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.orangeDark }}>${getTotalShipMin().toFixed(2)}</div>
                  </div>
                </div>

                {/* Total Price (1) */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>📦 Total Price (1):</div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: HC.success }}>
                    ${(getTotalDisplayPrice() + getTotalCustomizePrice() + getTotalShipMin()).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= Giá hiển thị + Customize + Ship</div>
                </div>

                {/* Total Price (2) - từ phương thức vận chuyển */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>🚚 Total Price (2) - {getShippingMethodLabel(setupForm.shipping_method)}:</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: HC.orangeDark }}>
                    ${shipInfo.total_price.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= Giá ship + Fulfill (từ Vendor)</div>
                </div>

                {/* Coupon */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>🎫 Coupon ({setupForm.coupon_percent}%):</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: HC.warning }}>
                    -${((setupForm.coupon_percent || 0) * (getTotalDisplayPrice() + getTotalCustomizePrice()) / 100).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2, marginTop: 4 }}>
                    = {setupForm.coupon_percent}% × (Total Price (1) - Ship) = {setupForm.coupon_percent}% × ${(getTotalDisplayPrice() + getTotalCustomizePrice()).toFixed(2)}
                  </div>
                </div>

                {/* After Price */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>💰 After Price:</div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#16a34a' }}>
                    ${((getTotalDisplayPrice() + getTotalCustomizePrice() + getTotalShipMin()) -
                      ((setupForm.coupon_percent || 0) * (getTotalDisplayPrice() + getTotalCustomizePrice()) / 100)).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= Total Price (1) - Coupon</div>
                </div>

                {/* Coupon Fee */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef3c7', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>📋 Coupon Fee (2.5%):</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#d97706' }}>
                    ${((setupForm.coupon_percent || 0) * (getTotalDisplayPrice() + getTotalCustomizePrice()) / 100 * 0.025).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= 2.5% × (Total Price (1) - Ship - Coupon)</div>
                </div>

                {/* AMZ Fee */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef3c7', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>📋 AMZ Fee (17%):</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: HC.orangeDark }}>
                    ${(((getTotalDisplayPrice() + getTotalCustomizePrice() + getTotalShipMin()) -
                      ((setupForm.coupon_percent || 0) * (getTotalDisplayPrice() + getTotalCustomizePrice()) / 100)) * 0.17).toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= 17% × After Price</div>
                </div>

                {/* Base Cost = Total Price (2) */}
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef3c7', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: HC.muted }}>📦 Base Cost:</div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#d97706' }}>
                    ${shipInfo.total_price.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted2 }}>= Total Price (2) từ phương thức vận chuyển đã chọn</div>
                </div>

                {/* Profit và Margin */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 12, borderTop: '1px solid #bbf7d0', marginTop: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: HC.muted }}>💵 Profit:</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: setupForm.profit > 0 ? HC.success : HC.danger }}>
                      ${setupForm.profit.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: HC.muted2 }}>= Total(1) - Coupon - Fee - AMZ - Base</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: HC.muted }}>📊 Profit Margin:</div>
                    <div style={{ fontWeight: 800, fontSize: 16, color: setupForm.profit_margin > 20 ? HC.success : HC.warning }}>
                      {setupForm.profit_margin.toFixed(2)}%
                    </div>
                    <div style={{ fontSize: 10, color: HC.muted2 }}>= Profit / Total Price (1)</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: `1px solid ${HC.border}`, display: 'flex', gap: 12, justifyContent: 'flex-end', background: HC.surface2, borderRadius: '0 0 20px 20px' }}>
              <button onClick={() => setShowSetupModal(false)} style={{ padding: '10px 20px', borderRadius: 10, background: HC.cream, border: `1px solid ${HC.border}`, color: HC.brown, cursor: 'pointer', fontWeight: 700 }}>Hủy</button>
              <button onClick={handleSaveSetupPrice} style={{ padding: '10px 28px', borderRadius: 10, background: `linear-gradient(135deg, ${HC.success}, #15803d)`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>💾 Lưu Setup Giá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  IMPROVED SIDEBAR FOR SELLER (WHITE THEME)
// ══════════════════════════════════════════════════════════
function SellerSidebar({ active, setActive, sidebarOpen, setSidebarOpen, user, logout }) {
  const [hoveredItem, setHoveredItem] = useState(null);

  return (
    <div style={{
      width: sidebarOpen ? 280 : 80,
      background: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: '2px 0 12px rgba(0, 0, 0, 0.05)',
      borderRight: `1px solid ${HC.border}`,
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(circle at 20% 40%, ${HC.orange}08 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        pointerEvents: 'none',
        opacity: 0.4,
      }} />

      <div style={{
        padding: sidebarOpen ? '28px 24px' : '28px 20px',
        borderBottom: `1px solid ${HC.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: sidebarOpen ? 'space-between' : 'center',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${HC.orange}10, ${HC.orange}05)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${HC.orange}20`,
            boxShadow: `0 2px 8px ${HC.orange}10`,
            flexShrink: 0,
          }}>
            <HCLogo size={28} color={HC.orange} />
          </div>
          {sidebarOpen && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{
                color: HC.ink,
                fontWeight: 900,
                fontSize: 16,
                fontFamily: "'Nunito',sans-serif",
                letterSpacing: '-0.02em',
              }}>
                Happy Creative
              </div>
              <div style={{
                color: HC.orange,
                fontSize: 10,
                letterSpacing: '0.2em',
                fontWeight: 800,
                textTransform: 'uppercase',
                marginTop: 2,
              }}>
                Seller Dashboard
              </div>
            </div>
          )}
        </div>
      </div>

      {sidebarOpen && (
        <div style={{
          margin: '20px 16px',
          padding: '16px',
          borderRadius: 16,
          background: `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`,
          border: `1px solid ${HC.orangeMid}`,
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
            }}>
              <ToolOutlined />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>
                {user?.sellerName || user?.seller_name || user?.name || 'Seller'}
              </div>
              <div style={{ fontSize: 10, color: HC.brown, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <UserOutlined style={{ fontSize: 10, color: HC.orange }} />
                <span>Seller</span>
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 10,
            color: HC.muted,
            paddingTop: 8,
            borderTop: `1px solid ${HC.orangeMid}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <CalendarOutlined style={{ fontSize: 10 }} />
            <span>Last login: {new Date().toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      )}

      <nav style={{
        flex: 1,
        padding: sidebarOpen ? '8px 16px' : '8px 12px',
        marginTop: 8,
      }}>
        {MENU.map(item => {
          const isActive = active === item.id;
          const isHovered = hoveredItem === item.id;

          return (
            <div
              key={item.id}
              onClick={() => setActive(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: sidebarOpen ? '12px 16px' : '12px',
                marginBottom: 6,
                borderRadius: 12,
                background: isActive
                  ? `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`
                  : 'transparent',
                border: `1px solid ${isActive ? HC.orangeMid : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered && !isActive ? 'translateX(4px)' : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3,
                  height: 32,
                  background: `linear-gradient(180deg, ${HC.orange}, ${HC.orangeDark})`,
                  borderRadius: '0 4px 4px 0',
                }} />
              )}

              <div style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: isActive
                  ? `linear-gradient(135deg, ${HC.orange}20, ${HC.orange}10)`
                  : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: isActive ? HC.orange : HC.muted,
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}>
                {item.icon}
              </div>

              {sidebarOpen && (
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: isActive ? 800 : 600,
                    color: isActive ? HC.orangeDark : HC.brown,
                    fontFamily: "'Nunito',sans-serif",
                    transition: 'color 0.2s ease',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: HC.muted,
                    marginTop: 2,
                    fontFamily: "'Nunito Sans',sans-serif",
                    opacity: 0.7,
                  }}>
                    {item.desc}
                  </div>
                </div>
              )}

              {!sidebarOpen && isActive && (
                <div style={{
                  position: 'absolute',
                  right: 8,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: HC.orange,
                }} />
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: sidebarOpen ? '16px 16px 24px' : '16px 12px 24px' }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            width: '100%',
            padding: sidebarOpen ? '10px' : '10px',
            borderRadius: 12,
            background: HC.cream,
            border: `1px solid ${HC.border}`,
            color: HC.brown,
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            fontFamily: "'Nunito',sans-serif",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = HC.orangeLight;
            e.currentTarget.style.borderColor = HC.orangeMid;
            e.currentTarget.style.color = HC.orangeDark;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = HC.cream;
            e.currentTarget.style.borderColor = HC.border;
            e.currentTarget.style.color = HC.brown;
          }}
        >
          {sidebarOpen ? (
            <>
              <MenuFoldOutlined />
              <span>Thu gọn menu</span>
            </>
          ) : (
            <MenuUnfoldOutlined />
          )}
        </button>

        <button
          onClick={logout}
          style={{
            width: '100%',
            marginTop: 12,
            padding: sidebarOpen ? '10px' : '10px',
            borderRadius: 12,
            background: '#fee2e2',
            border: `1px solid #fecaca`,
            color: HC.danger,
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            fontFamily: "'Nunito',sans-serif",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#fecaca';
            e.currentTarget.style.borderColor = '#f87171';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#fee2e2';
            e.currentTarget.style.borderColor = '#fecaca';
          }}
        >
          <LogoutOutlined />
          {sidebarOpen && <span>Đăng xuất</span>}
        </button>

        {sidebarOpen && (
          <div style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 9,
            fontWeight: 800,
            color: HC.muted2,
            letterSpacing: '0.2em',
            fontFamily: "'Nunito',sans-serif",
          }}>
            #IT'S ALWAYS DAY 1
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}
// ══════════════════════════════════════════════════════════
//  NOTIFICATION CENTER FOR SELLER (2 TABS)
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  NOTIFICATION CENTER FOR SELLER (2 TABS - FIXED)
// ══════════════════════════════════════════════════════════
function SellerNotificationCenter({
  requestNotifications,
  newsNotifications,
  markRequestAsRead,
  markNewsAsRead,
  onRequestClick,
  onNewsClick
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('requests');
  const [localRequests, setLocalRequests] = useState(requestNotifications || []);
  const [localNews, setLocalNews] = useState(newsNotifications || []);
  const isMarkingRef = useRef(false);
  useEffect(() => {
    setLocalRequests(requestNotifications || []);
  }, [requestNotifications]);

  useEffect(() => {
    setLocalNews(newsNotifications || []);
  }, [newsNotifications]);

  const unreadRequests = localRequests.filter(n => !n.read).length;
  const unreadNews = localNews.filter(n => !n.read).length;
  const totalUnread = unreadRequests + unreadNews;
  const markAllNewsAsRead = () => {
    if (isMarkingRef.current) return;
    isMarkingRef.current = true;

    const unreadIds = localNews.filter(n => !n.read).map(n => n.id);

    Promise.all(unreadIds.map(async (id) => {
      if (markNewsAsRead) {
        await markNewsAsRead(id);
      }
    })).finally(() => {
      setLocalNews(prev => prev.map(n => ({ ...n, read: true })));
      isMarkingRef.current = false;
    });
  };
  const handleRequestClick = (notif) => {
    if (!notif.read && markRequestAsRead) {
      markRequestAsRead(notif.id);
      setLocalRequests(prev =>
        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
      );
    }
    if (onRequestClick) {
      onRequestClick(notif);
    }
    setIsOpen(false);
  };

  const handleNewsClick = (notif) => {
    if (!notif.read && markNewsAsRead) {
      markNewsAsRead(notif.id);
      setLocalNews(prev =>
        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
      );
    }
    if (onNewsClick) {
      onNewsClick(notif);
    }
    setIsOpen(false);
  };

  const markAllRequestsAsRead = () => {
    // Tránh gọi nhiều lần cùng lúc
    if (isMarkingRef.current) return;
    isMarkingRef.current = true;

    console.log('📌 Marking all requests as read, count:', localRequests.length);

    const unreadIds = localRequests.filter(n => !n.read).map(n => n.id);
    console.log('📌 Unread request IDs:', unreadIds);

    // Gọi markRequestAsRead cho từng thông báo chưa đọc
    Promise.all(unreadIds.map(async (id) => {
      if (markRequestAsRead) {
        await markRequestAsRead(id);
      }
    })).finally(() => {
      // Cập nhật state local sau khi đã mark hết
      setLocalRequests(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      isMarkingRef.current = false;
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: HC.orangeLight,
          border: `1px solid ${HC.orangeMid}`,
          borderRadius: 30,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = HC.orangeMid;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = HC.orangeLight;
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <BellOutlined style={{ fontSize: 20, color: HC.orangeDark }} />
        {totalUnread > 0 && (
          <span style={{
            position: 'absolute',
            top: -5,
            right: -5,
            background: HC.danger,
            color: '#fff',
            fontSize: 10,
            fontWeight: 900,
            width: 20,
            height: 20,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${HC.surface}`,
          }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
            }}
          />
          <div style={{
            position: 'absolute',
            top: 50,
            right: 0,
            width: 420,
            maxHeight: 550,
            background: HC.surface,
            borderRadius: 16,
            boxShadow: HC.shadowStrong,
            border: `1.5px solid ${HC.border}`,
            zIndex: 999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header with 2 tabs */}
            <div style={{
              padding: '14px 18px',
              background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              color: '#fff',
            }}>
              <div style={{ fontWeight: 900, fontSize: 14, fontFamily: "'Nunito',sans-serif", marginBottom: 12 }}>
                🔔 Trung tâm thông báo
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setActiveTab('requests')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: activeTab === 'requests' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: "'Nunito',sans-serif",
                    transition: 'all 0.2s',
                  }}
                >
                  📋 Yêu cầu
                  {unreadRequests > 0 && (
                    <span style={{
                      background: '#fff',
                      color: HC.orangeDark,
                      borderRadius: 20,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 900,
                    }}>
                      {unreadRequests}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('news')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: activeTab === 'news' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: "'Nunito',sans-serif",
                    transition: 'all 0.2s',
                  }}
                >
                  📰 Tin tức
                  {unreadNews > 0 && (
                    <span style={{
                      background: '#fff',
                      color: HC.orangeDark,
                      borderRadius: 20,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 900,
                    }}>
                      {unreadNews}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Tab Yêu Cầu Content */}
            {activeTab === 'requests' && (
              <div style={{ overflowY: 'auto', maxHeight: 420 }}>
                <div style={{
                  padding: '10px 16px',
                  background: HC.cream,
                  borderBottom: `1px solid ${HC.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>
                    📋 Yêu cầu từ Admin & Staff B
                  </span>
                  {unreadRequests > 0 && (
                    <button
                      onClick={markAllRequestsAsRead}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: HC.orange,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>

                {localRequests.length === 0 ? (
                  <div style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: HC.muted,
                  }}>
                    <span style={{ fontSize: 48, opacity: 0.5 }}>📭</span>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Không có yêu cầu mới</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Thông báo từ Admin và Staff B sẽ hiển thị tại đây</div>
                  </div>
                ) : (
                  localRequests.map((notif, idx) => {
                    // Xác định loại thông báo
                    const isAdminApproved = notif.source === 'admin' && notif.type === 'approved';
                    const isAdminRejected = notif.source === 'admin' && notif.type === 'rejected';
                    const isVendorAssigned = notif.type === 'vendor_assigned';
                    const isSellerFeedback = notif.type === 'seller_feedback';  // ✅ Thêm loại này

                    let icon = '📋';
                    let bgColor = notif.read ? HC.surface : HC.orangeLight;
                    let dotColor = HC.orange;

                    // Admin duyệt sản phẩm
                    if (isAdminApproved) {
                      icon = '✅';
                      bgColor = notif.read ? HC.surface : '#ecfdf5';
                      dotColor = HC.success;
                    }
                    // Admin từ chối sản phẩm
                    else if (isAdminRejected) {
                      icon = '❌';
                      bgColor = notif.read ? HC.surface : '#fef2f2';
                      dotColor = HC.danger;
                    }
                    // Staff B gán vendor
                    else if (isVendorAssigned) {
                      icon = '🏪';
                      bgColor = notif.read ? HC.surface : '#ecfdf5';
                      dotColor = HC.success;
                    }
                    // ✅ Phản hồi từ Staff B
                    else if (isSellerFeedback) {
                      icon = '💬';
                      bgColor = notif.read ? HC.surface : HC.orangeLight;
                      dotColor = HC.orange;
                    }

                    return (
                      <div
                        key={notif.id || idx}
                        onClick={() => handleRequestClick(notif)}
                        style={{
                          padding: '14px 16px',
                          borderBottom: `1px solid ${HC.border}`,
                          background: bgColor,
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = HC.orangePale}
                        onMouseLeave={e => e.currentTarget.style.background = bgColor}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ fontSize: 24 }}>{icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: 800,
                              fontSize: 13,
                              color: notif.read ? HC.muted : HC.ink,
                              fontFamily: "'Nunito',sans-serif",
                              marginBottom: 4,
                            }}>
                              {notif.title}
                            </div>
                            <div style={{
                              fontSize: 12,
                              color: HC.brown,
                              lineHeight: 1.4,
                              whiteSpace: 'pre-wrap',
                            }}>
                              {notif.message}
                            </div>
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: 12,
                              marginTop: 8,
                              fontSize: 10,
                              color: HC.muted2,
                            }}>
                              <span>🕒 {notif.time || new Date(notif.timestamp || Date.now()).toLocaleString('vi-VN')}</span>
                              {notif.productType && notif.productType !== 'undefined' && <span>📦 {notif.productType}</span>}
                              {notif.vendorType && <span>🏪 {notif.vendorType}</span>}
                              {notif.source === 'admin' && <span>👑 Từ Admin</span>}
                              {notif.source === 'staffb' && notif.type === 'vendor_assigned' && <span>📢 Từ Staff B (Gán vendor)</span>}
                              {notif.source === 'staffb' && notif.type === 'seller_feedback' && <span>📢 Từ Staff B (Phản hồi)</span>}
                            </div>
                          </div>
                          {!notif.read && (
                            <div style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: dotColor,
                              flexShrink: 0,
                              marginTop: 8,
                            }} />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {/* Tab Tin Tức Content */}
            {activeTab === 'news' && (
              <div style={{ overflowY: 'auto', maxHeight: 420 }}>
                <div style={{
                  padding: '10px 16px',
                  background: HC.cream,
                  borderBottom: `1px solid ${HC.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>
                    📰 Tin tức & Cập nhật từ Staff B
                  </span>
                  {unreadNews > 0 && (
                    <button
                      onClick={markAllNewsAsRead}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: HC.orange,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>

                {localNews.length === 0 ? (
                  <div style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: HC.muted,
                  }}>
                    <span style={{ fontSize: 48, opacity: 0.5 }}>📰</span>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Chưa có tin tức mới</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Thông báo từ Staff B sẽ hiển thị tại đây</div>
                  </div>
                ) : (
                  localNews.map((notif, idx) => (
                    <div
                      key={notif.id || idx}
                      onClick={() => handleNewsClick(notif)}
                      style={{
                        padding: '14px 16px',
                        borderBottom: `1px solid ${HC.border}`,
                        background: notif.read ? HC.surface : HC.orangeLight,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = HC.orangePale}
                      onMouseLeave={e => e.currentTarget.style.background = notif.read ? HC.surface : HC.orangeLight}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>{notif.icon || '📰'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontWeight: 800,
                            fontSize: 13,
                            color: notif.read ? HC.muted : HC.ink,
                            fontFamily: "'Nunito',sans-serif",
                          }}>
                            {notif.title}
                          </div>
                          <div style={{
                            fontSize: 12,
                            color: HC.brown,
                            marginTop: 6,
                            lineHeight: 1.4,
                            whiteSpace: 'pre-wrap',
                          }}>
                            {notif.message}
                          </div>
                          <div style={{
                            fontSize: 10,
                            color: HC.muted2,
                            marginTop: 8,
                          }}>
                            🕒 {notif.time || new Date(notif.timestamp || Date.now()).toLocaleString('vi-VN')}
                          </div>
                          {notif.source === 'staff_b' && (
                            <div style={{
                              marginTop: 6,
                              display: 'inline-block',
                              padding: '2px 8px',
                              background: HC.orangeLight,
                              borderRadius: 12,
                              fontSize: 9,
                              color: HC.orangeDark,
                              fontWeight: 600,
                            }}>
                              📢 Từ Staff B
                            </div>
                          )}
                        </div>
                        {!notif.read && (
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: HC.orange,
                            flexShrink: 0,
                            marginTop: 8,
                          }} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div style={{
              padding: '10px 16px',
              borderTop: `1px solid ${HC.border}`,
              background: HC.cream,
              textAlign: 'center',
            }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: HC.orange,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Nunito',sans-serif",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
// ══════════════════════════════════════════════════════════
//  MAIN SELLER DASHBOARD
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  MAIN SELLER DASHBOARD (FIXED - NHẬN TIN TỨC TỪ STAFF B)
// ══════════════════════════════════════════════════════════
export default function SellerDashboard() {
  const { user, logout } = useAuth();
  const [active, setActive] = useState('products');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [requestNotifications, setRequestNotifications] = useState([]);
  const [newsNotifications, setNewsNotifications] = useState([]);
  const [highlightedProductId, setHighlightedProductId] = useState(null);
  const [pendingOpenProductId, setPendingOpenProductId] = useState(null);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const PAGE_TITLES = {
    products: 'Products — Sản Phẩm',
    vendors: 'Vendors — Nhà Cung Cấp',
    setup_price: 'Setup Price — Cài Đặt Giá'
  };

  // Load Request Notifications (Admin duyệt/từ chối + Staff B gán vendor + Staff B phản hồi)
  const loadRequestNotifications = useCallback(() => {
    const requests = [];

    // 1. Từ API (Admin duyệt/từ chối)
    notificationApi.list()
      .then(r => {
        const apiNotifs = r.data.data || [];

        apiNotifs.forEach(n => {
          const productName = n.product_type || n.product_name || n.productType || 'Sản phẩm';

          const exists = requests.some(ex => ex.id === `api_${n.id}`); if (!exists) {
            requests.push({
              id: `api_${n.id}`,
              type: n.type,
              source: 'admin',
              icon: n.type === 'approved' ? '✅' : '❌',
              title: n.type === 'approved' ? '✅ Sản phẩm được duyệt' : '❌ Sản phẩm bị từ chối',
              message: n.type === 'approved'
                ? `Sản phẩm "${productName}" đã được Admin duyệt`
                : `Sản phẩm "${productName}" đã bị Admin từ chối. Lý do: ${n.reason || 'Không có lý do'}`,
              time: new Date(n.created_at).toLocaleString('vi-VN'),
              read: n.is_read || false,
              productId: n.product_id,
              productType: productName,
              timestamp: n.created_at,
              reason: n.reason || null
            });
          }
        });
        // Cập nhật state sau khi có dữ liệu từ API
        setRequestNotifications(prev => {
          const allRequests = [...prev, ...requests];
          const unique = allRequests.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
          unique.sort((a, b) => new Date(b.time) - new Date(a.time));
          return unique.slice(0, 100);
        });
      })
      .catch(err => console.error('Lỗi load API notifications:', err));

    // 2. Từ STAFF_B_NOTIFICATIONS (Staff B gán vendor + Phản hồi từ Staff B)
    try {
      const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');

      staffBNotifs.forEach(n => {
        // ✅ Lấy các thông báo: vendor_assigned, seller_feedback (phản hồi từ Staff B)
        // ❌ BỎ QUA sample_approved và sample_rejected (không hiển thị cho Seller)
        if (n.type === 'vendor_assigned' || n.type === 'seller_feedback') {
          const productName = n.productName || n.product_type || n.productType || 'Sản phẩm';

          let icon = '';
          let title = '';
          let bgColor = '';

          if (n.type === 'vendor_assigned') {
            icon = '🏪';
            title = '🏪 Vendor đã được gán';
            bgColor = '#ecfdf5';
          } else if (n.type === 'seller_feedback') {
            icon = '💬';
            title = '💬 Phản hồi từ Staff B';
            bgColor = HC.orangeLight;
          }

          const exists = requests.some(ex => ex.id === `staffb_${n.id}`);
          if (!exists) {
            requests.push({
              id: `staffb_${n.id}`,
              type: n.type,
              source: 'staffb',
              icon: icon,
              title: title,
              message: n.message || '',
              time: n.time || new Date(n.created_at || Date.now()).toLocaleString('vi-VN'),
              read: n.is_read || false,
              productId: n.productId,
              productType: productName,
              vendorType: n.vendorType,
              timestamp: n.created_at || Date.now(),
              bgColor: bgColor
            });
          }
        }
      });
    } catch (err) {
      console.error('Lỗi load thông báo từ localStorage:', err);
    }
    try {
      const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      staffANotifs.forEach(n => {
        if (n.type === 'feedback_from_b') {
          requests.push({
            id: `staffa_${n.id}`,
            type: 'feedback_from_b',
            source: 'staffb',
            icon: n.icon || '💬',
            title: n.title || '💬 Staff B đã gửi phản hồi',
            message: n.message || '',
            time: n.time || new Date(n.timestamp || Date.now()).toLocaleString('vi-VN'),
            read: n.is_read || false,
            productId: n.productId,
            productType: n.productType,
            vendorKey: n.vendorKey,
            timestamp: n.timestamp || n.id
          });
        }
      });
    } catch (err) {
      console.error('Lỗi load STAFF_A_NOTIFICATIONS:', err);
    }
    // Sắp xếp theo thời gian mới nhất
    requests.sort((a, b) => new Date(b.time) - new Date(a.time));

    setRequestNotifications(prev => {
      const allRequests = [...prev, ...requests];
      const unique = allRequests.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      unique.sort((a, b) => new Date(b.time) - new Date(a.time));
      return unique.slice(0, 100);
    });
  }, []);

  // Load News Notifications (Tin tức từ Staff B - type === 'news')
  const loadNewsNotifications = useCallback(() => {
    const news = [];

    try {
      // Lấy từ STAFF_B_NOTIFICATIONS với type === 'news'
      const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
      console.log('📰 Tất cả thông báo từ Staff B:', staffBNotifs);

      // Lọc lấy thông báo type === 'news'
      const newsNotifs = staffBNotifs.filter(n => n.type === 'news');
      console.log('📰 Tin tức từ Staff B:', newsNotifs);

      newsNotifs.forEach(n => {
        news.push({
          id: `news_${n.id}`,
          type: 'news',
          icon: n.icon || '📰',
          title: n.title || '📰 Tin tức mới',
          message: n.message || '',
          time: n.time || new Date(n.created_at || Date.now()).toLocaleString('vi-VN'),
          read: n.is_read || false,
          timestamp: n.created_at || Date.now(),
          source: 'staff_b'
        });
      });
    } catch (err) {
      console.error('Lỗi load tin tức:', err);
    }

    // Cũng có thể lấy từ SELLER_NOTIFICATIONS nếu có
    try {
      const sellerNotifs = JSON.parse(localStorage.getItem('SELLER_NOTIFICATIONS') || '[]');
      const sellerNewsNotifs = sellerNotifs.filter(n => n.type === 'news');
      sellerNewsNotifs.forEach(n => {
        // Kiểm tra xem đã có trong news chưa để tránh trùng
        const exists = news.some(existing => existing.id === n.id);
        if (!exists) {
          news.push({
            id: n.id,
            type: 'news',
            icon: n.icon || '📰',
            title: n.title || '📰 Tin tức mới',
            message: n.message || '',
            time: n.time || new Date(n.timestamp || Date.now()).toLocaleString('vi-VN'),
            read: n.read || false,
            timestamp: n.timestamp || Date.now(),
            source: 'staff_b'
          });
        }
      });
    } catch (err) {
      console.error('Lỗi load tin tức từ SELLER_NOTIFICATIONS:', err);
    }

    // Sắp xếp theo thời gian mới nhất
    news.sort((a, b) => new Date(b.time) - new Date(a.time));
    console.log('📰 Danh sách tin tức sau khi load:', news);
    setNewsNotifications(news.slice(0, 100));
  }, []);

  const markRequestAsRead = useCallback((notificationId) => {
    console.log('📌 Marking as read:', notificationId);

    // Nếu là từ API (Admin)
    if (notificationId.startsWith('api_')) {
      const apiId = notificationId.replace('api_', '');
      notificationApi.markAsRead(apiId).catch(err => console.error('Lỗi mark as read:', err));
    }

    // Nếu là từ localStorage (Staff B)
    if (notificationId.startsWith('staffb_')) {
      try {
        const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
        const originalId = notificationId.replace('staffb_', '');
        const updated = staffBNotifs.map(n =>
          String(n.id) === originalId ? { ...n, is_read: true } : n
        );
        localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(updated));
        // Dispatch event để đồng bộ
        window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS' }));
      } catch (err) {
        console.error('Lỗi cập nhật trạng thái đã đọc:', err);
      }
    }

    // Cập nhật state local
    setRequestNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  // Mark news as read
  const markNewsAsRead = useCallback((notificationId) => {
    try {
      // Cập nhật trong STAFF_B_NOTIFICATIONS
      const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
      const originalId = notificationId.replace('news_', '');
      const updatedStaffB = staffBNotifs.map(n =>
        String(n.id) === originalId ? { ...n, is_read: true } : n
      );
      localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(updatedStaffB));

      // Cập nhật trong SELLER_NOTIFICATIONS nếu có
      const sellerNotifs = JSON.parse(localStorage.getItem('SELLER_NOTIFICATIONS') || '[]');
      const updatedSeller = sellerNotifs.map(n =>
        String(n.id) === notificationId ? { ...n, read: true } : n
      );
      localStorage.setItem('SELLER_NOTIFICATIONS', JSON.stringify(updatedSeller));
    } catch (err) { }

    setNewsNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  // Click vào request notification
  const handleRequestClick = useCallback((notification) => {
    console.log('🔔 Click vào thông báo:', notification);

    if (notification.productId) {
      setPendingOpenProductId(notification.productId);
      setActive('products');
    }
  }, []);

  // Click vào news notification
  const handleNewsClick = useCallback((notification) => {
    console.log('📰 Click vào tin tức:', notification);
    // Có thể mở modal chi tiết tin tức nếu cần
    // Ví dụ: setSelectedNews(notification);
  }, []);

  // Refresh notifications periodically
  useEffect(() => {
    loadRequestNotifications();
    loadNewsNotifications();

    const interval = setInterval(() => {
      loadRequestNotifications();
      loadNewsNotifications();
    }, 10000);

    const handleStorageChange = (e) => {
      if (e.key === 'STAFF_B_NOTIFICATIONS') {
        console.log('🔄 Storage changed: STAFF_B_NOTIFICATIONS');
        loadRequestNotifications();
        loadNewsNotifications();
      }
      if (e.key === 'SELLER_NOTIFICATIONS') {
        console.log('🔄 Storage changed: SELLER_NOTIFICATIONS');
        loadNewsNotifications();
      }
      // ✅ THÊM DÒNG NÀY
      if (e.key === 'STAFF_A_NOTIFICATIONS') {
        console.log('🔄 Storage changed: STAFF_A_NOTIFICATIONS');
        loadRequestNotifications();  // Staff B gửi phản hồi vào đây
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadRequestNotifications, loadNewsNotifications]);

  // Mở modal sản phẩm khi chuyển sang tab products
  useEffect(() => {
    if (active === 'products' && pendingOpenProductId) {
      setHighlightedProductId(pendingOpenProductId);
      setPendingOpenProductId(null);
    }
  }, [active, pendingOpenProductId]);

  const renderSection = () => {
    switch (active) {
      case 'products': return <ProductsSection highlightedProductId={highlightedProductId} onHighlightCleared={() => setHighlightedProductId(null)} />;
      case 'vendors': return <VendorsSection />;
      case 'setup_price': return <SetupPriceSection />;
      default: return null;
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${HC.cream}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: ${HC.orangeMid}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${HC.orange}; }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>

      <div style={{
        display: 'flex',
        height: '100vh',
        background: `linear-gradient(135deg, ${HC.orangePale} 0%, ${HC.cream} 100%)`,
        fontFamily: "'Nunito Sans',sans-serif",
        color: HC.ink,
        overflow: 'hidden',
      }}>
        <SellerSidebar
          active={active}
          setActive={setActive}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          logout={logout}
        />

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            height: 72,
            background: `linear-gradient(135deg, ${HC.surface}, ${HC.surface2})`,
            borderBottom: `1.5px solid ${HC.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            gap: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 4,
                height: 32,
                borderRadius: 99,
                background: `linear-gradient(to bottom, ${HC.orange}, ${HC.orangeDark})`,
                flexShrink: 0,
              }} />
              <div style={{
                color: HC.ink,
                fontWeight: 900,
                fontSize: 16,
                fontFamily: "'Nunito',sans-serif",
                letterSpacing: '-0.01em',
              }}>
                {PAGE_TITLES[active]}
              </div>
            </div>

            <SellerNotificationCenter
              requestNotifications={requestNotifications}
              newsNotifications={newsNotifications}
              markRequestAsRead={markRequestAsRead}
              markNewsAsRead={markNewsAsRead}
              onRequestClick={handleRequestClick}
              onNewsClick={handleNewsClick}
            />
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 32,
          }}>
            {renderSection()}
          </div>
        </div>
      </div>
    </>
  );
}