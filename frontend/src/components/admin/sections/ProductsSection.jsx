import React, { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { HC, ITEMS_PER_PAGE } from '../constants';
import { normalizeList, normalizeProduct, getMediaUrls, fmtDate } from '../utils';
import { playNotificationBeep } from '../audio';
import { productApi } from '../../../services/api';
import { EmptyState, Table, Badge, MediaGallery, Pagination, Spinner } from '../ui';
import ProductViewerModal from '../modals/ProductViewerModal';
import RejectModal from '../modals/RejectModal';

export default function ProductsSection({ externalViewProduct, setExternalViewProduct }) {
  const [allProducts, setAllProducts] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewProduct, setViewProduct] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, productId: null, reason: '' });
  const pendingCountRef = useRef(0);
  const [toast, setToast] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);
  const [sellerNamesMap, setSellerNamesMap] = useState({});
  const [loadingProductId, setLoadingProductId] = useState(null);
  const [pendingPage, setPendingPage] = useState(1);
  const [allProductsPage, setAllProductsPage] = useState(1);
  const LS_REJECTED_CACHE = 'ADMIN_REJECTED_CACHE_V1';
  const LS_SELLER_PRODUCTS = 'SELLER_PRODUCTS_V1';
  const notifiedProductIds = useRef(new Set());

  useEffect(() => {
    const loadSellerNames = () => {
      try {
        const saved = localStorage.getItem(LS_SELLER_PRODUCTS);
        if (saved) {
          setSellerNamesMap(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Lỗi load seller names:', e);
      }
    };
    loadSellerNames();
    window.addEventListener('storage', loadSellerNames);
    return () => window.removeEventListener('storage', loadSellerNames);
  }, []);

  const getSellerName = useCallback((product) => {
    if (product.seller_name) return product.seller_name;
    if (product.sellerName) return product.sellerName;
    if (product.user_name) return product.user_name;
    if (product.userName) return product.userName;
    const fromLocal = sellerNamesMap[product.id];
    if (fromLocal) {
      return fromLocal.seller_name || fromLocal.sellerName || '—';
    }
    return '—';
  }, [sellerNamesMap]);

  useEffect(() => {
    if (externalViewProduct) {
      setViewProduct(externalViewProduct);
      if (setExternalViewProduct) {
        setExternalViewProduct(null);
      }
    }
  }, [externalViewProduct, setExternalViewProduct]);

  const loadAllProducts = useCallback(async () => {
    try {
      const res = await productApi.list();
      const all = normalizeList(res).map(normalizeProduct);
      setAllProducts(all);
    } catch (err) {
      console.error('Lỗi tải danh sách:', err);
      setAllProducts([]);
    }
  }, []);

  const handleViewProduct = useCallback(async (product) => {
    if (loadingProductId === product.id) return;
    setLoadingProductId(product.id);
    try {
      const response = await productApi.getById(product.id);
      const fullProduct = response.data?.data || response.data;
      setViewProduct(normalizeProduct(fullProduct));
    } catch (err) {
      console.error('❌ Lỗi tải chi tiết sản phẩm:', err);
      setViewProduct(normalizeProduct(product));
    } finally {
      setLoadingProductId(null);
    }
  }, [loadingProductId]);

  // 🔔 CHỈ TẠO THÔNG BÁO CHO FORM MỚI (KHÔNG BAO GỒM DUYỆT/TỪ CHỐI)
  const createNewFormNotification = useCallback((product) => {
    const projectName = product.project || 'Không xác định';
    const sellerName = getSellerName(product);

    return {
      id: `form_${product.id}_${Date.now()}`,
      type: 'new_form',
      icon: '📋',
      title: `Yêu cầu duyệt sản phẩm mới`,
      message: `Seller "${sellerName}" thuộc Project "${projectName}" vừa gửi form request mới.`,  // ✅ Đã sửa
      product_id: product.id,
      product_type: product.product_type,
      project: projectName,
      seller_name: sellerName,
      timestamp: product.created_at || new Date().toISOString(),
      read: false,
    };
  }, [getSellerName]);

  const loadPending = useCallback(() => {
    return productApi.pendingApprovals()
      .then(r => {
        const newPending = normalizeList(r).map(normalizeProduct);
        const oldCount = pendingCountRef.current;

        setPendingProducts(newPending);

        // 🔔 CHỈ TẠO THÔNG BÁO CHO FORM MỚI (type: 'new_form')
        const existingNotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');

        // Lọc để chỉ giữ lại thông báo type 'new_form' (xóa các loại khác)
        const filteredNotifs = existingNotifs.filter(n => n.type === 'new_form');
        let hasNew = false;

        newPending.forEach(product => {
          const alreadyNotified = filteredNotifs.some(
            n => String(n.product_id) === String(product.id) && n.type === 'new_form'
          );
          if (!alreadyNotified && !notifiedProductIds.current.has(product.id)) {
            notifiedProductIds.current.add(product.id);
            const newNotification = createNewFormNotification(product);
            filteredNotifs.unshift(newNotification);
            hasNew = true;
          }
        });

        if (hasNew) {
          // Chỉ lưu các thông báo type 'new_form'
          localStorage.setItem('STAFF_A_NOTIFICATIONS', JSON.stringify(filteredNotifs.slice(0, 100)));
          window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_A_NOTIFICATIONS' }));
          window.dispatchEvent(new CustomEvent('pendingProductsUpdated', { detail: newPending }));

          // Phát âm thanh khi có form mới
          if (oldCount > 0 && newPending.length > oldCount) {
            playNotificationBeep();
          }

          // Hiển thị toast cho form mới
          if (newPending.length > oldCount) {
            const newCount = newPending.length - oldCount;
            const newestProducts = newPending.slice(0, newCount);
            const projectNames = [...new Set(newestProducts.map(p => p.project || 'Không xác định'))];
            setToast({
              type: 'new_form',
              title: 'Form mới từ Seller!',
              message: `${newCount} form mới từ Project: ${projectNames.join(', ')}`,
              duration: 5000
            });
          }
        }

        pendingCountRef.current = newPending.length;
      })
      .catch(err => {
        console.error('Lỗi load pending:', err);
        setPendingProducts([]);
      });
  }, [createNewFormNotification]);

  // 🗑️ XÓA HÀM sendNotificationToStaffB (Admin không cần gửi thông báo duyệt/từ chối nữa)
  // Chỉ giữ lại chức năng approve/reject API

  const handleApprove = async (product) => {
    if (processingId === product.id) return;
    setProcessingId(product.id);

    try {
      await productApi.approve(product.id, { approved: true });

      // Lưu vào localStorage approved products
      try {
        const approvedProducts = JSON.parse(localStorage.getItem('STAFF_A_APPROVED_PRODUCTS_V1') || '[]');
        const existingIndex = approvedProducts.findIndex(p => p.id === product.id);
        const updatedProduct = { ...product, status: 'approved', approved_at: new Date().toISOString() };
        if (existingIndex >= 0) {
          approvedProducts[existingIndex] = updatedProduct;
        } else {
          approvedProducts.unshift(updatedProduct);
        }
        localStorage.setItem('STAFF_A_APPROVED_PRODUCTS_V1', JSON.stringify(approvedProducts.slice(0, 100)));
      } catch (e) { }

      // Xóa khỏi cache rejected nếu có
      const cache = JSON.parse(localStorage.getItem(LS_REJECTED_CACHE) || '{}');
      if (cache[product.id]) {
        delete cache[product.id];
        localStorage.setItem(LS_REJECTED_CACHE, JSON.stringify(cache));
      }

      // 🆕 Gửi thông báo cho Staff B
      try {
        const staffBNotifications = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
        const newNotif = {
          id: Date.now(),
          type: 'product_approved',
          title: 'Sản phẩm đã được duyệt',
          message: `Sản phẩm "${product.product_type}" của Seller "${getSellerName(product)}" đã được Admin duyệt. Hãy vào "Products" để gán Vendor.`,
          productId: product.id,
          productType: product.product_type,
          sellerName: getSellerName(product),
          timestamp: new Date().toISOString(),
          read: false,
        };
        staffBNotifications.unshift(newNotif);
        localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(staffBNotifications.slice(0, 100)));
        window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS' }));
      } catch (e) {
        console.warn('Không thể gửi thông báo cho Staff B', e);
      }

      // Cập nhật UI
      setPendingProducts(prev => prev.filter(p => p.id !== product.id));
      setAllProducts(prev => {
        const exists = prev.find(p => p.id === product.id);
        if (exists) {
          return prev.map(p => p.id === product.id ? { ...p, status: 'approved' } : p);
        } else {
          return [...prev, { ...product, status: 'approved' }];
        }
      });

      setToast({
        type: 'success',
        title: 'Duyệt thành công!',
        message: `Sản phẩm "${product.product_type}" đã được duyệt`,
        duration: 3000
      });
    } catch (err) {
      console.error('Lỗi duyệt:', err);
      setToast({
        type: 'error',
        title: 'Lỗi duyệt!',
        message: err.response?.data?.message || 'Không thể duyệt sản phẩm',
        duration: 4000
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal.reason.trim()) {
      setToast({
        type: 'warning',
        title: 'Thiếu lý do!',
        message: 'Vui lòng nhập lý do từ chối',
        duration: 3000
      });
      return;
    }

    const product = pendingProducts.find(p => p.id === rejectModal.productId);
    if (!product) return;

    setProcessingId(rejectModal.productId);

    try {
      await productApi.approve(rejectModal.productId, {
        approved: false,
        reason: rejectModal.reason
      });

      try {
        const rejectedProducts = JSON.parse(localStorage.getItem('STAFF_A_REJECTED_PRODUCTS_V1') || '[]');
        rejectedProducts.unshift({ ...product, status: 'rejected', rejected_at: new Date().toISOString(), reason: rejectModal.reason });
        localStorage.setItem('STAFF_A_REJECTED_PRODUCTS_V1', JSON.stringify(rejectedProducts.slice(0, 100)));
      } catch (e) { }

      const cache = JSON.parse(localStorage.getItem(LS_REJECTED_CACHE) || '{}');
      cache[product.id] = { timestamp: Date.now() };
      localStorage.setItem(LS_REJECTED_CACHE, JSON.stringify(cache));

      setPendingProducts(prev => prev.filter(p => p.id !== product.id));
      setAllProducts(prev => {
        const exists = prev.find(p => p.id === product.id);
        if (exists) {
          return prev.map(p => p.id === product.id ? { ...p, status: 'rejected' } : p);
        } else {
          return [...prev, { ...product, status: 'rejected' }];
        }
      });

      setToast({
        type: 'warning',
        title: 'Đã từ chối!',
        message: `Sản phẩm "${product.product_type}" đã bị từ chối`,
        duration: 5000
      });

      setRejectModal({ open: false, productId: null, reason: '' });
    } catch (err) {
      console.error('Lỗi từ chối:', err);
      setToast({
        type: 'error',
        title: 'Lỗi từ chối!',
        message: err.response?.data?.message || 'Không thể từ chối sản phẩm',
        duration: 4000
      });
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    Promise.all([loadPending(), loadAllProducts()]).finally(() => setLoading(false));
  }, [loadPending, loadAllProducts]);

  useEffect(() => {
    const id = setInterval(() => {
      loadPending();
      loadAllProducts();
    }, 15000);
    return () => clearInterval(id);
  }, [loadPending, loadAllProducts]);

  const TABLE_COLS = ['STT', 'Project', 'Seller Name', 'Product Type', 'Hình ảnh', 'Date Request', 'Deadline', 'Trạng thái', 'Thao tác'];

  const viewBtn = (p) => (
    <button
      onClick={() => handleViewProduct(p)}
      disabled={loadingProductId === p.id}
      style={{
        padding: '5px 12px',
        borderRadius: 7,
        border: `1.5px solid ${HC.border}`,
        background: HC.cream,
        cursor: loadingProductId === p.id ? 'wait' : 'pointer',
        fontSize: 11,
        fontWeight: 800,
        color: HC.brown,
        fontFamily: "'Nunito',sans-serif",
        transition: 'all 0.15s',
        opacity: loadingProductId === p.id ? 0.6 : 1
      }}
    >
      {loadingProductId === p.id ? '⏳ Đang tải...' : '👁 Xem'}
    </button>
  );

  const sHdr = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' };
  const h3S = { fontSize: 15, fontWeight: 900, color: HC.ink, margin: 0, fontFamily: "'Nunito',sans-serif" };
  const refreshBtn = fn => (
    <button
      onClick={async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try { await fn(); } finally { setIsRefreshing(false); }
      }}
      disabled={isRefreshing}
      style={{
        marginLeft: 'auto', padding: '5px 14px', borderRadius: 8,
        border: `1.5px solid ${isRefreshing ? HC.orangeMid : HC.border}`,
        background: isRefreshing ? HC.orangeLight : HC.cream,
        color: isRefreshing ? HC.orangeDark : HC.brown,
        fontSize: 11, fontWeight: 800,
        cursor: isRefreshing ? 'not-allowed' : 'pointer',
        fontFamily: "'Nunito',sans-serif",
        transition: 'all 0.2s',
        opacity: isRefreshing ? 0.85 : 1,
        display: 'flex', alignItems: 'center', gap: 5,
      }}
    >
      <span style={{ display: 'inline-block', animation: isRefreshing ? 'spin360 0.7s linear infinite' : 'none' }}>↻</span>
      {isRefreshing ? 'Đang tải...' : 'Làm mới'}
    </button>
  );

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ marginBottom: pendingProducts.length === 0 ? 16 : 32 }}>
        <div style={sHdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⏳</span>
            <h3 style={h3S}>Form Chờ Duyệt Từ Seller</h3>
          </div>
          {pendingProducts.length > 0 && (
            <span style={{
              padding: '4px 14px',
              borderRadius: 999,
              background: HC.orangeLight,
              border: `1.5px solid ${HC.orangeMid}`,
              color: HC.orangeDark,
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "'Nunito',sans-serif"
            }}>
              {pendingProducts.length} form chờ xử lý
            </span>
          )}
          {refreshBtn(async () => { await Promise.all([loadPending(), loadAllProducts()]); })}
        </div>

        {pendingProducts.length === 0 ? (
          <div style={{
            padding: '11px 18px',
            borderRadius: 10,
            background: `linear-gradient(135deg, #f0fdf4, #ecfdf5)`,
            border: `1.5px solid #bbf7d0`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 15 }}>🟢</span>
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#166534',
              fontFamily: "'Nunito Sans',sans-serif",
            }}>
              Tất cả form đã được xử lý — Không có form nào đang chờ duyệt
            </span>
          </div>
        ) : (
          <>
            <Table
              cols={TABLE_COLS}
              rows={pendingProducts
                .slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE)
                .map((p, i) => [
                  (pendingPage - 1) * ITEMS_PER_PAGE + i + 1,
                  p.project || '—',
                  getSellerName(p),
                  p.product_type || p.category || p.name || '—',
                  <MediaGallery mediaUrls={getMediaUrls(p)} />,
                  fmtDate(p.created_at),
                  fmtDate(p.deadline_date),
                  <Badge status="pending" />,
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {viewBtn(p)}
                    <button
                      onClick={() => handleApprove(p)}
                      disabled={processingId === p.id}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 7,
                        border: '1.5px solid #bbf7d0',
                        background: processingId === p.id ? '#d1fae5' : '#ecfdf5',
                        cursor: processingId === p.id ? 'wait' : 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#065f46',
                        fontFamily: "'Nunito',sans-serif",
                        opacity: processingId === p.id ? 0.7 : 1,
                      }}
                    >
                      {processingId === p.id ? '⟳ Đang xử lý...' : '✓ Duyệt'}
                    </button>
                    <button
                      onClick={() => setRejectModal({ open: true, productId: p.id, reason: '' })}
                      disabled={processingId === p.id}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 7,
                        border: '1.5px solid #fecaca',
                        background: processingId === p.id ? '#fee2e2' : '#fef2f2',
                        cursor: processingId === p.id ? 'wait' : 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#991b1b',
                        fontFamily: "'Nunito',sans-serif",
                        opacity: processingId === p.id ? 0.7 : 1,
                      }}
                    >
                      ✕ Từ chối
                    </button>
                  </div>,
                ])}
            />
            <Pagination
              currentPage={pendingPage}
              totalPages={Math.ceil(pendingProducts.length / ITEMS_PER_PAGE)}
              totalItems={pendingProducts.length}
              onPageChange={setPendingPage}
            />
          </>
        )}
      </div>

      <div>
        <div style={sHdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <h3 style={h3S}>Danh Sách Sản Phẩm</h3>
            <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
              <span style={{ padding: '2px 10px', borderRadius: 999, background: '#ecfdf5', border: '1.5px solid #bbf7d0', color: '#065f46', fontSize: 11, fontWeight: 800 }}>
                ✅ Đã duyệt: {allProducts.filter(p => p.status === 'approved').length}
              </span>
              <span style={{ padding: '2px 10px', borderRadius: 999, background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b', fontSize: 11, fontWeight: 800 }}>
                ❌ Từ chối: {allProducts.filter(p => p.status === 'rejected' || p.status === 'reject').length}
              </span>
            </div>
          </div>
        </div>

        {(() => {
          const filteredProducts = allProducts.filter(p => p.status !== 'pending');
          const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
          const pagedProducts = filteredProducts.slice(
            (allProductsPage - 1) * ITEMS_PER_PAGE,
            allProductsPage * ITEMS_PER_PAGE
          );

          return filteredProducts.length === 0 ? (
            <EmptyState msg="Chưa có sản phẩm nào được xử lý" />
          ) : (
            <>
              <Table
                cols={TABLE_COLS}
                rows={pagedProducts.map((p, i) => {
                  const normalizedStatus = p.status === 'reject' ? 'rejected' : p.status;
                  return [
                    (allProductsPage - 1) * ITEMS_PER_PAGE + i + 1,
                    p.project || '—',
                    getSellerName(p),
                    p.product_type || p.category || p.name || '—',
                    <MediaGallery mediaUrls={getMediaUrls(p)} />,
                    fmtDate(p.created_at),
                    fmtDate(p.deadline_date),
                    <Badge status={normalizedStatus} />,
                    viewBtn(p),
                  ];
                })}
              />
              <Pagination
                currentPage={allProductsPage}
                totalPages={totalPages}
                totalItems={filteredProducts.length}
                onPageChange={setAllProductsPage}
              />
            </>
          );
        })()}
      </div>

      <ProductViewerModal product={viewProduct} onClose={() => setViewProduct(null)} />

      <RejectModal
        open={rejectModal.open}
        reason={rejectModal.reason}
        setReason={r => setRejectModal(prev => ({ ...prev, reason: r }))}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectModal({ open: false, productId: null, reason: '' })}
      />

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 2000,
          animation: 'slideIn 0.3s ease-out, fadeOut 0.3s ease-out 4.7s forwards',
          maxWidth: 380,
        }}>
          <div style={{
            background: toast.type === 'success'
              ? `linear-gradient(135deg, ${HC.success}, #15803d)`
              : toast.type === 'error'
                ? `linear-gradient(135deg, ${HC.danger}, #b91c1c)`
                : toast.type === 'warning'
                  ? `linear-gradient(135deg, ${HC.warning}, #d97706)`
                  : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
            color: '#fff',
            borderRadius: 12,
            boxShadow: HC.shadowStrong,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>
                {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : toast.type === 'warning' ? '⚠️' : '📋'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 13, fontFamily: "'Nunito',sans-serif", marginBottom: 2 }}>
                  {toast.title}
                </div>
                <div style={{ fontSize: 11, opacity: 0.9, fontFamily: "'Nunito Sans',sans-serif", lineHeight: 1.4 }}>
                  {toast.message}
                </div>
              </div>
              <button
                onClick={() => setToast(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 4,
                  opacity: 0.7,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{
              height: 3,
              background: 'rgba(255,255,255,0.5)',
              animation: `progressBar ${(toast.duration || 5000) / 1000}s linear forwards`,
              transformOrigin: 'left'
            }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          to { opacity: 0; transform: translateX(100%); }
        }
        @keyframes progressBar {
          from { width: 100%; }
          to { width: 0%; }
        }
        @keyframes spin360 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
