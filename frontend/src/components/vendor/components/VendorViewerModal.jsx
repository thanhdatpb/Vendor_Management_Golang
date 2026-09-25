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
import useIsMobile from '../../../hooks/useIsMobile';
import useResizablePane from '../../../hooks/useResizablePane';
import {
  MODAL_MAX_WIDTH, FONT, toList,
  DetailHeader, MediaColumn, Section, Field, ReviewCard, RefLink,
  SpecRail, SpecList, VendorBar, VendorEmptyState, PaneResizer,
} from '../../shared/RequestDetailUI';

// Ghi nhớ chiều cao/thu gọn khung thông tin request theo từng người dùng.
const LS_REQUEST_PANE = 'REQUEST_DETAIL_PANE_V1';

const parseAssignedVendors = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

export default function VendorViewerModal({ product, onClose }) {
  const isMobile = useIsMobile();
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

  // Khung trên (thông tin request) kéo cao/thấp được, nhớ theo người dùng.
  // Mobile xếp dọc nên không chia khung — giữ nguyên cách cuộn cũ.
  const {
    containerRef: paneContainerRef, ratio: paneRatio, collapsed: paneCollapsed,
    dragging: paneDragging, startDrag: startPaneDrag, onKeyDown: onPaneKeyDown,
    toggleCollapse: togglePane, reset: resetPane,
  } = useResizablePane({ storageKey: LS_REQUEST_PANE, enabled: !isMobile });
  const paneHeight = paneCollapsed ? 0 : `${(paneRatio * 100).toFixed(2)}%`;

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
  // Nhận diện video giờ nằm trong MediaView/Lightbox (../../shared/RequestDetailUI) —
  // không còn cần isVideo cục bộ ở đây.

  const videoLinks = toList(product.product_video_links).filter(Boolean);

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
        <div role="dialog" aria-modal="true" aria-label={product.product_type || 'Chi tiết request'} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: MODAL_MAX_WIDTH, height: '92vh', background: HC.surface, borderRadius: 16, boxShadow: '0 32px 80px rgba(26,15,0,0.28)', border: `1px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>

          <DetailHeader
            eyebrow="Request sản phẩm"
            title={product.product_type || `#${product.id}`}
            isMobile={isMobile}
            onClose={onClose}
            badges={bSelectedCount > 0 ? <span style={{ padding: '2px 10px', borderRadius: 999, background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#065f46', fontSize: 11, fontWeight: 700 }}>✓ Đã chọn {bSelectedCount} nhà cung cấp</span> : null}
            meta={<>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>Gửi {fmtDate(product.created_at) || '—'}</span>
              {product.deadline_date && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '1px 9px', borderRadius: 999, background: '#fef2f2', border: '1px solid #fecaca', color: HC.danger, fontWeight: 600 }}>
                  <span>Deadline</span><span>{fmtDate(product.deadline_date)}</span>
                </span>
              )}
            </>}
            actions={
              <button
                type="button"
                onClick={() => setShowMatrix(!showMatrix)}
                style={{ height: 36, padding: '0 14px', borderRadius: 10, background: showMatrix ? HC.orangeLight : HC.surface, border: `1px solid ${showMatrix ? HC.orangeMid : HC.border}`, color: showMatrix ? HC.orangeDeep : HC.brown, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: FONT }}
                onMouseEnter={e => { e.currentTarget.style.background = HC.orangeLight; e.currentTarget.style.borderColor = HC.orangeMid; }}
                onMouseLeave={e => { e.currentTarget.style.background = showMatrix ? HC.orangeLight : HC.surface; e.currentTarget.style.borderColor = showMatrix ? HC.orangeMid : HC.border; }}
              >{showMatrix ? 'Xem danh sách' : 'So sánh Matrix'}</button>
            }
          />

          <div ref={paneContainerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>

            {/* ── TOP: ảnh (trái) + thông tin chia Section (phải) ── */}
            <div style={{
              display: isMobile ? 'grid' : (paneCollapsed ? 'none' : 'grid'),
              gridTemplateColumns: isMobile ? '1fr' : '300px minmax(0,1fr)',
              alignItems: 'stretch', flexShrink: 0, minHeight: 0,
              // Desktop: chiều cao do người dùng kéo (ratio); mobile giữ cuộn dọc như cũ.
              height: isMobile ? 'auto' : paneHeight,
              maxHeight: isMobile ? 'none' : undefined,
              overflowY: 'auto',
              borderBottom: isMobile ? `1px solid ${HC.border}` : 'none',
              background: HC.surface,
            }}>
              <MediaColumn
                urls={mediaUrls}
                current={currentMediaIndex}
                onSelect={setCurrentMediaIndex}
                onOpen={() => { if (mediaUrls.length) { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); } }}
                isMobile={isMobile}
                alt={product.product_type || ''}
              />

              <div style={{ minWidth: 0, padding: isMobile ? '4px 14px 6px' : '4px 22px 6px' }}>
                <Section title="Thông số sản phẩm">
                  <SpecRail totalCost={product.total_cost} productionTime={product.production_time} shippingTime={product.shipping_time} isMobile={isMobile} />
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: isMobile ? 10 : '12px 20px' }}>
                    <Field label="Chất liệu" value={product.material} />
                    <Field label="Vùng in" value={product.print_area} />
                  </div>
                  <SpecList text={product.other_specs} />
                </Section>

                <Section title="Phản hồi khách hàng">
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: 10 }}>
                    <ReviewCard good label="Good review" value={product.good_review} />
                    <ReviewCard label="Bad review" value={product.bad_review} />
                  </div>
                </Section>

                <Section title="Đóng gói">
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: isMobile ? 10 : '12px 20px' }}>
                    <Field label="Packing" value={product.packaging_links} />
                    <Field label="Other packing" value={product.other_packaging} />
                  </div>
                </Section>

                <Section title="Tham khảo" last>
                  {parsedLinks.length + videoLinks.length > 0 ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {parsedLinks.map((link, idx) => (
                        <RefLink key={`img-${idx}`} href={link} title={parsedLinks.length > 1 ? `Link hình ảnh ${idx + 1}` : 'Link hình ảnh'} />
                      ))}
                      {videoLinks.map((link, idx) => (
                        <RefLink key={`vid-${idx}`} href={link} video title={videoLinks.length > 1 ? `Video sản phẩm ${idx + 1}` : 'Video sản phẩm'} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: HC.muted }}>Chưa có link tham khảo</div>
                  )}
                </Section>
              </div>
            </div>

            {/* ── Thanh chia kéo được: thu gọn thông tin request để xem bảng vendor ── */}
            {!isMobile && (
              <PaneResizer
                ratio={paneRatio}
                collapsed={paneCollapsed}
                dragging={paneDragging}
                onDragStart={startPaneDrag}
                onKeyDown={onPaneKeyDown}
                onToggle={togglePane}
                onReset={resetPane}
              />
            )}

            {/* ── BOTTOM: Vendor Comparison ── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>
              <VendorBar vendors={vendors} totalCost={product.total_cost} isMobile={isMobile} />

              <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '12px 14px' : '14px 22px 18px', background: '#f8fafc' }}>
                {showMatrix ? (
                  <div style={{ paddingBottom: 40 }}>
                    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, color: HC.brown, fontWeight: 700 }}>📊 Bảng so sánh chỉ số giữa các Vendor ({product.product_type})</div>
                      <div style={{ fontSize: 11, color: HC.muted2 }}>Tự động highlight các giá trị tối ưu nhất</div>
                    </div>
                    <PriceComparisonMatrix vendors={vendors} productType={product.product_type} />
                  </div>
                ) : vendors.length === 0 ? (
                  <VendorEmptyState />
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
          <div style={{ padding: isMobile ? '12px 14px' : '14px 22px', background: HC.surface2, borderTop: `1px solid ${HC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: HC.muted }}>
              {bSelectedCount > 0 && <span style={{ color: HC.success, fontWeight: 800 }}>✓ Đã chọn {bSelectedCount} vendor</span>}
            </div>
            <button onClick={onClose} style={{ height: isMobile ? 44 : 40, padding: '0 28px', borderRadius: 10, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: FONT }}>Đóng</button>
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox mediaUrls={mediaUrls} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  );
}
