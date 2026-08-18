import React from 'react';
import { HC, STATUS_CFG } from '../utils/constants';
import logoImg from '../../../assets/logo.png';

export function HCLogo({ size = 32 }) {
  return (
    <img
      src={logoImg}
      alt="Happy Creative Logo"
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
    />
  );
}

export function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: HC.muted, fontSize: 13, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ marginTop: 10 }}>Đang tải...</div>
    </div>
  );
}

export function EmptyState({ msg = 'Không có dữ liệu' }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: HC.muted, fontSize: 13, fontFamily: "'Inter',sans-serif" }}>
      <div style={{ marginTop: 12 }}>{msg}</div>
    </div>
  );
}

export function Field({ label, hint, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 10, fontWeight: 800, color: HC.muted, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'Inter',sans-serif" }}>
        {label}{required && <span style={{ color: HC.danger, marginLeft: 2 }}>*</span>}
        {hint && <span style={{ color: HC.muted2, fontWeight: 500, marginLeft: 5, textTransform: 'none', letterSpacing: 0, fontSize: 10 }}>({hint})</span>}
      </label>
      {children}
    </div>
  );
}

export const inp = {
  padding: '9px 12px',
  borderRadius: 9,
  border: `1.5px solid ${HC.border}`,
  fontSize: 13,
  color: HC.ink2,
  background: HC.surface2,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: "'Inter',sans-serif",
  transition: 'border-color 0.2s,box-shadow 0.2s'
};

export const inp3 = { 
  padding: '7px 9px', 
  borderRadius: 8, 
  border: `1.5px solid ${HC.border}`, 
  fontSize: 12, 
  color: HC.ink2, 
  background: HC.surface2, 
  width: '100%', 
  boxSizing: 'border-box', 
  outline: 'none', 
  fontFamily: "'Inter',sans-serif", 
  transition: 'border-color 0.2s' 
};

export const focusStyle = {
  onFocus: e => {
    e.target.style.borderColor = HC.orange;
    e.target.style.boxShadow = `0 0 0 3px ${HC.orangeGlow}`;
  },
  onBlur: e => {
    e.target.style.borderColor = HC.border;
    e.target.style.boxShadow = 'none';
  }
};

export function Pagination({ currentPage, totalPages, totalItems, onPageChange }) {
  if (totalPages <= 1) return null;
  const from = (currentPage - 1) * 10 + 1, to = Math.min(currentPage * 10, totalItems);
  const pages = []; const push = n => { if (!pages.includes(n)) pages.push(n); };
  push(1); if (currentPage > 3) pages.push('...');
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) push(i);
  if (currentPage < totalPages - 2) pages.push('...');
  if (totalPages > 1) push(totalPages);
  const btn = (ex = {}) => ({ minWidth: 32, height: 32, borderRadius: 8, border: `1.5px solid ${HC.border}`, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px', fontFamily: "'Inter',sans-serif", ...ex });
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 14, padding: '10px 16px', background: HC.surface, borderRadius: 12, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow }}>
      <div style={{ fontSize: 12, color: HC.muted, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>Hiển thị <b style={{ color: HC.ink }}>{from}–{to}</b> / <b style={{ color: HC.ink }}>{totalItems}</b></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} style={btn({ background: HC.cream, color: HC.muted2, opacity: currentPage === 1 ? 0.4 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' })}>‹</button>
        {pages.map((p, i) => p === '...' ? <span key={`g${i}`} style={{ fontSize: 12, color: HC.muted2 }}>…</span> : <button key={p} onClick={() => onPageChange(p)} style={btn({ background: currentPage === p ? HC.orange : HC.surface, color: currentPage === p ? '#fff' : HC.ink2, border: `1.5px solid ${currentPage === p ? HC.orange : HC.border}`, fontWeight: currentPage === p ? 900 : 700 })}>{p}</button>)}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} style={btn({ background: HC.cream, color: HC.muted2, opacity: currentPage === totalPages ? 0.4 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' })}>›</button>
      </div>
    </div>
  );
}

export function Badge({ status }) {
  const c = STATUS_CFG[status] || { bg: HC.orangeLight, text: HC.brown, dot: HC.muted2, label: status };
  return (
    <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${HC.border}`, fontFamily: "'Inter',sans-serif" }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      {c.label}
    </span>
  );
}

export function BestSellerBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 999,
      background: 'linear-gradient(135deg,#FFF8DC,#FFE97A)',
      border: '1.5px solid #D4A017',
      color: HC.gold, fontSize: 10, fontWeight: 900,
      fontFamily: "'Inter',sans-serif", letterSpacing: '0.04em',
    }}>
      ⭐ Best Seller
    </span>
  );
}
