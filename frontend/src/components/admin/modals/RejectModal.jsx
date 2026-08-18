import React from 'react';
import { HC } from '../constants';

export default function RejectModal({ open, onConfirm, onCancel, reason, setReason }) {
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, background: HC.surface, borderRadius: 20, padding: 30, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}` }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: HC.danger, marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>🚫 Từ chối sản phẩm</div>
        <div style={{ fontSize: 12, color: HC.muted, marginBottom: 18, fontFamily: "'Inter',sans-serif" }}>Vui lòng nhập lý do để Seller biết cách chỉnh sửa.</div>
        <textarea autoFocus placeholder="Nhập lý do từ chối..." value={reason} onChange={e => setReason(e.target.value)} style={{ width: '100%', minHeight: 100, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${HC.border}`, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: "'Inter',sans-serif", color: HC.ink2, background: HC.surface2 }} onFocus={e => e.target.style.borderColor = HC.orange} onBlur={e => e.target.style.borderColor = HC.border} />
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: HC.danger, color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Xác nhận từ chối</button>
          <button onClick={onCancel} style={{ padding: '10px 18px', borderRadius: 10, background: HC.cream, color: HC.brown, border: `1.5px solid ${HC.border}`, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter',sans-serif" }}>Hủy</button>
        </div>
      </div>
    </div>
  );
}
