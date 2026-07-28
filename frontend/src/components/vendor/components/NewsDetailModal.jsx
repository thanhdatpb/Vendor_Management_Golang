import React, { useEffect } from 'react';
import { EditOutlined, SendOutlined, NotificationOutlined } from '@ant-design/icons';
import { HC } from '../utils/constants';

/**
 * Modal xem chi tiết 1 thông báo (news) ở màn Quản Lý Thông Báo của Vendor.
 * Bảng danh sách chỉ hiển thị nội dung rút gọn 2 dòng, nên cần chỗ đọc trọn vẹn
 * nội dung dài (giữ nguyên xuống dòng) + xem mốc thời gian tạo/cập nhật.
 */
// Xoá thông báo chỉ nằm ở nút Xóa trên từng dòng danh sách — modal này thuần để
// đọc nội dung + gửi/sửa, tránh thao tác huỷ nhầm khi đang xem chi tiết.
export default function NewsDetailModal({ news, onClose, onEdit, onSend }) {
  useEffect(() => {
    if (!news) return undefined;
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [news, onClose]);

  if (!news) return null;

  const fmt = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN');
  };

  const createdAt = fmt(news.created_at);
  const updatedAt = fmt(news.updated_at);
  const isEdited = news.updated_at && news.created_at
    && new Date(news.updated_at).getTime() - new Date(news.created_at).getTime() > 1000;

  const metaRow = (icon, label, value) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, color: HC.muted, fontWeight: 700, width: 120, flexShrink: 0 }}>{icon} {label}</span>
      <span style={{ fontSize: 12.5, color: HC.brown, fontWeight: 700 }}>{value}</span>
    </div>
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.6)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 2050, backdropFilter: 'blur(4px)', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 640, maxWidth: '100%', maxHeight: '85vh',
          background: HC.surface, borderRadius: 20,
          boxShadow: '0 32px 80px rgba(26,15,0,0.28)', border: `1.5px solid ${HC.border}`,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 24, display: 'flex', color: '#fff' }}><NotificationOutlined /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>
                Chi tiết thông báo
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>
                Nội dung đầy đủ đã gửi tới Admin &amp; Seller
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '3px 10px',
              background: '#f0f9ff', color: '#0891b2', border: '1px solid #bae6fd',
            }}>
              📰 Tin tức
            </span>
            {isEdited && (
              <span style={{
                fontSize: 10, fontWeight: 800, borderRadius: 99, padding: '3px 10px',
                background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe',
              }}>
                ✏️ Đã chỉnh sửa
              </span>
            )}
          </div>

          <div style={{
            fontWeight: 900, fontSize: 17, color: HC.ink,
            fontFamily: "'Nunito',sans-serif", lineHeight: 1.4, marginBottom: 16, wordBreak: 'break-word',
          }}>
            {news.title}
          </div>

          <div style={{
            background: HC.orangePale, border: `1px solid ${HC.border}`, borderRadius: 14,
            padding: '16px 18px', fontSize: 13.5, color: HC.ink2, lineHeight: 1.75,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 18,
          }}>
            {news.message || '(Không có nội dung)'}
          </div>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 10,
            padding: '14px 16px', background: HC.cream, borderRadius: 12, border: `1px solid ${HC.border}`,
          }}>
            {metaRow('🕒', 'Ngày tạo', createdAt)}
            {isEdited && metaRow('🔄', 'Cập nhật lúc', updatedAt)}
            {metaRow('👥', 'Đối tượng nhận', 'Admin & Seller')}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: `1.5px solid ${HC.border}`, background: HC.cream,
          display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px', borderRadius: 10, background: HC.surface,
              border: `1.5px solid ${HC.border}`, color: HC.brown, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Đóng
          </button>
          {onSend && (
            <button
              onClick={() => onSend(news)}
              title="Gửi thông báo này tới Admin & Seller"
              style={{
                padding: '10px 20px', borderRadius: 10, background: '#ecfdf5',
                border: '1.5px solid #bbf7d0', color: HC.success, fontSize: 13, fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <SendOutlined /> Gửi tới Admin &amp; Seller
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(news)}
              style={{
                padding: '10px 24px', borderRadius: 10,
                background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
                color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, boxShadow: `0 2px 8px ${HC.orangeGlow}`,
              }}
            >
              <EditOutlined /> Sửa thông báo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
