import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HC, LS_PRODUCT_VENDORS, LS_B_SELECTIONS } from '../utils/constants';
import { lsGet, lsSet, getMediaUrls, fmtDate } from '../utils/helpers';
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
    try {
      const v = vendors.find((v, i) => vendorKey(v, i) === key);
      const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      staffANotifs.unshift({
        id: Date.now(),
        type: 'feedback_from_b',
        icon: '💬',
        title: '💬 Phản hồi mới về Vendor',
        message: `Bộ phận Vận hành đã gửi phản hồi về vendor "${v?.vendor_type || '—'}" cho sản phẩm "${product.product_type}".`,
        time: new Date().toLocaleString('vi-VN'),
        is_read: false,
        productId: product.id,
        vendorKey: key
      });
      localStorage.setItem('STAFF_A_NOTIFICATIONS', JSON.stringify(staffANotifs.slice(0, 100)));
      window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_A_NOTIFICATIONS' }));
    } catch (err) { console.error('Lỗi gửi thông báo A:', err); }

    alert('✅ Đã gửi phản hồi đến Staff A!');
  }, [product.id, product.product_type, vendors]);

  const fmt = n => (n != null && n !== '') ? `$${Number(n).toFixed(2)}` : '—';
  const bSelectedCount = Object.values(bSelections).filter(s => s?.checked).length;

  const mediaUrls = getMediaUrls(product);
  const mediaSrc = mediaUrls.length > 0 ? mediaUrls[0] : null;
  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

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
    { label: 'Link', value: product.product_type_link, color: HC.orange },
    { label: 'Status', value: product.status || 'draft', color: HC.brown, bold: true },
  ];

  const InfoRow = ({ label, value, valueColor, valueBold, idx, isLast }) => (
    <div style={{ display: 'flex', gap: 8, padding: '7px 12px', borderBottom: isLast ? 'none' : `1px solid ${HC.border}`, background: idx % 2 === 0 ? HC.surface : HC.surface2, minHeight: 34 }}>
      <span style={{ minWidth: 108, flexShrink: 0, fontWeight: 800, color: HC.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2, fontFamily: "'Nunito',sans-serif", lineHeight: 1.4 }}>{label}</span>
      <span style={{ color: valueColor || HC.ink2, fontWeight: valueBold ? 700 : 400, flex: 1, wordBreak: 'break-word', fontFamily: "'Nunito Sans',sans-serif", fontSize: 12, lineHeight: 1.4 }}>{value || '—'}</span>
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

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* LEFT COLUMN: Image & Product Info */}
            <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1.5px solid ${HC.border}`, overflow: 'hidden', background: HC.surface }}>
              <div style={{ height: 220, background: '#2a1a00', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: mediaUrls.length > 0 ? 'pointer' : 'default' }} onClick={() => { if (mediaUrls.length > 0) { setLightboxIndex(0); setLightboxOpen(true); } }}>
                {mediaSrc ? (isVideo(mediaSrc) ? <video src={mediaSrc} style={{ height: '100%', width: '100%', objectFit: 'cover' }} /> : <img src={mediaSrc} alt="" style={{ height: '100%', width: '100%', objectFit: 'contain' }} />) : (
                  <div style={{ color: HC.muted2, textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 8 }}>📷</div><div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>Không có ảnh</div></div>
                )}
                {mediaUrls.length > 1 && <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#fff', fontWeight: 700 }}>{mediaUrls.length} ảnh</div>}
              </div>
              {mediaUrls.length > 1 && (
                <div style={{ display: 'flex', gap: 8, padding: '10px', overflowX: 'auto', background: '#1f1400', borderTop: `1px solid ${HC.border}` }}>
                  {mediaUrls.map((url, idx) => (
                    <div key={idx} onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }} style={{ width: 55, height: 55, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${idx === lightboxIndex ? HC.orange : 'transparent'}`, flexShrink: 0, transition: 'all 0.2s' }}>
                      {isVideo(url) ? <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '10px 14px', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, display: 'flex', alignItems: 'center', gap: 7, position: 'sticky', top: 0, zIndex: 1 }}>
                  <span style={{ fontSize: 14 }}>📦</span>
                  <div style={{ fontWeight: 900, fontSize: 10, color: '#fff', fontFamily: "'Nunito',sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em' }}>Thông单 sản phẩm</div>
                </div>
                {productRows.map((r, idx) => <InfoRow key={r.label} label={r.label} value={r.value} valueColor={r.color} valueBold={r.bold} idx={idx} isLast={idx === productRows.length - 1} />)}
              </div>
            </div>

            {/* RIGHT COLUMN: VENDORS LIST */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
              <div style={{ padding: '12px 20px', background: `linear-gradient(135deg,${HC.orangeDark},${HC.orangeDeep})`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🏪</span>
                  <div><div style={{ fontWeight: 900, fontSize: 12, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Danh sách nhà phân phối đã gán</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Chọn nhà cung cấp và gửi phản hồi đến bộ phận Kinh doanh</div></div>
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
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {vendors.map((v, i) => {
                        const key = vendorKey(v, i);
                        const bSel = bSelections[key];
                        const bChecked = !!bSel?.checked;
                        const bSubmitted = bSubmittedFeedbacks[key];
                        const aResponse = aResponseFeedbacks[key];
                        const currentFeedback = feedbackTexts[key] || '';

                        return (
                          <div key={key} style={{ background: bChecked ? '#ecfdf5' : HC.surface, borderRadius: 16, border: `1.5px solid ${bChecked ? '#bbf7d0' : HC.border}`, overflow: 'hidden', transition: 'all 0.2s ease', boxShadow: bChecked ? '0 4px 12px rgba(22,163,74,0.1)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
                            {/* Vendor Header */}
                            <div style={{ padding: '14px 20px', background: bChecked ? '#ecfdf5' : HC.cream, borderBottom: `1px solid ${bChecked ? '#bbf7d0' : HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <button onClick={() => toggleBCheck(key)} style={{ width: 28, height: 28, borderRadius: 8, background: bChecked ? HC.success : 'transparent', border: `2px solid ${bChecked ? HC.success : HC.muted2}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                    {bChecked && <span style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>✓</span>}
                                  </button>
                                  <span style={{ fontWeight: 800, fontSize: 13, color: HC.muted }}>#{i + 1}</span>
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    {v.name && v.name !== v.vendor_type && <span style={{ fontWeight: 700, fontSize: 14, color: HC.ink }}>{v.name}</span>}
                                    <span style={{ fontWeight: 900, fontSize: 16, color: HC.orangeDark }}>{v.vendor_type || '—'}</span>
                                    {v.vendor_type === 'Best Seller' && <BestSellerBadge />}
                                  </div>
                                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: HC.muted2 }}>
                                    {v.size && <span>📏 Size: {v.size}</span>}
                                    {v.optional && <span>🎨 Optional: {v.optional}</span>}
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: HC.muted }}>Pricing 1+2</div><div style={{ fontWeight: 800, fontSize: 15, color: HC.orange }}>${((v.pricing1 || 0) + (v.pricing2 || 0)).toFixed(2)}</div></div>
                            </div>

                            {/* Pricing Grid */}
                            <div style={{ padding: '16px 20px', background: HC.surface2, borderBottom: `1px solid ${HC.border}` }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                {[
                                  { label: '🚚 ECONOMY', price: v.eco_price, total: v.eco_total },
                                  { label: '⚡ FAST', price: v.fast_price, total: v.fast_total },
                                  { label: '✈️ EXPRESS', price: v.express_price, total: v.express_total },
                                  { label: '🌙 OVERNIGHT', price: v.overnight_price, total: v.overnight_total }
                                ].map((item, idx) => (
                                  <div key={idx} style={{ background: HC.surface, borderRadius: 12, padding: '10px 12px', border: `1px solid ${HC.border}` }}>
                                    <div style={{ fontWeight: 800, fontSize: 10, color: HC.muted, marginBottom: 6 }}>{item.label}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 11, color: HC.muted2 }}>Ship:</span><span style={{ fontWeight: 700, fontSize: 12 }}>{fmt(item.price)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}><span style={{ fontSize: 11, color: HC.muted2 }}>Total:</span><span style={{ fontWeight: 800, fontSize: 13, color: HC.success }}>{fmt(item.total)}</span></div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Feedback Section */}
                            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                              {/* Staff B Feedback */}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><span style={{ fontSize: 14 }}>💬</span><span style={{ fontWeight: 800, fontSize: 11, color: HC.muted, textTransform: 'uppercase' }}>Phản hồi của Staff B</span></div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                  <textarea
                                    placeholder="Nhập phản hồi về vendor này..."
                                    value={currentFeedback}
                                    onChange={e => setFeedbackTexts(prev => ({ ...prev, [key]: e.target.value }))}
                                    rows={2}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${currentFeedback ? HC.orange : HC.border}`, fontSize: 12, color: HC.ink2, background: HC.surface, resize: 'vertical', fontFamily: "'Nunito Sans',sans-serif", outline: 'none' }}
                                    onFocus={e => e.target.style.borderColor = HC.orange}
                                    onBlur={e => e.target.style.borderColor = currentFeedback ? HC.orange : HC.border}
                                  />
                                  <button
                                    onClick={() => submitBFeedback(key, currentFeedback)}
                                    disabled={!currentFeedback || bSubmitted}
                                    style={{ padding: '8px 16px', borderRadius: 10, background: bSubmitted ? HC.success : (!currentFeedback ? HC.muted2 : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`), color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: (!currentFeedback || bSubmitted) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: (!currentFeedback || bSubmitted) ? 0.5 : 1 }}
                                  >
                                    {bSubmitted ? '✓ Đã gửi' : '📨 Gửi'}
                                  </button>
                                </div>
                              </div>

                              {/* Seller Response (chỉ hiển thị) */}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><span style={{ fontSize: 14 }}>📝</span><span style={{ fontWeight: 800, fontSize: 11, color: HC.muted, textTransform: 'uppercase' }}>Phản hồi của Seller</span></div>
                                {aResponse ? (
                                  <div style={{ background: aResponse.decision === 'dat' ? '#ecfdf5' : '#fef2f2', borderRadius: 12, padding: '12px', border: `1px solid ${aResponse.decision === 'dat' ? '#bbf7d0' : '#fecaca'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                      {aResponse.decision === 'dat' ? <><span style={{ fontSize: 18 }}>✅</span><span style={{ fontWeight: 800, fontSize: 12, color: '#065f46' }}>QUYẾT ĐỊNH: ĐẶT SAMPLE</span></> : <><span style={{ fontSize: 18 }}>❌</span><span style={{ fontWeight: 800, fontSize: 12, color: '#991b1b' }}>QUYẾT ĐỊNH: TỪ CHỐI</span></>}
                                    </div>
                                    {aResponse.sampleDetails && <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff', borderRadius: 8, border: `1px solid ${HC.border}` }}><div style={{ fontWeight: 700, fontSize: 10, color: HC.orange, marginBottom: 4 }}>📦 CHI TIẾT SAMPLE:</div><div style={{ fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{aResponse.sampleDetails}</div></div>}
                                    {aResponse.sellerFeedback && <div style={{ marginTop: 6, fontSize: 10, color: HC.brown, padding: '6px 8px', background: HC.orangeLight, borderRadius: 6 }}>💬 Phản hồi gốc: {aResponse.sellerFeedback}</div>}
                                    <div style={{ marginTop: 6, fontSize: 9, color: '#059669', textAlign: 'right' }}>{new Date(aResponse.respondedAt).toLocaleString('vi-VN')}</div>
                                  </div>
                                ) : (
                                  <div style={{ padding: '20px', textAlign: 'center', background: HC.orangePale, borderRadius: 12, border: `1px dashed ${HC.border}`, color: HC.muted2, fontSize: 11 }}>⏳ Chưa có phản hồi từ Seller</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
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
