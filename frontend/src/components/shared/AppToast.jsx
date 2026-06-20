import React from 'react';

const VARIANTS = {
  success: {
    border: '#16a34a',
    iconBg: '#dcfce7',
    iconColor: '#16a34a',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  error: {
    border: '#ef4444',
    iconBg: '#fee2e2',
    iconColor: '#ef4444',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
  warning: {
    border: '#f59e0b',
    iconBg: '#fef3c7',
    iconColor: '#d97706',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  info: {
    border: '#3b82f6',
    iconBg: '#dbeafe',
    iconColor: '#2563eb',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
};

// Xóa emoji dẫn đầu để icon component đảm nhiệm
function stripLeadingEmoji(str) {
  if (!str) return '';
  return str.replace(/^[\p{Emoji}\s]+/u, '').trim();
}

export default function AppToast({ toast, onClose }) {
  if (!toast) return null;

  const type = toast.type || 'success';
  const variant = VARIANTS[type] || VARIANTS.success;
  const duration = toast.duration || 3000;

  // Hỗ trợ cả 2 pattern: {title, message} và {msg}
  const title = stripLeadingEmoji(toast.title || toast.msg || '');
  const message = stripLeadingEmoji(toast.message || '');

  return (
    <>
      <style>{`
        @keyframes hc-toast-in {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes hc-toast-bar {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
      <div style={{
        position: 'fixed',
        bottom: 28,
        right: 28,
        zIndex: 9999,
        width: 340,
        background: '#ffffff',
        borderRadius: 14,
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.13)',
        borderLeft: `4px solid ${variant.border}`,
        overflow: 'hidden',
        animation: 'hc-toast-in 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards',
        fontFamily: "'Nunito', 'Nunito Sans', sans-serif",
      }}>
        <div style={{
          padding: '14px 14px 14px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          {/* Icon */}
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            background: variant.iconBg,
            color: variant.iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 1,
          }}>
            {variant.icon}
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: message ? 0 : 7 }}>
            <div style={{
              fontWeight: 800,
              fontSize: 13.5,
              color: '#111827',
              lineHeight: 1.3,
              marginBottom: message ? 4 : 0,
            }}>
              {title}
            </div>
            {message && (
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                {message}
              </div>
            )}
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 6,
              marginTop: -2,
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.color = '#374151';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#9ca3af';
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 3,
          background: variant.border,
          opacity: 0.55,
          transformOrigin: 'left center',
          animation: `hc-toast-bar ${duration}ms linear forwards`,
        }} />
      </div>
    </>
  );
}
