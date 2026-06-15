import React, { useState, useEffect } from 'react';
import { HC } from '../constants';
import { fmtDate, getMediaUrls } from '../utils';
import { MediaGallery } from '../ui';

export default function FormHistoryModal({ open, onClose, title, filterType, filterValue, initialStatus = 'all', allProducts }) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (open) {
      setFilterStatus(initialStatus);
    }
  }, [open, initialStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus]);

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
    borderBottom: `2px solid ${HC.border}`
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1000, background: HC.surface, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>
              📋 {title}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              Tổng số: {finalFilteredProducts.length} form requests
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>



        {/* Bảng danh sách */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px 20px' }}>
          {paginatedProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: HC.muted }}>
              <span style={{ fontSize: 48, opacity: 0.5 }}>📭</span>
              <div style={{ marginTop: 12, fontSize: 13 }}>Không có dữ liệu form request</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>STT</th>
                  <th style={thStyle}>Project</th>
                  <th style={thStyle}>Product Type</th>
                  <th style={thStyle}>Hình ảnh</th>
                  <th style={thStyle}>Ngày gửi</th>
                  <th style={thStyle}>Deadline</th>
                  <th style={thStyle}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product, idx) => (
                  <tr key={product.id} style={{ borderBottom: `1px solid ${HC.border}` }} onMouseEnter={e => e.currentTarget.style.background = HC.orangePale} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px', fontSize: 12 }}>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                    <td style={{ padding: '12px', fontSize: 12 }}>{product.project || '—'}</td>
                    <td style={{ padding: '12px', fontSize: 12 }}>{product.product_type || '—'}</td>
                    <td style={{ padding: '12px', fontSize: 12 }}><MediaGallery mediaUrls={getMediaUrls(product)} /></td>
                    <td style={{ padding: '12px', fontSize: 12 }}>{fmtDate(product.created_at)}</td>
                    <td style={{ padding: '12px', fontSize: 12 }}>{fmtDate(product.deadline_date)}</td>
                    <td style={{ padding: '12px', fontSize: 12 }}>{getStatusBadge(product.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Phân trang */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, background: HC.surface, cursor: currentPage === 1 ? 'not-allowed' : 'opacity: 1', opacity: currentPage === 1 ? 0.5 : 1 }}>‹ Trước</button>
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
    </div>
  );
}
