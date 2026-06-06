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

  const handleTargetChange = (targetValue) => {
    if (['both', 'admin', 'seller'].includes(targetValue)) {
      onFormChange({ ...form, target: targetValue });
    } else {
      let currentTarget = Array.isArray(form.target) ? [...form.target] : [];
      if (typeof form.target === 'string' && !['both', 'admin', 'seller'].includes(form.target)) {
        currentTarget = [form.target];
      }
      
      if (currentTarget.includes(targetValue)) {
        currentTarget = currentTarget.filter(t => t !== targetValue);
        if (currentTarget.length === 0) onFormChange({ ...form, target: 'both' });
        else onFormChange({ ...form, target: currentTarget });
      } else {
        currentTarget.push(targetValue);
        onFormChange({ ...form, target: currentTarget });
      }
    }
  };

  const isSelected = (val) => {
    if (['both', 'admin', 'seller'].includes(val)) return form.target === val;
    if (Array.isArray(form.target)) return form.target.includes(val);
    return form.target === val;
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
                borderRadius: 10, background: isSelected('both') ? HC.orangeLight : 'transparent',
                border: `1px solid ${isSelected('both') ? HC.orange : HC.border}`,
              }}>
                <input type="radio" checked={isSelected('both')} onChange={() => handleTargetChange('both')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>Tất cả (Admin & Seller)</span>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 16px',
                borderRadius: 10, background: isSelected('admin') ? HC.orangeLight : 'transparent',
                border: `1px solid ${isSelected('admin') ? HC.orange : HC.border}`,
              }}>
                <input type="radio" checked={isSelected('admin')} onChange={() => handleTargetChange('admin')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>Chỉ Admin</span>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 16px',
                borderRadius: 10, background: isSelected('seller') ? HC.orangeLight : 'transparent',
                border: `1px solid ${isSelected('seller') ? HC.orange : HC.border}`,
              }}>
                <input type="radio" checked={isSelected('seller')} onChange={() => handleTargetChange('seller')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>Tất cả Seller</span>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 16px',
                borderRadius: 10, background: isSelected('Creative Project') ? HC.orangeLight : 'transparent',
                border: `1px solid ${isSelected('Creative Project') ? HC.orange : HC.border}`,
              }}>
                <input type="checkbox" checked={isSelected('Creative Project')} onChange={() => handleTargetChange('Creative Project')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>Creative Project</span>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 16px',
                borderRadius: 10, background: isSelected('Happy Project') ? HC.orangeLight : 'transparent',
                border: `1px solid ${isSelected('Happy Project') ? HC.orange : HC.border}`,
              }}>
                <input type="checkbox" checked={isSelected('Happy Project')} onChange={() => handleTargetChange('Happy Project')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>Happy Project</span>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 16px',
                borderRadius: 10, background: isSelected('Global Project') ? HC.orangeLight : 'transparent',
                border: `1px solid ${isSelected('Global Project') ? HC.orange : HC.border}`,
              }}>
                <input type="checkbox" checked={isSelected('Global Project')} onChange={() => handleTargetChange('Global Project')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>Global Project</span>
              </label>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 16px',
                borderRadius: 10, background: isSelected('Pilot Project') ? HC.orangeLight : 'transparent',
                border: `1px solid ${isSelected('Pilot Project') ? HC.orange : HC.border}`,
              }}>
                <input type="checkbox" checked={isSelected('Pilot Project')} onChange={() => handleTargetChange('Pilot Project')} style={{ width: 18, height: 18, cursor: 'pointer' }} />
                <span style={{ fontSize: 13 }}>Pilot Project</span>
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
