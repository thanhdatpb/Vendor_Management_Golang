import React, { useEffect } from 'react';
import { HC } from '../constants';

export default function NotificationToast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
      color: '#fff',
      padding: '12px 20px',
      borderRadius: 12,
      boxShadow: HC.shadowStrong,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      zIndex: 2000,
      animation: 'slideIn 0.3s ease-out',
      fontFamily: "'Nunito Sans',sans-serif",
      border: `1px solid ${HC.orangeLight}`,
    }}>
      <span style={{ fontSize: 20 }}>📋</span>
      <div>
        <div style={{ fontWeight: 800, fontSize: 12 }}>Form mới từ Seller!</div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>{message}</div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 14,
          padding: 4,
        }}
      >
        ✕
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
