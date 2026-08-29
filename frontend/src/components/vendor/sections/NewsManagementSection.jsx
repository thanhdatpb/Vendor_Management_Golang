import React, { useState, useEffect, useCallback } from 'react';
import { BellOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, ProfileOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { HC } from '../utils/constants';
import AppToast from '../../shared/AppToast';
import { playNotificationSound } from '../utils/helpers';
import { Spinner, EmptyState, Pagination } from '../ui/VendorUI';
import NewsModalComponent from '../components/NewsModalComponent';
import NewsDetailModal from '../components/NewsDetailModal';
import { newsApi } from '../../../services/api';
import { timeValue, fmtVNDateTime } from '../../../utils/vnTime';

// Vendor luôn phát thông báo cho cả Admin lẫn Seller — không còn chọn đối tượng
// trong form nữa, nên khoá cứng target ở một chỗ để list/API dùng chung.
const NEWS_TARGET = 'both';

// Đã gửi = đã có notification nằm ở chuông của Admin & Seller → khoá sửa/xoá/gửi lại,
// vì sửa nội dung gốc lúc này sẽ lệch với bản người nhận đã đọc.
const isSent = (news) => !!news?.sent_at;

export default function NewsManagementSection() {
  const [newsList, setNewsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    message: '',
    target: NEWS_TARGET
  });
  const [formErrors, setFormErrors] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sendConfirm, setSendConfirm] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [detailNews, setDetailNews] = useState(null);
  const [toast, setToast] = useState(null);

  // Danh sách tin tức lưu server (bảng `news`) — trước đây lưu localStorage
  // (STAFF_B_NEWS_V1) nên mất khi đổi máy, thậm chí mất khi F5 (main.jsx xoá
  // key này mỗi lần app khởi động).
  const loadNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await newsApi.list();
      const news = Array.isArray(res.data) ? res.data : [];
      news.sort((a, b) => timeValue(b.created_at) - timeValue(a.created_at));
      setNewsList(news);
    } catch (err) {
      console.error('Lỗi load tin tức:', err);
      setToast({ type: 'error', title: 'Lỗi', message: 'Không tải được danh sách thông báo từ server.' });
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

  // Fan-out nằm ở server (POST /news/{id}/send): server tạo notification cho mọi
  // tài khoản Admin & Seller rồi đóng dấu sent_at. Bản cũ đẩy từ client qua
  // pushNotifMulti → POST /notifications, nhưng route đó không tồn tại nên request
  // luôn 404 rồi rơi vào fallback localStorage của chính máy Vendor — người nhận ở
  // máy khác không bao giờ thấy, mà toast vẫn báo "Đã gửi".
  const handleSend = async () => {
    if (!sendConfirm) return;
    const news = sendConfirm;
    setSendingId(news.id);
    try {
      const res = await newsApi.send(news.id);
      const sent = res.data;
      setNewsList(prev => prev.map(n => (n.id === sent.id ? sent : n)));
      setDetailNews(prev => (prev && prev.id === sent.id ? sent : prev));
      setSendConfirm(null);
      setToast({ type: 'success', title: 'Đã gửi', message: `"${news.title}" đã được gửi tới Admin & Seller` });
      playNotificationSound();
    } catch (err) {
      // 409 = thông báo đã gửi ở tab/máy khác — nạp lại để danh sách khớp server.
      if (err?.response?.status === 409) {
        setSendConfirm(null);
        loadNews();
      }
      setToast({ type: 'error', title: 'Lỗi', message: err?.response?.data?.message || 'Không gửi được thông báo' });
    } finally {
      setSendingId(null);
    }
  };

  const handleCreateNews = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const res = await newsApi.create({
        title: form.title.trim(),
        message: form.message.trim(),
        target: NEWS_TARGET,
      });
      // Tạo ra là bản nháp — chưa gửi cho ai. Vendor soát lại rồi bấm Gửi.
      setNewsList(prev => [res.data, ...prev]);
      closeModal();
      setToast({ type: 'success', title: 'Đã tạo', message: 'Đã lưu thông báo. Bấm "Gửi" để phát tới Admin & Seller.' });
    } catch (err) {
      setToast({ type: 'error', title: 'Lỗi', message: err?.response?.data?.message || 'Không thể tạo thông báo' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateNews = async () => {
    if (!validateForm() || !editingNews) return;
    setSubmitting(true);
    try {
      const res = await newsApi.update(editingNews.id, {
        title: form.title.trim(),
        message: form.message.trim(),
        target: NEWS_TARGET,
      });
      const updatedNews = res.data;
      setNewsList(prev => prev.map(n => n.id === editingNews.id ? updatedNews : n));
      setDetailNews(prev => (prev && prev.id === updatedNews.id ? updatedNews : prev));
      closeModal();
      setToast({ type: 'success', title: 'Thành công', message: 'Đã cập nhật thông báo' });
    } catch (err) {
      setToast({ type: 'error', title: 'Lỗi', message: err?.response?.data?.message || 'Không thể cập nhật thông báo' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNews = async () => {
    if (!deleteConfirm) return;
    try {
      await newsApi.remove(deleteConfirm.id);
      setNewsList(prev => prev.filter(n => n.id !== deleteConfirm.id));
      setDetailNews(prev => (prev && prev.id === deleteConfirm.id ? null : prev));
      setDeleteConfirm(null);
      setToast({ type: 'success', title: 'Thành công', message: 'Đã xóa thông báo' });
    } catch (err) {
      setToast({ type: 'error', title: 'Lỗi', message: err?.response?.data?.message || 'Không thể xóa thông báo' });
    }
  };

  const resetForm = () => {
    setForm({ title: '', message: '', target: NEWS_TARGET });
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
      target: NEWS_TARGET
    });
    setFormErrors({});
    setDetailNews(null);
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
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 140, color: HC.brown, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', borderBottom: `1.5px solid ${HC.border}` }}>Ngày tạo</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', width: 240, color: HC.brown, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', borderBottom: `1.5px solid ${HC.border}` }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {pagedNews.map((news, idx) => (
              <tr
                key={news.id}
                onClick={() => setDetailNews(news)}
                title="Bấm để xem chi tiết thông báo"
                style={{ borderBottom: `1px solid ${HC.border}`, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = HC.orangePale}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '12px 14px', textAlign: 'center', color: HC.muted, fontWeight: 700 }}>
                  {(currentPage - 1) * itemsPerPage + idx + 1}
                </td>
                <td style={{ padding: '12px 14px', fontWeight: 800, color: HC.ink2 }}>{news.title}</td>
                <td style={{ padding: '12px 14px', color: HC.ink2, maxWidth: 400, wordBreak: 'break-word' }}>
                  <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
                    {news.message}
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: HC.orangeDark, marginTop: 4, display: 'inline-block' }}>
                    Xem chi tiết →
                  </span>
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 11, color: HC.muted }}>
                  {fmtVNDateTime(news.created_at)}
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                  {isSent(news) ? (
                    // Đã phát tới chuông Admin & Seller → không còn thao tác nào, chỉ
                    // báo lại mốc đã gửi để Vendor biết tin này đi lúc nào.
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                      borderRadius: 999, border: '1.5px solid #bbf7d0', background: '#ecfdf5',
                      color: HC.success, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap'
                    }}>
                      <CheckCircleOutlined /> Đã gửi · {fmtVNDateTime(news.sent_at)}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button
                        onClick={e => { e.stopPropagation(); setSendConfirm(news); }}
                        disabled={sendingId === news.id}
                        title="Gửi thông báo này tới Admin & Seller"
                        style={{
                          padding: '5px 12px', borderRadius: 7, border: '1.5px solid #bbf7d0',
                          background: '#ecfdf5', cursor: sendingId === news.id ? 'wait' : 'pointer',
                          fontSize: 11, fontWeight: 800, color: HC.success,
                          display: 'flex', alignItems: 'center', gap: 4, opacity: sendingId === news.id ? 0.6 : 1
                        }}
                      >
                        <SendOutlined /> {sendingId === news.id ? 'Đang gửi…' : 'Gửi'}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); openEditModal(news); }}
                        style={{
                          padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${HC.orangeMid}`,
                          background: HC.orangeLight, cursor: 'pointer', fontSize: 11, fontWeight: 800,
                          color: HC.orangeDark, display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <EditOutlined /> Sửa
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirm(news); }}
                        style={{
                          padding: '5px 12px', borderRadius: 7, border: '1.5px solid #fecaca',
                          background: '#fef2f2', cursor: 'pointer', fontSize: 11, fontWeight: 800,
                          color: HC.danger, display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <DeleteOutlined /> Xóa
                      </button>
                    </div>
                  )}
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
      <AppToast toast={toast} onClose={() => setToast(null)} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, color: HC.orangeDark, display: 'flex' }}><BellOutlined /></span>
          <span style={{ fontWeight: 900, fontSize: 16, color: HC.ink }}>Danh sách thông báo</span>
          <span style={{ padding: '2px 10px', borderRadius: 20, background: HC.orangeLight, color: HC.orangeDark, fontSize: 11, fontWeight: 700 }}>
            {newsList.length} thông báo
          </span>
          <span style={{ fontSize: 11, color: HC.muted, fontWeight: 600 }}>
            · Bấm vào dòng để xem chi tiết
          </span>
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

        {loading ? <Spinner /> : newsList.length === 0 ? <EmptyState msg="Chưa có thông báo nào. Hãy tạo thông báo mới!" /> : <NewsTable />}

      <NewsModalComponent
        isOpen={showModal}
        editingNews={editingNews}
        form={form}
        formErrors={formErrors}
        submitting={submitting}
        onClose={closeModal}
        onSubmit={editingNews ? handleUpdateNews : handleCreateNews}
        onFormChange={handleFormChange}
        vendorMode={true}
      />

      {/* Đã gửi thì modal chi tiết chỉ để đọc — bỏ luôn hai nút Gửi/Sửa cho khớp
          với hàng thao tác ở danh sách (và với ràng buộc 409 phía server). */}
      <NewsDetailModal
        news={detailNews}
        onClose={() => setDetailNews(null)}
        onEdit={isSent(detailNews) ? null : openEditModal}
        onSend={isSent(detailNews) ? null : (news) => { setDetailNews(null); setSendConfirm(news); }}
      />

      {sendConfirm && (
        <div onClick={() => sendingId ? null : setSendConfirm(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100, backdropFilter: 'blur(4px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: '92%', background: '#fff', borderRadius: 20, boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '20px', textAlign: 'center', background: 'linear-gradient(135deg, #ecfdf5, #fff)', borderBottom: '1px solid #bbf7d0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: 26, color: HC.success }}>
                <SendOutlined />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: HC.success }}>Gửi thông báo</h3>
              <p style={{ fontSize: 12, color: HC.brown, marginTop: 6 }}>Người nhận: <b>Admin &amp; Seller</b></p>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ background: HC.orangeLight, borderRadius: 12, padding: '14px', textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: HC.orangeDark }}>{sendConfirm.title}</div>
                <div style={{ fontSize: 11, color: HC.brownLight, marginTop: 4 }}>
                  {sendConfirm.message.length > 80 ? sendConfirm.message.substring(0, 80) + '…' : sendConfirm.message}
                </div>
              </div>
              <div style={{ fontSize: 11.5, color: HC.muted, textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>
                Thông báo sẽ xuất hiện ở chuông thông báo của Admin và toàn bộ Seller.
                <br />
                <b>Chỉ gửi được một lần</b> — sau khi gửi sẽ không sửa hay xoá được nữa.
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button disabled={!!sendingId} onClick={() => setSendConfirm(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: `1px solid ${HC.borderStrong}`, background: '#fff', fontSize: 13, fontWeight: 600, cursor: sendingId ? 'not-allowed' : 'pointer' }}>Hủy</button>
                <button disabled={!!sendingId} onClick={handleSend} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: sendingId ? HC.muted2 : `linear-gradient(135deg, ${HC.success}, #15803d)`, color: '#fff', fontSize: 13, fontWeight: 800, cursor: sendingId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  {sendingId ? '⟳ Đang gửi…' : <><SendOutlined /> Gửi ngay</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

    </div>
  );
}
