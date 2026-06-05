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
                    {groupedVendors.map((group, i) => {
                      const v = group.firstVendor;
                      const key = group.key;
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
                                <div style={{ fontWeight: 900, fontSize: 16, color: HC.orangeDark }}>{group.vendorName}</div>
                                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: HC.muted2 }}>
                                  <span>📏 {group.items.length} phân loại (sizes/options)</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Pricing Table (Grouped) */}
                          <div style={{ padding: '0', background: HC.surface2, borderBottom: `1px solid ${HC.border}`, overflowX: 'auto' }}>
                            <table style={{ width: '100%', minWidth: 600, borderCollapse: 'collapse', fontSize: 11, textAlign: 'center' }}>
                              <thead>
                                <tr style={{ background: HC.cream, borderBottom: `1px solid ${HC.border}`, color: HC.muted }}>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>Variant (Size / Opt)</th>
                                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Base Cost</th>
                                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Economy (Ship/Total)</th>
                                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Fast (Ship/Total)</th>
                                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Express (Ship/Total)</th>
                                  <th style={{ padding: '10px 12px', fontWeight: 800 }}>Overnight (Ship/Total)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.items.map((vi, idx) => (
                                  <tr key={idx} style={{ borderBottom: idx === group.items.length - 1 ? 'none' : `1px solid ${HC.border}`, background: HC.surface }}>
                                    <td style={{ padding: '10px 12px', textAlign: 'left' }}>
                                      <div style={{ fontWeight: 800, color: HC.ink }}>{vi.size || '—'}</div>
                                      {vi.optional && <div style={{ fontSize: 10, color: HC.muted2, marginTop: 2 }}>{vi.optional}</div>}
                                    </td>
                                    <td style={{ padding: '10px 12px', fontWeight: 800, color: HC.orange }}>${((vi.pricing1 || 0) + (vi.pricing2 || 0)).toFixed(2)}</td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{ color: HC.muted }}>{fmt(vi.eco_price)}</span> <span style={{ color: HC.border, margin: '0 4px' }}>|</span> <span style={{ color: HC.success, fontWeight: 800 }}>{fmt(vi.eco_total)}</span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{ color: HC.muted }}>{fmt(vi.fast_price)}</span> <span style={{ color: HC.border, margin: '0 4px' }}>|</span> <span style={{ color: HC.success, fontWeight: 800 }}>{fmt(vi.fast_total)}</span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{ color: HC.muted }}>{fmt(vi.express_price)}</span> <span style={{ color: HC.border, margin: '0 4px' }}>|</span> <span style={{ color: HC.success, fontWeight: 800 }}>{fmt(vi.express_total)}</span>
                                    </td>
                                    <td style={{ padding: '10px 12px' }}>
                                      <span style={{ color: HC.muted }}>{fmt(vi.overnight_price)}</span> <span style={{ color: HC.border, margin: '0 4px' }}>|</span> <span style={{ color: HC.success, fontWeight: 800 }}>{fmt(vi.overnight_total)}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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
                                      <><span style={{ fontSize: 18 }}>✅</span><span style={{ fontWeight: 800, color: '#065f46' }}>Đã gửi phản hồi</span></>
                                    ) : (
                                      <><span style={{ fontSize: 18 }}>❌</span><span style={{ fontWeight: 800, color: '#991b1b' }}>Đã gửi phản hồi</span></>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 12, color: HC.ink2, marginTop: 4, whiteSpace: 'pre-wrap' }}>
                                    {aResponse?.sellerFeedback || sampleDecision?.sellerFeedback}
                                  </div>
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
                                      // Gửi trực tiếp, mặc định duyệt (dat)
                                      submitFeedbackWithDecision(key, v, 'dat', '');
                                    }}
                                    disabled={sendingKey === key}
                                    style={{
                                      padding: '10px 16px', borderRadius: 10, border: 'none',
                                      background: (!isChecked || !feedback.trim()) ? HC.muted2 :
                                        (sendingKey === key ? HC.success : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`),
                                      color: '#fff', fontSize: 12, fontWeight: 700,
                                      cursor: (!isChecked || !feedback.trim()) ? 'not-allowed' : 'pointer',
                                      opacity: (!isChecked || !feedback.trim()) ? 0.5 : 1,
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
