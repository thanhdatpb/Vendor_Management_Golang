import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HC, LS_PRODUCT_VENDORS } from '../utils/constants';
import { lsGet, lsSet, fmtDate, getMediaUrls } from '../utils/helpers';
import { Spinner, EmptyState, Pagination, Badge, Field, inp, focusStyle } from '../ui/StaffBUI';
import VendorViewerModal from '../components/VendorViewerModal';
import { productApi } from '../../../services/api';
import { SearchOutlined } from '@ant-design/icons';

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

const ITEMS_PER_PAGE = 10;
const LS_A_SELECTIONS = 'STAFF_A_SELECTIONS_V1';
const LS_B_SELECTIONS = 'STAFF_B_SELECTIONS_V1';

function ThumbnailImg({ src, size = 72 }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      style={{ width: size, height: size, objectFit: 'cover', borderRadius: 8, border: `1.5px solid ${HC.border}`, display: 'block' }}
      onError={() => setBroken(true)}
    />
  );
}

export default function ProductsSection({ onGotoVendors, selectedProductId, setSelectedProductId }) {
  const [submittedProducts, setSubmittedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackProduct, setFeedbackProduct] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [viewVendorProduct, setViewVendorProduct] = useState(null);
  const [productVendors, setProductVendors] = useState(() => lsGet(LS_PRODUCT_VENDORS, {}));
  const [libraryVendorCounts, setLibraryVendorCounts] = useState({});

  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [deadlineProduct, setDeadlineProduct] = useState(null);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [settingDeadline, setSettingDeadline] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const [confirmDeleteProduct, setConfirmDeleteProduct] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const processedProductIdRef = useRef(null);

  useEffect(() => {
    const sync = () => {
      setProductVendors(lsGet(LS_PRODUCT_VENDORS, {}));
      try {
        const list = JSON.parse(localStorage.getItem('STAFF_VENDOR_LIST_V1') || '[]');
        const counts = {};
        list.forEach(v => {
          const type = (v.product_type || '').toLowerCase();
          if(type) counts[type] = (counts[type] || 0) + 1;
        });
        setLibraryVendorCounts(counts);
      } catch(e){}
    };
    sync();
    window.addEventListener('storage', sync);
    const id = setInterval(sync, 5000);
    return () => { window.removeEventListener('storage', sync); clearInterval(id); };
  }, []);

  const handleQuickAssign = (product) => {
    try {
      const allVendors = JSON.parse(localStorage.getItem('STAFF_VENDOR_LIST_V1') || '[]');
      const matchingVendors = allVendors.filter(v => (v.product_type || '').toLowerCase() === (product.product_type || '').toLowerCase());
      
      if (matchingVendors.length === 0) {
        alert('Không tìm thấy vendor nào trong thư viện cho loại sản phẩm này!');
        return;
      }

      const allAssigned = lsGet(LS_PRODUCT_VENDORS, {});
      allAssigned[product.id] = matchingVendors;
      lsSet(LS_PRODUCT_VENDORS, allAssigned);
      setProductVendors(allAssigned);
      window.dispatchEvent(new StorageEvent('storage', { key: LS_PRODUCT_VENDORS }));

      // Đồng bộ lên API để các thiết bị khác nhận được
      productApi.assignVendors(product.id, matchingVendors).catch(err => {
        console.error('Lỗi đồng bộ vendor lên API:', err);
      });

      alert(`Đã gán nhanh ${matchingVendors.length} vendor từ thư viện cho sản phẩm này!`);
    } catch (err) {
      console.error(err);
      alert('Có lỗi xảy ra khi gán nhanh!');
    }
  };

  const getStatus = p => { const s = p.status || 'draft'; return s === 'rejected' ? 'reject' : s; };

  const handleOpenDeadlineModal = (product) => {
    setDeadlineProduct(product);
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setDeadlineDate(defaultDate.toISOString().split('T')[0]);
    setDeadlineModalOpen(true);
  };

  const handleSetDeadline = async () => {
    if (!deadlineDate) {
      showToast('Vui lòng chọn ngày deadline!', 'warning');
      return;
    }

    setSettingDeadline(true);
    try {
      await productApi.updateDeadline(deadlineProduct.id, { deadline_date: deadlineDate });
      setSubmittedProducts(prev => prev.map(p =>
        p.id === deadlineProduct.id
          ? { ...p, deadline_date: deadlineDate }
          : p
      ));
      setDeadlineModalOpen(false);
      setDeadlineProduct(null);
      setDeadlineDate('');
      showToast('Đã cập nhật Deadline Date thành công!', 'success');
    } catch (err) {
      showToast('Lỗi: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setSettingDeadline(false);
    }
  };

  const handleDelete = async (product) => {
    setDeletingId(product.id);
    try {
      await productApi.delete(product.id);
      setSubmittedProducts(prev => prev.filter(p => p.id !== product.id));
      const pid = String(product.id);
      const allVendors = lsGet(LS_PRODUCT_VENDORS, {});
      delete allVendors[pid];
      lsSet(LS_PRODUCT_VENDORS, allVendors);
      const aSelections = lsGet(LS_A_SELECTIONS, {});
      delete aSelections[pid];
      lsSet(LS_A_SELECTIONS, aSelections);
      const bSelections = lsGet(LS_B_SELECTIONS, {});
      delete bSelections[pid];
      lsSet(LS_B_SELECTIONS, bSelections);
      window.dispatchEvent(new StorageEvent('storage', { key: LS_PRODUCT_VENDORS }));
      window.dispatchEvent(new StorageEvent('storage', { key: LS_A_SELECTIONS }));
      setConfirmDeleteProduct(null);
    } catch (err) {
      showToast('Lỗi xóa: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const loadProducts = useCallback(() => {
    setLoading(true);
    setApiError('');

    productApi.getApprovedProducts()
      .then(r => {
        let list = [];
        if (r.data && r.data.data && Array.isArray(r.data.data)) {
          list = r.data.data;
        }
        else if (Array.isArray(r.data)) {
          list = r.data;
        }
        else if (r.data && Array.isArray(r.data.products)) {
          list = r.data.products;
        }

        list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setSubmittedProducts(list);

        if (selectedProductId && processedProductIdRef.current !== selectedProductId) {
          const product = list.find(p => String(p.id) === String(selectedProductId));
          if (product) {
            processedProductIdRef.current = selectedProductId;
            setTimeout(() => {
              setViewVendorProduct(product);
              if (setSelectedProductId) setSelectedProductId(null);
            }, 100);
          }
        }
      })
      .catch(err => {
        setApiError(err.response?.data?.message || err.message || 'Lỗi tải dữ liệu');
        setSubmittedProducts([]);
      })
      .finally(() => setLoading(false));
  }, [selectedProductId, setSelectedProductId]);

  useEffect(() => { loadProducts(); const id = setInterval(loadProducts, 30000); return () => clearInterval(id); }, [loadProducts]);

  useEffect(() => {
    if (selectedProductId && submittedProducts.length > 0 && processedProductIdRef.current !== selectedProductId) {
      const product = submittedProducts.find(p => String(p.id) === String(selectedProductId));
      if (product) {
        processedProductIdRef.current = selectedProductId;
        setViewVendorProduct(product);
        if (setSelectedProductId) setSelectedProductId(null);
      } else {
        console.warn('Không tìm thấy sản phẩm trong danh sách:', selectedProductId);
      }
    }
  }, [selectedProductId, submittedProducts, setSelectedProductId]);

  const handleSendFeedback = product => { setFeedbackProduct(product); setFeedbackText(''); setFeedbackOpen(true); };
  
  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) { showToast('Vui lòng nhập nội dung phản hồi!', 'warning'); return; }
    setSendingFeedback(true);
    try {
      await productApi.sendFeedback(feedbackProduct.id, { feedback: feedbackText.trim() });
      setFeedbackOpen(false); setFeedbackProduct(null); setFeedbackText('');
      showToast('Đã gửi phản hồi thành công!', 'success');
    } catch (err) { showToast('Lỗi: ' + (err.response?.data?.message || err.message), 'error'); }
    finally { setSendingFeedback(false); }
  };

  const filteredProducts = submittedProducts.filter(p => {
    const hay = `${p.product_type || ''} ${p.other_specs || ''}`.toLowerCase();
    return !search || hay.includes(search.toLowerCase());
  });

  useEffect(() => { setCurrentPage(1); }, [search]);
  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const pagedProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) return <Spinner />;

  const TH = s => ({ padding: '11px 13px', fontWeight: 900, fontSize: 11, color: HC.brown, borderBottom: `1.5px solid ${HC.border}`, background: HC.cream, fontFamily: "'Nunito',sans-serif", textAlign: 'left', whiteSpace: 'nowrap', ...s });

  const toastMeta = {
    success: { bg: '#f0fdf4', border: '#86efac', color: '#166534', dot: '#22c55e', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
    )},
    error: { bg: '#fef2f2', border: '#fca5a5', color: '#991b1b', dot: '#ef4444', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
    )},
    warning: { bg: '#fffbeb', border: '#fcd34d', color: '#92400e', dot: '#f59e0b', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    )},
  };

  return (
    <div>
      {/* ── Toast Notification ── */}
      {toast && (() => {
        const m = toastMeta[toast.type] || toastMeta.success;
        return (
          <div style={{
            position: 'fixed', top: 24, right: 28, zIndex: 9999,
            minWidth: 300, maxWidth: 420,
            background: '#fff',
            border: `1.5px solid ${m.border}`,
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.13)',
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '14px 16px',
            animation: 'staffb-toast-in 0.28s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <style>{`
              @keyframes staffb-toast-in {
                from { opacity: 0; transform: translateX(60px) scale(0.95); }
                to   { opacity: 1; transform: translateX(0) scale(1); }
              }
            `}</style>
            <div style={{ marginTop: 1, flexShrink: 0 }}>{m.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: m.dot, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                {toast.type === 'success' ? 'Thành công' : toast.type === 'error' ? 'Lỗi' : 'Lưu ý'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', lineHeight: 1.45 }}>{toast.msg}</div>
            </div>
            <button
              onClick={() => setToast(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8', flexShrink: 0, marginTop: 1 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div style={{
              position: 'absolute', bottom: 0, left: 0,
              height: 3, borderRadius: '0 0 14px 14px',
              background: `linear-gradient(90deg, ${m.dot}, ${m.border})`,
              animation: 'staffb-toast-bar 3.5s linear forwards',
              width: '100%',
            }} />
            <style>{`
              @keyframes staffb-toast-bar {
                from { width: 100%; }
                to   { width: 0%; }
              }
            `}</style>
          </div>
        );
      })()}

      {apiError && <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>⚠️ {apiError}</span><button onClick={loadProducts} style={{ padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Thử lại</button></div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, padding: '12px 16px', background: HC.surface, borderRadius: 14, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <SearchOutlined style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: HC.muted, fontSize: 14, pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Tìm loại sản phẩm..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inp, paddingLeft: 36 }}
            onFocus={e => e.target.style.borderColor = HC.orange}
            onBlur={e => e.target.style.borderColor = HC.border}
          />
        </div>
        {search && <button onClick={() => setSearch('')} style={{ padding: '6px 12px', borderRadius: 9, border: '1.5px solid #fecaca', background: '#fef2f2', color: HC.danger, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>✕ Xóa lọc</button>}
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 11, color: HC.muted, fontWeight: 700, paddingLeft: 4, whiteSpace: 'nowrap' }}>{filteredProducts.length} / {submittedProducts.length} sản phẩm</div>
      </div>
      {filteredProducts.length === 0
        ? <EmptyState msg={submittedProducts.length === 0 ? 'Chưa có sản phẩm nào được Admin duyệt' : 'Không tìm thấy kết quả phù hợp'} />
        : <>
          <div style={{ overflowX: 'auto', borderRadius: 14, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, background: HC.surface }}>
              <thead>
                <tr>
                  <th style={TH()}>ID</th>
                  <th style={TH({ color: HC.orange })}>Project</th>
                  <th style={TH()}>Product Type</th>
                  <th style={TH()}>Image</th>
                  <th style={TH()}>Request Date</th>
                  <th style={TH()}>Deadline Date</th>
                  <th style={TH()}>Status</th>
                  <th style={TH()}>Supplier</th>
                  <th style={TH()}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.map((p, i) => {
                  const allUrls = getMediaUrls(p);
                  const mediaSrc = allUrls.length > 0 ? allUrls[0] : null;
                  const assignedVendors = productVendors[p.id] || [];
                  const uniqueVendorCount = new Set(assignedVendors.map(v => (v.name || v.vendor_name || v['Vendor Name'] || '').toString().trim()).filter(Boolean)).size || assignedVendors.length;
                  const hasVendors = assignedVendors.length > 0;
                  const aSelections = lsGet(LS_A_SELECTIONS, {})[p.id] || {};
                  const aSelectedCount = Object.values(aSelections).filter(s => s?.checked).length;
                  const pTypeLower = (p.product_type || '').toLowerCase();
                  const availableCount = libraryVendorCounts[pTypeLower] || 0;

                  return (
                    <tr key={p.id || i} style={{ borderBottom: `1px solid ${HC.border}`, cursor: 'pointer' }} onClick={() => setViewVendorProduct(p)} onMouseEnter={e => e.currentTarget.style.background = HC.orangePale} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 13px', color: HC.muted, fontWeight: 700 }}>
                        {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                      </td>

                      <td style={{ padding: '12px 13px', fontWeight: 800, color: HC.orangeDark }}>
                        {p.project || '—'}
                      </td>

                      <td style={{ padding: '12px 13px', fontWeight: 800, color: HC.ink2 }}>
                        {p.product_type || '—'}
                      </td>

                      <td style={{ padding: '12px 13px' }}>
                        {mediaSrc ? (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <ThumbnailImg src={mediaSrc} />
                          </div>
                        ) : (
                          hasVendors ? (
                            <div style={{
                              width: 72, height: 72, borderRadius: 8, border: `1.5px solid ${HC.border}`,
                              background: HC.orangeLight, display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center', gap: 2,
                            }}>
                              <span style={{ fontSize: 18 }}>🏪</span>
                              <span style={{ fontSize: 10, fontWeight: 900, color: HC.orangeDark }}>{uniqueVendorCount}</span>
                            </div>
                          ) : '—'
                        )}
                      </td>

                      <td style={{ padding: '12px 13px', color: HC.ink2 }}>{fmtDate(p.created_at) || '—'}</td>
                      <td style={{ padding: '12px 13px', color: HC.ink2 }}>{fmtDate(p.deadline_date) || '—'}</td>
                      <td style={{ padding: '12px 13px' }}><Badge status={getStatus(p)} /></td>

                      <td style={{ padding: '12px 13px' }}>
                        {hasVendors ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 600 }}>Assigned: {uniqueVendorCount} vendor</span>
                            {aSelectedCount > 0 && <span style={{ fontSize: 11, color: HC.success, fontWeight: 600 }}>✓ A đã chọn {aSelectedCount}</span>}
                          </div>
                        ) : <span style={{ color: HC.muted2, fontSize: 12, fontStyle: 'italic' }}>—</span>}
                      </td>

                      <td style={{ padding: '12px 13px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={(e) => { e.stopPropagation(); onGotoVendors(p.product_type, p.id); }} style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${HC.orange}`, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                            Tìm Vendor
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenDeadlineModal(p); }}
                            style={{
                              padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${HC.orangeMid}`,
                              background: HC.orangeLight, cursor: 'pointer', fontSize: 11, fontWeight: 800,
                              color: HC.orangeDark
                            }}
                          >
                            Tạo Deadline
                          </button>
                          {availableCount > 0 && !hasVendors && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleQuickAssign(p); }}
                              style={{
                                padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${HC.success}`,
                                background: '#ecfdf5', cursor: 'pointer', fontSize: 11, fontWeight: 800,
                                color: HC.success
                              }}
                            >
                              ⚡ Gán nhanh ({availableCount})
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDeleteProduct(p); }}
                            style={{
                              padding: '5px 10px', borderRadius: 7,
                              border: '1.5px solid #fecaca', background: '#fef2f2',
                              cursor: 'pointer', fontSize: 11, fontWeight: 800, color: HC.danger
                            }}
                          >
                            🗑 Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredProducts.length} onPageChange={setCurrentPage} />
        </>
      }
      {viewVendorProduct && (
        <VendorViewerModal
          product={viewVendorProduct}
          onClose={() => {
            setViewVendorProduct(null);
            processedProductIdRef.current = null;
            if (setSelectedProductId) {
              setSelectedProductId(null);
            }
          }}
        />
      )}
      {feedbackOpen && feedbackProduct && (
        <div onClick={() => setFeedbackOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 480, background: HC.surface, borderRadius: 20, padding: 28, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}` }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: HC.ink, marginBottom: 6, fontFamily: "'Nunito',sans-serif" }}>💬 Gửi phản hồi</div>
            <div style={{ height: 3, background: `linear-gradient(90deg,${HC.orange},${HC.orangeLight})`, borderRadius: 99, marginBottom: 16 }} />
            <div style={{ fontSize: 12, color: HC.muted, marginBottom: 18 }}>Sản phẩm: <b style={{ color: HC.ink2 }}>{feedbackProduct.product_type || '—'}</b></div>
            <Field label="Nội dung phản hồi" required><textarea placeholder="Nhập nội dung phản hồi..." value={feedbackText} onChange={e => setFeedbackText(e.target.value)} style={{ ...inp, minHeight: 110, resize: 'vertical' }} {...focusStyle} autoFocus /></Field>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={handleFeedbackSubmit} disabled={sendingFeedback} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: sendingFeedback ? HC.muted2 : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: sendingFeedback ? 'not-allowed' : 'pointer' }}>{sendingFeedback ? '⟳ Đang gửi...' : '📨 Gửi phản hồi'}</button>
              <button onClick={() => { setFeedbackOpen(false); setFeedbackProduct(null); setFeedbackText(''); }} style={{ padding: '10px 18px', borderRadius: 10, background: HC.cream, color: HC.brown, border: `1.5px solid ${HC.border}`, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteProduct && (
        <div onClick={() => !deletingId && setConfirmDeleteProduct(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1001, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 420, background: HC.surface, borderRadius: 20, padding: 28, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: '1.5px solid #fecaca' }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: HC.ink, marginBottom: 6, fontFamily: "'Nunito',sans-serif" }}>
              🗑 Xác nhận xóa form
            </div>
            <div style={{ height: 3, background: 'linear-gradient(90deg,#dc2626,#fca5a5)', borderRadius: 99, marginBottom: 16 }} />
            <div style={{ fontSize: 13, color: HC.ink2, marginBottom: 12 }}>
              Bạn có chắc muốn xóa form sản phẩm này không?
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca', fontSize: 12, color: HC.danger, marginBottom: 12 }}>
              <div><b>Loại sản phẩm:</b> {confirmDeleteProduct.product_type || '—'}</div>
              <div style={{ marginTop: 4 }}><b>Project:</b> {confirmDeleteProduct.project || '—'}</div>
            </div>
            <div style={{ fontSize: 12, color: HC.brown, marginBottom: 20, padding: '8px 12px', borderRadius: 8, background: HC.orangeLight, border: `1px solid ${HC.border}` }}>
              ⚠️ Form này sẽ bị xóa khỏi tất cả các giao diện (Seller, Admin).
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => handleDelete(confirmDeleteProduct)}
                disabled={!!deletingId}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: deletingId ? HC.muted2 : 'linear-gradient(135deg,#dc2626,#b91c1c)', color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: deletingId ? 'not-allowed' : 'pointer' }}
              >
                {deletingId ? '⟳ Đang xóa...' : '🗑 Xóa form'}
              </button>
              <button
                onClick={() => setConfirmDeleteProduct(null)}
                disabled={!!deletingId}
                style={{ padding: '10px 18px', borderRadius: 10, background: HC.cream, color: HC.brown, border: `1.5px solid ${HC.border}`, fontSize: 13, fontWeight: 700, cursor: deletingId ? 'not-allowed' : 'pointer' }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
      {deadlineModalOpen && deadlineProduct && (
        <div onClick={() => setDeadlineModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 420, background: HC.surface, borderRadius: 20, padding: 28, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}` }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: HC.ink, marginBottom: 6, fontFamily: "'Nunito',sans-serif", display: 'flex', alignItems: 'center', gap: 9 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={HC.orange} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Tạo Deadline Date
            </div>
            <div style={{ height: 3, background: `linear-gradient(90deg,${HC.orange},${HC.orangeLight})`, borderRadius: 99, marginBottom: 16 }} />
            <div style={{ fontSize: 12, color: HC.muted, marginBottom: 18 }}>
              Sản phẩm: <b style={{ color: HC.ink2 }}>{deadlineProduct.product_type || '—'}</b>
            </div>
            <Field label="Chọn ngày deadline" required>
              <input
                type="date"
                value={deadlineDate}
                onChange={e => setDeadlineDate(e.target.value)}
                style={{ ...inp, padding: '10px 12px' }}
                min={new Date().toISOString().split('T')[0]}
                {...focusStyle}
                autoFocus
              />
            </Field>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={handleSetDeadline} disabled={settingDeadline} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: settingDeadline ? HC.muted2 : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: settingDeadline ? 'not-allowed' : 'pointer' }}>
                {settingDeadline ? '⟳ Đang xử lý...' : 'Lưu Deadline'}
              </button>
              <button onClick={() => { setDeadlineModalOpen(false); setDeadlineProduct(null); setDeadlineDate(''); }} style={{ padding: '10px 18px', borderRadius: 10, background: HC.cream, color: HC.brown, border: `1.5px solid ${HC.border}`, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
