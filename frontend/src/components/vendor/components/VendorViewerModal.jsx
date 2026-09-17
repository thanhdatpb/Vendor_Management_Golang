import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExportOutlined, FileOutlined } from '@ant-design/icons';
import { HC, LS_PRODUCT_VENDORS, LS_B_SELECTIONS } from '../utils/constants';
import { lsGet, lsSet, getMediaUrls, fmtDate } from '../utils/helpers';
import { pushNotif } from '../../../utils/notifUtils';
import { targetCostCeiling } from '../../../utils/targetCost';
import { libraryFilePath } from '../../../utils/libraryFileLink';
import PriceComparisonMatrix from './PriceComparisonMatrix';
import Lightbox from './Lightbox';
import { BestSellerBadge } from '../ui/VendorUI';

const parseAssignedVendors = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

export default function VendorViewerModal({ product, onClose }) {
  const LS_A_FEEDBACK_RESPONSE = 'STAFF_A_FEEDBACK_RESPONSE_V1';

  // Ưu tiên assigned_vendors từ API (nguồn thật, đồng bộ mọi thiết bị) — trước đây
  // đọc localStorage TRƯỚC nên nếu Seller gán vendor mới trên máy khác, máy này vẫn
  // hiển thị danh sách cũ cho tới khi user tự thao tác lại. Local chỉ còn là fallback
  // khi API chưa có dữ liệu (vd sản phẩm gán nhanh chưa kịp đồng bộ ngay).
  const getVendors = (pid) => {
    const fromAPI = parseAssignedVendors(product?.assigned_vendors);
    if (fromAPI.length > 0) return fromAPI;
    return lsGet(LS_PRODUCT_VENDORS, {})[pid] || [];
  };

  const [vendors, setVendors] = useState(() => getVendors(product?.id));
  const [bSelections, setBSelections] = useState(() => lsGet(LS_B_SELECTIONS, {})[product?.id] || {});
  const [bFeedbacks, setBFeedbacks] = useState(() => lsGet('STAFF_B_FEEDBACKS_V1', {})[product?.id] || {});
  const [bSubmittedFeedbacks, setBSubmittedFeedbacks] = useState(() => lsGet('STAFF_B_SUBMITTED_FEEDBACK_V1', {})[product?.id] || {});
  const [aResponseFeedbacks, setAResponseFeedbacks] = useState(() => {
    const all = lsGet(LS_A_FEEDBACK_RESPONSE, {});
    return all[product?.id] || {};
  });
  const [sampleDecisions, setSampleDecisions] = useState(() => {
    try { const raw = localStorage.getItem('STAFF_SAMPLE_DECISIONS_V1'); const all = raw ? JSON.parse(raw) : {}; return all[product?.id] || {}; } catch { return {}; }
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showMatrix, setShowMatrix] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const isMountedRef = useRef(true);

  const [feedbackTexts, setFeedbackTexts] = useState(() => {
    const initial = {};
    vendors.forEach((v, i) => {
      const key = v.id ? String(v.id) : `idx_${i}`;
      initial[key] = bFeedbacks[key]?.feedback || '';
    });
    return initial;
  });

  useEffect(() => {
    isMountedRef.current = true;
    const sync = () => {
      if (!isMountedRef.current) return;
      const allVendors = getVendors(product?.id);
      const decisions = (() => { try { const raw = localStorage.getItem('STAFF_SAMPLE_DECISIONS_V1'); const all = raw ? JSON.parse(raw) : {}; return all[product?.id] || {}; } catch { return {}; } })();
      const approvedKeys = Object.entries(decisions).filter(([_, d]) => d.decision === 'dat').map(([key]) => key);
      const allResponses = lsGet(LS_A_FEEDBACK_RESPONSE, {});

      if (approvedKeys.length > 0) {
        setVendors(allVendors.filter((v, i) => { const key = v.id ? String(v.id) : `idx_${i}`; return approvedKeys.includes(key); }));
      } else { setVendors(allVendors); }
      setBSelections(lsGet(LS_B_SELECTIONS, {})[product?.id] || {});
      setBFeedbacks(lsGet('STAFF_B_FEEDBACKS_V1', {})[product?.id] || {});
      setBSubmittedFeedbacks(lsGet('STAFF_B_SUBMITTED_FEEDBACK_V1', {})[product?.id] || {});
      setAResponseFeedbacks(allResponses[product?.id] || {});
      setSampleDecisions(decisions);
    };
    sync();
    window.addEventListener('storage', sync);
    const id = setInterval(sync, 4000);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('storage', sync);
      clearInterval(id);
    };
  }, [product?.id]);

  if (!product) return null;
  const vendorKey = (v, i) => v.id ? String(v.id) : `idx_${i}`;

  const toggleBCheck = useCallback((key) => {
    setBSelections(prev => {
      const currentChecked = prev[key]?.checked;
      const n = { ...prev, [key]: { ...prev[key], checked: !currentChecked } };
      const all = lsGet(LS_B_SELECTIONS, {});
      if (!all[product.id]) all[product.id] = {};
      all[product.id] = n;
      lsSet(LS_B_SELECTIONS, all);
      requestAnimationFrame(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: LS_B_SELECTIONS }));
      });
      return n;
    });
  }, [product.id]);

  const submitBFeedback = useCallback(async (key, feedbackText) => {
    if (!feedbackText) { alert('Vui lòng nhập phản hồi trước khi gửi'); return; }
    const allSubmitted = lsGet('STAFF_B_SUBMITTED_FEEDBACK_V1', {});
    if (!allSubmitted[product.id]) allSubmitted[product.id] = {};
    allSubmitted[product.id][key] = {
      feedback: feedbackText,
      submittedAt: new Date().toISOString(),
      vendorKey: key,
      staff_b_approved: true
    };
    lsSet('STAFF_B_SUBMITTED_FEEDBACK_V1', allSubmitted);
    setBSubmittedFeedbacks(prev => ({ ...prev, [key]: allSubmitted[product.id][key] }));
    const allFeedbacks = lsGet('STAFF_B_FEEDBACKS_V1', {});
    if (!allFeedbacks[product.id]) allFeedbacks[product.id] = {};
    allFeedbacks[product.id][key] = { feedback: feedbackText };
    lsSet('STAFF_B_FEEDBACKS_V1', allFeedbacks);
    setBFeedbacks(prev => ({ ...prev, [key]: { feedback: feedbackText } }));
    const v = vendors.find((v, i) => vendorKey(v, i) === key);
    pushNotif('staff_a', {
      type: 'feedback_from_b',
      icon: '💬',
      title: 'Phản hồi mới về Vendor',
      message: `Bộ phận Vận hành đã gửi phản hồi về vendor "${v?.vendor_type || '—'}" cho sản phẩm "${product.product_type}".`,
      product_id: product.id,
      vendorKey: key,
    });
    alert('Đã gửi phản hồi đến Staff A!');
  }, [product.id, product.product_type, vendors]);

  const bSelectedCount = Object.values(bSelections).filter(s => s?.checked).length;
  const mediaUrls = getMediaUrls(product);
  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

  const parsedLinks = (() => {
    if (product.product_type_links) {
      if (Array.isArray(product.product_type_links)) return product.product_type_links;
      try { return JSON.parse(product.product_type_links); } catch { return [product.product_type_links]; }
    }
    if (product.product_type_link) return [product.product_type_link];
    return [];
  })();

  // ── Grouped vendors ──────────────────────────────────────────────────────────
  const groupedV = [];
  const gMap = new Map();
  vendors.forEach((v, idx) => {
    const vName = ((v.name || v.vendor_type || '—') || '').toString().trim();
    if (!gMap.has(vName)) {
      gMap.set(vName, { vendorName: vName, items: [], firstVendor: v, key: vendorKey(v, idx) });
      groupedV.push(gMap.get(vName));
    }
    gMap.get(vName).items.push(v);
  });

  // ── Price tiers ──────────────────────────────────────────────────────────────
  const TIER_META = [
    { key: 'eco_total',       short: 'ECO',  label: 'Economy',   color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
    { key: 'ground_total',    short: 'GND',  label: 'Ground',    color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe' },
    { key: 'twoday_total',    short: '2DAY', label: '2 Days',    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    { key: 'express_total',   short: 'EXP',  label: 'Express',   color: '#b45309', bg: '#fff7ed', border: '#fed7aa' },
    { key: 'overnight_total', short: 'OVN',  label: 'Overnight', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  ];

  // total_cost có thể là khoảng ("100-150") → lấy cận trên làm trần so sánh.
  // Number() trực tiếp sẽ ra NaN, khiến mọi vendor bị gắn nhãn "Vượt target".
  const target = targetCostCeiling(product.total_cost);

  const getTotal = (vi, key) => {
    const v = Number(vi[key]);
    if (vi[key] != null && vi[key] !== '' && v > 0) return v;
    if (key === 'eco_total') {
      const p1 = Number(vi.pricing1); const ep = Number(vi.eco_price);
      if (p1 > 0 && ep > 0) return p1 + ep;
    }
    return null;
  };

  const getBestPrice = (items) => {
    for (const vi of items) {
      for (const t of TIER_META) {
        const v = getTotal(vi, t.key);
        if (v != null && v > 0) return v;
      }
    }
    return null;
  };

  const groupPrices = groupedV.map(g => getBestPrice(g.items));
  const validPrices = groupPrices.filter(p => p != null);
  const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

  // ── Table style helpers ──────────────────────────────────────────────────────
  const NaLib = ({ title: tip } = {}) => (
    <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }} title={tip || 'Chưa có trong thư viện vendor'}>—</span>
  );
  const NaStaff = () => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: '#92400e', padding: '2px 7px', borderRadius: 4, background: '#fffbeb', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>
      chờ cập nhật
    </span>
  );
  const thS = (extra = {}) => ({
    padding: '9px 12px', fontWeight: 800, fontSize: 10, color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderRight: `1px solid ${HC.border}`, borderBottom: `1.5px solid #e5e7eb`,
    background: '#f8fafc', whiteSpace: 'nowrap', textAlign: 'center', ...extra,
  });
  const td = (extra = {}) => ({
    padding: '11px 12px', verticalAlign: 'middle',
    borderRight: `1px solid #f1f5f9`, borderBottom: `1px solid #f1f5f9`, ...extra,
  });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, backdropFilter: 'blur(3px)', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1400, height: '92vh', background: HC.orangePale, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.28)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* ── Header ── */}
          <div style={{ padding: '13px 20px', background: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 4, height: 22, borderRadius: 99, background: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', fontFamily: "'Inter',sans-serif" }}>Chi tiết sản phẩm</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontFamily: "'Inter',sans-serif", marginTop: 1 }}>
                {product.product_type || `#${product.id}`}
                {vendors.length > 0 && <span style={{ marginLeft: 10, padding: '1px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 10, fontWeight: 800 }}>{vendors.length} vendor</span>}
              </div>
            </div>
            {bSelectedCount > 0 && <span style={{ padding: '3px 12px', borderRadius: 999, background: 'rgba(22,163,74,0.25)', border: '1px solid rgba(22,163,74,0.5)', color: '#4ade80', fontSize: 11, fontWeight: 800 }}>✓ Đã chọn {bSelectedCount} nhà cung cấp</span>}
            <button onClick={() => setShowMatrix(!showMatrix)} style={{ padding: '6px 14px', borderRadius: 8, background: showMatrix ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = showMatrix ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'; }}
            >
              {showMatrix ? '📋 Xem danh sách' : '📊 So sánh Matrix'}
            </button>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, transition: 'background 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >✕</button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* ── TOP: Image + Compact Product Info ── */}
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: `1.5px solid ${HC.border}`, background: HC.surface }}>

              {/* Image panel */}
              <div style={{ width: 240, flexShrink: 0, borderRight: `1.5px solid ${HC.border}`, display: 'flex', flexDirection: 'column', background: '#1a1008' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: mediaUrls.length ? 'pointer' : 'default' }}>
                  {mediaUrls.length > 0 ? (
                    isVideo(mediaUrls[currentMediaIndex])
                      ? <video onClick={() => { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); }} src={mediaUrls[currentMediaIndex]} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                      : <img onClick={() => { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); }} src={mediaUrls[currentMediaIndex]} alt="" style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>Chưa có ảnh</div>
                    </div>
                  )}
                  {mediaUrls.length > 1 && (
                    <>
                      <button onClick={e => { e.stopPropagation(); setCurrentMediaIndex(p => p > 0 ? p - 1 : mediaUrls.length - 1); }} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, fontSize: 18 }}>‹</button>
                      <button onClick={e => { e.stopPropagation(); setCurrentMediaIndex(p => p < mediaUrls.length - 1 ? p + 1 : 0); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, fontSize: 18 }}>›</button>
                      <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.65)', borderRadius: 20, padding: '3px 9px', fontSize: 10, color: '#fff', fontWeight: 700 }}>
                        {currentMediaIndex + 1} / {mediaUrls.length}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Product info — compact mini cards */}
              <div style={{ flex: 1, overflowX: 'hidden', padding: '10px 16px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 3, height: 13, borderRadius: 2, background: HC.orange, flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: 10, color: HC.ink, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Thông tin request</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ padding: '2px 8px', borderRadius: 5, background: '#f1f5f9', border: `1px solid ${HC.border}`, fontSize: 10, fontWeight: 600, color: HC.muted }}>{fmtDate(product.created_at) || '—'}</span>
                    {product.deadline_date && (
                      <span style={{ padding: '2px 8px', borderRadius: 5, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 10, fontWeight: 700, color: HC.danger }}>Deadline {fmtDate(product.deadline_date)}</span>
                    )}
                  </div>
                </div>

                {/* Row 1: key metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr', gap: 6, marginBottom: 6 }}>
                  <div style={{ background: HC.orangePale, border: `1px solid ${HC.orangeMid}`, borderRadius: 8, padding: '7px 11px' }}>
                    <div style={{ fontSize: 9, color: HC.orangeDark, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Product Type</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: HC.orangeDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.product_type || '—'}</div>
                  </div>
                  {[{ label: 'SX', value: product.production_time }, { label: 'Ship', value: product.shipping_time }].map(({ label, value }) => (
                    <div key={label} style={{ background: '#fff', border: `1px solid #e5e7eb`, borderRadius: 8, padding: '7px 11px' }}>
                      <div style={{ fontSize: 9, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>T.gian {label}</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: HC.ink }}>{value || '—'}</div>
                    </div>
                  ))}
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '7px 11px' }}>
                    <div style={{ fontSize: 9, color: '#065f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Target Cost</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#065f46' }}>{product.total_cost != null ? `$${product.total_cost}` : '—'}</div>
                  </div>
                </div>

                {/* Row 2: specs compact */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
                  {[
                    { label: 'Chất liệu', value: product.material },
                    { label: 'Vùng In', value: product.print_area },
                    { label: 'Packing', value: product.packaging_links || 'Bao bì' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 11px' }}>
                      <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: HC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value || ''}>{value || '—'}</div>
                    </div>
                  ))}
                </div>

                {/* Row 2a: Đặc tính KT — nội dung có thể dài, cho xuống dòng đầy đủ */}
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 11px', marginBottom: 6 }}>
                  <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Đặc tính KT</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: HC.ink, lineHeight: 1.4 }}>{product.other_specs || '—'}</div>
                </div>

                {/* Row 2b: reviews — full wrapped text */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                  {[
                    { label: 'Good Review', value: product.good_review, color: '#166534', bg: '#f0fdf4', bc: '#bbf7d0' },
                    { label: 'Bad Review', value: product.bad_review, color: '#991b1b', bg: '#fef2f2', bc: '#fecaca' },
                  ].map(({ label, value, color, bg, bc }) => (
                    <div key={label} style={{ background: bg, border: `1px solid ${bc}`, borderRadius: 8, padding: '7px 11px' }}>
                      <div style={{ fontSize: 9, color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color, lineHeight: 1.4 }}>{value || '—'}</div>
                    </div>
                  ))}
                </div>

                {/* Row 3 & 4: links + video — always visible */}
                {(() => {
                  let vLinks = [];
                  if (product.product_video_links && Array.isArray(product.product_video_links)) {
                    vLinks = product.product_video_links;
                  } else if (typeof product.product_video_links === 'string') {
                    try { vLinks = JSON.parse(product.product_video_links); } catch { vLinks = [product.product_video_links]; }
                  }
                  vLinks = vLinks.filter(Boolean);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {/* Ref links */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: HC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, minWidth: 38 }}>Links</span>
                        {parsedLinks.length > 0
                          ? parsedLinks.map((link, idx) => (
                              <a key={idx} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                style={{ fontSize: 10, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '2px 10px', borderRadius: 5, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, transition: 'background 0.15s', whiteSpace: 'nowrap' }}
                                onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                                onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                              >Link {idx + 1}</a>
                            ))
                          : <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }}>—</span>
                        }
                      </div>
                      {/* Video links */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, color: HC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, minWidth: 38 }}>Video</span>
                        {vLinks.length > 0
                          ? vLinks.map((link, idx) => (
                              <a key={idx} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                style={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textDecoration: 'none', padding: '2px 10px', borderRadius: 5, background: '#f5f3ff', border: '1px solid #ddd6fe', transition: 'background 0.15s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#ede9fe'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#f5f3ff'; }}
                              >▶ Video {idx + 1}</a>
                            ))
                          : <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }}>—</span>
                        }
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* ── BOTTOM: Vendor Comparison ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
              {/* Section bar */}
              <div style={{ padding: '8px 20px', background: '#fff', borderBottom: `1.5px solid ${HC.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 3, height: 14, borderRadius: 2, background: HC.orange }} />
                <span style={{ fontWeight: 800, fontSize: 11, color: HC.ink, textTransform: 'uppercase', letterSpacing: '0.07em' }}>So sánh nhà phân phối</span>
                {vendors.length > 0 && (() => {
                  const uCount = new Set(vendors.map(v => (v.name || v.vendor_type || '').toString().trim()).filter(Boolean)).size || vendors.length;
                  return <span style={{ padding: '2px 10px', borderRadius: 20, background: 'rgba(120,53,15,0.1)', color: '#78350f', fontSize: 10, fontWeight: 700 }}>{uCount} vendor</span>;
                })()}
                {product.total_cost != null && (
                  <span style={{ marginLeft: 4, padding: '2px 10px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 10, fontWeight: 700 }}>
                    Target: ${product.total_cost}
                  </span>
                )}
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>
                {showMatrix ? (
                  <div style={{ paddingBottom: 40 }}>
                    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, color: HC.brown, fontWeight: 700 }}>📊 Bảng so sánh chỉ số giữa các Vendor ({product.product_type})</div>
                      <div style={{ fontSize: 11, color: HC.muted2 }}>Tự động highlight các giá trị tối ưu nhất</div>
                    </div>
                    <PriceComparisonMatrix vendors={vendors} productType={product.product_type} />
                  </div>
                ) : vendors.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 40px', background: HC.surface, borderRadius: 14, border: `1px solid ${HC.border}` }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: HC.cream, border: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={HC.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.ink, marginBottom: 6 }}>Chưa có nhà phân phối được gán</div>
                    <div style={{ fontSize: 12, color: HC.muted, lineHeight: 1.6, textAlign: 'center', maxWidth: 320 }}>Bộ phận Vận hành sẽ gán nhà cung cấp phù hợp sau khi xem xét yêu cầu sản phẩm này.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ borderRadius: 12, border: `1.5px solid ${HC.border}`, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: 990, borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={{ ...thS({ width: 60 }) }}>Ảnh</th>
                              <th style={{ ...thS({ textAlign: 'left', minWidth: 150 }) }}>Vendor</th>
                              <th style={{ ...thS({ textAlign: 'left', minWidth: 120 }) }}>Chất liệu</th>
                              <th style={{ ...thS({ width: 80 }) }}>Size</th>
                              <th style={{ ...thS({ width: 124 }) }}>T.gian Vendor</th>
                              <th style={{ ...thS({ width: 70 }) }}>Folder</th>
                              <th style={{ ...thS({ minWidth: 260, borderRight: 'none', color: '#059669' }) }}>Giá & So sánh Target</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedV.map((group, gIdx) => {
                              const v = group.firstVendor;
                              const vendorImg = v.media_url || (Array.isArray(v.images) && v.images[0]) || null;
                              const rawMaterial = v.overview || '';
                              const vendorLink = v.link_folder || null;

                              const bestPrice = getBestPrice(group.items);
                              const isBest = bestPrice != null && lowestPrice != null
                                && Math.abs(bestPrice - lowestPrice) < 0.001
                                && groupedV.length > 1;
                              const isWithinTarget = target != null && bestPrice != null && bestPrice <= target;

                              const rowBg = isBest ? '#f0fdf4' : gIdx % 2 === 0 ? '#fff' : '#fafafa';
                              const leftBorder = isBest ? '3px solid #22c55e' : '3px solid transparent';

                              const sizes = [...new Set(group.items.map(vi => vi.size).filter(Boolean))];

                              const tierRanges = TIER_META.map(t => {
                                const vals = group.items.map(vi => getTotal(vi, t.key)).filter(n => n != null && n > 0);
                                if (vals.length === 0) return null;
                                return { ...t, min: Math.min(...vals), max: Math.max(...vals) };
                              }).filter(Boolean);

                              return (
                                <tr key={group.key} style={{ background: rowBg, transition: 'background 0.12s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = isBest ? '#dcfce7' : '#fff8f0'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
                                >
                                  {/* Ảnh + BEST badge */}
                                  <td style={{ ...td({ textAlign: 'center', width: 60, position: 'relative', borderLeft: leftBorder }) }}>
                                    {vendorImg
                                      ? <img src={vendorImg} loading="lazy" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: `1px solid ${HC.border}`, display: 'block', margin: '0 auto' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                                      : <div style={{ width: 44, height: 44, borderRadius: 8, background: HC.cream, border: `1px dashed ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', color: HC.muted2 }}>
                                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                        </div>
                                    }
                                    {isBest && (
                                      <div style={{ marginTop: 4, padding: '1px 5px', borderRadius: 4, background: '#16a34a', color: '#fff', fontSize: 7.5, fontWeight: 900, letterSpacing: '0.06em', textAlign: 'center' }}>BEST</div>
                                    )}
                                  </td>

                                  {/* Vendor name + badges */}
                                  <td style={{ ...td({ textAlign: 'left' }) }}>
                                    <div style={{ fontWeight: 800, fontSize: 12, color: HC.ink }}>{v.name || v.vendor_type || '—'}</div>
                                    {v.name && v.vendor_type && v.name !== v.vendor_type && (
                                      <div style={{ fontSize: 10, color: HC.muted2, marginTop: 1 }}>{v.vendor_type}</div>
                                    )}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                                      {isWithinTarget && (
                                        <span style={{ padding: '1px 7px', borderRadius: 4, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 9, fontWeight: 800, color: '#16a34a' }}>✓ Trong target</span>
                                      )}
                                      {!isWithinTarget && bestPrice != null && target != null && (
                                        <span style={{ padding: '1px 7px', borderRadius: 4, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 9, fontWeight: 700, color: '#dc2626' }}>Vượt target</span>
                                      )}
                                      {v.source_file_id && (
                                        <a
                                          href={libraryFilePath(v.source_file_id, v.source_file_name)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={v.source_file_name ? `Mở file gốc: ${v.source_file_name}` : 'Mở file gốc trong Thư viện Vendor'}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9, fontWeight: 700, color: HC.orangeDark, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, borderRadius: 4, padding: '1px 7px', textDecoration: 'none' }}
                                        ><FileOutlined aria-hidden="true" /> {v.source_file_name ? v.source_file_name.replace(/\.xlsx?$/i, '') : 'File gốc'} <ExportOutlined aria-hidden="true" /></a>
                                      )}
                                    </div>
                                  </td>

                                  {/* Chất liệu */}
                                  <td style={{ ...td({ textAlign: 'left' }) }}>
                                    {rawMaterial
                                      ? <span style={{ color: HC.ink2, fontSize: 11, lineHeight: 1.5 }} title={rawMaterial}>{rawMaterial.length > 55 ? rawMaterial.slice(0, 55) + '…' : rawMaterial}</span>
                                      : <NaLib title="Thư viện chưa có thông tin chất liệu" />
                                    }
                                  </td>

                                  {/* Size — pills */}
                                  <td style={{ ...td({ textAlign: 'center', width: 80 }) }}>
                                    {sizes.length === 0
                                      ? <NaLib title="Thư viện chưa có thông tin size" />
                                      : (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
                                          {sizes.map(s => (
                                            <span key={s} style={{ fontSize: 9, fontWeight: 700, color: HC.ink, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap' }}>{s}</span>
                                          ))}
                                        </div>
                                      )
                                    }
                                  </td>

                                  {/* T.gian Vendor — thời gian do CHÍNH vendor này báo cáo (avg_time_vendor/avg_time_actual),
                                      KHÔNG phải production_time/shipping_time của request gốc (giống nhau cho mọi vendor) */}
                                  <td style={{ ...td({ textAlign: 'left', width: 124 }) }}>
                                    {(v.avg_time_vendor || v.avg_time_actual)
                                      ? (
                                        <div style={{ fontSize: 10, lineHeight: 1.4 }}>
                                          {v.avg_time_vendor && <div style={{ fontWeight: 700, color: '#0284c7', whiteSpace: 'pre-line' }}>{v.avg_time_vendor}</div>}
                                          {v.avg_time_actual && <div style={{ fontWeight: 600, color: '#7c3aed', marginTop: v.avg_time_vendor ? 3 : 0, whiteSpace: 'pre-line' }}>Thực tế: {v.avg_time_actual}</div>}
                                        </div>
                                      )
                                      : <NaLib />
                                    }
                                  </td>

                                  {/* Link Folder */}
                                  <td style={{ ...td({ textAlign: 'center', width: 70 }) }}>
                                    {vendorLink
                                      ? <a href={vendorLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '4px 8px', borderRadius: 6, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, transition: 'all 0.15s' }}
                                          onMouseEnter={e => e.currentTarget.style.background = HC.orangeMid}
                                          onMouseLeave={e => e.currentTarget.style.background = HC.orangeLight}
                                        >
                                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                                          Folder
                                        </a>
                                      : <NaStaff />
                                    }
                                  </td>

                                  {/* Giá & So sánh Target */}
                                  <td style={{ ...td({ borderRight: 'none', minWidth: 260 }) }}>
                                    {tierRanges.length > 0 ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {tierRanges.map(({ short, label, min, max, color, bg, border: bc }, ti) => {
                                          const isPrimary = ti === 0;
                                          const delta = target != null ? min - target : null;
                                          const dColor = delta == null ? '#94a3b8'
                                            : delta <= 0 ? '#16a34a'
                                            : delta <= (target ?? 0) * 0.1 ? '#d97706'
                                            : '#dc2626';
                                          const dLabel = delta == null ? null
                                            : delta <= 0 ? `-$${Math.abs(delta).toFixed(2)} dưới target`
                                            : `+$${delta.toFixed(2)} trên target`;
                                          const priceLabel = min === max
                                            ? `$${min.toFixed(2)}`
                                            : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
                                          return (
                                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                              <span style={{ fontSize: 8, fontWeight: 900, color, background: bg, border: `1px solid ${bc}`, padding: '2px 6px', borderRadius: 4, minWidth: 34, textAlign: 'center', letterSpacing: '0.04em', flexShrink: 0 }}>{short}</span>
                                              <span style={{ fontWeight: isPrimary ? 900 : 700, fontSize: isPrimary ? 14 : 12, color, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{priceLabel}</span>
                                              {isPrimary && delta != null && (
                                                <span style={{ fontSize: 9, fontWeight: 800, color: dColor, padding: '2px 8px', borderRadius: 4, background: dColor + '14', border: `1px solid ${dColor}30`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                  {dLabel}
                                                </span>
                                              )}
                                              {!isPrimary && (
                                                <span style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>{label}</span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <NaLib title="Thư viện chưa có dữ liệu giá" />
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: '12px 20px', background: HC.surface, borderTop: `1.5px solid ${HC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: HC.muted }}>
              {bSelectedCount > 0 && <span style={{ color: HC.success, fontWeight: 800 }}>✓ Đã chọn {bSelectedCount} vendor</span>}
            </div>
            <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: 10, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>Đóng</button>
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox mediaUrls={mediaUrls} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}
