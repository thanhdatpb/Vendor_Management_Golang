// ════════════════════════════════════════════════════════
//  PRODUCT VIEWER MODAL (Seller)
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { LeftOutlined, RightOutlined, DeleteOutlined } from '@ant-design/icons';
import { HC, STATUS_CFG, ITEMS_PER_PAGE, LS_A_SELECTIONS, LS_B_SELECTIONS, LS_PRODUCT_VENDORS, LS_SAMPLE_DECISIONS, LS_A_FEEDBACK_RESPONSE, LS_B_SUBMITTED_FEEDBACK } from '../../constants/sellerTheme';
import { lsGet, lsSet, fmtDate, getMediaUrls, getMediaUrl } from '../../utils/sellerHelpers';
import { Badge, CardHeader, InfoRow, Field, MediaGallery, inp, EMPTY_FORM } from './SellerUI';

export default function ProductViewerModal({ product, productVendors, onClose, getStatus }) {
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
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
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

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* TOP SECTION: Media & Product Info (Sheet Layout) */}
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: `1.5px solid ${HC.border}`, background: HC.surface, height: 320 }}>
              {/* Media */}
              <div style={{ width: 320, flexShrink: 0, borderRight: `1.5px solid ${HC.border}`, display: 'flex', flexDirection: 'column', background: '#2a1a00' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: mediaUrls.length ? 'pointer' : 'default' }}>
                  {mediaUrls.length > 0 ? (
                    isVideo(mediaUrls[currentMediaIndex]) ? (
                      <video onClick={() => { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); }} src={mediaUrls[currentMediaIndex]} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                    ) : (
                      <img onClick={() => { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); }} src={mediaUrls[currentMediaIndex]} alt="" style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
                    )
                  ) : (
                    <div style={{ color: HC.muted2, textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 8 }}>📷</div><div>Không có ảnh</div></div>
                  )}
                  {mediaUrls.length > 1 && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(p => p > 0 ? p - 1 : mediaUrls.length - 1); }} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
                        <LeftOutlined />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setCurrentMediaIndex(p => p < mediaUrls.length - 1 ? p + 1 : 0); }} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}>
                        <RightOutlined />
                      </button>
                      <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#fff' }}>
                        {currentMediaIndex + 1} / {mediaUrls.length}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Product Info — Full Form Fields */}
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px', background: '#fff' }}>
                {/* Header row */}
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

                {/* Form Fields Compact Layout */}
                {(() => {
                  const F = ({ label, value, bg, border, valueColor, bold }) => (
                    <div style={{ background: bg || HC.cream, border: `1px solid ${border || HC.border}`, borderRadius: 7, padding: '7px 11px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                      <div style={{ fontSize: 11, fontWeight: bold ? 800 : 600, color: valueColor || HC.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || '—'}</div>
                    </div>
                  );
                  let links = [];
                  if (product.product_type_links) {
                    if (Array.isArray(product.product_type_links)) links = product.product_type_links;
                    else { try { links = JSON.parse(product.product_type_links); } catch { links = [product.product_type_links]; } }
                  } else if (product.product_type_link) links = [product.product_type_link];

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Row 1: Key metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr 1fr 1.2fr', gap: 8 }}>
                        <F label="Product Type" value={product.product_type} bg={HC.orangePale} valueColor={HC.orangeDark} bold />
                        <F label="⏱ Sản xuất" value={product.production_time} valueColor={HC.brown} bold />
                        <F label="🚢 Giao hàng" value={product.shipping_time} valueColor={HC.brown} bold />
                        <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 7, padding: '7px 11px' }}>
                          <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em' }}>💰 Target Cost</div>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#065f46' }}>{product.total_cost != null ? `$${product.total_cost}` : '—'}</div>
                        </div>
                      </div>

                      {/* Row 2: Spec fields */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1fr', gap: 8 }}>
                        <F label="Chất liệu" value={product.material} />
                        <F label="Vùng In" value={product.print_area} />
                        <F label="Đặc tính KT" value={product.other_specs} />
                        <F label="Packaging" value={product.packaging_links} />
                        <F label="Other Pkg" value={product.other_packaging} />
                      </div>

                      {/* Row 3: Links as pill buttons */}
                      <div style={{ background: HC.cream, border: `1px solid ${HC.border}`, borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: HC.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>🔗 Links tham khảo</span>
                        {links.length > 0
                          ? links.map((link, idx) => (
                              <a key={idx} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '4px 12px', borderRadius: 20, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                                onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                                onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                              >
                                🔗 Link {idx + 1}
                              </a>
                            ))
                          : <span style={{ color: HC.muted2, fontSize: 11 }}>Chưa có link</span>
                        }
                      </div>

                      {/* Row 4: Reviews */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ fontSize: 9, color: '#065f46', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>👍 Good Review</div>
                          <div className="custom-scrollbar" style={{ fontSize: 11, fontWeight: 600, color: '#065f46', whiteSpace: 'pre-wrap', maxHeight: 52, overflowY: 'auto' }}>{product.good_review || '—'}</div>
                        </div>
                        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
                          <div style={{ fontSize: 9, color: HC.danger, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>👎 Bad Review</div>
                          <div className="custom-scrollbar" style={{ fontSize: 11, fontWeight: 600, color: HC.danger, whiteSpace: 'pre-wrap', maxHeight: 52, overflowY: 'auto' }}>{product.bad_review || '—'}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>


            {/* BOTTOM SECTION: Vendors List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: '#faf9f8' }}>
              <div style={{ padding: '10px 20px', background: `linear-gradient(135deg,${HC.orangeDark},${HC.orangeDeep})`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>🏪</span>
                <div style={{ fontWeight: 900, fontSize: 12, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Danh sách nhà phân phối đã gán</div>
                {vendors.length > 0 && (
                  <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 10, fontWeight: 700 }}>
                    {vendors.length} vendor
                  </span>
                )}
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '14px 20px' }}>
                {vendors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, background: HC.surface, borderRadius: 16, border: `1.5px dashed ${HC.border}` }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: HC.brown }}>Chưa có nhà phân phối nào được gán</div>
                    <div style={{ fontSize: 12, color: HC.muted2, marginTop: 6 }}>Bộ phận Vận hành sẽ gán nhà cung cấp sau khi xem xét sản phẩm này.</div>
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
                                        {v.media_url
                                          ? <img src={v.media_url} style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 8, border: `1px solid ${HC.border}`, display: 'block', margin: '0 auto' }} />
                                          : <div style={{ width: 52, height: 52, borderRadius: 8, background: HC.cream, border: `1px dashed ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, margin: '0 auto', color: HC.muted2 }}>📷</div>
                                        }
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

                                    {/* Total Price (per item) */}
                                    <td style={{ ...tdBase({ textAlign: 'center', borderRight: 'none' }) }}>
                                      {vi.eco_total != null && vi.eco_total !== '' && vi.eco_total !== 0
                                        ? <span style={{ fontWeight: 900, fontSize: 14, color: '#059669' }}>${Number(vi.eco_total).toFixed(2)}</span>
                                        : <Na pending />
                                      }
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
