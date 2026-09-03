import React, { useState, useEffect, useCallback } from 'react';
import { HC } from '../constants';
import { fmtDate, getMediaUrls, normalizeProduct } from '../utils';
import { MediaGallery } from '../ui';
import { productApi } from '../../../services/api';
import VendorViewerModal from '../../vendor/components/VendorViewerModal';

const LS_SELLER_PRODUCTS = 'SELLER_PRODUCTS_V1';
const LS_PRODUCT_VENDORS = 'STAFF_PRODUCT_VENDORS_V1';
const LS_VENDOR_LIBRARY = 'STAFF_VENDOR_LIST_V1';

// Đi qua window.localStorage (không dùng biến global trần) để môi trường test
// jsdom lấy đúng storage — Node 22 có global `localStorage` riêng chưa bật, che mất bản của jsdom.
const lsRead = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const parseAssignedVendors = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return []; }
};

const vendorLabel = (v) => (v?.name || v?.vendor_name || v?.['Vendor Name'] || '').toString().trim();

export default function FormHistoryModal({ open, onClose, title, filterType, filterValue, initialStatus = 'all', allProducts, getSellerName }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sellerNamesMap, setSellerNamesMap] = useState({});
  const [productVendors, setProductVendors] = useState({});
  const [libraryVendorNames, setLibraryVendorNames] = useState({});
  const [detailProduct, setDetailProduct] = useState(null);
  const [loadingProductId, setLoadingProductId] = useState(null);
  const itemsPerPage = 10;

  useEffect(() => {
    if (open) {
      setFilterStatus(initialStatus);
    }
  }, [open, initialStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

  // Tên Seller / Vendor lấy từ localStorage (mock DB dùng chung giữa các role) —
  // đồng bộ lại mỗi khi mở modal hoặc khi tab khác ghi dữ liệu mới.
  useEffect(() => {
    if (!open) return;
    const sync = () => {
      setSellerNamesMap(lsRead(LS_SELLER_PRODUCTS, {}));
      setProductVendors(lsRead(LS_PRODUCT_VENDORS, {}));
      const names = {};
      lsRead(LS_VENDOR_LIBRARY, []).forEach(v => {
        const type = (v.product_type || '').toLowerCase();
        const name = vendorLabel(v);
        if (!type || !name) return;
        if (!names[type]) names[type] = [];
        if (!names[type].includes(name)) names[type].push(name);
      });
      setLibraryVendorNames(names);
    };
    sync();
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [open]);

  const sellerNameOf = useCallback((product) => {
    if (getSellerName) return getSellerName(product);
    if (product.seller_name) return product.seller_name;
    if (product.sellerName) return product.sellerName;
    if (product.user_name) return product.user_name;
    if (product.userName) return product.userName;
    const fromLocal = sellerNamesMap[product.id];
    if (fromLocal) return fromLocal.seller_name || fromLocal.sellerName || '—';
    return '—';
  }, [getSellerName, sellerNamesMap]);

  // Mở chi tiết request giống role Vendor: lấy bản đầy đủ từ API để có
  // assigned_vendors / media / thông tin request, fallback bản trong list nếu lỗi.
  const handleOpenDetail = useCallback(async (product) => {
    if (loadingProductId) return;
    setLoadingProductId(product.id);
    try {
      const response = await productApi.getById(product.id);
      const fullProduct = response.data?.data || response.data;
      setDetailProduct(normalizeProduct(fullProduct));
    } catch (err) {
      console.error('Lỗi tải chi tiết sản phẩm:', err);
      setDetailProduct(normalizeProduct(product));
    } finally {
      setLoadingProductId(null);
    }
  }, [loadingProductId]);

  if (!open) return null;

  // Lọc dữ liệu theo filterType
  let filteredProducts = [...allProducts];

  if (filterType === 'status') {
    if (filterValue === 'pending') {
      filteredProducts = filteredProducts.filter(p => p.status === 'pending');
    } else if (filterValue === 'approved') {
      filteredProducts = filteredProducts.filter(p => p.status === 'approved');
    } else if (filterValue === 'rejected') {
      filteredProducts = filteredProducts.filter(p => p.status === 'rejected' || p.status === 'reject');
    }
  } else if (filterType === 'project') {
    filteredProducts = filteredProducts.filter(p => {
      const dbProj = (p.project || '').toLowerCase().trim();
      const uiProj = (filterValue || '').toLowerCase().replace(' project', '');
      return dbProj === uiProj || dbProj === (filterValue || '').toLowerCase();
    });
  }

  // Áp dụng bộ lọc phụ
  let finalFilteredProducts = [...filteredProducts];

  if (filterStatus !== 'all') {
    if (filterStatus === 'pending') {
      finalFilteredProducts = finalFilteredProducts.filter(p => p.status === 'pending');
    } else if (filterStatus === 'approved') {
      finalFilteredProducts = finalFilteredProducts.filter(p => p.status === 'approved');
    } else if (filterStatus === 'rejected') {
      finalFilteredProducts = finalFilteredProducts.filter(p => p.status === 'rejected' || p.status === 'reject');
    }
  }

  // Phân trang
  const totalPages = Math.ceil(finalFilteredProducts.length / itemsPerPage);
  const paginatedProducts = finalFilteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Chỉ hiện cột Trạng thái khi danh sách trộn nhiều trạng thái; khi đã lọc sẵn
  // (Đã duyệt / Chờ duyệt / Từ chối) thì bảng giữ đúng bộ cột như Danh sách sản phẩm.
  const showStatusCol = filterStatus === 'all';

  const getStatusBadge = (status) => {
    const realStatus = status === 'reject' ? 'rejected' : status;
    const colors = {
      pending: { bg: '#fffbeb', text: '#92400e', label: 'Chờ duyệt' },
      approved: { bg: '#ecfdf5', text: '#065f46', label: 'Đã duyệt' },
      rejected: { bg: '#fef2f2', text: '#991b1b', label: 'Từ chối' },
    };
    const c = colors[realStatus] || colors.pending;
    return (
      <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
        {c.label}
      </span>
    );
  };

  const renderVendorCell = (product) => {
    const apiVendors = parseAssignedVendors(product.assigned_vendors);
    const assigned = apiVendors.length > 0 ? apiVendors : (productVendors[product.id] || []);
    const names = [...new Set(assigned.map(vendorLabel).filter(Boolean))];

    if (assigned.length > 0) {
      return (
        <span style={{ fontSize: 12, fontWeight: 700, color: HC.ink }}>
          {names.length > 0 ? names.join(', ') : `${assigned.length} vendor`}
        </span>
      );
    }

    const libraryNames = libraryVendorNames[(product.product_type || '').toLowerCase()] || [];
    if (libraryNames.length > 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: HC.orangeDark }}>{libraryNames.join(', ')}</span>
          <span style={{ fontSize: 10, color: HC.muted, fontStyle: 'italic' }}>📚 Đã có trong thư viện</span>
        </div>
      );
    }

    return <span style={{ color: HC.muted2, fontSize: 12, fontStyle: 'italic' }}>—</span>;
  };

  const thStyle = {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    background: HC.cream,
    padding: '12px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 800,
    color: HC.muted,
    borderBottom: `2px solid ${HC.border}`,
    whiteSpace: 'nowrap',
  };

  const tdStyle = { padding: '12px', fontSize: 12, color: HC.ink2 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1240, background: HC.surface, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Inter',sans-serif" }}>
              📋 {title}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              Tổng số: {finalFilteredProducts.length} form requests · Bấm vào dòng để xem chi tiết
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Bảng danh sách */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px 20px' }}>
          {paginatedProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: HC.muted }}>
              <span style={{ fontSize: 48, opacity: 0.5 }}>📭</span>
              <div style={{ marginTop: 12, fontSize: 13 }}>Không có dữ liệu form request</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={{ ...thStyle, color: HC.orangeDark }}>Project</th>
                  <th style={thStyle}>Nhân sự request</th>
                  <th style={thStyle}>Product Type</th>
                  <th style={thStyle}>Ảnh</th>
                  <th style={thStyle}>Ngày request</th>
                  <th style={thStyle}>Deadline Date</th>
                  <th style={thStyle}>Vendor</th>
                  {showStatusCol && <th style={thStyle}>Trạng thái</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product, idx) => (
                  <tr
                    key={product.id}
                    onClick={() => handleOpenDetail(product)}
                    style={{
                      borderBottom: `1px solid ${HC.border}`,
                      cursor: loadingProductId === product.id ? 'wait' : 'pointer',
                      background: loadingProductId === product.id ? HC.orangeLight : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (loadingProductId !== product.id) e.currentTarget.style.background = HC.orangePale; }}
                    onMouseLeave={e => { if (loadingProductId !== product.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td style={{ ...tdStyle, color: HC.muted, fontWeight: 700 }}>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                    <td style={{ ...tdStyle, fontWeight: 800, color: HC.orangeDark }}>{product.project || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{sellerNameOf(product)}</td>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>{product.product_type || '—'}</td>
                    <td style={tdStyle}><MediaGallery mediaUrls={getMediaUrls(product)} /></td>
                    <td style={tdStyle}>{fmtDate(product.created_at)}</td>
                    <td style={tdStyle}>{fmtDate(product.deadline_date)}</td>
                    <td style={tdStyle}>{renderVendorCell(product)}</td>
                    {showStatusCol && <td style={tdStyle}>{getStatusBadge(product.status)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Phân trang */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, background: HC.surface, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>‹ Trước</button>
              <span style={{ padding: '6px 12px', fontSize: 12, color: HC.muted }}>Trang {currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, background: HC.surface, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>Sau ›</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', background: HC.cream, borderTop: `1px solid ${HC.border}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: 10, background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Đóng</button>
        </div>
      </div>

      {/* Wrapper chặn bubble: click trong modal chi tiết (kể cả nền mờ của nó)
          không được lan ra overlay ngoài làm đóng luôn bảng lịch sử form. */}
      {detailProduct && (
        <div onClick={e => e.stopPropagation()}>
          <VendorViewerModal
            product={detailProduct}
            onClose={() => setDetailProduct(null)}
          />
        </div>
      )}
    </div>
  );
}
