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
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: `1.5px solid ${HC.border}`, background: HC.surface, height: 220 }}>
              {/* Media */}
              <div style={{ width: 240, flexShrink: 0, borderRight: `1.5px solid ${HC.border}`, display: 'flex', flexDirection: 'column', background: '#1a1008' }}>
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

              {/* Product Info — compact */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 16px', background: '#f8fafc' }}>
                {/* Header row */}
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

                {/* Row 2: specs + reviews inline */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr 1.2fr 1.2fr', gap: 6, marginBottom: 6 }}>
                  {[
                    { label: 'Chất liệu', value: product.material },
                    { label: 'Vùng In', value: product.print_area },
                    { label: 'Đặc tính KT', value: product.other_specs },
                    { label: 'Good Review', value: product.good_review, color: '#166534', bg: '#f0fdf4', bc: '#bbf7d0' },
                    { label: 'Bad Review', value: product.bad_review, color: '#991b1b', bg: '#fef2f2', bc: '#fecaca' },
                  ].map(({ label, value, color, bg, bc }) => (
                    <div key={label} style={{ background: bg || '#fff', border: `1px solid ${bc || '#e5e7eb'}`, borderRadius: 8, padding: '7px 11px' }}>
                      <div style={{ fontSize: 9, color: color || '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: color || HC.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={value || ''}>{value || '—'}</div>
                    </div>
                  ))}
                </div>

                {/* Row 3: ref links inline */}
                {referenceLinks.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: HC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>Links</span>
                    {referenceLinks.map((link, idx) => (
                      <a key={idx} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ fontSize: 10, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '2px 10px', borderRadius: 5, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, transition: 'background 0.15s', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                        onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                      >Link {idx + 1}</a>
                    ))}
                  </div>
                )}
              </div>
            </div>


            {/* BOTTOM SECTION: Vendor Comparison */}
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
                {vendors.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '52px 40px', background: HC.surface, borderRadius: 14, border: `1px solid ${HC.border}` }}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: HC.cream, border: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={HC.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.ink, marginBottom: 6 }}>Chưa có nhà phân phối được gán</div>
                    <div style={{ fontSize: 12, color: HC.muted, lineHeight: 1.6, textAlign: 'center', maxWidth: 320 }}>Bộ phận Vận hành sẽ gán nhà cung cấp phù hợp sau khi xem xét yêu cầu sản phẩm này.</div>
                  </div>
                ) : (() => {
                  const target = product.total_cost != null ? Number(product.total_cost) : null;

                  // N/A phân biệt: thư viện trống vs chờ Staff B
                  const NaLib = ({ title: tip } = {}) => (
                    <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }} title={tip || 'Chưa có trong thư viện vendor'}>—</span>
                  );
                  const NaStaff = () => (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: '#92400e', padding: '2px 7px', borderRadius: 4, background: '#fffbeb', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>
                      chờ Staff B
                    </span>
                  );

                  const TIER_META = [
                    { key: 'eco_total',       short: 'ECO',  label: 'Economy',   color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
                    { key: 'ground_total',    short: 'GND',  label: 'Ground',    color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe' },
                    { key: 'twoday_total',    short: '2DAY', label: '2 Days',    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
                    { key: 'express_total',   short: 'EXP',  label: 'Express',   color: '#b45309', bg: '#fff7ed', border: '#fed7aa' },
                    { key: 'overnight_total', short: 'OVN',  label: 'Overnight', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                  ];

                  // Helper: resolve total, fallback eco_total = pricing1+eco_price for legacy data
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

                  const groupPrices = groupedVendors.map(g => getBestPrice(g.items));
                  const validPrices = groupPrices.filter(p => p != null);
                  const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

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
                      <div style={{ borderRadius: 12, border: `1.5px solid ${HC.border}`, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', minWidth: 990, borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={{ ...thS({ width: 60 }) }}>Ảnh</th>
                                <th style={{ ...thS({ textAlign: 'left', minWidth: 150 }) }}>Vendor</th>
                                <th style={{ ...thS({ textAlign: 'left', minWidth: 120 }) }}>Chất liệu</th>
                                <th style={{ ...thS({ width: 80 }) }}>Size</th>
                                <th style={{ ...thS({ width: 62 }) }}>T.gian SX</th>
                                <th style={{ ...thS({ width: 62 }) }}>T.gian Ship</th>
                                <th style={{ ...thS({ width: 70 }) }}>Folder</th>
                                <th style={{ ...thS({ minWidth: 260, borderRight: 'none', color: '#059669' }) }}>Giá & So sánh Target</th>
                              </tr>
                            </thead>
                            <tbody>
                              {groupedVendors.map((group, gIdx) => {
                                const v = group.firstVendor;
                                const vendorImg = v.media_url || (Array.isArray(v.images) && v.images[0]) || null;
                                const rawMaterial = v.overview || '';
                                const vendorLink = v.link_folder || null;

                                const bestPrice = getBestPrice(group.items);
                                const isBest = bestPrice != null && lowestPrice != null
                                  && Math.abs(bestPrice - lowestPrice) < 0.001
                                  && groupedVendors.length > 1;
                                const isWithinTarget = target != null && bestPrice != null && bestPrice <= target;

                                const rowBg = isBest ? '#f0fdf4' : gIdx % 2 === 0 ? '#fff' : '#fafafa';
                                const leftBorder = isBest ? '3px solid #22c55e' : '3px solid transparent';

                                // All sizes for this vendor (deduplicated)
                                const sizes = [...new Set(group.items.map(vi => vi.size).filter(Boolean))];

                                // Price range (min–max) per tier across all sizes
                                const tierRanges = TIER_META.map(t => {
                                  const vals = group.items
                                    .map(vi => getTotal(vi, t.key))
                                    .filter(n => n != null && n > 0);
                                  if (vals.length === 0) return null;
                                  return { ...t, min: Math.min(...vals), max: Math.max(...vals) };
                                }).filter(Boolean);

                                return (
                                  <tr key={group.key}
                                    style={{ background: rowBg, transition: 'background 0.12s' }}
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
                                        {onViewVendorLibrary && v.source_file_id && (
                                          <button
                                            onClick={() => { onClose(); onViewVendorLibrary(v.source_file_id); }}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: HC.orange, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, borderRadius: 4, padding: '1px 7px', cursor: 'pointer' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                                          >Xem thư viện</button>
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

                                    {/* Size — tất cả size dưới dạng pills */}
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

                                    {/* T.gian SX */}
                                    <td style={{ ...td({ textAlign: 'center', width: 62 }) }}>
                                      {product.production_time
                                        ? <span style={{ fontWeight: 700, fontSize: 11, color: '#0284c7' }}>{product.production_time}</span>
                                        : <NaLib title="Chưa có thông tin thời gian sản xuất" />
                                      }
                                    </td>

                                    {/* T.gian Ship */}
                                    <td style={{ ...td({ textAlign: 'center', width: 62 }) }}>
                                      {product.shipping_time
                                        ? <span style={{ fontWeight: 700, fontSize: 11, color: '#7c3aed' }}>{product.shipping_time}</span>
                                        : <NaLib title="Chưa có thông tin thời gian giao hàng" />
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

                                    {/* Giá & So sánh Target — khoảng min–max per tier */}
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
                                        <div>
                                          <NaLib title="Thư viện chưa có dữ liệu giá" />
                                          <div style={{ fontSize: 8, color: '#999', marginTop: 3, lineHeight: 1.5, fontFamily: 'monospace' }}>
                                            {group.items.map((vi, _di) => (
                                              <div key={_di}>#{_di+1} eco:{String(vi.eco_total??'∅')} p1:{String(vi.pricing1??'∅')} ep:{String(vi.eco_price??'∅')} gnd:{String(vi.ground_total??'∅')}</div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Legend */}
                      <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '7px 12px', background: '#fff', borderRadius: 8, border: `1px solid ${HC.border}` }}>
                        <span style={{ fontSize: 10, color: HC.muted, fontWeight: 700 }}>Chú thích:</span>
                        <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 10, color: '#cbd5e1' }}>—</span> Thư viện chưa có dữ liệu
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: HC.muted }}>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#92400e', padding: '1px 6px', borderRadius: 4, background: '#fffbeb', border: '1px solid #fde68a' }}>chờ Staff B</span>
                          Bộ phận Vận hành chưa nhập
                        </span>
                        {groupedVendors.length > 1 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: HC.muted }}>
                            <span style={{ fontSize: 8, fontWeight: 900, color: '#fff', padding: '1px 5px', borderRadius: 3, background: '#16a34a' }}>BEST</span>
                            Giá tốt nhất trong danh sách
                          </span>
                        )}
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
