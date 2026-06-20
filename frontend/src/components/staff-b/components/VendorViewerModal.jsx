import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HC, LS_PRODUCT_VENDORS, LS_B_SELECTIONS } from '../utils/constants';
import { lsGet, lsSet, getMediaUrls, fmtDate } from '../utils/helpers';
import { pushNotif } from '../../../utils/notifUtils';
import PriceComparisonMatrix from './PriceComparisonMatrix';
import Lightbox from './Lightbox';
import { BestSellerBadge } from '../ui/StaffBUI';

export default function VendorViewerModal({ product, onClose }) {
  const LS_A_FEEDBACK_RESPONSE = 'STAFF_A_FEEDBACK_RESPONSE_V1';
  const [vendors, setVendors] = useState(() => lsGet(LS_PRODUCT_VENDORS, {})[product?.id] || []);
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

  // Local state cho từng feedback text (không auto‑save)
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
      const allVendors = lsGet(LS_PRODUCT_VENDORS, {})[product?.id] || [];
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
    // Gửi thông báo cho Staff A
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

  const fmt = n => (n != null && n !== '') ? `$${Number(n).toFixed(2)}` : '—';
  const bSelectedCount = Object.values(bSelections).filter(s => s?.checked).length;

  const mediaUrls = getMediaUrls(product);
  const mediaSrc = mediaUrls.length > 0 ? mediaUrls[0] : null;
  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

  const parsedLinks = (() => {
    if (product.product_type_links) {
      if (Array.isArray(product.product_type_links)) return product.product_type_links;
      try { return JSON.parse(product.product_type_links); } catch { return [product.product_type_links]; }
    }
    if (product.product_type_link) return [product.product_type_link];
    return [];
  })();

  const productRows = [
    { label: 'Date Request', value: fmtDate(product.created_at), color: HC.ink2 },
    { label: 'Deadline', value: fmtDate(product.deadline_date), color: HC.danger, bold: true },
    { label: 'Product Type', value: product.product_type, color: HC.orangeDark, bold: true },
    { label: 'Đặc tính KT', value: product.other_specs, color: HC.ink2 },
    { label: 'Chất liệu', value: product.material, color: HC.ink2 },
    { label: 'Vùng In', value: product.print_area, color: HC.ink2 },
    { label: 'Good Review', value: product.good_review, color: HC.success },
    { label: 'Bad Review', value: product.bad_review, color: HC.danger },
    { label: 'Packing', value: product.packaging_links, color: HC.ink2 },
    { label: 'Other Packing', value: product.other_packaging, color: HC.ink2 },
    { label: 'Links', value: parsedLinks, isLinks: true },
    { label: 'Status', value: product.status || 'draft', color: HC.brown, bold: true },
  ];

  const InfoRow = ({ label, value, valueColor, valueBold, idx, isLast, isLinks }) => (
    <div style={{ display: 'flex', gap: 8, padding: '7px 12px', borderBottom: isLast ? 'none' : `1px solid ${HC.border}`, background: idx % 2 === 0 ? HC.surface : HC.surface2, minHeight: 34 }}>
      <span style={{ minWidth: 108, flexShrink: 0, fontWeight: 800, color: HC.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2, fontFamily: "'Nunito',sans-serif", lineHeight: 1.4 }}>{label}</span>
      {isLinks ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {value && value.length > 0 ? value.map((link, i) => (
            <a key={i} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: HC.orange, fontSize: 11, fontWeight: 700, textDecoration: 'none', padding: '3px 8px', borderRadius: 6, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, wordBreak: 'break-all', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; e.currentTarget.style.textDecoration = 'underline'; }}
              onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; e.currentTarget.style.textDecoration = 'none'; }}
            >
              🔗 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{link}</span>
            </a>
          )) : <span style={{ color: HC.muted2, fontSize: 12 }}>—</span>}
        </div>
      ) : (
        <span style={{ color: valueColor || HC.ink2, fontWeight: valueBold ? 700 : 400, flex: 1, wordBreak: 'break-word', fontFamily: "'Nunito Sans',sans-serif", fontSize: 12, lineHeight: 1.4 }}>{value || '—'}</span>
      )}
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, backdropFilter: 'blur(3px)', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1400, height: '92vh', background: HC.orangePale, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.28)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ padding: '13px 20px', background: HC.ink, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 4, height: 22, borderRadius: 99, background: `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Chi tiết sản phẩm</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'Nunito Sans',sans-serif", marginTop: 1 }}>
                {product.product_type || `#${product.id}`}
                {vendors.length > 0 && <span style={{ marginLeft: 10, padding: '1px 8px', borderRadius: 999, background: 'rgba(245,166,35,0.2)', color: HC.orange, fontSize: 10, fontWeight: 800 }}>{vendors.length} vendor</span>}
              </div>
            </div>
            {bSelectedCount > 0 && <span style={{ padding: '3px 12px', borderRadius: 999, background: 'rgba(245,166,35,0.25)', border: '1px solid rgba(245,166,35,0.5)', color: HC.orange, fontSize: 11, fontWeight: 800 }}>✓ Vận hành đã chọn {bSelectedCount}</span>}
            <button onClick={() => setShowMatrix(!showMatrix)} style={{ padding: '6px 14px', borderRadius: 8, background: showMatrix ? HC.orange : 'rgba(255,255,255,0.1)', border: `1px solid ${showMatrix ? HC.orange : 'rgba(255,255,255,0.2)'}`, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {showMatrix ? '📋 Xem danh sách' : '📊 So sánh Matrix'}
            </button>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>✕</button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* TOP SECTION: Image + Product Info (layout giống Seller) */}
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: `1.5px solid ${HC.border}`, background: HC.surface, height: 320 }}>

              {/* Image panel */}
              <div style={{ width: 320, flexShrink: 0, borderRight: `1.5px solid ${HC.border}`, display: 'flex', flexDirection: 'column', background: '#2a1a00' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: mediaUrls.length ? 'pointer' : 'default' }}>
                  {mediaUrls.length > 0 ? (
                    isVideo(mediaUrls[currentMediaIndex])
                      ? <video onClick={() => { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); }} src={mediaUrls[currentMediaIndex]} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                      : <img onClick={() => { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); }} src={mediaUrls[currentMediaIndex]} alt="" style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ color: HC.muted2, textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 8 }}>📷</div><div style={{ fontSize: 12 }}>Không có ảnh</div></div>
                  )}
                  {mediaUrls.length > 1 && (
                    <>
                      <button onClick={e => { e.stopPropagation(); setCurrentMediaIndex(p => p > 0 ? p - 1 : mediaUrls.length - 1); }} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                      <button onClick={e => { e.stopPropagation(); setCurrentMediaIndex(p => p < mediaUrls.length - 1 ? p + 1 : 0); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
                      <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#fff' }}>{currentMediaIndex + 1} / {mediaUrls.length}</div>
                    </>
                  )}
                </div>
              </div>

              {/* Product info grid */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px', background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 16 }}>📋</span>
                  <div style={{ fontWeight: 900, fontSize: 13, color: HC.ink, textTransform: 'uppercase', letterSpacing: '0.02em' }}>Thông tin request sản phẩm</div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                    <span style={{ padding: '2px 10px', borderRadius: 99, background: HC.cream, border: `1px solid ${HC.border}`, fontSize: 10, fontWeight: 700, color: HC.muted }}>
                      Ngày gửi: {fmtDate(product.created_at) || '—'}
                    </span>
                    {product.deadline_date && (
                      <span style={{ padding: '2px 10px', borderRadius: 99, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 10, fontWeight: 700, color: HC.danger }}>
                        Deadline: {fmtDate(product.deadline_date)}
                      </span>
                    )}
                  </div>
                </div>
                {(() => {
                  const F = ({ label, value, bg, bdr, valueColor, bold }) => (
                    <div style={{ background: bg || HC.cream, border: `1px solid ${bdr || HC.border}`, borderRadius: 7, padding: '7px 11px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                      <div style={{ fontSize: 11, fontWeight: bold ? 800 : 600, color: valueColor || HC.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</div>
                    </div>
                  );
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1.2fr', gap: 8 }}>
                        <F label="Product Type" value={product.product_type} bg={HC.orangePale} valueColor={HC.orangeDark} bold />
                        <F label="⏱ Sản xuất" value={product.production_time} valueColor={HC.brown} bold />
                        <F label="🚢 Giao hàng" value={product.shipping_time} valueColor={HC.brown} bold />
                        <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 7, padding: '7px 11px' }}>
                          <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>💰 Target Cost</div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#065f46' }}>{product.total_cost != null ? `$${product.total_cost}` : '—'}</div>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1fr', gap: 8 }}>
                        <F label="Chất liệu" value={product.material} />
                        <F label="Vùng In" value={product.print_area} />
                        <F label="Đặc tính KT" value={product.other_specs} />
                        <F label="Packaging" value={product.packaging_links} />
                        <F label="Other Pkg" value={product.other_packaging} />
                      </div>
                      <div style={{ background: HC.cream, border: `1px solid ${HC.border}`, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: HC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>🔗 Links tham khảo</span>
                        {parsedLinks.length > 0
                          ? parsedLinks.map((link, idx) => (
                              <a key={idx} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '4px 12px', borderRadius: 20, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                                onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                                onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                              >🔗 Link {idx + 1}</a>
                            ))
                          : <span style={{ color: HC.muted2, fontSize: 11 }}>Chưa có link</span>
                        }
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ fontSize: 9, color: '#065f46', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>👍 Good Review</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#065f46', whiteSpace: 'pre-wrap', maxHeight: 52, overflowY: 'auto' }}>{product.good_review || '—'}</div>
                        </div>
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ fontSize: 9, color: HC.danger, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>👎 Bad Review</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: HC.danger, whiteSpace: 'pre-wrap', maxHeight: 52, overflowY: 'auto' }}>{product.bad_review || '—'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* BOTTOM SECTION: Vendors */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
              <div style={{ padding: '10px 20px', background: `linear-gradient(135deg,${HC.orangeDark},${HC.orangeDeep})`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>🏪</span>
                  <div><div style={{ fontWeight: 900, fontSize: 12, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Danh sách nhà phân phối đã gán</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>Chọn nhà cung cấp và gửi phản hồi đến bộ phận Kinh doanh</div></div>
                  {vendors.length > 0 && <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 10, fontWeight: 700 }}>{vendors.length} vendor</span>}
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                {showMatrix ? (
                  <div style={{ paddingBottom: 40 }}>
                    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, color: HC.brown, fontWeight: 700 }}>📊 Bảng so sánh chỉ số giữa các Vendor ({product.product_type})</div>
                      <div style={{ fontSize: 11, color: HC.muted2 }}>Tự động highlight các giá trị tối ưu nhất</div>
                    </div>
                    <PriceComparisonMatrix vendors={vendors} productType={product.product_type} />
                  </div>
                ) : (
                  vendors.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, background: HC.surface, borderRadius: 16, border: `1.5px dashed ${HC.border}` }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>🏪</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: HC.brown }}>Chưa có nhà cung cấp nào được gán</div>
                      <div style={{ fontSize: 12, color: HC.muted2, marginTop: 6 }}>Vào Products → nhấn "Tìm Vendor" để gán vendor cho sản phẩm này</div>
                    </div>
                  ) : (() => {
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
                    const Na = ({ pending } = {}) => (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#94a3b8', padding: '2px 7px', borderRadius: 4, background: '#f8fafc', border: '1px dashed #cbd5e1', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                        N/A{pending && <span style={{ fontSize: 8, opacity: 0.7 }}> · chờ cập nhật</span>}
                      </span>
                    );
                    const thS = (color, align = 'center') => ({ padding: '9px 12px', fontWeight: 800, fontSize: 10, color: color || HC.muted, textTransform: 'uppercase', letterSpacing: '0.05em', borderRight: `1px solid ${HC.border}`, borderBottom: `1.5px solid ${HC.border}`, textAlign: align, background: HC.cream, whiteSpace: 'nowrap' });
                    const tdS = (extra = {}) => ({ padding: '10px 12px', verticalAlign: 'middle', borderRight: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}`, ...extra });
                    return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {/* Vendor Table */}
                      <div style={{ borderRadius: 12, border: `1px solid ${HC.border}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={{ ...thS(), width: 40 }}>☑</th>
                                <th style={{ ...thS(), width: 72 }}>Ảnh</th>
                                <th style={{ ...thS(HC.ink, 'left'), minWidth: 130 }}>Vendor Name</th>
                                <th style={{ ...thS(HC.orangeDark) }}>Product Type</th>
                                <th style={{ ...thS(null, 'left'), minWidth: 140 }}>Chất liệu</th>
                                <th style={{ ...thS() }}>T.gian SX</th>
                                <th style={{ ...thS() }}>T.gian Ship</th>
                                <th style={{ ...thS() }}>Size</th>
                                <th style={{ ...thS() }}>Link Folder</th>
                                <th style={{ ...thS('#059669'), borderRight: 'none' }}>Total Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupedV.map((group, gIdx) => {
                                const v = group.firstVendor;
                                const gKey = group.key;
                                const bChecked = !!bSelections[gKey]?.checked;
                                const rowBg = bChecked ? '#ecfdf5' : (gIdx % 2 === 0 ? '#ffffff' : HC.orangePale);
                                const rawMat = v.overview || '';
                                const matText = rawMat.length > 70 ? rawMat.slice(0, 70) + '…' : rawMat || null;
                                const vLink = v.link_folder || null;
                                return group.items.map((vi, idx) => (
                                  <tr key={`${gIdx}-${idx}`} style={{ background: rowBg, transition: 'background 0.12s' }}
                                    onMouseEnter={e => { if (!bChecked) e.currentTarget.style.background = '#fff8f0'; }}
                                    onMouseLeave={e => e.currentTarget.style.background = rowBg}
                                  >
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdS({ textAlign: 'center', width: 40 }) }}>
                                        <button onClick={() => toggleBCheck(gKey)} style={{ width: 24, height: 24, borderRadius: 6, background: bChecked ? HC.success : 'transparent', border: `2px solid ${bChecked ? HC.success : HC.muted2}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                          {bChecked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 900 }}>✓</span>}
                                        </button>
                                      </td>
                                    )}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdS({ textAlign: 'center', width: 72 }) }}>
                                        {v.media_url
                                          ? <img src={v.media_url} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: `1px solid ${HC.border}`, display: 'block', margin: '0 auto' }} />
                                          : <div style={{ width: 52, height: 52, borderRadius: 8, background: HC.cream, border: `1px dashed ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, margin: '0 auto', color: HC.muted2 }}>📷</div>}
                                      </td>
                                    )}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdS({ textAlign: 'left' }) }}>
                                        {v.name || v.vendor_type
                                          ? <><div style={{ fontWeight: 800, fontSize: 12, color: HC.ink }}>{v.name || v.vendor_type}</div>{v.name && v.vendor_type && v.name !== v.vendor_type && <div style={{ fontSize: 10, color: HC.muted2, marginTop: 2 }}>{v.vendor_type}</div>}</>
                                          : <Na pending />}
                                      </td>
                                    )}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdS({ textAlign: 'center' }) }}>
                                        {v.vendor_type
                                          ? <span style={{ fontWeight: 800, fontSize: 10, color: HC.orangeDark, padding: '3px 10px', borderRadius: 20, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, display: 'inline-block', whiteSpace: 'nowrap' }}>{v.vendor_type}</span>
                                          : <Na pending />}
                                      </td>
                                    )}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdS({ textAlign: 'left' }) }}>
                                        {matText ? <span style={{ color: HC.ink2, fontSize: 11, lineHeight: 1.5 }} title={rawMat}>{matText}</span> : <Na pending />}
                                      </td>
                                    )}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdS({ textAlign: 'center' }) }}>
                                        {product.production_time ? <span style={{ fontWeight: 700, color: HC.brown }}>{product.production_time}</span> : <Na />}
                                      </td>
                                    )}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdS({ textAlign: 'center' }) }}>
                                        {product.shipping_time ? <span style={{ fontWeight: 700, color: HC.brown }}>{product.shipping_time}</span> : <Na />}
                                      </td>
                                    )}
                                    <td style={{ ...tdS({ textAlign: 'center' }) }}>
                                      {vi.size ? <><div style={{ fontWeight: 700, color: HC.ink }}>{vi.size}</div>{vi.optional && <div style={{ fontSize: 9, color: HC.muted2, marginTop: 2 }}>{vi.optional}</div>}</> : <Na />}
                                    </td>
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdS({ textAlign: 'center' }) }}>
                                        {vLink
                                          ? <a href={vLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '5px 10px', borderRadius: 7, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, transition: 'all 0.15s' }}
                                              onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                                              onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                                            >📁 Xem folder</a>
                                          : <Na pending />}
                                      </td>
                                    )}
                                    <td style={{ ...tdS({ textAlign: 'center', borderRight: 'none' }) }}>
                                      {vi.eco_total != null && vi.eco_total !== '' && vi.eco_total !== 0
                                        ? <span style={{ fontWeight: 900, fontSize: 14, color: '#059669' }}>${Number(vi.eco_total).toFixed(2)}</span>
                                        : <Na pending />}
                                    </td>
                                  </tr>
                                ));
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div style={{ padding: '8px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#92400e' }}>
                        <span>ℹ️</span>
                        <span>Các ô hiển thị <strong>N/A</strong> đang chờ cập nhật thông tin vendor.</span>
                      </div>
                    </div>
                    );
                  })())}
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 20px', background: HC.surface, borderTop: `1.5px solid ${HC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: HC.muted }}>{bSelectedCount > 0 && <span style={{ color: HC.success, fontWeight: 800 }}>✓ Đã chọn {bSelectedCount} vendor</span>}</div>
            <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: 10, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>Đóng</button>
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox 
          mediaUrls={mediaUrls} 
          initialIndex={lightboxIndex} 
          onClose={() => setLightboxOpen(false)} 
        />
      )}
    </>
  );
}
