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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Row 1: Short fields from Section 1 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ background: HC.orangePale, border: `1px solid ${HC.border}`, borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 2 }}>1. Product Type</div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: HC.orangeDark, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.product_type || '—'}</div>
                    </div>
                    <div style={{ background: HC.cream, border: `1px solid ${HC.border}`, borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 2 }}>1.2 T.gian SX</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: HC.brown }}>{product.production_time || '—'}</div>
                    </div>
                    <div style={{ background: HC.cream, border: `1px solid ${HC.border}`, borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 2 }}>1.3 T.gian Ship</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: HC.brown }}>{product.shipping_time || '—'}</div>
                    </div>
                    <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 2 }}>1.4 Total Cost</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#065f46' }}>{product.total_cost != null ? `$${product.total_cost}` : '—'}</div>
                    </div>
                  </div>

                  {/* Row 2: Short fields from Section 2 & 3 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1fr', gap: 8 }}>
                    <div style={{ background: HC.cream, border: `1px solid ${HC.border}`, borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 2 }}>2.1 Chất liệu</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: HC.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.material || '—'}</div>
                    </div>
                    <div style={{ background: HC.cream, border: `1px solid ${HC.border}`, borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 2 }}>2.2 Vùng In</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: HC.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.print_area || '—'}</div>
                    </div>
                    <div style={{ background: HC.cream, border: `1px solid ${HC.border}`, borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 2 }}>2.3 Other Specs</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: HC.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.other_specs || '—'}</div>
                    </div>
                    <div style={{ background: HC.cream, border: `1px solid ${HC.border}`, borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 2 }}>3.1 Packaging</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: HC.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.packaging_links || '—'}</div>
                    </div>
                    <div style={{ background: HC.cream, border: `1px solid ${HC.border}`, borderRadius: 6, padding: '6px 10px' }}>
                      <div style={{ fontSize: 9, color: HC.muted, fontWeight: 700, marginBottom: 2 }}>3.2 Other Pkg</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: HC.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.other_packaging || '—'}</div>
                    </div>
                  </div>

                  {/* Row 3: Links (Long content) */}
                  <div style={{ background: HC.cream, border: `1px solid ${HC.border}`, borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 10, color: HC.muted, fontWeight: 700, marginBottom: 4 }}>1.1 Link hình ảnh và video</div>
                    {(() => {
                      let links = [];
                      if (product.product_type_links) {
                        if (Array.isArray(product.product_type_links)) links = product.product_type_links;
                        else { try { links = JSON.parse(product.product_type_links); } catch { links = [product.product_type_links]; } }
                      } else if (product.product_type_link) links = [product.product_type_link];
                      return links.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 60, overflowY: 'auto' }} className="custom-scrollbar">
                          {links.map((link, idx) => (
                            <a key={idx} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              style={{ color: HC.orange, fontSize: 11, textDecoration: 'none', wordBreak: 'break-all' }}
                              onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
                              onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}>
                              🔗 {link}
                            </a>
                          ))}
                        </div>
                      ) : <span style={{ color: HC.muted2, fontSize: 11 }}>—</span>;
                    })()}
                  </div>

                  {/* Row 4: Reviews (Long content) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: HC.muted, fontWeight: 700, marginBottom: 4 }}>2.4 Good Review</div>
                      <div className="custom-scrollbar" style={{ fontSize: 11, fontWeight: 600, color: '#065f46', whiteSpace: 'pre-wrap', maxHeight: 60, overflowY: 'auto' }}>{product.good_review || '—'}</div>
                    </div>
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: HC.muted, fontWeight: 700, marginBottom: 4 }}>2.5 Bad Review</div>
                      <div className="custom-scrollbar" style={{ fontSize: 11, fontWeight: 600, color: HC.danger, whiteSpace: 'pre-wrap', maxHeight: 60, overflowY: 'auto' }}>{product.bad_review || '—'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>


            {/* BOTTOM SECTION: Vendors List */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, background: '#faf9f8' }}>
              <div style={{ padding: '12px 20px', background: `linear-gradient(135deg,${HC.orangeDark},${HC.orangeDeep})`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🏪</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 12, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Danh sách nhà phân phối đã gán</div>
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
                  <div style={{ background: HC.surface, borderRadius: 16, border: `1px solid ${HC.border}`, overflow: 'hidden' }}>
                    <div style={{ padding: '0', background: HC.surface2, overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', fontSize: 12, textAlign: 'center' }}>
                        <thead style={{ color: HC.muted, background: HC.cream }}>
                          <tr>
                            <th style={{ padding: '12px', fontWeight: 800, borderRight: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}` }}>Ảnh</th>
                            <th style={{ padding: '12px', fontWeight: 800, borderRight: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}`, color: HC.ink }}>Vendor Name</th>
                            <th style={{ padding: '12px', fontWeight: 800, borderRight: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}`, color: HC.orangeDark }}>Product Type</th>
                            <th style={{ padding: '12px', fontWeight: 800, borderRight: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}` }}>Chất liệu</th>
                            <th style={{ padding: '12px', fontWeight: 800, borderRight: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}` }}>Thời gian SX</th>
                            <th style={{ padding: '12px', fontWeight: 800, borderRight: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}` }}>Thời gian Ship</th>
                            <th style={{ padding: '12px', fontWeight: 800, borderRight: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}` }}>Size</th>
                            <th style={{ padding: '12px', fontWeight: 800, borderRight: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}` }}>Link Folder</th>
                            <th style={{ padding: '12px', fontWeight: 800, borderBottom: `1px solid ${HC.border}` }}>Total Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedVendors.map((group, gIdx) => {
                            const v = group.firstVendor;
                            return group.items.map((vi, idx) => (
                              <tr key={`${gIdx}-${idx}`} style={{ borderBottom: `1px solid ${HC.border}`, background: HC.surface }}>
                                {idx === 0 && (
                                  <td rowSpan={group.items.length} style={{ padding: '10px', verticalAlign: 'middle', borderRight: `1px solid ${HC.border}`, textAlign: 'center', width: 80 }}>
                                    {v.media_url ? <img src={v.media_url} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: `1px solid ${HC.border}` }} /> : <span style={{color: HC.muted2, fontSize: 10}}>—</span>}
                                  </td>
                                )}
                                {/* Vendor Name */}
                                {idx === 0 && (
                                  <td rowSpan={group.items.length} style={{ padding: '10px 14px', verticalAlign: 'middle', borderRight: `1px solid ${HC.border}`, minWidth: 120, textAlign: 'left' }}>
                                    <div style={{ fontWeight: 800, fontSize: 12, color: HC.ink }}>{v.name || v.vendor_type || '—'}</div>
                                    {v.name && v.vendor_type && v.name !== v.vendor_type && (
                                      <div style={{ fontSize: 10, color: HC.muted2, marginTop: 2 }}>{v.vendor_type}</div>
                                    )}
                                  </td>
                                )}
                                {/* Product Type (vendor_type badge) */}
                                {idx === 0 && (
                                  <td rowSpan={group.items.length} style={{ padding: '10px 14px', verticalAlign: 'middle', borderRight: `1px solid ${HC.border}`, minWidth: 110 }}>
                                    {v.vendor_type ? (
                                      <span style={{ fontWeight: 900, fontSize: 11, color: HC.orangeDark, padding: '3px 10px', borderRadius: 6, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, whiteSpace: 'nowrap' }}>
                                        {v.vendor_type}
                                      </span>
                                    ) : <span style={{ color: HC.muted2 }}>—</span>}
                                  </td>
                                )}
                                {idx === 0 && (
                                  <td rowSpan={group.items.length} style={{ padding: '10px 12px', verticalAlign: 'middle', borderRight: `1px solid ${HC.border}`, maxWidth: 150 }}>
                                    <div style={{ fontWeight: 600, color: HC.ink, lineHeight: 1.4 }}>{v.overview || product.material || '—'}</div>
                                  </td>
                                )}
                                {idx === 0 && (
                                  <td rowSpan={group.items.length} style={{ padding: '10px 12px', verticalAlign: 'middle', borderRight: `1px solid ${HC.border}` }}>
                                    <div style={{ fontWeight: 700, color: HC.brown }}>{product.production_time || '—'}</div>
                                  </td>
                                )}
                                {idx === 0 && (
                                  <td rowSpan={group.items.length} style={{ padding: '10px 12px', verticalAlign: 'middle', borderRight: `1px solid ${HC.border}` }}>
                                    <div style={{ fontWeight: 700, color: HC.brown }}>{product.shipping_time || '—'}</div>
                                  </td>
                                )}
                                <td style={{ padding: '10px 12px', textAlign: 'center', borderRight: `1px solid ${HC.border}` }}>
                                  <div style={{ fontWeight: 800, color: HC.ink }}>{vi.size || '—'}</div>
                                  {vi.optional && <div style={{ fontSize: 10, color: HC.muted2, marginTop: 4 }}>{vi.optional}</div>}
                                </td>
                                {idx === 0 && (
                                  <td rowSpan={group.items.length} style={{ padding: '10px 12px', verticalAlign: 'middle', borderRight: `1px solid ${HC.border}`, maxWidth: 150 }}>
                                    {(() => {
                                      let links = [];
                                      if (product.product_type_links) {
                                        if (Array.isArray(product.product_type_links)) links = product.product_type_links;
                                        else { try { links = JSON.parse(product.product_type_links); } catch { links = [product.product_type_links]; } }
                                      } else if (product.product_type_link) links = [product.product_type_link];
                                      return links.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 80, overflowY: 'auto' }} className="custom-scrollbar">
                                          {links.map((link, i) => (
                                            <a key={i} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                              style={{ color: HC.orange, fontSize: 11, textDecoration: 'none', fontWeight: 700, display: 'inline-block', padding: '4px 8px', background: HC.orangePale, borderRadius: 4 }}>
                                              🔗 Link {i + 1}
                                            </a>
                                          ))}
                                        </div>
                                      ) : <span style={{ color: HC.muted2, fontSize: 11 }}>—</span>;
                                    })()}
                                  </td>
                                )}
                                <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                                  <span style={{ color: '#059669', fontWeight: 900, fontSize: 14 }}>{fmt(vi.eco_total)}</span>
                                </td>
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    </div>
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
