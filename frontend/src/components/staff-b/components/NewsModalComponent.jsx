import React from 'react';
import { EditOutlined, SendOutlined } from '@ant-design/icons';
import { HC } from '../utils/constants';

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

        <div style={{ padding: '24px' }}>
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

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 800, color: HC.ink, marginBottom: 12, display: 'block' }}>
              Đối tượng nhận
            </label>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 16px',
                borderRadius: 10, background: form.target === 'both' ? HC.orangeLight : 'transparent',
                border: `1px solid ${form.target === 'both' ? HC.orange : HC.border}`,
              }}>
                <input type="radio" checked={form.target === 'both'} onChange={() => handleTargetChange('both')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>📋 Admin + 👤 Seller</span>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 16px',
                borderRadius: 10, background: form.target === 'admin' ? HC.orangeLight : 'transparent',
                border: `1px solid ${form.target === 'admin' ? HC.orange : HC.border}`,
              }}>
                <input type="radio" checked={form.target === 'admin'} onChange={() => handleTargetChange('admin')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>📋 Chỉ Admin</span>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 16px',
                borderRadius: 10, background: form.target === 'seller' ? HC.orangeLight : 'transparent',
                border: `1px solid ${form.target === 'seller' ? HC.orange : HC.border}`,
              }}>
                <input type="radio" checked={form.target === 'seller'} onChange={() => handleTargetChange('seller')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>👤 Chỉ Seller</span>
              </label>
            </div>
          </div>
        </div>

        <div style={{
          padding: '16px 24px', borderTop: `1.5px solid ${HC.border}`, background: HC.cream,
          borderRadius: '0 0 20px 20px', display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0
        }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 10, background: HC.surface, border: `1.5px solid ${HC.border}`, color: HC.brown, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Hủy
          </button>
          <button disabled={submitting} onClick={onSubmit} style={{
            padding: '10px 28px', borderRadius: 10, background: submitting ? HC.muted2 : `linear-gradient(135deg, ${HC.success}, #15803d)`,
            color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {submitting ? '⟳ Đang xử lý...' : editingNews ? <><EditOutlined /> Cập nhật</> : <><SendOutlined /> Gửi thông báo</>}
          </button>
        </div>
      </div>
    </div>
  );
});

export default NewsModalComponent;
