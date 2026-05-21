// ════════════════════════════════════════════════════════════
//  VẬN HÀNH DASHBOARD — TechStore Hub
// ════════════════════════════════════════════════════════════
import { AppstoreOutlined, ShopOutlined, BellOutlined, StarFilled, MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, CalendarOutlined, LeftOutlined, RightOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { productApi, notificationApi, vendorApi } from '../services/api';

const API_BASE_URL = import.meta.env.VITE_API_URL || ""; // "" = dùng Vite proxy → /storage → laravel
// const API_BASE_URL = "http://localhost:8000/api";

const getMediaUrls = (product) => {
  if (!product) return [];
  if (product.media_urls && Array.isArray(product.media_urls) && product.media_urls.length) {
    return product.media_urls.map(url =>
      url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
    );
  }
  if (product.media_path) {
    const full = product.media_path.startsWith('http')
      ? product.media_path
      : `${API_BASE_URL}/storage/${product.media_path.replace(/^\/?storage\//, '')}`;
    return [full];
  }
  if (product.image_url) {
    const full = product.image_url.startsWith('http')
      ? product.image_url
      : `${API_BASE_URL}${product.image_url.startsWith('/') ? '' : '/'}${product.image_url}`;
    return [full];
  }
  return [];
};

const fmtDate = iso => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return iso; }
};
const ITEMS_PER_PAGE = 20;
const VENDOR_PAGE_SIZE = 20;

const LS_PRODUCT_VENDORS = 'STAFF_PRODUCT_VENDORS_V1';
const LS_A_SELECTIONS = 'STAFF_A_SELECTIONS_V1';
const LS_B_SELECTIONS = 'STAFF_B_SELECTIONS_V1';

const HC = {
  orange: '#F5A623', orangeDark: '#E09415', orangeDeep: '#C47F10',
  orangeLight: '#FEF3DC', orangeMid: '#FDE8B8', orangePale: '#FFFBF4',
  orangeGlow: 'rgba(245,166,35,0.15)', cream: '#FFF8EE', brown: '#7A5C32',
  brownLight: '#9C7A50', ink: '#1A0F00', ink2: '#3D2B0F', muted: '#B8956A',
  muted2: '#D4B896', surface: '#FFFFFF', surface2: '#FFFDF9', border: '#F0E4CC',
  borderStrong: '#E8D4A8', success: '#16a34a', danger: '#dc2626', warning: '#f59e0b',
  gold: '#B8860B', goldLight: '#FFF8DC', goldMid: '#FFE97A',
  shadow: '0 10px 30px rgba(245,166,35,0.08)', shadowStrong: '0 20px 50px rgba(245,166,35,0.14)',
};

// ── MENU: Products | Library Vendor ─────────────────────────
const MENU = [
  { id: 'products', icon: <AppstoreOutlined />, label: 'Quản Lý Form Duyệt' },
  { id: 'library', icon: <ShopOutlined />, label: 'Thư Viện Vendor' },
  { id: 'news', icon: <BellOutlined />, label: 'Tạo thông báo' },
];

const PAGE_TITLES = {
  products: 'Product Approval — Quản Lý Form Duyệt',
  library: 'Library Vendor — Thư Viện Vendor',
  news: 'News Management — Tạo Thông Báo',
};
// ══════════════════════════════════════════════════════════
//  NEWS MANAGEMENT SECTION (FIXED - ĐÃ SỬA LỖI)
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  NEWS MANAGEMENT SECTION (FIXED - KHÔNG BỊ NHẢY KHI NHẬP)
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  NEWS MANAGEMENT SECTION (FIXED - KHÔNG NHẢY KHI FOCUS)
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
//  NEWS MANAGEMENT SECTION (FIXED TRIỆT ĐỂ - KHÔNG NHẢY FOCUS)
// ══════════════════════════════════════════════════════════

// Tách modal thành component riêng với React.memo
const NewsModalComponent = React.memo(({
  isOpen,
  editingNews,
  form,
  formErrors,
  submitting,
  onClose,
  onSubmit,
  onFormChange
}) => {
  if (!isOpen) return null;

  // Xử lý change cho từng field
  const handleTitleChange = (e) => {
    onFormChange({ ...form, title: e.target.value });
  };

  const handleMessageChange = (e) => {
    onFormChange({ ...form, message: e.target.value });
  };

  const handleTargetChange = (target) => {
    onFormChange({ ...form, target });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(26,15,0,0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 550,
          maxWidth: '90%',
          maxHeight: '85vh',
          overflowY: 'auto',
          background: HC.surface,
          borderRadius: 20,
          boxShadow: '0 32px 80px rgba(26,15,0,0.28)',
          border: `1.5px solid ${HC.border}`,
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
          borderRadius: '20px 20px 0 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }}>{editingNews ? '✏️' : '📰'}</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>
                {editingNews ? 'Sửa thông báo' : 'Tạo thông báo mới'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                {editingNews ? 'Chỉnh sửa nội dung thông báo' : 'Gửi thông báo đến Admin và Seller'}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              cursor: 'pointer',
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>
          {/* Tiêu đề */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
              Tiêu đề <span style={{ color: HC.danger }}>*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={handleTitleChange}
              placeholder="VD: Thông báo quan trọng..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: `1.5px solid ${formErrors.title ? HC.danger : HC.border}`,
                fontSize: 14,
                color: HC.ink2,
                background: HC.surface2,
                outline: 'none',
                fontFamily: "'Nunito Sans',sans-serif",
              }}
            />
            {formErrors.title && (
              <span style={{ color: HC.danger, fontSize: 11, marginTop: 6, display: 'block' }}>
                ⚠ {formErrors.title}
              </span>
            )}
          </div>

          {/* Nội dung */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
              Nội dung <span style={{ color: HC.danger }}>*</span>
            </label>
            <textarea
              value={form.message}
              onChange={handleMessageChange}
              placeholder="Nhập nội dung thông báo..."
              rows={5}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 10,
                border: `1.5px solid ${formErrors.message ? HC.danger : HC.border}`,
                fontSize: 13,
                color: HC.ink2,
                background: HC.surface2,
                resize: 'vertical',
                outline: 'none',
                fontFamily: "'Nunito Sans',sans-serif",
              }}
            />
            {formErrors.message && (
              <span style={{ color: HC.danger, fontSize: 11, marginTop: 6, display: 'block' }}>
                ⚠ {formErrors.message}
              </span>
            )}
          </div>

          {/* Đối tượng nhận */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 12, display: 'block' }}>
              Đối tượng nhận
            </label>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: 10,
                background: form.target === 'both' ? HC.orangeLight : 'transparent',
                border: `1px solid ${form.target === 'both' ? HC.orange : HC.border}`,
              }}>
                <input
                  type="radio"
                  checked={form.target === 'both'}
                  onChange={() => handleTargetChange('both')}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13 }}>📋 Admin + 👤 Seller</span>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: 10,
                background: form.target === 'admin' ? HC.orangeLight : 'transparent',
                border: `1px solid ${form.target === 'admin' ? HC.orange : HC.border}`,
              }}>
                <input
                  type="radio"
                  checked={form.target === 'admin'}
                  onChange={() => handleTargetChange('admin')}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13 }}>📋 Chỉ Admin</span>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                padding: '8px 16px',
                borderRadius: 10,
                background: form.target === 'seller' ? HC.orangeLight : 'transparent',
                border: `1px solid ${form.target === 'seller' ? HC.orange : HC.border}`,
              }}>
                <input
                  type="radio"
                  checked={form.target === 'seller'}
                  onChange={() => handleTargetChange('seller')}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13 }}>👤 Chỉ Seller</span>
              </label>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: `1.5px solid ${HC.border}`,
          background: HC.cream,
          borderRadius: '0 0 20px 20px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              background: HC.surface,
              border: `1.5px solid ${HC.border}`,
              color: HC.brown,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Hủy
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            style={{
              padding: '10px 28px',
              borderRadius: 10,
              background: submitting ? HC.muted2 : `linear-gradient(135deg, ${HC.success}, #15803d)`,
              color: '#fff',
              border: 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {submitting ? (
              '⟳ Đang xử lý...'
            ) : editingNews ? (
              <>
                <EditOutlined /> Cập nhật
              </>
            ) : (
              <>
                <SendOutlined /> Gửi thông báo
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

function NewsManagementSection() {
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    target: 'both'
  });
  const [formErrors, setFormErrors] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const NEWS_STORAGE_KEY = 'STAFF_B_NEWS_V1';

  const loadNews = useCallback(() => {
    setLoading(true);
    try {
      const saved = localStorage.getItem(NEWS_STORAGE_KEY);
      const news = saved ? JSON.parse(saved) : [];
      news.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setNewsList(news);
    } catch (err) {
      console.error('Lỗi load tin tức:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  const validateForm = () => {
    const errors = {};
    if (!form.title.trim()) errors.title = 'Vui lòng nhập tiêu đề';
    if (!form.message.trim()) errors.message = 'Vui lòng nhập nội dung';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const sendNewsToDashboards = (news) => {
    const notification = {
      id: `news_${news.id}`,
      type: 'news',
      icon: '📰',
      title: news.title,
      message: news.message,
      time: new Date(news.created_at).toLocaleString('vi-VN'),
      read: false,
      timestamp: news.created_at,
      source: 'staff_b'
    };

    if (news.target === 'admin' || news.target === 'both') {
      try {
        // ✅ ĐÚNG: Lưu vào STAFF_B_NOTIFICATIONS_TO_ADMIN để Admin đọc được
        const adminNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS_TO_ADMIN') || '[]');
        adminNotifs.unshift({ ...notification, id: `admin_${news.id}` });
        localStorage.setItem('STAFF_B_NOTIFICATIONS_TO_ADMIN', JSON.stringify(adminNotifs.slice(0, 100)));
        window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS_TO_ADMIN' }));
      } catch (err) { }
    }

    if (news.target === 'seller' || news.target === 'both') {
      try {
        const sellerNotifs = JSON.parse(localStorage.getItem('SELLER_NOTIFICATIONS') || '[]');
        sellerNotifs.unshift({ ...notification, id: `seller_${news.id}` });
        localStorage.setItem('SELLER_NOTIFICATIONS', JSON.stringify(sellerNotifs.slice(0, 100)));
        window.dispatchEvent(new StorageEvent('storage', { key: 'SELLER_NOTIFICATIONS' }));
      } catch (err) { }
    }
  };

  const handleCreateNews = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const newNews = {
        id: Date.now(),
        title: form.title.trim(),
        message: form.message.trim(),
        target: form.target,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_read: false
      };
      const updatedList = [newNews, ...newsList];
      localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(updatedList));
      sendNewsToDashboards(newNews);
      setNewsList(updatedList);
      closeModal();
      setToast({ type: 'success', title: 'Thành công', message: 'Đã tạo thông báo mới' });
      playNotificationSound();
    } catch (err) {
      setToast({ type: 'error', title: 'Lỗi', message: 'Không thể tạo thông báo' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateNews = async () => {
    if (!validateForm() || !editingNews) return;
    setSubmitting(true);
    try {
      const updatedNews = {
        ...editingNews,
        title: form.title.trim(),
        message: form.message.trim(),
        target: form.target,
        updated_at: new Date().toISOString()
      };
      const updatedList = newsList.map(n => n.id === editingNews.id ? updatedNews : n);
      localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(updatedList));
      setNewsList(updatedList);
      closeModal();
      setToast({ type: 'success', title: 'Thành công', message: 'Đã cập nhật thông báo' });
    } catch (err) {
      setToast({ type: 'error', title: 'Lỗi', message: 'Không thể cập nhật thông báo' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNews = async () => {
    if (!deleteConfirm) return;
    try {
      const updatedList = newsList.filter(n => n.id !== deleteConfirm.id);
      localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(updatedList));
      setNewsList(updatedList);
      setDeleteConfirm(null);
      setToast({ type: 'success', title: 'Thành công', message: 'Đã xóa thông báo' });
    } catch (err) {
      setToast({ type: 'error', title: 'Lỗi', message: 'Không thể xóa thông báo' });
    }
  };

  const resetForm = () => {
    setForm({ title: '', message: '', target: 'both' });
    setFormErrors({});
  };

  const openCreateModal = () => {
    resetForm();
    setEditingNews(null);
    setShowModal(true);
  };

  const openEditModal = (news) => {
    setEditingNews(news);
    setForm({
      title: news.title,
      message: news.message,
      target: news.target || 'both'
    });
    setFormErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
    setEditingNews(null);
  };

  // Hàm xử lý thay đổi form - KHÔNG gây re-render toàn bộ modal
  const handleFormChange = useCallback((newForm) => {
    setForm(newForm);
    // Xóa lỗi tương ứng nếu có
    if (formErrors.title && newForm.title.trim()) {
      setFormErrors(prev => ({ ...prev, title: null }));
    }
    if (formErrors.message && newForm.message.trim()) {
      setFormErrors(prev => ({ ...prev, message: null }));
    }
  }, [formErrors.title, formErrors.message]);

  const getTargetLabel = (target) => {
    switch (target) {
      case 'admin': return '📋 Admin';
      case 'seller': return '👤 Seller';
      case 'both': return '📋👤 Cả hai';
      default: return '—';
    }
  };

  const getTargetColor = (target) => {
    switch (target) {
      case 'admin': return '#3b82f6';
      case 'seller': return '#16a34a';
      case 'both': return '#f59e0b';
      default: return HC.muted;
    }
  };

  // Bảng danh sách thông báo
  const NewsTable = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const totalPages = Math.ceil(newsList.length / itemsPerPage);
    const pagedNews = newsList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
      <div style={{ overflowX: 'auto', borderRadius: 14, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, background: HC.surface }}>
          <thead>
            <tr style={{ background: HC.cream }}>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 60, color: HC.brown, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', borderBottom: `1.5px solid ${HC.border}` }}>STT</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', color: HC.brown, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', borderBottom: `1.5px solid ${HC.border}` }}>Tiêu đề</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', color: HC.brown, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', borderBottom: `1.5px solid ${HC.border}` }}>Nội dung</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 100, color: HC.brown, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', borderBottom: `1.5px solid ${HC.border}` }}>Đối tượng</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 140, color: HC.brown, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', borderBottom: `1.5px solid ${HC.border}` }}>Ngày tạo</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 100, color: HC.brown, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', borderBottom: `1.5px solid ${HC.border}` }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pagedNews.map((news, idx) => (
              <tr key={news.id} style={{ borderBottom: `1px solid ${HC.border}` }} onMouseEnter={e => e.currentTarget.style.background = HC.orangePale} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 14px', textAlign: 'center', color: HC.muted, fontWeight: 700 }}>
                  {(currentPage - 1) * itemsPerPage + idx + 1}
                </td>
                <td style={{ padding: '12px 14px', fontWeight: 800, color: HC.ink2 }}>{news.title}</td>
                <td style={{ padding: '12px 14px', color: HC.ink2, maxWidth: 400, wordBreak: 'break-word' }}>{news.message}</td>
                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                  <span style={{
                    padding: '4px 12px',
                    borderRadius: 20,
                    background: `${getTargetColor(news.target)}20`,
                    color: getTargetColor(news.target),
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-block'
                  }}>
                    {getTargetLabel(news.target)}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 11, color: HC.muted }}>
                  {new Date(news.created_at).toLocaleString('vi-VN')}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button
                      onClick={() => openEditModal(news)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 7,
                        border: `1.5px solid ${HC.orangeMid}`,
                        background: HC.orangeLight,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                        color: HC.orangeDark,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <EditOutlined /> Sửa
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(news)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 7,
                        border: '1.5px solid #fecaca',
                        background: '#fef2f2',
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                        color: HC.danger,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <DeleteOutlined /> Xóa
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: `1.5px solid ${HC.border}`, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={newsList.length}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 2000,
          animation: 'slideInRight 0.3s ease-out, fadeOut 0.3s ease-out 2.7s forwards',
        }}>
          <div style={{
            background: toast.type === 'success' ? `linear-gradient(135deg, ${HC.success}, #15803d)` : `linear-gradient(135deg, ${HC.danger}, #b91c1c)`,
            borderRadius: 12,
            padding: '12px 20px',
            color: '#fff',
            boxShadow: HC.shadowStrong,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{toast.type === 'success' ? '✅' : '❌'}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{toast.title}</div>
                <div style={{ fontSize: 11, opacity: 0.9 }}>{toast.message}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: HC.ink, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellOutlined style={{ color: HC.orange }} />
            Quản lý thông báo
          </h3>
          <p style={{ fontSize: 12, color: HC.muted, marginTop: 4 }}>Tạo thông báo gửi đến Admin và Seller</p>
        </div>
        <button
          onClick={openCreateModal}
          style={{
            padding: '10px 20px',
            borderRadius: 10,
            background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
            color: '#fff',
            border: 'none',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: `0 2px 8px ${HC.orangeGlow}`
          }}
        >
          <PlusOutlined /> Tạo thông báo mới
        </button>
      </div>

      {/* Danh sách thông báo */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ fontWeight: 900, fontSize: 14, color: HC.ink }}>Danh sách thông báo đã tạo</span>
          <span style={{
            padding: '2px 10px',
            borderRadius: 20,
            background: HC.orangeLight,
            color: HC.orangeDark,
            fontSize: 11,
            fontWeight: 700
          }}>
            {newsList.length} thông báo
          </span>
        </div>

        {loading ? (
          <Spinner />
        ) : newsList.length === 0 ? (
          <EmptyState msg="Chưa có thông báo nào. Hãy tạo thông báo mới!" />
        ) : (
          <NewsTable />
        )}
      </div>

      {/* Modal Tạo/Sửa thông báo - SỬ DỤNG COMPONENT RIÊNG VỚI REACT.MEMO */}
      <NewsModalComponent
        isOpen={showModal}
        editingNews={editingNews}
        form={form}
        formErrors={formErrors}
        submitting={submitting}
        onClose={closeModal}
        onSubmit={editingNews ? handleUpdateNews : handleCreateNews}
        onFormChange={handleFormChange}
      />

      {/* Modal xác nhận xóa */}
      {deleteConfirm && (
        <div
          onClick={() => setDeleteConfirm(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 400,
              background: '#fff',
              borderRadius: 20,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '20px', textAlign: 'center',
              background: 'linear-gradient(135deg, #fef2f2, #fff)',
              borderBottom: '1px solid #fecaca'
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: '#fee2e2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', fontSize: 28
              }}>⚠️</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#dc2626' }}>Xóa thông báo</h3>
              <p style={{ fontSize: 12, color: '#7a5c32', marginTop: 6 }}>Hành động không thể hoàn tác</p>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{
                background: '#fef3dc', borderRadius: 12, padding: '14px',
                textAlign: 'center', marginBottom: 20
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#e09415' }}>
                  {deleteConfirm.title}
                </div>
                <div style={{ fontSize: 11, color: '#9c7a50', marginTop: 4 }}>
                  {deleteConfirm.message.length > 80
                    ? deleteConfirm.message.substring(0, 80) + '...'
                    : deleteConfirm.message}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    border: '1px solid #e8d4a8', background: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteNews}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    border: 'none', background: '#dc2626', color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          to { opacity: 0; transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
function HCLogo({ size = 32, color = '#F5A623' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <path d="M168 44 A88 88 0 1 0 168 156" stroke={color} strokeWidth="20" strokeLinecap="round" fill="none" />
      <path d="M118 128 Q130 142 145 132" stroke={color} strokeWidth="18" strokeLinecap="round" fill="none" />
    </svg>
  );
}

const EMPTY_FORM = {
  deadline_date: '', product_type: '', media: null, product_type_link: '',
  other_specs: '', material: '', print_area: '', good_review: '', bad_review: '',
  packaging_links: '', other_packaging: '',
};

const lsGet = (key, fallback) => { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; } };
const lsSet = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch { } };

function Spinner() {
  return <div style={{ textAlign: 'center', padding: 60, color: HC.muted, fontSize: 13, fontFamily: "'Nunito Sans',sans-serif" }}><HCLogo size={36} color={HC.orange} /><div style={{ marginTop: 10 }}>Đang tải...</div></div>;
}
function EmptyState({ msg = 'Không có dữ liệu' }) {
  return <div style={{ textAlign: 'center', padding: 60, color: HC.muted, fontSize: 13, fontFamily: "'Nunito Sans',sans-serif" }}><HCLogo size={40} color={HC.orangeMid} /><div style={{ marginTop: 12 }}>{msg}</div></div>;
}
function Field({ label, hint, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10, fontWeight: 800, color: HC.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Nunito',sans-serif" }}>
        {label}{required && <span style={{ color: HC.danger, marginLeft: 2 }}>*</span>}
        {hint && <span style={{ color: HC.muted2, fontWeight: 500, marginLeft: 5, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}
const inp = {
  padding: '9px 12px',
  borderRadius: 9,
  border: `1.5px solid ${HC.border}`,
  fontSize: 13,
  color: HC.ink2,
  background: HC.surface2,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: "'Nunito Sans',sans-serif",
  transition: 'border-color 0.2s,box-shadow 0.2s'
};
const focusStyle = {
  onFocus: e => {
    e.target.style.borderColor = HC.orange;
    e.target.style.boxShadow = `0 0 0 3px ${HC.orangeGlow}`;
  },
  onBlur: e => {
    e.target.style.borderColor = HC.border;
    e.target.style.boxShadow = 'none';
  }
};
function Pagination({ currentPage, totalPages, totalItems, onPageChange }) {
  if (totalPages <= 1) return null;
  const from = (currentPage - 1) * 10 + 1, to = Math.min(currentPage * 10, totalItems);
  const pages = []; const push = n => { if (!pages.includes(n)) pages.push(n); };
  push(1); if (currentPage > 3) pages.push('...');
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) push(i);
  if (currentPage < totalPages - 2) pages.push('...');
  if (totalPages > 1) push(totalPages);
  const btn = (ex = {}) => ({ minWidth: 32, height: 32, borderRadius: 8, border: `1.5px solid ${HC.border}`, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', fontFamily: "'Nunito',sans-serif", ...ex });
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14, padding: '10px 16px', background: HC.surface, borderRadius: 12, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow }}>
      <div style={{ fontSize: 12, color: HC.muted, fontWeight: 600, fontFamily: "'Nunito Sans',sans-serif" }}>Hiển thị <b style={{ color: HC.ink }}>{from}–{to}</b> / <b style={{ color: HC.ink }}>{totalItems}</b></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} style={btn({ background: HC.cream, color: HC.muted2, opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' })}>‹</button>
        {pages.map((p, i) => p === '...' ? <span key={`g${i}`} style={{ fontSize: 12, color: HC.muted2 }}>…</span> : <button key={p} onClick={() => onPageChange(p)} style={btn({ background: currentPage === p ? HC.orange : HC.surface, color: currentPage === p ? '#fff' : HC.ink2, border: `1.5px solid ${currentPage === p ? HC.orange : HC.border}`, fontWeight: currentPage === p ? 900 : 700 })}>{p}</button>)}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} style={btn({ background: HC.cream, color: HC.muted2, opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' })}>›</button>
      </div>
    </div>
  );
}

const STATUS_CFG = { draft: { bg: HC.orangeLight, text: HC.brown, dot: HC.muted, label: 'Draft' }, pending: { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b', label: 'Pending' }, approved: { bg: '#ecfdf5', text: '#065f46', dot: '#16a34a', label: 'Approved' }, reject: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626', label: 'Rejected' } };
function Badge({ status }) {
  const c = STATUS_CFG[status] || { bg: HC.orangeLight, text: HC.brown, dot: HC.muted2, label: status };
  return <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${HC.border}`, fontFamily: "'Nunito',sans-serif" }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />{c.label}</span>;
}

// ── Best Seller badge ─────────────────────────────────────
function BestSellerBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 999,
      background: 'linear-gradient(135deg,#FFF8DC,#FFE97A)',
      border: '1.5px solid #D4A017',
      color: HC.gold, fontSize: 10, fontWeight: 900,
      fontFamily: "'Nunito',sans-serif", letterSpacing: '0.04em',
    }}>
      ⭐ Best Seller
    </span>
  );
}

const playNotificationSound = () => {
  try {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,U3RlYW0gRW5jb2RlciB2ZXJzaW9uIDENCkZpbGUgc291cmNlOiBodHRwOi8vY29tbWVudC5zc28ub3JnL3BsYXlzb3VuZC8NCkJpdHJhdGU6IDExMDI1DQpDaGFubmVsczogMQ0KU2FtcGxlcyA6IDEwMDAwDQpEYXRhIA0A';
    audio.volume = 0.4;
    audio.play().catch(e => console.log('Audio play failed:', e));
  } catch (e) { console.log('Cannot play sound:', e); }
};

const normalizeVendorType = (value) => {
  const val = (value || '').toString().trim().toLowerCase();
  if (val === 'old') return 'Old';
  if (val === 'new') return 'New';
  if (val === 'bestseller' || val === 'best seller' || val === 'best' || val === 'bs') return 'Best Seller';
  return value;
};

const VENDOR_TYPES = ['Old', 'New', 'Best Seller'];

// ── Price Comparison Matrix ─────────────────────────────────
function PriceComparisonMatrix({ vendors, productType }) {
  if (!vendors || vendors.length === 0) return null;

  const fmt = (v) => (v != null && v !== '') ? `$${Number(v).toFixed(2)}` : '—';

  const criteria = [
    { key: 'base_price', label: 'Giá Phôi', format: fmt, best: 'min' },
    { key: 'printing_price', label: 'Giá In', format: fmt, best: 'min' },
    { key: 'total_price', label: 'Tổng Cộng', format: (v, item) => fmt(Number(item.base_price || 0) + Number(item.printing_price || 0)), best: 'min' },
    { key: 'lead_time', label: 'Sản xuất', format: (v) => v ? `${v} ngày` : '—', best: 'min' },
    { key: 'min_order_qty', label: 'MOQ', format: (v) => v || '—', best: 'min' },
    { key: 'rating', label: 'Đánh giá', format: (v) => v ? `⭐ ${v}/5` : '—', best: 'max' },
  ];

  return (
    <div style={{ width: '100%', overflowX: 'auto', background: '#fff', borderRadius: 12, border: `1.5px solid ${HC.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Nunito Sans',sans-serif" }}>
        <thead>
          <tr style={{ background: HC.ink, color: '#fff' }}>
            <th style={{ padding: '15px 20px', textAlign: 'left', borderBottom: `2px solid ${HC.orange}`, width: 150 }}>Tiêu chí</th>
            {vendors.map((v, i) => (
              <th key={i} style={{ padding: '15px 20px', textAlign: 'center', borderBottom: `2px solid ${HC.orange}`, minWidth: 160 }}>
                <div style={{ color: HC.orange, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Vendor #{i + 1}</div>
                <div style={{ fontWeight: 800 }}>{v.name || v.vendor_type}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, idx) => {
            let bestVal = null;
            if (c.best) {
              const values = vendors.map(v => {
                if (c.key === 'total_price') return Number(v.base_price || 0) + Number(v.printing_price || 0);
                return Number(v[c.key] || 0);
              }).filter(v => v > 0);
              if (values.length > 0) {
                bestVal = c.best === 'min' ? Math.min(...values) : Math.max(...values);
              }
            }

            return (
              <tr key={c.key} style={{ background: idx % 2 === 0 ? '#fff' : HC.surface }}>
                <td style={{ padding: '12px 20px', fontWeight: 700, color: HC.muted, borderBottom: `1px solid ${HC.border}` }}>{c.label}</td>
                {vendors.map((v, i) => {
                  const rawVal = c.key === 'total_price' ? (Number(v.base_price || 0) + Number(v.printing_price || 0)) : Number(v[c.key] || 0);
                  const isBest = bestVal !== null && rawVal === bestVal && rawVal > 0;

                  return (
                    <td key={i} style={{ padding: '12px 20px', textAlign: 'center', borderBottom: `1px solid ${HC.border}`, color: isBest ? HC.success : HC.ink, fontWeight: isBest ? 800 : 400, background: isBest ? 'rgba(34,197,94,0.08)' : 'transparent' }}>
                      {c.format(v[c.key], v)}
                      {isBest && <div style={{ fontSize: 9, marginTop: 2, color: HC.success }}>Tối ưu nhất</div>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function VendorViewerModal({ product, onClose }) {
  const LS_A_FEEDBACK_RESPONSE = 'STAFF_A_FEEDBACK_RESPONSE_V1';
  const [vendors, setVendors] = useState(() => lsGet(LS_PRODUCT_VENDORS, {})[product?.id] || []);
  const [bSelections, setBSelections] = useState(() => lsGet(LS_B_SELECTIONS, {})[product?.id] || {});
  const [bFeedbacks, setBFeedbacks] = useState(() => lsGet('STAFF_B_FEEDBACKS_V1', {})[product?.id] || {});
  const [bSubmittedFeedbacks, setBSubmittedFeedbacks] = useState(() => lsGet('STAFF_B_SUBMITTED_FEEDBACK_V1', {})[product?.id] || {});
  const [aResponseFeedbacks, setAResponseFeedbacks] = useState(() => {
    const all = lsGet(LS_A_FEEDBACK_RESPONSE, {});
    return all[product?.id] || {};
  });
  const [sampleDecisions, setSampleDecisions] = useState(() => {
    try { const raw = localStorage.getItem('STAFF_SAMPLE_DECISIONS_V1'); const all = raw ? JSON.parse(raw) : {}; return all[product?.id] || {}; } catch { return {}; }
  });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showMatrix, setShowMatrix] = useState(false);
  const isMountedRef = useRef(true);

  // Local state cho từng feedback text (không auto‑save)
  const [feedbackTexts, setFeedbackTexts] = useState(() => {
    const initial = {};
    vendors.forEach((v, i) => {
      const key = v.id ? String(v.id) : `idx_${i}`;
      initial[key] = bFeedbacks[key]?.feedback || '';
    });
    return initial;
  });

  useEffect(() => {
    isMountedRef.current = true;
    const sync = () => {
      if (!isMountedRef.current) return;
      const allVendors = lsGet(LS_PRODUCT_VENDORS, {})[product?.id] || [];
      const decisions = (() => { try { const raw = localStorage.getItem('STAFF_SAMPLE_DECISIONS_V1'); const all = raw ? JSON.parse(raw) : {}; return all[product?.id] || {}; } catch { return {}; } })();
      const approvedKeys = Object.entries(decisions).filter(([_, d]) => d.decision === 'dat').map(([key]) => key);
      const allResponses = lsGet(LS_A_FEEDBACK_RESPONSE, {});

      if (approvedKeys.length > 0) {
        setVendors(allVendors.filter((v, i) => { const key = v.id ? String(v.id) : `idx_${i}`; return approvedKeys.includes(key); }));
      } else { setVendors(allVendors); }
      setBSelections(lsGet(LS_B_SELECTIONS, {})[product?.id] || {});
      setBFeedbacks(lsGet('STAFF_B_FEEDBACKS_V1', {})[product?.id] || {});
      setBSubmittedFeedbacks(lsGet('STAFF_B_SUBMITTED_FEEDBACK_V1', {})[product?.id] || {});
      setAResponseFeedbacks(allResponses[product?.id] || {});
      setSampleDecisions(decisions);
    };
    sync();
    window.addEventListener('storage', sync);
    const id = setInterval(sync, 4000);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('storage', sync);
      clearInterval(id);
    };
  }, [product?.id]);

  if (!product) return null;
  const vendorKey = (v, i) => v.id ? String(v.id) : `idx_${i}`;

  const toggleBCheck = useCallback((key) => {
    setBSelections(prev => {
      const currentChecked = prev[key]?.checked;
      const n = { ...prev, [key]: { ...prev[key], checked: !currentChecked } };
      const all = lsGet(LS_B_SELECTIONS, {});
      if (!all[product.id]) all[product.id] = {};
      all[product.id] = n;
      lsSet(LS_B_SELECTIONS, all);
      requestAnimationFrame(() => {
        window.dispatchEvent(new StorageEvent('storage', { key: LS_B_SELECTIONS }));
      });
      return n;
    });
  }, [product.id]);

  const submitBFeedback = useCallback(async (key, feedbackText) => {
    if (!feedbackText) { alert('Vui lòng nhập phản hồi trước khi gửi'); return; }
    const allSubmitted = lsGet('STAFF_B_SUBMITTED_FEEDBACK_V1', {});
    if (!allSubmitted[product.id]) allSubmitted[product.id] = {};
    allSubmitted[product.id][key] = {
      feedback: feedbackText,
      submittedAt: new Date().toISOString(),
      vendorKey: key,
      staff_b_approved: true
    };
    lsSet('STAFF_B_SUBMITTED_FEEDBACK_V1', allSubmitted);
    setBSubmittedFeedbacks(prev => ({ ...prev, [key]: allSubmitted[product.id][key] }));
    const allFeedbacks = lsGet('STAFF_B_FEEDBACKS_V1', {});
    if (!allFeedbacks[product.id]) allFeedbacks[product.id] = {};
    allFeedbacks[product.id][key] = { feedback: feedbackText };
    lsSet('STAFF_B_FEEDBACKS_V1', allFeedbacks);
    setBFeedbacks(prev => ({ ...prev, [key]: { feedback: feedbackText } }));
    // Gửi thông báo cho Staff A
    try {
      const v = vendors.find((v, i) => vendorKey(v, i) === key);
      const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      staffANotifs.unshift({
        id: Date.now(),
        type: 'feedback_from_b',
        icon: '💬',
        title: '💬 Phản hồi mới về Vendor',
        message: `Bộ phận Vận hành đã gửi phản hồi về vendor "${v?.vendor_type || '—'}" cho sản phẩm "${product.product_type}".`,
        time: new Date().toLocaleString('vi-VN'),
        is_read: false,
        productId: product.id,
        vendorKey: key
      });
      localStorage.setItem('STAFF_A_NOTIFICATIONS', JSON.stringify(staffANotifs.slice(0, 100)));
      window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_A_NOTIFICATIONS' }));
    } catch (err) { console.error('Lỗi gửi thông báo A:', err); }

    alert('✅ Đã gửi phản hồi đến Staff A!');
  }, [product.id, product.product_type, vendors]);

  const fmt = n => (n != null && n !== '') ? `$${Number(n).toFixed(2)}` : '—';
  const bSelectedCount = Object.values(bSelections).filter(s => s?.checked).length;

  const mediaUrls = getMediaUrls(product);
  const mediaSrc = mediaUrls.length > 0 ? mediaUrls[0] : null;
  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

  const productRows = [
    { label: 'Date Request', value: fmtDate(product.created_at), color: HC.ink2 },
    { label: 'Deadline', value: fmtDate(product.deadline_date), color: HC.danger, bold: true },
    { label: 'Product Type', value: product.product_type, color: HC.orangeDark, bold: true },
    { label: 'Đặc tính KT', value: product.other_specs, color: HC.ink2 },
    { label: 'Chất liệu', value: product.material, color: HC.ink2 },
    { label: 'Vùng In', value: product.print_area, color: HC.ink2 },
    { label: 'Good Review', value: product.good_review, color: HC.success },
    { label: 'Bad Review', value: product.bad_review, color: HC.danger },
    { label: 'Packing', value: product.packaging_links, color: HC.ink2 },
    { label: 'Other Packing', value: product.other_packaging, color: HC.ink2 },
    { label: 'Link', value: product.product_type_link, color: HC.orange },
    { label: 'Status', value: product.status || 'draft', color: HC.brown, bold: true },
  ];

  const InfoRow = ({ label, value, valueColor, valueBold, idx, isLast }) => (
    <div style={{ display: 'flex', gap: 8, padding: '7px 12px', borderBottom: isLast ? 'none' : `1px solid ${HC.border}`, background: idx % 2 === 0 ? HC.surface : HC.surface2, minHeight: 34 }}>
      <span style={{ minWidth: 108, flexShrink: 0, fontWeight: 800, color: HC.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2, fontFamily: "'Nunito',sans-serif", lineHeight: 1.4 }}>{label}</span>
      <span style={{ color: valueColor || HC.ink2, fontWeight: valueBold ? 700 : 400, flex: 1, wordBreak: 'break-word', fontFamily: "'Nunito Sans',sans-serif", fontSize: 12, lineHeight: 1.4 }}>{value || '—'}</span>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, backdropFilter: 'blur(3px)', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1400, height: '92vh', background: HC.orangePale, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.28)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ padding: '13px 20px', background: HC.ink, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 4, height: 22, borderRadius: 99, background: `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Chi tiết sản phẩm</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'Nunito Sans',sans-serif", marginTop: 1 }}>
                {product.product_type || `#${product.id}`}
                {vendors.length > 0 && <span style={{ marginLeft: 10, padding: '1px 8px', borderRadius: 999, background: 'rgba(245,166,35,0.2)', color: HC.orange, fontSize: 10, fontWeight: 800 }}>{vendors.length} vendor</span>}
              </div>
            </div>
            {bSelectedCount > 0 && <span style={{ padding: '3px 12px', borderRadius: 999, background: 'rgba(245,166,35,0.25)', border: '1px solid rgba(245,166,35,0.5)', color: HC.orange, fontSize: 11, fontWeight: 800 }}>✓ Vận hành đã chọn {bSelectedCount}</span>}
            <button onClick={() => setShowMatrix(!showMatrix)} style={{ padding: '6px 14px', borderRadius: 8, background: showMatrix ? HC.orange : 'rgba(255,255,255,0.1)', border: `1px solid ${showMatrix ? HC.orange : 'rgba(255,255,255,0.2)'}`, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {showMatrix ? '📋 Xem danh sách' : '📊 So sánh Matrix'}
            </button>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>✕</button>
          </div>

          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* LEFT COLUMN: Image & Product Info (giữ nguyên) */}
            <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1.5px solid ${HC.border}`, overflow: 'hidden', background: HC.surface }}>
              <div style={{ height: 220, background: '#2a1a00', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: mediaUrls.length > 0 ? 'pointer' : 'default' }} onClick={() => { if (mediaUrls.length > 0) { setLightboxIndex(0); setLightboxOpen(true); } }}>
                {mediaSrc ? (isVideo(mediaSrc) ? <video src={mediaSrc} style={{ height: '100%', width: '100%', objectFit: 'cover' }} /> : <img src={mediaSrc} alt="" style={{ height: '100%', width: '100%', objectFit: 'contain' }} />) : (
                  <div style={{ color: HC.muted2, textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 8 }}>📷</div><div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif" }}>Không có ảnh</div></div>
                )}
                {mediaUrls.length > 1 && <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.7)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: '#fff', fontWeight: 700 }}>{mediaUrls.length} ảnh</div>}
              </div>
              {mediaUrls.length > 1 && (
                <div style={{ display: 'flex', gap: 8, padding: '10px', overflowX: 'auto', background: '#1f1400', borderTop: `1px solid ${HC.border}` }}>
                  {mediaUrls.map((url, idx) => (
                    <div key={idx} onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }} style={{ width: 55, height: 55, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${idx === lightboxIndex ? HC.orange : 'transparent'}`, flexShrink: 0, transition: 'all 0.2s' }}>
                      {isVideo(url) ? <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ flex: 1, overflowY: 'auto' }}>
                <div style={{ padding: '10px 14px', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, display: 'flex', alignItems: 'center', gap: 7, position: 'sticky', top: 0, zIndex: 1 }}>
                  <span style={{ fontSize: 14 }}>📦</span>
                  <div style={{ fontWeight: 900, fontSize: 10, color: '#fff', fontFamily: "'Nunito',sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em' }}>Thông tin sản phẩm</div>
                </div>
                {productRows.map((r, idx) => <InfoRow key={r.label} label={r.label} value={r.value} valueColor={r.color} valueBold={r.bold} idx={idx} isLast={idx === productRows.length - 1} />)}
              </div>
            </div>

            {/* RIGHT COLUMN: VENDORS LIST */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
              <div style={{ padding: '12px 20px', background: `linear-gradient(135deg,${HC.orangeDark},${HC.orangeDeep})`, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>🏪</span>
                  <div><div style={{ fontWeight: 900, fontSize: 12, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Danh sách nhà phân phối đã gán</div><div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>Chọn nhà cung cấp và gửi phản hồi đến bộ phận Kinh doanh</div></div>
                </div>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                {showMatrix ? (
                  <div style={{ paddingBottom: 40 }}>
                    <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: 13, color: HC.brown, fontWeight: 700 }}>📊 Bảng so sánh chỉ số giữa các Vendor ({product.product_type})</div>
                      <div style={{ fontSize: 11, color: HC.muted2 }}>Tự động highlight các giá trị tối ưu nhất</div>
                    </div>
                    <PriceComparisonMatrix vendors={vendors} productType={product.product_type} />
                  </div>
                ) : (
                  vendors.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 60, background: HC.surface, borderRadius: 16, border: `1.5px dashed ${HC.border}` }}>
                      <div style={{ fontSize: 48, marginBottom: 16 }}>🏪</div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: HC.brown }}>Chưa có nhà cung cấp nào được gán</div>
                      <div style={{ fontSize: 12, color: HC.muted2, marginTop: 6 }}>Vào Products → nhấn "Tìm Vendor" để gán vendor cho sản phẩm này</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {vendors.map((v, i) => {
                        const key = vendorKey(v, i);
                        const bSel = bSelections[key];
                        const bChecked = !!bSel?.checked;
                        const bSubmitted = bSubmittedFeedbacks[key];
                        const aResponse = aResponseFeedbacks[key];
                        const currentFeedback = feedbackTexts[key] || '';

                        return (
                          <div key={key} style={{ background: bChecked ? '#ecfdf5' : HC.surface, borderRadius: 16, border: `1.5px solid ${bChecked ? '#bbf7d0' : HC.border}`, overflow: 'hidden', transition: 'all 0.2s ease', boxShadow: bChecked ? '0 4px 12px rgba(22,163,74,0.1)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
                            {/* Vendor Header */}
                            <div style={{ padding: '14px 20px', background: bChecked ? '#ecfdf5' : HC.cream, borderBottom: `1px solid ${bChecked ? '#bbf7d0' : HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <button onClick={() => toggleBCheck(key)} style={{ width: 28, height: 28, borderRadius: 8, background: bChecked ? HC.success : 'transparent', border: `2px solid ${bChecked ? HC.success : HC.muted2}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                    {bChecked && <span style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>✓</span>}
                                  </button>
                                  <span style={{ fontWeight: 800, fontSize: 13, color: HC.muted }}>#{i + 1}</span>
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                    {v.name && v.name !== v.vendor_type && <span style={{ fontWeight: 700, fontSize: 14, color: HC.ink }}>{v.name}</span>}
                                    <span style={{ fontWeight: 900, fontSize: 16, color: HC.orangeDark }}>{v.vendor_type || '—'}</span>
                                    {v.vendor_type === 'Best Seller' && <BestSellerBadge />}
                                  </div>
                                  <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: HC.muted2 }}>
                                    {v.size && <span>📏 Size: {v.size}</span>}
                                    {v.optional && <span>🎨 Optional: {v.optional}</span>}
                                  </div>
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}><div style={{ fontSize: 11, color: HC.muted }}>Pricing 1+2</div><div style={{ fontWeight: 800, fontSize: 15, color: HC.orange }}>${((v.pricing1 || 0) + (v.pricing2 || 0)).toFixed(2)}</div></div>
                            </div>

                            {/* Pricing Grid (giữ nguyên) */}
                            <div style={{ padding: '16px 20px', background: HC.surface2, borderBottom: `1px solid ${HC.border}` }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                                {[
                                  { label: '🚚 ECONOMY', price: v.eco_price, total: v.eco_total },
                                  { label: '⚡ FAST', price: v.fast_price, total: v.fast_total },
                                  { label: '✈️ EXPRESS', price: v.express_price, total: v.express_total },
                                  { label: '🌙 OVERNIGHT', price: v.overnight_price, total: v.overnight_total }
                                ].map((item, idx) => (
                                  <div key={idx} style={{ background: HC.surface, borderRadius: 12, padding: '10px 12px', border: `1px solid ${HC.border}` }}>
                                    <div style={{ fontWeight: 800, fontSize: 10, color: HC.muted, marginBottom: 6 }}>{item.label}</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 11, color: HC.muted2 }}>Ship:</span><span style={{ fontWeight: 700, fontSize: 12 }}>{fmt(item.price)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}><span style={{ fontSize: 11, color: HC.muted2 }}>Total:</span><span style={{ fontWeight: 800, fontSize: 13, color: HC.success }}>{fmt(item.total)}</span></div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Feedback Section - KHÔNG AUTO‑SAVE */}
                            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                              {/* Staff B Feedback */}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><span style={{ fontSize: 14 }}>💬</span><span style={{ fontWeight: 800, fontSize: 11, color: HC.muted, textTransform: 'uppercase' }}>Phản hồi của Staff B</span></div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                  <textarea
                                    placeholder="Nhập phản hồi về vendor này..."
                                    value={currentFeedback}
                                    onChange={e => setFeedbackTexts(prev => ({ ...prev, [key]: e.target.value }))}
                                    rows={2}
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${currentFeedback ? HC.orange : HC.border}`, fontSize: 12, color: HC.ink2, background: HC.surface, resize: 'vertical', fontFamily: "'Nunito Sans',sans-serif", outline: 'none' }}
                                    onFocus={e => e.target.style.borderColor = HC.orange}
                                    onBlur={e => e.target.style.borderColor = currentFeedback ? HC.orange : HC.border}
                                  />
                                  <button
                                    onClick={() => submitBFeedback(key, currentFeedback)}
                                    disabled={!currentFeedback || bSubmitted}
                                    style={{ padding: '8px 16px', borderRadius: 10, background: bSubmitted ? HC.success : (!currentFeedback ? HC.muted2 : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`), color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, cursor: (!currentFeedback || bSubmitted) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: (!currentFeedback || bSubmitted) ? 0.5 : 1 }}
                                  >
                                    {bSubmitted ? '✓ Đã gửi' : '📨 Gửi'}
                                  </button>
                                </div>
                              </div>

                              {/* Seller Response (chỉ hiển thị) */}
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}><span style={{ fontSize: 14 }}>📝</span><span style={{ fontWeight: 800, fontSize: 11, color: HC.muted, textTransform: 'uppercase' }}>Phản hồi của Seller</span></div>
                                {aResponse ? (
                                  <div style={{ background: aResponse.decision === 'dat' ? '#ecfdf5' : '#fef2f2', borderRadius: 12, padding: '12px', border: `1px solid ${aResponse.decision === 'dat' ? '#bbf7d0' : '#fecaca'}` }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                      {aResponse.decision === 'dat' ? <><span style={{ fontSize: 18 }}>✅</span><span style={{ fontWeight: 800, fontSize: 12, color: '#065f46' }}>QUYẾT ĐỊNH: ĐẶT SAMPLE</span></> : <><span style={{ fontSize: 18 }}>❌</span><span style={{ fontWeight: 800, fontSize: 12, color: '#991b1b' }}>QUYẾT ĐỊNH: TỪ CHỐI</span></>}
                                    </div>
                                    {aResponse.sampleDetails && <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff', borderRadius: 8, border: `1px solid ${HC.border}` }}><div style={{ fontWeight: 700, fontSize: 10, color: HC.orange, marginBottom: 4 }}>📦 CHI TIẾT SAMPLE:</div><div style={{ fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{aResponse.sampleDetails}</div></div>}
                                    {aResponse.sellerFeedback && <div style={{ marginTop: 6, fontSize: 10, color: HC.brown, padding: '6px 8px', background: HC.orangeLight, borderRadius: 6 }}>💬 Phản hồi gốc: {aResponse.sellerFeedback}</div>}
                                    <div style={{ marginTop: 6, fontSize: 9, color: '#059669', textAlign: 'right' }}>{new Date(aResponse.respondedAt).toLocaleString('vi-VN')}</div>
                                  </div>
                                ) : (
                                  <div style={{ padding: '20px', textAlign: 'center', background: HC.orangePale, borderRadius: 12, border: `1px dashed ${HC.border}`, color: HC.muted2, fontSize: 11 }}>⏳ Chưa có phản hồi từ Seller</div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 20px', background: HC.surface, borderTop: `1.5px solid ${HC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: HC.muted }}>{bSelectedCount > 0 && <span style={{ color: HC.success, fontWeight: 800 }}>✓ Đã chọn {bSelectedCount} vendor</span>}</div>
            <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: 10, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>Đóng</button>
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <div onClick={() => setLightboxOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', cursor: 'pointer' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            {isVideo(mediaUrls[lightboxIndex]) ? <video src={mediaUrls[lightboxIndex]} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12 }} /> : <img src={mediaUrls[lightboxIndex]} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />}
            {mediaUrls.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev - 1 + mediaUrls.length) % mediaUrls.length); }} style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 28 }}>‹</button>
                <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev + 1) % mediaUrls.length); }} style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 28 }}>›</button>
                <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: 20, color: '#fff', fontSize: 14 }}>{lightboxIndex + 1} / {mediaUrls.length}</div>
              </>
            )}
            <button onClick={() => setLightboxOpen(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40, width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 20 }}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── LIGHTBOX COMPONENT ─────────────────────────────────────
function Lightbox({ mediaUrls, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

  const next = () => setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);

  if (!mediaUrls.length) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)', cursor: 'pointer'
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
        {isVideo(mediaUrls[currentIndex]) ? (
          <video src={mediaUrls[currentIndex]} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12 }} />
        ) : (
          <img src={mediaUrls[currentIndex]} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
        )}
        {mediaUrls.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              style={{
                position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
                width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff', fontSize: 28, transition: '0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              style={{
                position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
                width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff', fontSize: 28, transition: '0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
            >
              ›
            </button>
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: 20, color: '#fff', fontSize: 14 }}>
              {currentIndex + 1} / {mediaUrls.length}
            </div>
          </>
        )}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
            width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 20
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  PRODUCTS SECTION
// ══════════════════════════════════════════════════════════
function ProductsSection({ onGotoVendors, selectedProductId, setSelectedProductId }) {
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

  // 🆕 Thêm state cho Deadline Date
  const [deadlineModalOpen, setDeadlineModalOpen] = useState(false);
  const [deadlineProduct, setDeadlineProduct] = useState(null);
  const [deadlineDate, setDeadlineDate] = useState('');
  const [settingDeadline, setSettingDeadline] = useState(false);
  const processedProductIdRef = useRef(null)
  useEffect(() => {
    const sync = () => setProductVendors(lsGet(LS_PRODUCT_VENDORS, {}));
    window.addEventListener('storage', sync);
    const id = setInterval(sync, 5000);
    return () => { window.removeEventListener('storage', sync); clearInterval(id); };
  }, []);

  const getStatus = p => { const s = p.status || 'draft'; return s === 'rejected' ? 'reject' : s; };
  const handleOpenDeadlineModal = (product) => {
    setDeadlineProduct(product);
    // Set ngày mặc định là hôm nay + 7 ngày
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 7);
    setDeadlineDate(defaultDate.toISOString().split('T')[0]);
    setDeadlineModalOpen(true);
  };

  const handleSetDeadline = async () => {
    if (!deadlineDate) {
      alert('Vui lòng chọn ngày deadline!');
      return;
    }

    setSettingDeadline(true);
    try {
      // Gọi API để cập nhật deadline_date
      await productApi.updateDeadline(deadlineProduct.id, { deadline_date: deadlineDate });

      // Cập nhật local state
      setSubmittedProducts(prev => prev.map(p =>
        p.id === deadlineProduct.id
          ? { ...p, deadline_date: deadlineDate }
          : p
      ));

      setDeadlineModalOpen(false);
      setDeadlineProduct(null);
      setDeadlineDate('');
      alert('✅ Đã cập nhật Deadline Date!');
    } catch (err) {
      alert('Lỗi: ' + (err.response?.data?.message || err.message));
    } finally {
      setSettingDeadline(false);
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

        // ✅ SỬA LẠI: Kiểm tra selectedProductId
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

  // Effect riêng để xử lý selectedProductId khi products đã có sẵn
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
    if (!feedbackText.trim()) { alert('Vui lòng nhập nội dung phản hồi!'); return; }
    setSendingFeedback(true);
    try {
      await productApi.sendFeedback(feedbackProduct.id, { feedback: feedbackText.trim() });
      setFeedbackOpen(false); setFeedbackProduct(null); setFeedbackText(''); alert('Đã gửi phản hồi!');
    } catch (err) { alert('Lỗi: ' + (err.response?.data?.message || err.message)); }
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

  const TH = s => ({ padding: '11px 13px', fontWeight: 900, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: HC.brown, borderBottom: `1.5px solid ${HC.border}`, background: HC.cream, fontFamily: "'Nunito',sans-serif", textAlign: 'left', whiteSpace: 'nowrap', ...s });

  return (
    <div>
      {apiError && <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>⚠️ {apiError}</span><button onClick={loadProducts} style={{ padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Thử lại</button></div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, padding: '12px 16px', background: HC.surface, borderRadius: 14, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 160 }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: HC.muted, pointerEvents: 'none', fontSize: 14 }}>🔍</span>
          <input type="text" placeholder="Tìm loại sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, paddingLeft: 34 }} {...focusStyle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 9, background: '#ecfdf5', border: '1.5px solid #bbf7d0', fontSize: 11, fontWeight: 800, color: '#065f46', whiteSpace: 'nowrap' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />Chỉ hiển thị: Approved</div>
        <button onClick={loadProducts} style={{ padding: '6px 14px', borderRadius: 9, border: `1.5px solid ${HC.border}`, background: HC.cream, color: HC.brown, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>↻ Làm mới</button>
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
                  <th style={TH({ color: HC.orange })}>Project</th>     {/* ← Cột Project MỚI */}
                  <th style={TH({ color: HC.orange })}>Seller</th>
                  <th style={TH()}>Product Type</th>
                  <th style={TH()}>Hình ảnh</th>
                  <th style={TH()}>Date Request</th>
                  <th style={TH()}>Deadline Date</th>
                  <th style={TH()}>Trạng thái</th>
                  <th style={TH()}>Nhà cung cấp</th>
                  <th style={TH()}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.map((p, i) => {
                  const mediaSrc = (() => {
                    if (p.media_path) {
                      const cleanPath = p.media_path.replace(/^\/?storage\//, '');
                      return `${API_BASE_URL}/storage/${cleanPath}`;
                    }
                    if (p.image_url) {
                      return p.image_url.startsWith('http') ? p.image_url : `${API_BASE_URL}/${p.image_url}`;
                    }
                    if (p.media_urls && Array.isArray(p.media_urls) && p.media_urls.length) {
                      const firstUrl = p.media_urls[0];
                      return firstUrl.startsWith('http') ? firstUrl : `${API_BASE_URL}/${firstUrl}`;
                    }
                    return null;
                  })();
                  const assignedVendors = productVendors[p.id] || [];
                  const hasVendors = assignedVendors.length > 0;
                  const aSelections = lsGet(LS_A_SELECTIONS, {})[p.id] || {};
                  const aSelectedCount = Object.values(aSelections).filter(s => s?.checked).length;

                  return (
                    <tr key={p.id || i} style={{ borderBottom: `1px solid ${HC.border}` }} onMouseEnter={e => e.currentTarget.style.background = HC.orangePale} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '12px 13px', color: HC.muted, fontWeight: 700 }}>
                        {(currentPage - 1) * ITEMS_PER_PAGE + i + 1}
                      </td>

                      {/* 🆕 Cột Project */}
                      <td style={{ padding: '12px 13px', fontWeight: 800, color: HC.orangeDark }}>
                        {p.project || '—'}
                      </td>

                      {/* Cột Seller */}
                      <td style={{ padding: '12px 13px', fontWeight: 800, color: HC.orange }}>
                        {p.seller_name || p.sellerName || '—'}
                      </td>

                      <td style={{ padding: '12px 13px', fontWeight: 800, color: HC.ink2 }}>
                        {p.product_type || '—'}
                      </td>

                      <td style={{ padding: '12px 13px' }}>
                        {mediaSrc ? (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img src={mediaSrc} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: `1.5px solid ${HC.border}`, display: 'block' }} />
                          </div>
                        ) : (
                          hasVendors ? (
                            <div style={{
                              width: 72, height: 72, borderRadius: 8, border: `1.5px solid ${HC.border}`,
                              background: HC.orangeLight, display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center', gap: 2,
                            }}>
                              <span style={{ fontSize: 18 }}>🏪</span>
                              <span style={{ fontSize: 10, fontWeight: 900, color: HC.orangeDark }}>{assignedVendors.length}</span>
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
                            <span style={{ fontSize: 12, fontWeight: 600 }}>Assigned: {assignedVendors.length} vendor</span>
                            {aSelectedCount > 0 && <span style={{ fontSize: 11, color: HC.success, fontWeight: 600 }}>✓ A đã chọn {aSelectedCount}</span>}
                          </div>
                        ) : <span style={{ color: HC.muted2, fontSize: 12, fontStyle: 'italic' }}>—</span>}
                      </td>

                      <td style={{ padding: '12px 13px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button onClick={() => setViewVendorProduct(p)} style={{ padding: '5px 10px', borderRadius: 7, border: `1.5px solid ${HC.border}`, background: HC.cream, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: HC.brown }}>
                            👁 Xem
                          </button>
                          <button onClick={() => onGotoVendors(p.product_type, p.id)} style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${HC.orange}`, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, cursor: 'pointer', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                            🔍 Tìm Vendor
                          </button>
                          <button
                            onClick={() => handleOpenDeadlineModal(p)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 7,
                              border: `1.5px solid ${HC.orangeMid}`,
                              background: HC.orangeLight,
                              cursor: 'pointer',
                              fontSize: 11,
                              fontWeight: 800,
                              color: HC.orangeDark
                            }}
                          >
                            📅 Tạo Deadline
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
            // Reset processedProductIdRef khi đóng modal
            processedProductIdRef.current = null;
            // Clear selectedProductId
            if (setSelectedProductId) {
              setSelectedProductId(null);
            }
          }}
        />
      )}      {feedbackOpen && feedbackProduct && (
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
      {deadlineModalOpen && deadlineProduct && (
        <div onClick={() => setDeadlineModalOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 420, background: HC.surface, borderRadius: 20, padding: 28, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}` }}>
            <div style={{ fontWeight: 900, fontSize: 16, color: HC.ink, marginBottom: 6, fontFamily: "'Nunito',sans-serif" }}>
              📅 Tạo Deadline Date
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
              <button
                onClick={handleSetDeadline}
                disabled={settingDeadline}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 10,
                  background: settingDeadline ? HC.muted2 : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`,
                  color: '#fff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: settingDeadline ? 'not-allowed' : 'pointer'
                }}
              >
                {settingDeadline ? '⟳ Đang xử lý...' : '✅ Lưu Deadline'}
              </button>
              <button
                onClick={() => { setDeadlineModalOpen(false); setDeadlineProduct(null); setDeadlineDate(''); }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 10,
                  background: HC.cream,
                  color: HC.brown,
                  border: `1.5px solid ${HC.border}`,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  EXCEL PARSER
// ══════════════════════════════════════════════════════════
const EXCEL_COL_MAP = {
  'vendor name': 'vendor_name', 'vendor_name': 'vendor_name',
  'product type': 'product_type', 'product_type': 'product_type', 'loại sản phẩm': 'product_type',
  'vendor type': 'vendor_type', 'vendor_type': 'vendor_type', 'loại vendor': 'vendor_type',
  'size': 'size', 'kích thước': 'size', 'optional': 'optional', 'tùy chọn': 'optional',
  'pricing 1': 'pricing1', 'pricing1': 'pricing1', 'giá 1': 'pricing1',
  'pricing 2': 'pricing2', 'pricing2': 'pricing2', 'giá 2': 'pricing2',
  'economy ship': 'eco_price', 'eco_price': 'eco_price',
  'economy total': 'eco_total', 'eco_total': 'eco_total', 'economy': 'eco_total',
  'fast ship': 'fast_price', 'fast_price': 'fast_price',
  'fast total': 'fast_total', 'fast_total': 'fast_total', 'fast': 'fast_total',
  'express ship': 'express_price', 'express_price': 'express_price',
  'express total': 'express_total', 'express_total': 'express_total', 'express': 'express_total',
  'overnight ship': 'overnight_price', 'overnight_price': 'overnight_price',
  'overnight total': 'overnight_total', 'overnight_total': 'overnight_total', 'overnight': 'overnight_total',
  'detail size': 'size', 'detail optional': 'optional',
};

function fillForward(arr) { let last = ''; return arr.map(v => { const s = String(v ?? '').trim().toLowerCase(); if (s) { last = s; return s; } return last; }); }
function parseVendorExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawData || rawData.length === 0) {
          resolve([]);
          return;
        }

        const vendors = [];

        const mapColumn = (row, possibleNames) => {
          for (const name of possibleNames) {
            if (row[name] !== undefined && row[name] !== '') {
              return row[name];
            }
            const lowerName = name.toLowerCase();
            for (const key of Object.keys(row)) {
              if (key.toLowerCase() === lowerName) {
                return row[key];
              }
            }
          }
          return '';
        };

        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];

          let productType = mapColumn(row, ['Product Type', 'product_type', 'product type', 'PRODUCT TYPE']);
          productType = productType.toString().trim();

          let vendorType = mapColumn(row, ['Vendor Type', 'vendor_type', 'vendor type', 'VENDOR TYPE']);
          vendorType = vendorType.toString().trim();

          if (!productType || !vendorType) {
            continue;
          }

          // Lấy vendor name từ cột Vendor Name hoặc name
          let vendorName = mapColumn(row, ['Vendor Name', 'vendor_name', 'VENDOR NAME', 'name', 'Name']);
          vendorName = vendorName ? vendorName.toString().trim() : '';

          const size = mapColumn(row, ['Size', 'size', 'SIZE']);
          const optional = mapColumn(row, ['Optional', 'optional', 'OPTIONAL']);

          const pricing1 = parseFloat(mapColumn(row, ['Pricing 1', 'pricing1', 'pricing 1', 'PRICING 1', 'Pricing1']) || 0);
          const pricing2 = parseFloat(mapColumn(row, ['Pricing 2', 'pricing2', 'pricing 2', 'PRICING 2', 'Pricing2']) || 0);
          const eco_price = parseFloat(mapColumn(row, ['Economy Price Ship', 'economy_price_ship', 'Economy Ship', 'economy ship', 'ECONOMY PRICE SHIP']) || 0);
          const eco_total = parseFloat(mapColumn(row, ['Economy Total', 'economy_total', 'Economy', 'economy', 'ECONOMY TOTAL']) || 0);
          const fast_price = parseFloat(mapColumn(row, ['Fast Price Ship', 'fast_price_ship', 'Fast Ship', 'fast ship', 'FAST PRICE SHIP']) || 0);
          const fast_total = parseFloat(mapColumn(row, ['Fast Total', 'fast_total', 'Fast', 'fast', 'FAST TOTAL']) || 0);
          const express_price = parseFloat(mapColumn(row, ['Express Price Ship', 'express_price_ship', 'Express Ship', 'express ship', 'EXPRESS PRICE SHIP']) || 0);
          const express_total = parseFloat(mapColumn(row, ['Express Total', 'express_total', 'Express', 'express', 'EXPRESS TOTAL']) || 0);
          const overnight_price = parseFloat(mapColumn(row, ['Overnight Price Ship', 'overnight_price_ship', 'Overnight Ship', 'overnight ship', 'OVERNIGHT PRICE SHIP']) || 0);
          const overnight_total = parseFloat(mapColumn(row, ['Overnight Total', 'overnight_total', 'Overnight', 'overnight', 'OVERNIGHT TOTAL']) || 0);

          const vendor = {
            name: vendorName,  // Đổi từ vendor_name thành name
            product_type: productType,
            vendor_type: normalizeVendorType(vendorType),
            size: size ? size.toString().trim() : '',
            optional: optional ? optional.toString().trim() : '',
            pricing1: isNaN(pricing1) ? null : pricing1,
            pricing2: isNaN(pricing2) ? null : pricing2,
            eco_price: isNaN(eco_price) ? null : eco_price,
            eco_total: isNaN(eco_total) ? null : eco_total,
            fast_price: isNaN(fast_price) ? null : fast_price,
            fast_total: isNaN(fast_total) ? null : fast_total,
            express_price: isNaN(express_price) ? null : express_price,
            express_total: isNaN(express_total) ? null : express_total,
            overnight_price: isNaN(overnight_price) ? null : overnight_price,
            overnight_total: isNaN(overnight_total) ? null : overnight_total,
          };

          vendors.push(vendor);
        }

        if (vendors.length === 0) {
          reject(new Error('Không tìm thấy dữ liệu vendor trong file. Vui lòng kiểm tra lại cột tiêu đề.'));
          return;
        }

        resolve(vendors);
      } catch (err) {
        reject(new Error('Lỗi đọc file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsArrayBuffer(file);
  });
}

// ══════════════════════════════════════════════════════════
//  VENDORS SECTION (with Tabs: Tất cả & Best Seller)
// ══════════════════════════════════════════════════════════
function VendorsSection({ filterProductType = '', filterProductId = '', onClearFilter, onAssignComplete }) {
  const [showVForm, setShowVForm] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'bestseller'
  const EMPTY_VENDOR = {
    name: '',
    vendor_type: '',
    product_type: '',
    size: '',
    optional: '',
    pricing: '',
    eco_price: '',
    eco_total: '',
    fast_price: '',
    fast_total: '',
    express_price: '',
    express_total: '',
    overnight_price: '',
    overnight_total: ''
  };

  const [vendorList, setVendorList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  // const [showVForm, setShowVForm] = useState(false);
  const [vForm, setVForm] = useState(EMPTY_VENDOR);
  const [editingVId, setEditingVId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [vPage, setVPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const importFileRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreviewPage, setImportPreviewPage] = useState(1);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const vf = key => e => setVForm(p => ({ ...p, [key]: e.target.value }));
  const [vendorModalOpen, setVendorModalOpen] = useState(false);
  const [vendorModalMode, setVendorModalMode] = useState('create');

  const loadVendors = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setApiError('');
    try {
      const res = await vendorApi.list({ per_page: 10000 });

      let list = [];
      if (res.data?.data?.data && Array.isArray(res.data.data.data)) {
        list = res.data.data.data;
      } else if (res.data?.data && Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data)) {
        list = res.data;
      }

      // Debug: xem cấu trúc dữ liệu
      console.log('Vendor sample:', list[0]);

      setVendorList(list);
      localStorage.setItem('STAFF_VENDOR_LIST_V1', JSON.stringify(list));
    } catch (err) {
      setApiError(err.response?.data?.message || err.message || 'Lỗi tải vendor');
      setVendorList([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadVendors(); }, [loadVendors]);
  useEffect(() => { setVPage(1); setSelectedIds(new Set()); setSearchFilter(''); }, [filterProductType, filterProductId, activeTab]);
  useEffect(() => { setVForm(EMPTY_VENDOR); }, []);

  // Filter vendors based on active tab and search
  let filteredVendors = activeTab === 'bestseller'
    ? vendorList.filter(v => v.vendor_type === 'Best Seller')
    : vendorList;

  if (filterProductType) {
    filteredVendors = filteredVendors.filter(v => (v.product_type || '').toLowerCase().includes(filterProductType.toLowerCase()));
  }
  if (searchFilter && !filterProductType) {
    filteredVendors = filteredVendors.filter(v => (v.product_type || '').toLowerCase().includes(searchFilter.toLowerCase()));
  }

  const totalVPages = Math.ceil(filteredVendors.length / VENDOR_PAGE_SIZE);
  const pagedVendors = filteredVendors.slice((vPage - 1) * VENDOR_PAGE_SIZE, vPage * VENDOR_PAGE_SIZE);

  const toggleSelect = (id) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    const pageIds = pagedVendors.map(v => v.id);
    const allSel = pageIds.every(id => selectedIds.has(id));
    setSelectedIds(prev => { const n = new Set(prev); if (allSel) { pageIds.forEach(id => n.delete(id)); } else { pageIds.forEach(id => n.add(id)); } return n; });
  };
  const pageAllSelected = pagedVendors.length > 0 && pagedVendors.every(v => selectedIds.has(v.id));
  const pageSomeSelected = pagedVendors.some(v => selectedIds.has(v.id));

  const handleAssignVendor = () => {
    if (selectedIds.size === 0) { alert('Vui lòng chọn ít nhất 1 vendor!'); return; }
    const selected = vendorList.filter(v => selectedIds.has(v.id));
    const productId = filterProductId;
    if (!productId) { alert('Không xác định được sản phẩm.'); return; }
    const all = lsGet(LS_PRODUCT_VENDORS, {}); all[productId] = selected; lsSet(LS_PRODUCT_VENDORS, all);
    window.dispatchEvent(new StorageEvent('storage', { key: LS_PRODUCT_VENDORS }));
    alert(`✅ Đã gán ${selected.length} vendor cho sản phẩm!`);
    setSelectedIds(new Set()); onAssignComplete();
  };

  const getDetailedError = (err) => {
    if (err.response?.data?.errors) {
      const e = err.response.data.errors;
      return typeof e === 'object' ? Object.entries(e).map(([f, m]) => `${f}: ${Array.isArray(m) ? m.join(', ') : m}`).join('; ') : e;
    }
    return err.response?.data?.message || err.message || 'Lỗi không xác định';
  };

  // Cách khác an toàn hơn - thay thế hoàn toàn:

  const handleExportSample = () => {
    const columns = [
      'Vendor Name',
      'Product Type',
      'Vendor Type',
      'Size',
      'Optional',
      'Pricing 1',
      'Pricing 2',
      'Economy Price Ship',
      'Economy Total',
      'Fast Price Ship',
      'Fast Total',
      'Express Price Ship',
      'Express Total',
      'Overnight Price Ship',
      'Overnight Total'
    ];

    let exportData = [];

    if (filteredVendors.length > 0) {
      exportData = filteredVendors.map(v => ({
        'Vendor Name': v.name || v.vendor_name || '',  // ← THÊM DÒNG NÀY
        'Product Type': v.product_type || '',
        'Vendor Type': v.vendor_type || '',
        'Size': v.size || '',
        'Optional': v.optional || '',
        'Pricing 1': v.pricing1 != null ? Number(v.pricing1).toFixed(2) : '',
        'Pricing 2': v.pricing2 != null ? Number(v.pricing2).toFixed(2) : '',
        'Economy Price Ship': v.eco_price != null ? Number(v.eco_price).toFixed(2) : '',
        'Economy Total': v.eco_total != null ? Number(v.eco_total).toFixed(2) : '',
        'Fast Price Ship': v.fast_price != null ? Number(v.fast_price).toFixed(2) : '',
        'Fast Total': v.fast_total != null ? Number(v.fast_total).toFixed(2) : '',
        'Express Price Ship': v.express_price != null ? Number(v.express_price).toFixed(2) : '',
        'Express Total': v.express_total != null ? Number(v.express_total).toFixed(2) : '',
        'Overnight Price Ship': v.overnight_price != null ? Number(v.overnight_price).toFixed(2) : '',
        'Overnight Total': v.overnight_total != null ? Number(v.overnight_total).toFixed(2) : '',
      }));
    } else {
      const emptyRow = {};
      columns.forEach(col => { emptyRow[col] = ''; });
      exportData = [emptyRow];
    }

    const ws = XLSX.utils.json_to_sheet(exportData);

    // Điều chỉnh độ rộng cột
    ws['!cols'] = [
      { wch: 25 },  // Vendor Name
      { wch: 20 },  // Product Type
      { wch: 15 },  // Vendor Type
      { wch: 10 },  // Size
      { wch: 15 },  // Optional
      { wch: 12 },  // Pricing 1
      { wch: 12 },  // Pricing 2
      { wch: 18 },  // Economy Price Ship
      { wch: 15 },  // Economy Total
      { wch: 18 },  // Fast Price Ship
      { wch: 15 },  // Fast Total
      { wch: 18 },  // Express Price Ship
      { wch: 15 },  // Express Total
      { wch: 18 },  // Overnight Price Ship
      { wch: 15 },  // Overnight Total
    ];

    // Style cho header
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Arial' },
      fill: { fgColor: { rgb: activeTab === 'bestseller' ? 'D4A017' : 'F59E0B' }, patternType: 'solid' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'CCCCCC' } },
        bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
        left: { style: 'thin', color: { rgb: 'CCCCCC' } },
        right: { style: 'thin', color: { rgb: 'CCCCCC' } }
      }
    };

    // Áp dụng style cho header
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:O1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[address]) continue;
      ws[address].s = headerStyle;
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'bestseller' ? 'Best_Seller' : 'Vendors');

    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = filteredVendors.length > 0
      ? `Vendors_${activeTab === 'bestseller' ? 'BestSeller_' : 'All_'}_${ts}.xlsx`
      : `Vendor_Template_${ts}.xlsx`;

    XLSX.writeFile(wb, filename);

    if (filteredVendors.length === 0) {
      alert('📋 Đã tải file Excel mẫu! Hãy điền dữ liệu và Import lại.');
    } else {
      alert(`✅ Đã xuất ${filteredVendors.length} vendor ra file Excel!`);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreview || importPreview.length === 0) return;
    setImporting(true);
    let successCount = 0, updateCount = 0;
    const errors = [];

    for (let i = 0; i < importPreview.length; i++) {
      const vendorData = importPreview[i];

      // Lấy Vendor Name - ưu tiên từ cột 'Vendor Name' hoặc 'name'
      let vendorName = vendorData['Vendor Name'] || vendorData.vendor_name || vendorData.name || '';
      vendorName = vendorName.toString().trim();

      let productType = (vendorData['Product Type'] || vendorData.product_type || '').toString().trim();
      if (!productType) {
        errors.push({ idx: i + 1, name: `dòng ${i + 1}`, message: 'Thiếu Product Type' });
        continue;
      }

      let vendorType = normalizeVendorType((vendorData['Vendor Type'] || vendorData.vendor_type || '').toString().trim());
      if (!VENDOR_TYPES.includes(vendorType)) {
        errors.push({ idx: i + 1, name: productType, message: `Vendor Type "${vendorData.vendor_type}" không hợp lệ` });
        continue;
      }

      const size = vendorData.Size || vendorData.size ? vendorData.Size || vendorData.size.toString().trim() : null;
      const optional = vendorData.Optional || vendorData.optional ? vendorData.Optional || vendorData.optional.toString().trim() : null;

      const numericFields = [
        'Pricing 1', 'pricing1',
        'Pricing 2', 'pricing2',
        'Economy Price Ship', 'eco_price',
        'Economy Total', 'eco_total',
        'Fast Price Ship', 'fast_price',
        'Fast Total', 'fast_total',
        'Express Price Ship', 'express_price',
        'Express Total', 'express_total',
        'Overnight Price Ship', 'overnight_price',
        'Overnight Total', 'overnight_total'
      ];

      const cleanedData = {
        name: vendorName,  // ← THÊM DÒNG NÀY
        product_type: productType,
        vendor_type: vendorType,
        size,
        optional
      };

      // Helper function để lấy giá trị từ nhiều tên cột
      const getValue = (obj, possibleNames) => {
        for (const name of possibleNames) {
          if (obj[name] !== undefined && obj[name] !== '' && obj[name] !== null) {
            return obj[name];
          }
        }
        return null;
      };

      cleanedData.pricing1 = parseFloat(getValue(vendorData, ['Pricing 1', 'pricing1']) || 0);
      cleanedData.pricing2 = parseFloat(getValue(vendorData, ['Pricing 2', 'pricing2']) || 0);
      cleanedData.eco_price = parseFloat(getValue(vendorData, ['Economy Price Ship', 'eco_price']) || 0);
      cleanedData.eco_total = parseFloat(getValue(vendorData, ['Economy Total', 'eco_total']) || 0);
      cleanedData.fast_price = parseFloat(getValue(vendorData, ['Fast Price Ship', 'fast_price']) || 0);
      cleanedData.fast_total = parseFloat(getValue(vendorData, ['Fast Total', 'fast_total']) || 0);
      cleanedData.express_price = parseFloat(getValue(vendorData, ['Express Price Ship', 'express_price']) || 0);
      cleanedData.express_total = parseFloat(getValue(vendorData, ['Express Total', 'express_total']) || 0);
      cleanedData.overnight_price = parseFloat(getValue(vendorData, ['Overnight Price Ship', 'overnight_price']) || 0);
      cleanedData.overnight_total = parseFloat(getValue(vendorData, ['Overnight Total', 'overnight_total']) || 0);

      // Xử lý các giá trị NaN
      Object.keys(cleanedData).forEach(key => {
        if (typeof cleanedData[key] === 'number' && isNaN(cleanedData[key])) {
          cleanedData[key] = null;
        }
      });

      const matched = vendorList.find(v =>
        v.product_type === cleanedData.product_type &&
        v.vendor_type === cleanedData.vendor_type &&
        (v.size || null) === cleanedData.size &&
        (v.optional || null) === cleanedData.optional
      );

      try {
        if (matched) {
          await vendorApi.update(matched.id, cleanedData);
          updateCount++;
        } else {
          await vendorApi.create(cleanedData);
          successCount++;
        }
      } catch (err) {
        errors.push({ idx: i + 1, name: productType, message: getDetailedError(err) });
      }
    }

    await loadVendors();
    setImporting(false);
    setImportConfirmOpen(false);
    setImportPreview(null);

    if (errors.length === 0) {
      alert(`✅ Import hoàn tất!\n• Thêm mới: ${successCount}\n• Cập nhật: ${updateCount}`);
    } else {
      alert(`⚠️ Import xong\n• Thêm: ${successCount} · Cập nhật: ${updateCount} · Lỗi: ${errors.length}\n\n${errors.slice(0, 8).map(e => `Dòng ${e.idx}: ${e.message}`).join('\n')}`);
    }
  };
  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (importFileRef.current) importFileRef.current.value = '';
    if (!file) return;
    if (!['xlsx', 'xls', 'csv'].includes(file.name.split('.').pop().toLowerCase())) { alert('Vui lòng chọn file Excel!'); return; }
    try {
      const parsed = await parseVendorExcel(file);
      if (parsed.length === 0) { alert('File không có dữ liệu!'); return; }
      setImportPreview(parsed); setImportPreviewPage(1); setImportConfirmOpen(true);
    } catch (err) { alert('Lỗi đọc file: ' + err.message); }
  };

  // Trong handleVSubmit, đảm bảo gửi đúng vendor_name
  const handleVSubmit = async () => {
    if (!vForm.product_type.trim()) {
      alert('Vui lòng nhập Product Type!');
      return;
    }
    if (!vForm.vendor_type.trim()) {
      alert('Vui lòng chọn Vendor Type!');
      return;
    }

    setSubmitting(true);
    try {
      const totalPricing = parseFloat(vForm.pricing) || 0;
      const pricing1 = totalPricing / 2;
      const pricing2 = totalPricing / 2;

      const dataToSend = {
        product_type: vForm.product_type,
        vendor_type: normalizeVendorType(vForm.vendor_type),
        name: vForm.name || '',
        size: vForm.size || '',
        optional: vForm.optional || '',
        pricing1: pricing1,
        pricing2: pricing2,
        eco_price: vForm.eco_price ? parseFloat(vForm.eco_price) : null,
        eco_total: vForm.eco_total ? parseFloat(vForm.eco_total) : null,
        fast_price: vForm.fast_price ? parseFloat(vForm.fast_price) : null,
        fast_total: vForm.fast_total ? parseFloat(vForm.fast_total) : null,
        express_price: vForm.express_price ? parseFloat(vForm.express_price) : null,
        express_total: vForm.express_total ? parseFloat(vForm.express_total) : null,
        overnight_price: vForm.overnight_price ? parseFloat(vForm.overnight_price) : null,
        overnight_total: vForm.overnight_total ? parseFloat(vForm.overnight_total) : null,
      };

      if (editingVId !== null) {
        await vendorApi.update(editingVId, dataToSend);
        alert('✅ Cập nhật vendor thành công!');
      } else {
        await vendorApi.create(dataToSend);
        alert('✅ Tạo vendor thành công!');
      }

      await loadVendors();
      closeVendorModal();  // ← SỬA: đóng modal thay vì setShowVForm(false)

    } catch (err) {
      alert('Lỗi: ' + getDetailedError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVEdit = vendor => {
    console.log('✏️ Editing vendor:', vendor);
    const totalPricing = (vendor.pricing1 || 0) + (vendor.pricing2 || 0);

    setVForm({
      name: vendor.name || '',
      product_type: vendor.product_type || '',
      vendor_type: vendor.vendor_type || '',
      size: vendor.size || '',
      optional: vendor.optional || '',
      pricing: totalPricing,
      eco_price: vendor.eco_price ?? '',
      eco_total: vendor.eco_total ?? '',
      fast_price: vendor.fast_price ?? '',
      fast_total: vendor.fast_total ?? '',
      express_price: vendor.express_price ?? '',
      express_total: vendor.express_total ?? '',
      overnight_price: vendor.overnight_price ?? '',
      overnight_total: vendor.overnight_total ?? ''
    });
    setEditingVId(vendor.id);
    setVendorModalMode('edit');  // ← THÊM DÒNG NÀY
    setVendorModalOpen(true);    // ← SỬA THÀNH setVendorModalOpen
  };
  const handleVDelete = async (vendor) => {
    setVendorToDelete(vendor);
    setDeleteModalOpen(true);
  };
  const openCreateVendorModal = () => {
    setVForm(EMPTY_VENDOR);
    setEditingVId(null);
    setVendorModalMode('create');
    setVendorModalOpen(true);
  };

  const openEditVendorModal = (vendor) => {
    const totalPricing = (vendor.pricing1 || 0) + (vendor.pricing2 || 0);
    setVForm({
      name: vendor.name || '',
      product_type: vendor.product_type || '',
      vendor_type: vendor.vendor_type || '',
      size: vendor.size || '',
      optional: vendor.optional || '',
      pricing: totalPricing,
      eco_price: vendor.eco_price ?? '',
      eco_total: vendor.eco_total ?? '',
      fast_price: vendor.fast_price ?? '',
      fast_total: vendor.fast_total ?? '',
      express_price: vendor.express_price ?? '',
      express_total: vendor.express_total ?? '',
      overnight_price: vendor.overnight_price ?? '',
      overnight_total: vendor.overnight_total ?? ''
    });
    setEditingVId(vendor.id);
    setVendorModalMode('edit');
    setVendorModalOpen(true);
  };

  const closeVendorModal = () => {
    setVendorModalOpen(false);
    setVForm(EMPTY_VENDOR);
    setEditingVId(null);
    setVendorModalMode('create');
  };
  const confirmDelete = async () => {
    if (!vendorToDelete) return;

    const deletedId = vendorToDelete.id;
    const deletedType = vendorToDelete.vendor_type;

    setDeleteModalOpen(false);
    setVendorToDelete(null);

    try {
      console.log('📡 Gửi request xóa ID:', deletedId);

      const response = await vendorApi.delete(deletedId);

      console.log('📡 Response status:', response?.status);
      console.log('📡 Response data:', response?.data);

      // Verify: gọi lại DB ngay để kiểm tra có thực sự xóa chưa
      const verifyRes = await vendorApi.list({ per_page: 10000 });
      const verifyList = Array.isArray(verifyRes.data?.data?.data) ? verifyRes.data.data.data
        : Array.isArray(verifyRes.data?.data) ? verifyRes.data.data
          : Array.isArray(verifyRes.data) ? verifyRes.data : [];

      const stillExists = verifyList.some(v => v.id === deletedId);
      console.log('🔍 Vendor vẫn còn trong DB?', stillExists);
      console.log('🔍 Tổng vendor trong DB sau xóa:', verifyList.length);

      if (stillExists) {
        // API trả 200 nhưng DB không xóa → báo lỗi thật
        console.error('❌ API báo thành công nhưng DB vẫn còn record!');
        setVendorList(verifyList);
        alert('⚠️ Lỗi: Server báo xóa thành công nhưng dữ liệu vẫn còn trong DB. Kiểm tra lại API.');
        return;
      }

      setVendorList(verifyList);
      setVPage(1);

      setToast({
        type: 'success',
        title: '✅ Xóa thành công!',
        message: `Đã xóa vendor "${deletedType}"`,
        duration: 3000,
      });

    } catch (err) {
      console.error('❌ Lỗi chi tiết:', err);
      console.error('❌ Status:', err.response?.status);
      console.error('❌ Response data:', err.response?.data);
      console.error('❌ Request URL:', err.config?.url);
      console.error('❌ Request method:', err.config?.method);

      await loadVendors(true);
      alert(`Lỗi xóa [${err.response?.status}]: ${getDetailedError(err)}`);
    }
  };
  const inp3 = { padding: '7px 9px', borderRadius: 8, border: `1.5px solid ${HC.border}`, fontSize: 12, color: HC.ink2, background: HC.surface2, width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: "'Nunito Sans',sans-serif", transition: 'border-color 0.2s' };
  const TH2 = (extra = {}) => ({
    padding: '8px 10px',
    fontWeight: 900,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    textAlign: extra.textAlign || 'center',
    color: '#fff',
    background: activeTab === 'bestseller' ? HC.gold : HC.orangeDark,
    border: `1px solid ${activeTab === 'bestseller' ? '#C8A000' : HC.orange}`,
    fontFamily: "'Nunito',sans-serif",
    verticalAlign: 'middle',
    ...extra
  });
  const TD = (extra = {}) => ({
    padding: '9px 10px',
    fontSize: 12,
    color: HC.ink2,
    border: `1px solid ${HC.border}`,
    textAlign: extra.textAlign || 'center',
    verticalAlign: 'middle',
    background: HC.surface2,
    fontFamily: "'Nunito Sans',sans-serif",
    ...extra
  }); const TDalt = (extra = {}) => ({ ...TD(extra), background: activeTab === 'bestseller' ? HC.goldLight : HC.orangePale });
  const fmt = n => (n != null && n !== '') ? Number(n).toFixed(2) : '—';

  const PREV_PAGE_SIZE = 5;
  const totalPrevPages = importPreview ? Math.ceil(importPreview.length / PREV_PAGE_SIZE) : 1;
  const pagedPreview = importPreview ? importPreview.slice((importPreviewPage - 1) * PREV_PAGE_SIZE, importPreviewPage * PREV_PAGE_SIZE) : [];
  const PREVIEW_COLS = ['Vendor Name', 'Product Type', 'Vendor Type', 'Size', 'Pricing 1', 'Eco Total', 'Fast Total'];
  const getCell = (v, col) => {
    const map = {
      'Vendor Name': v.name || v.vendor_name || v['Vendor Name'] || '',
      'Product Type': v.product_type || v['Product Type'] || '',
      'Vendor Type': v.vendor_type || v['Vendor Type'] || '',
      'Size': v.size || v.Size || '',
      'Pricing 1': v.pricing1 || v['Pricing 1'] ? `$${Number(v.pricing1 || v['Pricing 1']).toFixed(2)}` : '',
      'Eco Total': v.eco_total || v['Eco Total'] ? `$${Number(v.eco_total || v['Eco Total']).toFixed(2)}` : '',
      'Fast Total': v.fast_total || v['Fast Total'] ? `$${Number(v.fast_total || v['Fast Total']).toFixed(2)}` : ''
    };
    return map[col] || '—';
  };

  const MiniPager = ({ page, total, onChange, label }) => {
    if (total <= 1) return null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: HC.surface, borderTop: `1.5px solid ${HC.border}` }}>
        <span style={{ fontSize: 11, color: HC.muted, fontWeight: 600 }}>{label}</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button onClick={() => onChange(page - 1)} disabled={page === 1} style={{ minWidth: 28, height: 28, borderRadius: 7, border: `1.5px solid ${HC.border}`, background: HC.cream, color: HC.muted2, fontSize: 12, fontWeight: 700, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>‹</button>
          {Array.from({ length: total }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => onChange(p)} style={{ minWidth: 28, height: 28, borderRadius: 7, border: `1.5px solid ${p === page ? HC.orange : HC.border}`, background: p === page ? HC.orange : HC.surface, color: p === page ? '#fff' : HC.ink2, fontSize: 12, fontWeight: p === page ? 900 : 700, cursor: 'pointer' }}>{p}</button>
          ))}
          <button onClick={() => onChange(page + 1)} disabled={page === total} style={{ minWidth: 28, height: 28, borderRadius: 7, border: `1.5px solid ${HC.border}`, background: HC.cream, color: HC.muted2, fontSize: 12, fontWeight: 700, cursor: page === total ? 'not-allowed' : 'pointer', opacity: page === total ? 0.4 : 1 }}>›</button>
        </div>
      </div>
    );
  };

  const ImportConfirmModal = () => {
    if (!importConfirmOpen || !importPreview) return null;
    return (
      <div onClick={() => { if (!importing) { setImportConfirmOpen(false); setImportPreview(null); } }} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, backdropFilter: 'blur(3px)', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 800, background: HC.surface, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.28)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
          <div style={{ padding: '18px 22px', background: HC.ink, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,166,35,0.15)', border: '1.5px solid rgba(245,166,35,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>📥</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Xác nhận Import Vendor</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>Tìm thấy <b style={{ color: HC.orange }}>{importPreview.length} vendor</b></div>
            </div>
            {!importing && <button onClick={() => { setImportConfirmOpen(false); setImportPreview(null); }} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)' }}>✕</button>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', padding: '16px 22px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 600 }}>
              <thead>
                <th style={{ ...TH2({ minWidth: 36 }), padding: '7px 8px' }}>#</th>{PREVIEW_COLS.map(c => <th key={c} style={TH2({ minWidth: 90 })}>{c}</th>)}</thead>
              <tbody>
                {pagedPreview.map((v, i) => {
                  const absIdx = (importPreviewPage - 1) * PREV_PAGE_SIZE + i;
                  const C = absIdx % 2 === 0 ? TD : TDalt;
                  return (
                    <tr key={absIdx}>
                      <td style={{ ...C(), color: HC.muted, fontWeight: 700 }}>{absIdx + 1}</td>
                      {PREVIEW_COLS.map(col => <td key={col} style={{ ...C(), fontWeight: col === 'Product Type' || col === 'Vendor Type' ? 700 : 400, color: col === 'Product Type' ? HC.orangeDark : col.includes('Total') ? HC.success : HC.ink2 }}>{getCell(v, col) || <span style={{ color: HC.muted2, fontStyle: 'italic' }}>—</span>}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPrevPages > 1 && <div style={{ padding: '4px 22px', flexShrink: 0 }}><MiniPager page={importPreviewPage} total={totalPrevPages} onChange={setImportPreviewPage} label={`Xem ${(importPreviewPage - 1) * PREV_PAGE_SIZE + 1}–${Math.min(importPreview.length, importPreviewPage * PREV_PAGE_SIZE)} / ${importPreview.length}`} /></div>}
          <div style={{ padding: '14px 22px', background: HC.cream, borderTop: `1.5px solid ${HC.border}`, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ flex: 1, fontSize: 11, color: HC.muted }}>{importing ? '⟳ Đang import...' : `Sẽ thêm ${importPreview.length} vendor`}</div>
            <button onClick={() => { setImportConfirmOpen(false); setImportPreview(null); }} disabled={importing} style={{ padding: '9px 20px', borderRadius: 10, border: `1.5px solid ${HC.border}`, background: HC.surface, color: HC.brown, fontSize: 12, fontWeight: 700, cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.5 : 1 }}>Hủy</button>
            <button onClick={handleConfirmImport} disabled={importing} style={{ padding: '9px 26px', borderRadius: 10, border: 'none', background: importing ? HC.muted2 : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', fontSize: 12, fontWeight: 900, cursor: importing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>{importing ? '⟳ Đang import...' : `✓ Import ${importPreview.length} Vendor`}</button>
          </div>
        </div>
      </div>
    );
  };

  // Tab component
  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '10px 24px',
        borderRadius: 12,
        border: `2px solid ${activeTab === id ? (id === 'bestseller' ? HC.gold : HC.orange) : HC.border}`,
        background: activeTab === id ? (id === 'bestseller' ? HC.goldLight : HC.orangeLight) : HC.surface,
        color: activeTab === id ? (id === 'bestseller' ? HC.gold : HC.orangeDark) : HC.muted,
        fontSize: 13,
        fontWeight: activeTab === id ? 900 : 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.2s'
      }}
      onMouseEnter={e => { if (activeTab !== id) e.currentTarget.style.background = HC.orangePale; }}
      onMouseLeave={e => { if (activeTab !== id) e.currentTarget.style.background = HC.surface; }}
    >
      {icon && <span>{icon}</span>}
      {label}
      {id === 'bestseller' && <BestSellerBadge />}
    </button>
  );

  return (
    <div>
      <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleImportFile} />
      {apiError && <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span>⚠️ {apiError}</span><button onClick={loadVendors} style={{ padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Thử lại</button></div>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: `1.5px solid ${HC.border}`, paddingBottom: 8 }}>
        <TabButton id="all" label="Tất cả Vendor" icon="🏪" />
        <TabButton id="bestseller" label="Best Seller" icon="⭐" />
      </div>

      {/* Product type filter banner */}
      {filterProductType && (
        <div style={{ marginBottom: 14, padding: '12px 18px', borderRadius: 12, background: `linear-gradient(135deg,${HC.orangeLight},${HC.orangeMid})`, border: `1.5px solid ${HC.orange}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔍</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 13, color: HC.ink }}>Đang tìm vendor cho: <span style={{ color: HC.orangeDark }}>"{filterProductType}"</span></div>
            <div style={{ fontSize: 11, color: HC.brown, marginTop: 2 }}>Tích chọn vendor phù hợp rồi nhấn <b>Gán Vendor</b></div>
          </div>
          <button onClick={onClearFilter} style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${HC.orangeDark}`, background: 'rgba(255,255,255,0.6)', color: HC.brown, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>✕ Bỏ lọc</button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: activeTab === 'bestseller' ? HC.gold : HC.ink, fontFamily: "'Nunito',sans-serif" }}>
            {activeTab === 'bestseller' ? '⭐ Best Seller' : 'Tất Cả Vendor'}
            <span style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 999, background: activeTab === 'bestseller' ? HC.goldLight : HC.orangeLight, border: `1.5px solid ${activeTab === 'bestseller' ? '#D4A017' : HC.orangeMid}`, color: activeTab === 'bestseller' ? HC.gold : HC.orangeDark, fontSize: 11, fontWeight: 800 }}>
              {filteredVendors.length}{!filterProductType && vendorList.length !== filteredVendors.length ? ` / ${vendorList.length}` : ''}
            </span>
          </div>

          {!filterProductType && (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: HC.muted, fontSize: 12, pointerEvents: 'none' }}>🔍</span>
              <input type="text" placeholder="Lọc product type..." value={searchFilter} onChange={e => { setSearchFilter(e.target.value); setVPage(1); }} style={{ ...inp3, width: 170, paddingLeft: 28 }} onFocus={e => e.target.style.borderColor = HC.orange} onBlur={e => e.target.style.borderColor = HC.border} />
            </div>
          )}
          {searchFilter && !filterProductType && <button onClick={() => { setSearchFilter(''); setVPage(1); }} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fef2f2', color: HC.danger, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>✕</button>}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {selectedIds.size > 0 && filterProductId && (
            <button onClick={handleAssignVendor} style={{ padding: '9px 20px', borderRadius: 10, background: `linear-gradient(135deg,${HC.success},#15803d)`, color: '#fff', border: 'none', fontSize: 12, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <span>✅</span> Gán {selectedIds.size} Vendor
            </button>
          )}
          <button onClick={loadVendors} style={{ padding: '7px 14px', borderRadius: 9, border: `1.5px solid ${HC.border}`, background: HC.cream, color: HC.brown, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>↻ Làm mới</button>
          <button
            onClick={openCreateVendorModal}  // ← ĐỔI THÀNH openCreateVendorModal
            style={{ padding: '9px 16px', borderRadius: 10, background: HC.cream, border: `1.5px solid ${HC.border}`, color: HC.brown, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
            {activeTab === 'bestseller' ? '⭐ Tạo Best Seller' : '＋ Thêm thủ công'}
          </button>
          <button onClick={() => importFileRef.current?.click()} style={{ padding: '9px 20px', borderRadius: 10, background: activeTab === 'bestseller' ? `linear-gradient(135deg,#FFD700,#FFA500)` : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: activeTab === 'bestseller' ? '#7A5C00' : '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <span>📥</span> Import
          </button>
          <button onClick={handleExportSample} style={{ padding: '9px 20px', borderRadius: 10, background: `linear-gradient(135deg,${HC.brown},${HC.brownLight})`, color: '#fff', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <span>📤</span> Export
          </button>
        </div>
      </div>

      {/* Selected count bar */}
      {selectedIds.size > 0 && (
        <div style={{ marginBottom: 12, padding: '10px 16px', borderRadius: 12, background: '#ecfdf5', border: '1.5px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: HC.success }}>✓ Đã chọn {selectedIds.size} vendor</span>
          <button onClick={() => setSelectedIds(new Set())} style={{ padding: '3px 10px', borderRadius: 6, border: `1px solid ${HC.success}`, background: 'transparent', color: HC.success, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Bỏ chọn tất cả</button>
          {!filterProductId && <span style={{ fontSize: 11, color: '#92400e' }}>⚠️ Để gán vendor, vào Products → nhấn "Tìm Vendor".</span>}
        </div>
      )}



      {/* Table */}
      {loading ? <Spinner /> : filteredVendors.length === 0 && !showVForm ? (
        <EmptyState msg={activeTab === 'bestseller'
          ? <span>Chưa có Best Seller vendor nào. Nhấn <b style={{ color: HC.gold }}>⭐ Tạo Best Seller</b> để bắt đầu.</span>
          : <span>Chưa có vendor. Nhấn <b style={{ color: HC.orange }}>📥 Import</b> để bắt đầu.</span>}
        />
      ) : filteredVendors.length > 0 && (
        <div style={{ borderRadius: 16, border: `1.5px solid ${activeTab === 'bestseller' ? '#D4A017' : HC.border}`, boxShadow: activeTab === 'bestseller' ? '0 8px 32px rgba(212,160,23,0.15)' : HC.shadow, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1000 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      ...TH2({ minWidth: 44, width: 44 }),
                      cursor: 'pointer',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      padding: '8px 4px'
                    }}
                    onClick={toggleAll}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%'
                    }}>
                      <div style={{
                        width: 18,
                        height: 18,
                        borderRadius: 4,
                        border: `2px solid ${pageAllSelected ? '#fff' : 'rgba(255,255,255,0.5)'}`,
                        background: pageAllSelected ? '#fff' : pageSomeSelected ? 'rgba(255,255,255,0.4)' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease'
                      }}>
                        {pageAllSelected && <span style={{ color: activeTab === 'bestseller' ? HC.gold : HC.orangeDark, fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                        {!pageAllSelected && pageSomeSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>–</span>}
                      </div>
                    </div>
                  </th>
                  <th rowSpan={2} style={{ ...TH2(), minWidth: 36 }}>ID</th>
                  <th rowSpan={2} style={{ ...TH2(), minWidth: 130 }}>Vendor Name</th>
                  <th rowSpan={2} style={TH2({ minWidth: 110 })}>Vendor Type</th>
                  <th rowSpan={2} style={{ ...TH2(), minWidth: 120 }}>Product Type</th>
                  <th rowSpan={2} style={{ ...TH2({ minWidth: 90, background: activeTab === 'bestseller' ? '#C8A000' : HC.orange }), color: '#fff' }}>💰 Pricing</th>  {/* ← Cột Pricing mới */}
                  <th colSpan={2} style={TH2()}>Detail</th>
                  <th colSpan={2} style={{ ...TH2(), background: activeTab === 'bestseller' ? '#C8A000' : HC.orange }}>Economy</th>
                  <th colSpan={2} style={{ ...TH2(), background: activeTab === 'bestseller' ? HC.gold : HC.orangeDark }}>Fast</th>
                  <th colSpan={2} style={{ ...TH2(), background: activeTab === 'bestseller' ? '#C8A000' : HC.orange }}>Express</th>
                  <th colSpan={2} style={{ ...TH2(), background: activeTab === 'bestseller' ? HC.gold : HC.orangeDark }}>Overnight</th>
                  <th rowSpan={2} style={{ ...TH2(), background: activeTab === 'bestseller' ? '#8B6914' : HC.orangeDeep, minWidth: 90 }}>Thao tác</th>
                </tr>
                <tr>
                  <th style={{ ...TH2({ background: 'transparent', border: 'none' }), height: 0, padding: 0 }} />
                  <th style={TH2({ minWidth: 80 })}>Size</th>
                  <th style={TH2({ minWidth: 90 })}>Optional</th>
                  {['Economy', 'Fast', 'Express', 'Overnight'].map(s => [
                    <th key={`${s}-p`} style={TH2({ minWidth: 85, background: (s === 'Fast' || s === 'Overnight') ? (activeTab === 'bestseller' ? HC.gold : HC.orangeDark) : (activeTab === 'bestseller' ? '#C8A000' : HC.orange) })}>Price Ship</th>,
                    <th key={`${s}-t`} style={TH2({ minWidth: 100, background: (s === 'Fast' || s === 'Overnight') ? (activeTab === 'bestseller' ? HC.gold : HC.orangeDark) : (activeTab === 'bestseller' ? '#C8A000' : HC.orange) })}>Total</th>,
                  ]).flat()}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows = [];
                  for (let i = 0; i < pagedVendors.length; i++) {
                    const v = pagedVendors[i];
                    const absIdx = (vPage - 1) * VENDOR_PAGE_SIZE + i;
                    const C = absIdx % 2 === 0 ? TD : TDalt;
                    const isSelected = selectedIds.has(v.id);
                    const totalPricing = (v.pricing1 || 0) + (v.pricing2 || 0);
                    const vendorName = ((v.name || v.vendor_type || '—') || '').toString().trim();
                    const prevVendorName = i > 0 ? (((pagedVendors[i - 1].name || pagedVendors[i - 1].vendor_type || '—') || '').toString().trim()) : null;
                    const isSameAsPrev = i > 0 && vendorName === prevVendorName;

                    let rowSpan = 1;
                    if (!isSameAsPrev && vendorName) {
                      for (let j = i + 1; j < pagedVendors.length; j++) {
                        const nextName = (((pagedVendors[j].name || pagedVendors[j].vendor_type || '—') || '').toString().trim());
                        if (nextName !== vendorName) break;
                        rowSpan++;
                      }
                    }

                    rows.push(
                      <tr key={v.id || absIdx} style={{ background: isSelected ? (activeTab === 'bestseller' ? '#FFFDE7' : `${HC.orange}12`) : undefined }} onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.97)'} onMouseLeave={e => e.currentTarget.style.filter = 'none'}>
                        <td
                          style={{
                            ...C(),
                            cursor: 'pointer',
                            width: 44,
                            textAlign: 'center',
                            verticalAlign: 'middle',
                            padding: '8px 4px'
                          }}
                          onClick={() => toggleSelect(v.id)}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%'
                          }}>
                            <div style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              border: `2px solid ${isSelected ? (activeTab === 'bestseller' ? HC.gold : HC.orange) : HC.muted2}`,
                              background: isSelected ? (activeTab === 'bestseller' ? HC.gold : HC.orange) : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease'
                            }}>
                              {isSelected && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...C(), color: HC.muted, fontWeight: 700 }}>{absIdx + 1}</td>
                        {!isSameAsPrev && (
                          <td rowSpan={rowSpan} style={{ ...C(), fontWeight: 800, color: HC.ink2, verticalAlign: 'middle' }}>
                            {vendorName}
                          </td>
                        )}
                        <td style={{ ...C(), fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {v.vendor_type === 'Best Seller' ? (
                            <BestSellerBadge />
                          ) : (
                            v.vendor_type || '—'
                          )}
                        </td>
                        <td style={{ ...C(), fontWeight: 800, color: activeTab === 'bestseller' ? HC.gold : HC.orange }}>{v.product_type || '—'}</td>
                        <td style={{ ...C(), fontWeight: 800, color: HC.success, fontSize: 13 }}>
                          ${totalPricing.toFixed(2)}
                        </td>
                        <td style={C()}>{v.size || '—'}</td>
                        <td style={C()}>{v.optional || '—'}</td>
                        <td style={{ ...C(), borderLeft: `2px solid ${HC.border}` }}>{fmt(v.eco_price)}</td>
                        <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.eco_total)}</td>
                        <td style={C()}>{fmt(v.fast_price)}</td>
                        <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.fast_total)}</td>
                        <td style={C()}>{fmt(v.express_price)}</td>
                        <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.express_total)}</td>
                        <td style={C()}>{fmt(v.overnight_price)}</td>
                        <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt(v.overnight_total)}</td>
                        <td style={C()}>
                          <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                            <button onClick={() => openEditVendorModal(v)} style={{ padding: '4px 10px', borderRadius: 7, border: `1.5px solid ${activeTab === 'bestseller' ? '#D4A017' : HC.orangeMid}`, background: activeTab === 'bestseller' ? HC.goldLight : HC.orangeLight, color: activeTab === 'bestseller' ? HC.gold : HC.orangeDark, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Sửa</button>
                            <button onClick={() => handleVDelete(v)} style={{ padding: '4px 10px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fef2f2', color: HC.danger, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Xóa</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return rows;
                })()}
              </tbody>
            </table>
          </div>
          <MiniPager page={vPage} total={totalVPages} onChange={setVPage} label={`Hiển thị ${(vPage - 1) * VENDOR_PAGE_SIZE + 1}–${Math.min(vPage * VENDOR_PAGE_SIZE, filteredVendors.length)} / ${filteredVendors.length} vendor`} />
        </div>
      )}

      <ImportConfirmModal />
      {/* Modal Vendor */}
      {
        vendorModalOpen && (
          <div
            onClick={closeVendorModal}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(26,15,0,0.6)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 2000,
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: 700,
                maxWidth: '90%',
                maxHeight: '85vh',
                overflowY: 'auto',
                background: HC.surface,
                borderRadius: 20,
                boxShadow: '0 32px 80px rgba(26,15,0,0.28)',
                border: `1.5px solid ${HC.border}`,
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '18px 24px',
                background: activeTab === 'bestseller' ? `linear-gradient(135deg, #FFD700, #FFA500)` : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
                borderRadius: '20px 20px 0 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>{vendorModalMode === 'edit' ? '✏️' : (activeTab === 'bestseller' ? '⭐' : '➕')}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>
                      {vendorModalMode === 'edit' ? 'Sửa Vendor' : (activeTab === 'bestseller' ? 'Tạo Best Seller Vendor' : 'Thêm mới Vendor')}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                      {vendorModalMode === 'edit' ? 'Chỉnh sửa thông tin nhà cung cấp' : 'Nhập thông tin nhà cung cấp mới'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeVendorModal}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    fontSize: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px' }}>
                {/* Vendor Name */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
                    Vendor Name
                  </label>
                  <input
                    type="text"
                    value={vForm.name}
                    onChange={vf('name')}
                    placeholder="Tên nhà cung cấp..."
                    style={inp3}
                  />
                </div>

                {/* Product Type & Vendor Type & Size */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
                      Product Type <span style={{ color: HC.danger }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={vForm.product_type}
                      onChange={vf('product_type')}
                      placeholder="VD: Áo thun..."
                      style={inp3}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
                      Vendor Type <span style={{ color: HC.danger }}>*</span>
                    </label>
                    <select
                      value={vForm.vendor_type}
                      onChange={vf('vendor_type')}
                      style={inp3}
                    >
                      <option value="">-- Chọn --</option>
                      {VENDOR_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
                      Size
                    </label>
                    <input
                      type="text"
                      value={vForm.size}
                      onChange={vf('size')}
                      placeholder="VD: M, L, XL..."
                      style={inp3}
                    />
                  </div>
                </div>

                {/* Optional & Pricing */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
                      Optional
                    </label>
                    <input
                      type="text"
                      value={vForm.optional}
                      onChange={vf('optional')}
                      placeholder="Tùy chọn..."
                      style={inp3}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 8, display: 'block' }}>
                      Pricing <span style={{ color: HC.danger }}>*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={vForm.pricing}
                      onChange={vf('pricing')}
                      placeholder="0.00"
                      style={inp3}
                    />
                  </div>
                </div>

                {/* Shipping Methods */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 12, display: 'block' }}>
                    🚚 Phương thức vận chuyển
                  </div>
                  {[
                    { label: 'Economy', priceKey: 'eco_price', totalKey: 'eco_total', color: '#16a34a' },
                    { label: 'Fast', priceKey: 'fast_price', totalKey: 'fast_total', color: '#f59e0b' },
                    { label: 'Express', priceKey: 'express_price', totalKey: 'express_total', color: '#3b82f6' },
                    { label: 'Overnight', priceKey: 'overnight_price', totalKey: 'overnight_total', color: '#8b5cf6' }
                  ].map((method, idx) => (
                    <div key={idx} style={{ marginBottom: 12, padding: '12px', background: HC.surface2, borderRadius: 12, border: `1px solid ${HC.border}` }}>
                      <div style={{ fontWeight: 800, fontSize: 12, color: method.color, marginBottom: 8 }}>🚚 {method.label}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: HC.muted, marginBottom: 4, display: 'block' }}>Price Ship</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={vForm[method.priceKey]}
                            onChange={vf(method.priceKey)}
                            placeholder="0.00"
                            style={inp3}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: HC.muted, marginBottom: 4, display: 'block' }}>Total (fulfill)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={vForm[method.totalKey]}
                            onChange={vf(method.totalKey)}
                            placeholder="0.00"
                            style={inp3}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: `1.5px solid ${HC.border}`,
                background: HC.cream,
                borderRadius: '0 0 20px 20px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
                flexShrink: 0
              }}>
                <button
                  onClick={closeVendorModal}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 10,
                    background: HC.surface,
                    border: `1.5px solid ${HC.border}`,
                    color: HC.brown,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={handleVSubmit}
                  disabled={submitting}
                  style={{
                    padding: '10px 28px',
                    borderRadius: 10,
                    background: submitting ? HC.muted2 : (activeTab === 'bestseller' ? `linear-gradient(135deg, #FFD700, #FFA500)` : `linear-gradient(135deg, ${HC.success}, #15803d)`),
                    color: submitting ? '#fff' : (activeTab === 'bestseller' ? '#7A5C00' : '#fff'),
                    border: 'none',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  {submitting ? '⟳ Đang xử lý...' : (vendorModalMode === 'edit' ? '✓ Cập nhật' : '💾 Lưu Vendor')}
                </button>
              </div>
            </div>
          </div>
        )
      }
      {/* Modal xác nhận xóa */}
      {deleteModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            style={{
              width: 400, background: '#fff', borderRadius: 20,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px', textAlign: 'center',
              background: 'linear-gradient(135deg, #fef2f2, #fff)',
              borderBottom: '1px solid #fecaca'
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: '#fee2e2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px', fontSize: 28
              }}>⚠️</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#dc2626' }}>Xóa Vendor</h3>
              <p style={{ fontSize: 12, color: '#7a5c32', marginTop: 6 }}>Hành động không thể hoàn tác</p>
            </div>

            {/* Body */}
            <div style={{ padding: '20px' }}>
              <div style={{
                background: '#fef3dc', borderRadius: 12, padding: '14px',
                textAlign: 'center', marginBottom: 20
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#e09415' }}>
                  {vendorToDelete?.vendor_type || '—'}
                </div>
                <div style={{ fontSize: 11, color: '#9c7a50', marginTop: 4 }}>
                  {vendorToDelete?.product_type || '—'}
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => { setDeleteModalOpen(false); setVendorToDelete(null); }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    border: '1px solid #e8d4a8', background: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    console.log('🔥 Nút Xóa được click');
                    confirmDelete();
                  }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 10,
                    border: 'none', background: '#dc2626', color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Toast thông báo */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1300,
          animation: 'slideInRight 0.3s ease-out, fadeOut 0.3s ease-out 4.7s forwards',
        }}>
          <div style={{
            background: toast.type === 'success'
              ? `linear-gradient(135deg, ${HC.success}, #15803d)`
              : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
            borderRadius: 12,
            boxShadow: HC.shadowStrong,
            minWidth: 280,
            maxWidth: 380,
          }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 22 }}>{toast.type === 'success' ? '✅' : '🔔'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 13, fontFamily: "'Nunito',sans-serif", marginBottom: 2, color: '#fff' }}>
                  {toast.title}
                </div>
                <div style={{ fontSize: 11, opacity: 0.9, fontFamily: "'Nunito Sans',sans-serif", lineHeight: 1.4, color: '#fff' }}>
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
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
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

      {/* CSS animations */}
      <style>{`
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @keyframes modalSlideUp {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes fadeOut {
    to {
      opacity: 0;
      transform: translateX(100%);
    }
  }
  
  @keyframes progressBar {
    from {
      width: 100%;
    }
    to {
      width: 0%;
    }
  }
`}</style>
    </div>
  );
}
// ══════════════════════════════════════════════════════════
//  NOTIFICATION CENTER FOR STAFF B (2 TABS)
// ══════════════════════════════════════════════════════════
function StaffBNotificationCenter({
  requestNotifications,
  newsNotifications,
  markRequestAsRead,
  markNewsAsRead,
  onRequestClick,
  onNewsClick
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('requests');
  const [localRequests, setLocalRequests] = useState(requestNotifications || []);
  const [localNews, setLocalNews] = useState(newsNotifications || []);

  useEffect(() => {
    setLocalRequests(requestNotifications || []);
  }, [requestNotifications]);

  useEffect(() => {
    setLocalNews(newsNotifications || []);
  }, [newsNotifications]);

  const unreadRequests = localRequests.filter(n => !n.read).length;
  const unreadNews = localNews.filter(n => !n.read).length;
  const totalUnread = unreadRequests + unreadNews;

  const handleRequestClick = (notif) => {
    if (!notif.read && markRequestAsRead) {
      markRequestAsRead(notif.id);
      setLocalRequests(prev =>
        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
      );
    }
    if (onRequestClick) {
      onRequestClick(notif);
    }
    setIsOpen(false);
  };
  const handleNewsClick = (notif) => {
    if (!notif.read && markNewsAsRead) {
      markNewsAsRead(notif.id);
      setLocalNews(prev =>
        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
      );
    }
    if (onNewsClick) {
      onNewsClick(notif);
    }
    setIsOpen(false);
  };

  const markAllRequestsAsRead = () => {
    localRequests.forEach(n => {
      if (!n.read && markRequestAsRead) markRequestAsRead(n.id);
    });
    setLocalRequests(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const markAllNewsAsRead = () => {
    localNews.forEach(n => {
      if (!n.read && markNewsAsRead) markNewsAsRead(n.id);
    });
    setLocalNews(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: HC.orangeLight,
          border: `1px solid ${HC.orangeMid}`,
          borderRadius: 30,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = HC.orangeMid;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = HC.orangeLight;
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <BellOutlined style={{ fontSize: 20, color: HC.orangeDark }} />
        {totalUnread > 0 && (
          <span style={{
            position: 'absolute',
            top: -5,
            right: -5,
            background: HC.danger,
            color: '#fff',
            fontSize: 10,
            fontWeight: 900,
            width: 20,
            height: 20,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${HC.surface}`,
          }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
            }}
          />
          <div style={{
            position: 'absolute',
            top: 50,
            right: 0,
            width: 420,
            maxHeight: 550,
            background: HC.surface,
            borderRadius: 16,
            boxShadow: HC.shadowStrong,
            border: `1.5px solid ${HC.border}`,
            zIndex: 999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header with 2 tabs */}
            <div style={{
              padding: '14px 18px',
              background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              color: '#fff',
            }}>
              <div style={{ fontWeight: 900, fontSize: 14, fontFamily: "'Nunito',sans-serif", marginBottom: 12 }}>
                🔔 Trung tâm thông báo
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setActiveTab('requests')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: activeTab === 'requests' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: "'Nunito',sans-serif",
                    transition: 'all 0.2s',
                  }}
                >
                  📋 Yêu cầu
                  {unreadRequests > 0 && (
                    <span style={{
                      background: '#fff',
                      color: HC.orangeDark,
                      borderRadius: 20,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 900,
                    }}>
                      {unreadRequests}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('news')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: activeTab === 'news' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: "'Nunito',sans-serif",
                    transition: 'all 0.2s',
                  }}
                >
                  📰 Tin tức
                  {unreadNews > 0 && (
                    <span style={{
                      background: '#fff',
                      color: HC.orangeDark,
                      borderRadius: 20,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 900,
                    }}>
                      {unreadNews}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Tab Yêu Cầu Content */}
            {activeTab === 'requests' && (
              <div style={{ overflowY: 'auto', maxHeight: 420 }}>
                <div style={{
                  padding: '10px 16px',
                  background: HC.cream,
                  borderBottom: `1px solid ${HC.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>
                    📋 Yêu cầu từ Admin & Staff A
                  </span>
                  {unreadRequests > 0 && (
                    <button
                      onClick={markAllRequestsAsRead}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: HC.orange,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>

                {localRequests.length === 0 ? (
                  <div style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: HC.muted,
                  }}>
                    <span style={{ fontSize: 48, opacity: 0.5 }}>📭</span>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Không có yêu cầu mới</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Thông báo từ Admin và Staff A sẽ hiển thị tại đây</div>
                  </div>
                ) : (
                  localRequests.map((notif, idx) => {
                    let icon = '📋';
                    let bgColor = notif.read ? HC.surface : HC.orangeLight;

                    if (notif.type === 'approved' || notif.type === 'product_approved') {
                      icon = '✅';
                      bgColor = notif.read ? HC.surface : '#ecfdf5';
                    } else if (notif.type === 'sample_approved') {
                      icon = '✅';
                      bgColor = notif.read ? HC.surface : '#ecfdf5';
                    } else if (notif.type === 'sample_rejected') {
                      icon = '❌';
                      bgColor = notif.read ? HC.surface : '#fef2f2';
                    } else if (notif.type === 'seller_feedback') {
                      icon = '💬';
                      bgColor = notif.read ? HC.surface : HC.orangeLight;
                    } else if (notif.type === 'staff_a_approved_vendor') {
                      icon = '✅';
                      bgColor = notif.read ? HC.surface : '#ecfdf5';
                    }
                    return (
                      <div
                        key={notif.id || idx}
                        onClick={() => handleRequestClick(notif)}
                        style={{
                          padding: '14px 16px',
                          borderBottom: `1px solid ${HC.border}`,
                          background: bgColor,
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = HC.orangePale}
                        onMouseLeave={e => e.currentTarget.style.background = bgColor}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ fontSize: 24 }}>{icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: 800,
                              fontSize: 13,
                              color: notif.read ? HC.muted : HC.ink,
                              fontFamily: "'Nunito',sans-serif",
                            }}>
                              {notif.title}
                            </div>
                            <div style={{
                              fontSize: 12,
                              color: HC.brown,
                              marginTop: 6,
                              lineHeight: 1.4,
                              whiteSpace: 'pre-wrap',
                            }}>
                              {notif.message}
                            </div>
                            <div style={{
                              display: 'flex',
                              gap: 12,
                              marginTop: 8,
                              fontSize: 10,
                              color: HC.muted2,
                            }}>
                              <span>🕒 {notif.time || new Date(notif.timestamp || Date.now()).toLocaleString('vi-VN')}</span>
                              {notif.productType && <span>📦 {notif.productType}</span>}
                              {notif.vendorType && <span>🏪 {notif.vendorType}</span>}
                              {notif.sellerName && <span>👤 {notif.sellerName}</span>}
                            </div>
                          </div>
                          {!notif.read && (
                            <div style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: notif.type === 'approved' || notif.type === 'sample_approved' ? HC.success :
                                notif.type === 'sample_rejected' ? HC.danger : HC.orange,
                              flexShrink: 0,
                              marginTop: 8,
                            }} />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Tab Tin Tức Content */}
            {activeTab === 'news' && (
              <div style={{ overflowY: 'auto', maxHeight: 420 }}>
                <div style={{
                  padding: '10px 16px',
                  background: HC.cream,
                  borderBottom: `1px solid ${HC.border}`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>
                    📰 Tin tức & Cập nhật
                  </span>
                  {unreadNews > 0 && (
                    <button
                      onClick={markAllNewsAsRead}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: HC.orange,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>

                {localNews.length === 0 ? (
                  <div style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    color: HC.muted,
                  }}>
                    <span style={{ fontSize: 48, opacity: 0.5 }}>📰</span>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Chưa có tin tức mới</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Thông báo chung sẽ hiển thị tại đây</div>
                  </div>
                ) : (
                  localNews.map((notif, idx) => (
                    <div
                      key={notif.id || idx}
                      onClick={() => handleNewsClick(notif)}
                      style={{
                        padding: '14px 16px',
                        borderBottom: `1px solid ${HC.border}`,
                        background: notif.read ? HC.surface : HC.orangeLight,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = HC.orangePale}
                      onMouseLeave={e => e.currentTarget.style.background = notif.read ? HC.surface : HC.orangeLight}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>{notif.icon || '📰'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontWeight: 800,
                            fontSize: 13,
                            color: notif.read ? HC.muted : HC.ink,
                            fontFamily: "'Nunito',sans-serif",
                          }}>
                            {notif.title}
                          </div>
                          <div style={{
                            fontSize: 12,
                            color: HC.brown,
                            marginTop: 6,
                            lineHeight: 1.4,
                          }}>
                            {notif.message}
                          </div>
                          <div style={{
                            fontSize: 10,
                            color: HC.muted2,
                            marginTop: 8,
                          }}>
                            🕒 {notif.time || new Date(notif.timestamp || Date.now()).toLocaleString('vi-VN')}
                          </div>
                        </div>
                        {!notif.read && (
                          <div style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: HC.orange,
                            flexShrink: 0,
                            marginTop: 8,
                          }} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div style={{
              padding: '10px 16px',
              borderTop: `1px solid ${HC.border}`,
              background: HC.cream,
              textAlign: 'center',
            }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: HC.orange,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Nunito',sans-serif",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  MAIN DASHBOARD
// ══════════════════════════════════════════════════════════
export default function StaffDashboard() {
  const { user, logout } = useAuth();
  const [active, setActive] = useState('products');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterProductType, setFilterProductType] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [requestNotifications, setRequestNotifications] = useState([]);
  const [newsNotifications, setNewsNotifications] = useState([]);
  const [productsKey, setProductsKey] = useState(0);
  const [showSampleDetailModal, setShowSampleDetailModal] = useState(false);
  const [currentSampleNotification, setCurrentSampleNotification] = useState(null);

  // Load Request Notifications (Admin duyệt form + Staff A phản hồi sample)
  const loadRequestNotifications = useCallback(() => {
    const requests = [];

    // 1. Từ API (Admin duyệt form)
    notificationApi.list()
      .then(r => {
        const apiNotifs = r.data.data || [];
        apiNotifs.forEach(n => {
          if (n.type === 'approved') {
            requests.push({
              id: `api_${n.id}`,
              type: 'approved',
              source: 'admin',
              icon: '✅',
              title: '✅ Form sản phẩm đã được duyệt',
              message: `Form sản phẩm "${n.product_type || ''}" của Seller "${n.seller_name || 'Seller'}" đã được Admin duyệt.`,
              time: new Date(n.created_at).toLocaleString('vi-VN'),
              read: n.is_read || false,
              productId: n.product_id,
              productType: n.product_type,
              sellerName: n.seller_name,
              timestamp: n.created_at
            });
          }
        });
      })
      .catch(() => { });

    // 2. Từ STAFF_A_NOTIFICATIONS (Staff A phản hồi sample)
    try {
      const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      staffANotifs.forEach(n => {
        if (n.type === 'sample_approved' || n.type === 'sample_rejected') {
          const isApproved = n.type === 'sample_approved';
          requests.push({
            id: `staffa_${n.id}`,
            type: n.type,
            source: 'staffA',
            icon: isApproved ? '✅' : '❌',
            title: isApproved ? '✅ Seller đồng ý đặt Sample' : '❌ Seller từ chối đặt Sample',
            message: n.message || '',
            time: n.time || new Date(n.timestamp || Date.now()).toLocaleString('vi-VN'),
            read: n.read || false,
            productId: n.productId,
            productType: n.productType,
            vendorType: n.vendorType,
            sellerName: n.sellerName,
            sampleDetails: n.sampleDetails,
            timestamp: n.timestamp || Date.now()
          });
        }
      });
    } catch (err) { }

    // 3. 🆕 Từ STAFF_B_NOTIFICATIONS (Admin duyệt sản phẩm)
    try {
      const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
      staffBNotifs.forEach(n => {
        if (n.type === 'staff_a_approved_vendor') {
          requests.push({
            id: `staffb_${n.id}`,
            type: 'staff_a_approved_vendor',
            source: 'staffA',
            icon: n.icon || '✅',
            title: n.title || '✅ Staff A đã xác nhận vendor',
            message: n.message || '',
            time: n.time || new Date(n.timestamp || Date.now()).toLocaleString('vi-VN'),
            read: n.is_read || false,
            productId: n.productId,
            productType: n.productName || n.productType,
            vendorType: n.vendorType,
            sellerFeedback: n.sellerFeedback,
            timestamp: n.timestamp || n.id
          });
        }
      });
    } catch (err) { console.error('Lỗi load staff_a_approved_vendor:', err); }

    // Sắp xếp theo thời gian mới nhất
    requests.sort((a, b) => new Date(b.time) - new Date(a.time));
    setRequestNotifications(requests.slice(0, 100));
  }, []);
  const loadNewsNotifications = useCallback(() => {
    const news = [];
    try {
      const allNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
      const newsNotifs = allNotifs.filter(n => n.type === 'news');
      newsNotifs.forEach(n => {
        news.push({
          id: `news_${n.id}`,
          type: 'news',
          icon: n.icon || '📰',
          title: n.title || '📰 Tin tức mới',
          message: n.message || '',
          time: n.time || new Date(n.created_at || Date.now()).toLocaleString('vi-VN'),
          read: n.read || false,
          timestamp: n.created_at || Date.now()
        });
      });
    } catch (err) {
      console.error('Lỗi load tin tức:', err);
    }

    news.sort((a, b) => new Date(b.time) - new Date(a.time));
    setNewsNotifications(news.slice(0, 100));
  }, []);

  // Mark request as read
  // Thay thế hàm markRequestAsRead hiện tại
  const markRequestAsRead = useCallback(async (notificationId) => {
    // 1. Nếu là thông báo từ API (api_xxx)
    if (notificationId.startsWith('api_')) {
      const realId = notificationId.replace('api_', '');
      try {
        await notificationApi.markAsRead(realId);
      } catch (err) {
        console.error('Lỗi cập nhật read trên server:', err);
        // Vẫn cập nhật local để tránh làm phiền user
      }
    }
    // 2. Nếu là thông báo từ Staff A (staffa_xxx)
    else if (notificationId.startsWith('staffb_')) {
      try {
        const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
        const originalId = notificationId.replace('staffb_', '');
        const updated = staffBNotifs.map(n =>
          String(n.id) === originalId ? { ...n, is_read: true } : n
        );
        localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(updated));
        // dispatch event để các tab khác đồng bộ (nếu cần)
        window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS' }));
      } catch (err) { console.error('Lỗi cập nhật read staffb:', err); }
    }

    setRequestNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  // Mark news as read
  const markNewsAsRead = useCallback((notificationId) => {
    try {
      const allNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
      const updated = allNotifs.map(n =>
        String(n.id) === notificationId.replace('news_', '') ? { ...n, read: true } : n
      );
      localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(updated));
    } catch (err) { }

    setNewsNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  // Click vào request notification
  const handleRequestClick = useCallback((notification) => {
    if (notification.productId) {
      setActive('products');
      setSelectedProductId(notification.productId);
    }
  }, []);

  // Click vào news notification
  const handleNewsClick = useCallback((notification) => {
    console.log('Click vào tin tức:', notification);
  }, []);

  // Refresh notifications periodically
  useEffect(() => {
    loadRequestNotifications();
    loadNewsNotifications();

    const interval = setInterval(() => {
      loadRequestNotifications();
      loadNewsNotifications();
    }, 100000);

    const handleStorageChange = (e) => {
      if (e.key === 'STAFF_A_NOTIFICATIONS') {
        loadRequestNotifications();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadRequestNotifications, loadNewsNotifications]);

  // Navigate to library vendor
  const handleGotoVendors = (productType, productId) => {
    setFilterProductType(productType);
    setFilterProductId(String(productId));
    setActive('library');
  };

  const handleAssignComplete = () => {
    setActive('products');
  };

  const renderSection = () => {
    switch (active) {
      case 'products':
        return <ProductsSection
          onGotoVendors={handleGotoVendors}
          selectedProductId={selectedProductId}
          setSelectedProductId={setSelectedProductId}
        />;
      case 'library':
        return <VendorsSection
          filterProductType={filterProductType}
          filterProductId={filterProductId}
          onClearFilter={() => { setFilterProductType(''); setFilterProductId(''); }}
          onAssignComplete={handleAssignComplete}
        />;
      case 'news':
        return <NewsManagementSection />;
      default: return null;
    }
  };

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');*{box-sizing:border-box;}::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-track{background:${HC.cream};}::-webkit-scrollbar-thumb{background:${HC.orangeMid};border-radius:99px;}::-webkit-scrollbar-thumb:hover{background:${HC.orange};}@keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.8;transform:scale(1.15);}}`}</style>
      <div style={{ display: 'flex', height: '100vh', background: HC.orangePale, fontFamily: "'Nunito Sans',sans-serif", color: HC.ink, overflow: 'hidden' }}>

        {/* Sidebar (giữ nguyên) */}
        <div style={{
          width: sidebarOpen ? 280 : 80,
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '2px 0 12px rgba(0, 0, 0, 0.05)',
          borderRight: `1px solid ${HC.border}`,
        }}>
          {/* Decorative Pattern */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(circle at 20% 40%, ${HC.orange}08 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            pointerEvents: 'none',
            opacity: 0.4,
          }} />

          {/* Logo */}
          <div style={{
            padding: sidebarOpen ? '28px 24px' : '28px 20px',
            borderBottom: `1px solid ${HC.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifyContent: sidebarOpen ? 'space-between' : 'center',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${HC.orange}10, ${HC.orange}05)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1px solid ${HC.orange}20`,
                boxShadow: `0 2px 8px ${HC.orange}10`,
                flexShrink: 0,
              }}>
                <HCLogo size={28} color={HC.orange} />
              </div>
              {sidebarOpen && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <div style={{
                    color: HC.ink,
                    fontWeight: 900,
                    fontSize: 16,
                    fontFamily: "'Nunito',sans-serif",
                    letterSpacing: '-0.02em',
                  }}>
                    Happy Creative
                  </div>
                  <div style={{
                    color: HC.orange,
                    fontSize: 10,
                    letterSpacing: '0.2em',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    marginTop: 2,
                  }}>
                    Vendor Dashboard
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Info Card */}
          {sidebarOpen && (
            <div style={{
              margin: '20px 16px',
              padding: '16px',
              borderRadius: 16,
              background: `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`,
              border: `1px solid ${HC.orangeMid}`,
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#fff',
                }}>
                  <ShopOutlined />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>
                    {(user?.name === 'Vendor' ? 'Vendor' : user?.name) || 'Vendor'}
                  </div>
                  <div style={{ fontSize: 10, color: HC.brown, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <StarFilled style={{ fontSize: 10, color: HC.orange }} />
                    <span>Vendor</span>
                  </div>
                </div>
              </div>
              <div style={{
                fontSize: 10,
                color: HC.muted,
                paddingTop: 8,
                borderTop: `1px solid ${HC.orangeMid}`,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <CalendarOutlined style={{ fontSize: 10 }} />
                <span>Last login: {new Date().toLocaleDateString('vi-VN')}</span>
              </div>
            </div>
          )}

          {/* Navigation Menu */}
          <nav style={{
            flex: 1,
            padding: sidebarOpen ? '8px 16px' : '8px 12px',
            marginTop: 8,
          }}>
            {MENU.map(item => {
              const isActive = active === item.id;
              const isBest = item.id === 'library';
              return (
                <div
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = !isActive ? 'translateX(4px)' : 'none'; e.currentTarget.style.background = !isActive ? (isBest ? `${HC.gold}10` : `${HC.orange}10`) : undefined; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: sidebarOpen ? '12px 16px' : '12px',
                    marginBottom: 6,
                    borderRadius: 12,
                    background: isActive
                      ? (isBest ? `${HC.goldLight}` : `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`)
                      : 'transparent',
                    border: `1px solid ${isActive ? (isBest ? HC.goldMid : HC.orangeMid) : 'transparent'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {isActive && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3,
                      height: 32,
                      background: isBest
                        ? `linear-gradient(180deg, ${HC.gold}, #FFA500)`
                        : `linear-gradient(180deg, ${HC.orange}, ${HC.orangeDark})`,
                      borderRadius: '0 4px 4px 0',
                    }} />
                  )}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    background: isActive
                      ? (isBest ? `${HC.gold}20` : `linear-gradient(135deg, ${HC.orange}20, ${HC.orange}10)`)
                      : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    color: isActive ? (isBest ? HC.gold : HC.orange) : HC.muted,
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  {sidebarOpen && (
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: isActive ? 800 : 600,
                        color: isActive ? (isBest ? HC.gold : HC.orangeDark) : HC.brown,
                        fontFamily: "'Nunito',sans-serif",
                        transition: 'color 0.2s ease',
                      }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontSize: 10,
                        color: HC.muted,
                        marginTop: 2,
                        fontFamily: "'Nunito Sans',sans-serif",
                        opacity: 0.7,
                      }}>
                        {item.id === 'products' ? 'Form Approval Management' : 'Vendor Library'}
                      </div>
                    </div>
                  )}
                  {!sidebarOpen && isActive && (
                    <div style={{
                      position: 'absolute',
                      right: 8,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: isBest ? HC.gold : HC.orange,
                    }} />
                  )}
                </div>
              );
            })}
          </nav>

          {/* Footer Actions */}
          <div style={{ padding: sidebarOpen ? '16px 16px 24px' : '16px 12px 24px' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                width: '100%',
                padding: sidebarOpen ? '10px' : '10px',
                borderRadius: 12,
                background: HC.cream,
                border: `1px solid ${HC.border}`,
                color: HC.brown,
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
                fontFamily: "'Nunito',sans-serif",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = HC.orangeLight;
                e.currentTarget.style.borderColor = HC.orangeMid;
                e.currentTarget.style.color = HC.orangeDark;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = HC.cream;
                e.currentTarget.style.borderColor = HC.border;
                e.currentTarget.style.color = HC.brown;
              }}
            >
              {sidebarOpen ? (
                <>
                  <MenuFoldOutlined />
                  <span>Thu gọn menu</span>
                </>
              ) : (
                <MenuUnfoldOutlined />
              )}
            </button>

            <button
              onClick={logout}
              style={{
                width: '100%',
                marginTop: 12,
                padding: sidebarOpen ? '10px' : '10px',
                borderRadius: 12,
                background: '#fee2e2',
                border: `1px solid #fecaca`,
                color: HC.danger,
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.2s ease',
                fontFamily: "'Nunito',sans-serif",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#fecaca';
                e.currentTarget.style.borderColor = '#f87171';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.borderColor = '#fecaca';
              }}
            >
              <LogoutOutlined />
              {sidebarOpen && <span>Đăng xuất</span>}
            </button>

            {sidebarOpen && (
              <div style={{
                marginTop: 20,
                textAlign: 'center',
                fontSize: 9,
                fontWeight: 800,
                color: HC.muted2,
                letterSpacing: '0.2em',
                fontFamily: "'Nunito',sans-serif",
              }}>
                #IT'S ALWAYS DAY 1
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 64, background: HC.surface, borderBottom: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, boxShadow: '0 2px 12px rgba(245,166,35,0.06)' }}>
            <div style={{ width: 3, height: 28, borderRadius: 99, background: active === 'library' ? `linear-gradient(to bottom,#FFD700,#FFA500)` : `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})`, flexShrink: 0 }} />
            <div style={{ flex: 1, color: HC.ink, fontWeight: 900, fontSize: 15, fontFamily: "'Nunito',sans-serif", letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 10 }}>
              {PAGE_TITLES[active]}
              {active === 'library' && filterProductType && <span style={{ padding: '2px 10px', borderRadius: 999, background: HC.orangeLight, border: `1.5px solid ${HC.orange}`, color: HC.orangeDark, fontSize: 11, fontWeight: 800 }}>🔍 {filterProductType}</span>}
            </div>
            <div style={{ color: HC.muted, fontSize: 12, fontWeight: 600 }}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>

            <StaffBNotificationCenter
              requestNotifications={requestNotifications}
              newsNotifications={newsNotifications}
              markRequestAsRead={markRequestAsRead}
              markNewsAsRead={markNewsAsRead}
              onRequestClick={handleRequestClick}
              onNewsClick={handleNewsClick}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{renderSection()}</div>
        </div>
      </div>
    </>
  );
}