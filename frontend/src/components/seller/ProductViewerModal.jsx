// ════════════════════════════════════════════════════════
//  PRODUCT VIEWER MODAL (Seller)
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { LeftOutlined, RightOutlined, DeleteOutlined } from '@ant-design/icons';
import { HC, STATUS_CFG, ITEMS_PER_PAGE, LS_A_SELECTIONS, LS_B_SELECTIONS, LS_PRODUCT_VENDORS, LS_SAMPLE_DECISIONS, LS_A_FEEDBACK_RESPONSE, LS_B_SUBMITTED_FEEDBACK } from '../../constants/sellerTheme';
import { lsGet, lsSet, fmtDate, getMediaUrls, getMediaUrl, getProductImages, getProductLinks } from '../../utils/sellerHelpers';
import { pushNotif } from '../../utils/notifUtils';
import { Badge, CardHeader, InfoRow, Field, MediaGallery, inp, EMPTY_FORM } from './SellerUI';

function ThumbnailImg({ src }) {
  const [err, setErr] = useState(false);
  if (err) return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.06)', fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>🖼️</div>;
  return <img src={src} alt="" loading="lazy" onError={() => setErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
}

export default function ProductViewerModal({ product, productVendors, onClose, getStatus, onViewVendorLibrary }) {
  // Ưu tiên dùng assigned_vendors từ API, fallback về localStorage
  const [vendors, setVendors] = useState(() => product?.assigned_vendors || productVendors[product?.id] || []);
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
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  // Tách riêng: ảnh/video upload vs link tham khảo
  const mediaUrls = getProductImages(product);
  const referenceLinks = getProductLinks(product);
  // Dùng referenceLinks làm fallback khi không có ảnh upload
  const displayUrls = mediaUrls.length > 0 ? mediaUrls : referenceLinks;

  useEffect(() => {
    setVendors(product?.assigned_vendors || productVendors[product?.id] || []);
  }, [product?.id, product?.assigned_vendors, productVendors]);

  useEffect(() => { setImgError(false); setCurrentMediaIndex(0); }, [product?.id]);
  useEffect(() => { setImgError(false); }, [currentMediaIndex]);

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
      status: decision === 'dat' ? 'approved' : 'rejected'  // Thêm status
    };
    lsSet(LS_A_FEEDBACK_RESPONSE, allResponses);

    setSampleDecisions(prev => ({ ...prev, [key]: newDecision }));
    setAResponses(prev => ({ ...prev, [key]: allResponses[product.id][key] }));
    pushNotif('staff_a', {
      type: 'sample_decision',
      icon: '📝',
      title: 'Phản hồi mới về Vendor',
      message: `Bộ phận Kinh doanh đã ${decision === 'dat' ? 'đồng ý đặt sample' : 'từ chối đặt sample'} cho vendor "${vendor.vendor_type}" của sản phẩm "${product.product_type}".`,
      product_id: product.id,
      productType: product.product_type,
      vendorType: vendor.vendor_type,
      decision,
      sampleDetails,
      sellerFeedback: feedback,
    });
    pushNotif('staff_b', {
      type: 'staff_a_approved_vendor',
      icon: '',
      title: 'Kinh doanh đã xác nhận vendor',
      message: `Bộ phận Kinh doanh đã xác nhận vendor "${vendor.vendor_type}" cho sản phẩm "${product.product_type}".`,
      product_id: product.id,
      productName: product.product_type,
      vendorId: vendor.id,
      vendorType: vendor.vendor_type,
      vendorKey: key,
      sellerFeedback: feedback,
      staff_a_approved: true,
    });

    // 2. THÊM MỚI: GỬI THÔNG BÁO CHO STAFF A

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
    { label: 'Target Price', value: product.total_cost != null ? `$${product.total_cost}` : '—', color: HC.success, bold: true },
    { label: 'Target Prod Time', value: product.production_time, color: HC.brown },
    { label: 'Target Ship Time', value: product.shipping_time, color: HC.brown },
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

  const groupedVendors = [];
  const groupMap = new Map();
  vendors.forEach((v, idx) => {
    const vName = ((v.name || v.vendor_type || '—') || '').toString().trim();
    if (!groupMap.has(vName)) {
      groupMap.set(vName, {
        vendorName: vName,
        items: [],
        firstVendor: v,
        key: vendorKey(v, idx)
      });
      groupedVendors.push(groupMap.get(vName));
    }
    groupMap.get(vName).items.push(v);
  });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999, backdropFilter: 'blur(2px)', padding: '16px' }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1400, height: '92vh', background: HC.orangePale, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ padding: '13px 20px', background: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 4, height: 22, borderRadius: 99, background: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Chi tiết sản phẩm</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontFamily: "'Nunito Sans',sans-serif", marginTop: 1 }}>{product.product_type || `#${product.id}`}</div>
            </div>
            <Badge status={getStatus(product)} />
            {selectedCount > 0 && <span style={{ padding: '3px 12px', borderRadius: 999, background: 'rgba(22,163,74,0.25)', border: '1px solid rgba(22,163,74,0.5)', color: '#4ade80', fontSize: 11, fontWeight: 800 }}>✓ Đã chọn {selectedCount} nhà cung cấp</span>}
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: '1.5px solid rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.15)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, transition: 'background 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}>✕</button>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* TOP SECTION: Media & Product Info (Sheet Layout) */}
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: `1.5px solid ${HC.border}`, background: HC.surface, height: 320 }}>
              {/* Media */}
              <div style={{ width: 300, flexShrink: 0, borderRight: `1.5px solid ${HC.border}`, display: 'flex', flexDirection: 'column', background: '#1a1008' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: displayUrls.length ? 'pointer' : 'default' }}>
                  {displayUrls.length > 0 ? (
                    imgError ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>Không tải được ảnh</div>
                      </div>
                    ) : isVideo(displayUrls[currentMediaIndex]) ? (
                      <video onClick={() => { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); }} src={displayUrls[currentMediaIndex]} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                    ) : (
                      <img onClick={() => { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); }} src={displayUrls[currentMediaIndex]} alt="" onError={() => setImgError(true)} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                    )
                  ) : (
                    <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>Chưa có ảnh</div>
                    </div>
                  )}
                  {displayUrls.length > 1 && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(p => p > 0 ? p - 1 : displayUrls.length - 1); }} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
                        <LeftOutlined />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(p => p < displayUrls.length - 1 ? p + 1 : 0); }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
                        <RightOutlined />
                      </button>
                      <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.65)', borderRadius: 20, padding: '3px 9px', fontSize: 10, color: '#fff', fontWeight: 700 }}>
                        {currentMediaIndex + 1} / {displayUrls.length}
                      </div>
                    </>
                  )}
                  {/* Badge: link tham khảo (khi dùng fallback) */}
                  {mediaUrls.length === 0 && displayUrls.length > 0 && (
                    <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(245,158,11,0.82)', borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: '#fff', backdropFilter: 'blur(4px)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Ref. Link
                    </div>
                  )}
                </div>
                {/* Thumbnail strip */}
                {displayUrls.length > 1 && (
                  <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.4)', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {displayUrls.map((url, idx) => (
                      <div key={idx} onClick={() => { setCurrentMediaIndex(idx); setImgError(false); }} style={{ width: 38, height: 38, borderRadius: 5, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${currentMediaIndex === idx ? HC.orange : 'rgba(255,255,255,0.15)'}`, flexShrink: 0, transition: 'border-color 0.15s' }}>
                        {/\.(mp4|mov|webm)$/i.test(url)
                          ? <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                          : <ThumbnailImg src={url} />
                        }
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Info */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px', background: '#f8fafc' }}>

                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 3, height: 16, borderRadius: 2, background: HC.orange, flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: 11, color: HC.ink, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Thông tin request sản phẩm</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 6, background: HC.surface, border: `1px solid ${HC.border}`, fontSize: 10, fontWeight: 600, color: HC.muted }}>
                      {fmtDate(product.created_at) || '—'}
                    </span>
                    {product.deadline_date && (
                      <span style={{ padding: '3px 10px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 10, fontWeight: 700, color: HC.danger }}>
                        Deadline {fmtDate(product.deadline_date)}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* Row 1: Key metrics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.3fr', gap: 8 }}>
                    <div style={{ background: HC.orangePale, border: `1px solid ${HC.orangeMid}`, borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: HC.orangeDark, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Product Type</div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: HC.orangeDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.product_type || '—'}</div>
                    </div>
                    {[
                      { label: 'Thời gian SX', value: product.production_time },
                      { label: 'Thời gian Ship', value: product.shipping_time },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: '#fff', border: `1px solid #e5e7eb`, borderRadius: 10, padding: '10px 14px' }}>
                        <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: HC.ink }}>{value || '—'}</div>
                      </div>
                    ))}
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: '#065f46', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Target Cost</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#065f46' }}>{product.total_cost != null ? `$${product.total_cost}` : '—'}</div>
                    </div>
                  </div>

                  {/* Row 2: Spec fields */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1fr', gap: 8 }}>
                    {[
                      { label: 'Chất liệu', value: product.material },
                      { label: 'Vùng In', value: product.print_area },
                      { label: 'Đặc tính KT', value: product.other_specs },
                      { label: 'Packaging', value: product.packaging_links },
                      { label: 'Other Pkg', value: product.other_packaging },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 12px' }}>
                        <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: HC.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</div>
                      </div>
                    ))}
                  </div>

                  {/* Row 3: Reference links */}
                  {referenceLinks.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, color: HC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Ref. Links</span>
                      {referenceLinks.map((link, idx) => (
                        <a key={idx} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '3px 12px', borderRadius: 6, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, transition: 'background 0.15s', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                          onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                        >
                          Link {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Row 4: Reviews */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: '#166534', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Good Review</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#166534', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{product.good_review || '—'}</div>
                    </div>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px' }}>
                      <div style={{ fontSize: 10, color: '#991b1b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Bad Review</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#991b1b', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{product.bad_review || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* BOTTOM SECTION: Vendors List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: '#faf9f8' }}>
              <div style={{ padding: '10px 20px', background: '#fff', borderBottom: `1.5px solid ${HC.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 3, height: 14, borderRadius: 2, background: HC.orange, flexShrink: 0 }} />
                <div style={{ fontWeight: 800, fontSize: 11, color: HC.ink, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Danh sách nhà phân phối đã gán</div>
                {vendors.length > 0 && (() => {
                  const uCount = new Set(vendors.map(v => (v.name || v.vendor_type || '').toString().trim()).filter(Boolean)).size || vendors.length;
                  return (
                    <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 20, background: 'rgba(120,53,15,0.1)', color: '#78350f', fontSize: 10, fontWeight: 700 }}>
                      {uCount} vendor
                    </span>
                  );
                })()}
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '14px 20px' }}>
                {vendors.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 40px', background: HC.surface, borderRadius: 14, border: `1px solid ${HC.border}` }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: HC.cream, border: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={HC.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.ink, marginBottom: 6 }}>Chưa có nhà phân phối được gán</div>
                    <div style={{ fontSize: 12, color: HC.muted, lineHeight: 1.6, textAlign: 'center', maxWidth: 320 }}>Bộ phận Vận hành sẽ gán nhà cung cấp phù hợp sau khi xem xét yêu cầu sản phẩm này.</div>
                  </div>
                ) : (() => {
                  const Na = ({ pending } = {}) => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#94a3b8', padding: '2px 7px', borderRadius: 4, background: '#f8fafc', border: '1px dashed #cbd5e1', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                      N/A{pending && <span style={{ fontSize: 8, opacity: 0.7 }}> · chờ cập nhật</span>}
                    </span>
                  );
                  const thStyle = (color, align = 'center') => ({
                    padding: '9px 12px', fontWeight: 800, fontSize: 10, color: color || HC.muted,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderRight: `1px solid ${HC.border}`, borderBottom: `1.5px solid ${HC.border}`,
                    textAlign: align, background: HC.cream, whiteSpace: 'nowrap',
                  });
                  const tdBase = (extra = {}) => ({
                    padding: '10px 12px', verticalAlign: 'middle',
                    borderRight: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}`,
                    ...extra,
                  });

                  return (
                    <>
                      <div style={{ borderRadius: 12, border: `1px solid ${HC.border}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={{ ...thStyle(), width: 72 }}>Ảnh</th>
                                <th style={{ ...thStyle(HC.ink, 'left'), minWidth: 130 }}>Vendor Name</th>
                                <th style={{ ...thStyle(HC.orangeDark) }}>Product Type</th>
                                <th style={{ ...thStyle(null, 'left'), minWidth: 140 }}>Chất liệu</th>
                                <th style={{ ...thStyle() }}>T.gian SX</th>
                                <th style={{ ...thStyle() }}>T.gian Ship</th>
                                <th style={{ ...thStyle() }}>Size</th>
                                <th style={{ ...thStyle() }}>Link Folder</th>
                                <th style={{ ...thStyle('#059669'), borderRight: 'none' }}>Total Price</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupedVendors.map((group, gIdx) => {
                                const v = group.firstVendor;
                                // Fallback ảnh: media_url → images[0] (field từ Excel parser)
                                const vendorImg = v.media_url || (Array.isArray(v.images) && v.images[0]) || null;
                                const rowBg = gIdx % 2 === 0 ? '#ffffff' : HC.orangePale;
                                const rawMaterial = v.overview || '';
                                const materialText = rawMaterial.length > 70 ? rawMaterial.slice(0, 70) + '…' : rawMaterial || null;
                                const vendorLink = v.link_folder || null;

                                return group.items.map((vi, idx) => (
                                  <tr key={`${gIdx}-${idx}`}
                                    style={{ background: rowBg, transition: 'background 0.12s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#fff8f0'}
                                    onMouseLeave={e => e.currentTarget.style.background = rowBg}
                                  >
                                    {/* Ảnh */}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdBase({ textAlign: 'center', width: 72 }) }}>
                                        {vendorImg
                                          ? <img src={vendorImg} loading="lazy" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: `1px solid ${HC.border}`, display: 'block', margin: '0 auto' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }} />
                                          : null}
                                        <div style={{ width: 52, height: 52, borderRadius: 8, background: HC.cream, border: `1px dashed ${HC.border}`, alignItems: 'center', justifyContent: 'center', fontSize: 18, margin: '0 auto', color: HC.muted2, display: vendorImg ? 'none' : 'flex' }}>📷</div>
                                      </td>
                                    )}

                                    {/* Vendor Name */}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdBase({ textAlign: 'left' }) }}>
                                        {v.name || v.vendor_type
                                          ? <>
                                              <div style={{ fontWeight: 800, fontSize: 12, color: HC.ink }}>{v.name || v.vendor_type}</div>
                                              {v.name && v.vendor_type && v.name !== v.vendor_type && (
                                                <div style={{ fontSize: 10, color: HC.muted2, marginTop: 2 }}>{v.vendor_type}</div>
                                              )}
                                              {onViewVendorLibrary && v.source_file_id && (
                                                <button
                                                  onClick={() => { onClose(); onViewVendorLibrary(v.source_file_id); }}
                                                  style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: HC.orange, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, borderRadius: 6, padding: '3px 8px', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                                                  onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                                                  onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                                                >
                                                  📂 Xem trong Thư Viện
                                                </button>
                                              )}
                                            </>
                                          : <Na pending />
                                        }
                                      </td>
                                    )}

                                    {/* Product Type */}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdBase({ textAlign: 'center' }) }}>
                                        {v.vendor_type
                                          ? <span style={{ fontWeight: 800, fontSize: 10, color: HC.orangeDark, padding: '3px 10px', borderRadius: 20, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, display: 'inline-block', whiteSpace: 'nowrap' }}>
                                              {v.vendor_type}
                                            </span>
                                          : <Na pending />
                                        }
                                      </td>
                                    )}

                                    {/* Chất liệu */}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdBase({ textAlign: 'left' }) }}>
                                        {materialText
                                          ? <span style={{ color: HC.ink2, fontSize: 11, lineHeight: 1.5 }} title={rawMaterial}>{materialText}</span>
                                          : <Na pending />
                                        }
                                      </td>
                                    )}

                                    {/* T.gian SX */}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdBase({ textAlign: 'center' }) }}>
                                        {product.production_time
                                          ? <span style={{ fontWeight: 700, color: HC.brown }}>{product.production_time}</span>
                                          : <Na />
                                        }
                                      </td>
                                    )}

                                    {/* T.gian Ship */}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdBase({ textAlign: 'center' }) }}>
                                        {product.shipping_time
                                          ? <span style={{ fontWeight: 700, color: HC.brown }}>{product.shipping_time}</span>
                                          : <Na />
                                        }
                                      </td>
                                    )}

                                    {/* Size (per item) */}
                                    <td style={{ ...tdBase({ textAlign: 'center' }) }}>
                                      {vi.size
                                        ? <>
                                            <div style={{ fontWeight: 700, color: HC.ink }}>{vi.size}</div>
                                            {vi.optional && <div style={{ fontSize: 9, color: HC.muted2, marginTop: 2 }}>{vi.optional}</div>}
                                          </>
                                        : <Na />
                                      }
                                    </td>

                                    {/* Link Folder (vendor-specific, per group) */}
                                    {idx === 0 && (
                                      <td rowSpan={group.items.length} style={{ ...tdBase({ textAlign: 'center' }) }}>
                                        {vendorLink
                                          ? <a href={vendorLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '5px 10px', borderRadius: 7, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, transition: 'all 0.15s' }}
                                              onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                                              onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                                            >📁 Xem folder</a>
                                          : <Na pending />
                                        }
                                      </td>
                                    )}

                                    {/* Total Price — stacked tiers */}
                                    <td style={{ ...tdBase({ textAlign: 'left', borderRight: 'none' }) }}>
                                      {(() => {
                                        const tiers = [
                                          { label: 'Economy', value: vi.eco_total, color: '#059669' },
                                          { label: 'Fast', value: vi.fast_total, color: '#0284c7' },
                                          { label: 'Express', value: vi.express_total, color: '#7c3aed' },
                                          { label: 'Overnight', value: vi.overnight_total, color: '#b45309' },
                                        ].filter(t => t.value != null && t.value !== '' && Number(t.value) !== 0);
                                        return tiers.length > 0 ? (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            {tiers.map(({ label, value, color }) => (
                                              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ fontSize: 9, fontWeight: 700, color, minWidth: 52, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
                                                <span style={{ fontWeight: 800, fontSize: 12, color }}>${Number(value).toFixed(2)}</span>
                                              </div>
                                            ))}
                                          </div>
                                        ) : <Na />;
                                      })()}
                                    </td>
                                  </tr>
                                ));
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div style={{ marginTop: 10, padding: '8px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#92400e' }}>
                        <span>ℹ️</span>
                        <span>Các ô hiển thị <strong>N/A</strong> đang chờ bộ phận Vận hành (Staff B) cập nhật thông tin vendor.</span>
                      </div>
                    </>
                  );
                })()}
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
