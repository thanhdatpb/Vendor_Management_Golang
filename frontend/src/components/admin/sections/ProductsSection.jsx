import React, { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { HC, ITEMS_PER_PAGE } from '../constants';
import { normalizeList, normalizeProduct, getMediaUrls, fmtDate } from '../utils';
import { playNotificationBeep } from '../audio';
import { productApi } from '../../../services/api';
import { subscribeProductChanges } from '../../../services/echo';
import { pushNotif } from '../../../utils/notifUtils';
import { EmptyState, Table, Badge, MediaGallery, Pagination, Spinner } from '../ui';
import ProductViewerModal from '../modals/ProductViewerModal';
import AppToast from '../../shared/AppToast';
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
      console.error('Lỗi tải chi tiết sản phẩm:', err);
      setViewProduct(normalizeProduct(product));
    } finally {
      setLoadingProductId(null);
    }
  }, [loadingProductId]);

  // Thông báo "Yêu cầu duyệt sản phẩm mới" giờ được backend tạo 1 lần duy nhất khi
  // Seller submit (NotificationService trong ProductController::submit). Ở đây chỉ
  // theo dõi form mới để phát âm thanh + hiện toast, không tự tạo thêm thông báo nữa
  // (tránh trùng lặp 2 thông báo cho 1 form request).
  const loadPending = useCallback(() => {
    return productApi.pendingApprovals()
      .then(r => {
        const newPending = normalizeList(r).map(normalizeProduct);
        const oldCount = pendingCountRef.current;

        setPendingProducts(newPending);

        const newlySeen = newPending.filter(p => !notifiedProductIds.current.has(p.id));
        newlySeen.forEach(p => notifiedProductIds.current.add(p.id));

        if (oldCount > 0 && newlySeen.length > 0) {
          playNotificationBeep();
          window.dispatchEvent(new CustomEvent('pendingProductsUpdated', { detail: newPending }));

          const projectNames = [...new Set(newlySeen.map(p => p.project || 'Không xác định'))];
          setToast({
            type: 'new_form',
            title: 'Form mới từ Seller!',
            message: `${newlySeen.length} form mới từ Project: ${projectNames.join(', ')}`,
            duration: 5000
          });
        }

        pendingCountRef.current = newPending.length;
      })
      .catch(err => {
        console.error('Lỗi load pending:', err);
        setPendingProducts([]);
      });
  }, []);

  // 🗑️ XÓA HÀM sendNotificationToStaffB (Admin không cần gửi thông báo duyệt/từ chối nữa)
  // Chỉ giữ lại chức năng approve/reject API

  const handleApprove = async (product) => {
    if (processingId === product.id) return;
    setProcessingId(product.id);

    try {
      await productApi.approve(product.id, { approved: true });

      // Gửi thông báo cho Staff B
      pushNotif('staff_b', {
        type: 'product_approved',
        icon: '',
        title: 'Sản phẩm đã được duyệt',
        message: `Sản phẩm "${product.product_type}" của Seller "${getSellerName(product)}" đã được Admin duyệt. Hãy vào "Products" để gán Vendor.`,
        product_id: product.id,
        productType: product.product_type,
        sellerName: getSellerName(product),
      });

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
    // Real-time qua Pusher — cập nhật ngay khi có thay đổi, không cần F5.
    const unsubscribe = subscribeProductChanges(() => {
      loadPending();
      loadAllProducts();
    });

    // Polling giữ làm lưới an toàn, giãn tần suất vì real-time đã lo phần chính.
    const id = setInterval(() => {
      if (document.hidden) return; // tab không active thì bỏ qua, đỡ tốn CPU server
      loadPending();
      loadAllProducts();
    }, 120000);
    return () => { clearInterval(id); unsubscribe(); };
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
                Đã duyệt: {allProducts.filter(p => p.status === 'approved').length}
              </span>
              <span style={{ padding: '2px 10px', borderRadius: 999, background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b', fontSize: 11, fontWeight: 800 }}>
                Từ chối: {allProducts.filter(p => p.status === 'rejected' || p.status === 'reject').length}
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

      <AppToast toast={toast} onClose={() => setToast(null)} />

      <style>{`
        @keyframes spin360 {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
