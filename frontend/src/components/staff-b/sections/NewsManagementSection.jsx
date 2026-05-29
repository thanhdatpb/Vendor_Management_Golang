import React, { useState, useEffect, useCallback } from 'react';
import { BellOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { HC } from '../utils/constants';
import { playNotificationSound } from '../utils/helpers';
import { Spinner, EmptyState, Pagination } from '../ui/StaffBUI';
import NewsModalComponent from '../components/NewsModalComponent';

export default function NewsManagementSection() {
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

  const updateNewsInDashboards = (news) => {
    const notification = {
      type: 'news',
      icon: '📰',
      title: news.title,
      message: news.message,
      time: new Date(news.created_at || Date.now()).toLocaleString('vi-VN'),
      read: false,
      timestamp: news.created_at || Date.now(),
      source: 'staff_b'
    };

    try {
      let adminNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS_TO_ADMIN') || '[]');
      const existIdx = adminNotifs.findIndex(n => n.id === `admin_${news.id}`);
      if (existIdx !== -1) {
        if (news.target === 'seller') adminNotifs.splice(existIdx, 1);
        else adminNotifs[existIdx] = { ...adminNotifs[existIdx], title: news.title, message: news.message };
      } else if (news.target === 'admin' || news.target === 'both') {
        adminNotifs.unshift({ ...notification, id: `admin_${news.id}` });
      }
      localStorage.setItem('STAFF_B_NOTIFICATIONS_TO_ADMIN', JSON.stringify(adminNotifs.slice(0, 100)));
      window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS_TO_ADMIN' }));
    } catch (err) {}

    try {
      let sellerNotifs = JSON.parse(localStorage.getItem('SELLER_NOTIFICATIONS') || '[]');
      const existIdx = sellerNotifs.findIndex(n => n.id === `seller_${news.id}`);
      if (existIdx !== -1) {
        if (news.target === 'admin') sellerNotifs.splice(existIdx, 1);
        else sellerNotifs[existIdx] = { ...sellerNotifs[existIdx], title: news.title, message: news.message };
      } else if (news.target === 'seller' || news.target === 'both') {
        sellerNotifs.unshift({ ...notification, id: `seller_${news.id}` });
      }
      localStorage.setItem('SELLER_NOTIFICATIONS', JSON.stringify(sellerNotifs.slice(0, 100)));
      window.dispatchEvent(new StorageEvent('storage', { key: 'SELLER_NOTIFICATIONS' }));
    } catch (err) {}
  };

  const removeNewsFromDashboards = (newsId) => {
    try {
      let adminNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS_TO_ADMIN') || '[]');
      adminNotifs = adminNotifs.filter(n => n.id !== `admin_${newsId}`);
      localStorage.setItem('STAFF_B_NOTIFICATIONS_TO_ADMIN', JSON.stringify(adminNotifs));
      window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS_TO_ADMIN' }));
    } catch (err) {}

    try {
      let sellerNotifs = JSON.parse(localStorage.getItem('SELLER_NOTIFICATIONS') || '[]');
      sellerNotifs = sellerNotifs.filter(n => n.id !== `seller_${newsId}`);
      localStorage.setItem('SELLER_NOTIFICATIONS', JSON.stringify(sellerNotifs));
      window.dispatchEvent(new StorageEvent('storage', { key: 'SELLER_NOTIFICATIONS' }));
    } catch (err) {}
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
      updateNewsInDashboards(updatedNews);
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
      removeNewsFromDashboards(deleteConfirm.id);
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

  const handleFormChange = useCallback((newForm) => {
    setForm(newForm);
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
                        padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${HC.orangeMid}`,
                        background: HC.orangeLight, cursor: 'pointer', fontSize: 11, fontWeight: 800,
                        color: HC.orangeDark, display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <EditOutlined /> Sửa
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(news)}
                      style={{
                        padding: '5px 12px', borderRadius: 7, border: '1.5px solid #fecaca',
                        background: '#fef2f2', cursor: 'pointer', fontSize: 11, fontWeight: 800,
                        color: HC.danger, display: 'flex', alignItems: 'center', gap: 4
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
      {toast && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 2000,
          animation: 'slideInRight 0.3s ease-out, fadeOut 0.3s ease-out 2.7s forwards',
        }}>
          <div style={{
            background: toast.type === 'success' ? `linear-gradient(135deg, ${HC.success}, #15803d)` : `linear-gradient(135deg, ${HC.danger}, #b91c1c)`,
            borderRadius: 12, padding: '12px 20px', color: '#fff', boxShadow: HC.shadowStrong,
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: HC.ink, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BellOutlined style={{ color: HC.orange }} /> Quản lý thông báo
          </h3>
          <p style={{ fontSize: 12, color: HC.muted, marginTop: 4 }}>Tạo thông báo gửi đến Admin và Seller</p>
        </div>
        <button
          onClick={openCreateModal}
          style={{
            padding: '10px 20px', borderRadius: 10, background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
            color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8, boxShadow: `0 2px 8px ${HC.orangeGlow}`
          }}
        >
          <PlusOutlined /> Tạo thông báo mới
        </button>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <span style={{ fontWeight: 900, fontSize: 14, color: HC.ink }}>Danh sách thông báo đã tạo</span>
          <span style={{ padding: '2px 10px', borderRadius: 20, background: HC.orangeLight, color: HC.orangeDark, fontSize: 11, fontWeight: 700 }}>
            {newsList.length} thông báo
          </span>
        </div>

        {loading ? <Spinner /> : newsList.length === 0 ? <EmptyState msg="Chưa có thông báo nào. Hãy tạo thông báo mới!" /> : <NewsTable />}
      </div>

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

      {deleteConfirm && (
        <div onClick={() => setDeleteConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 400, background: '#fff', borderRadius: 20, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', textAlign: 'center', background: 'linear-gradient(135deg, #fef2f2, #fff)', borderBottom: '1px solid #fecaca' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 28 }}>⚠️</div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#dc2626' }}>Xóa thông báo</h3>
              <p style={{ fontSize: 12, color: '#7a5c32', marginTop: 6 }}>Hành động không thể hoàn tác</p>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ background: '#fef3dc', borderRadius: 12, padding: '14px', textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#e09415' }}>{deleteConfirm.title}</div>
                <div style={{ fontSize: 11, color: '#9c7a50', marginTop: 4 }}>{deleteConfirm.message.length > 80 ? deleteConfirm.message.substring(0, 80) + '...' : deleteConfirm.message}</div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e8d4a8', background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Hủy</button>
                <button onClick={handleDeleteNews} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Xóa</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes fadeOut { to { opacity: 0; transform: translateX(100%); } }
      `}</style>
    </div>
  );
}
