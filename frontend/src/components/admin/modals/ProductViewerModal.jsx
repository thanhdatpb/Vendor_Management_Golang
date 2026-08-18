import React, { useState } from 'react';
import { HC } from '../constants';
import { fmtDate, getMediaUrls } from '../utils';
import { Badge, CardHeader, InfoRow } from '../ui';
import Lightbox from './Lightbox';

export default function ProductViewerModal({ product, onClose, onApprove, onReject }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const mediaUrls = getMediaUrls(product);

  if (!product) return null;

  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

  const productRows = [
    { label: 'Seller Name', value: product.seller_name || product.sellerName || product.user_name || product.userName || '—', color: HC.orange, bold: true },
    { label: 'Project', value: product.project || '—', color: HC.orangeDark, bold: true },
    { label: 'Date Request', value: fmtDate(product.created_at), color: HC.ink2, bold: false },
    { label: 'Deadline', value: fmtDate(product.deadline_date), color: HC.danger, bold: true },
    { label: 'Product Type', value: product.product_type, color: HC.orangeDark, bold: true },
    { label: 'Đặc tính KT', value: product.other_specs, color: HC.ink2, bold: false },
    { label: 'Chất liệu', value: product.material, color: HC.ink2, bold: false },
    { label: 'Vùng In', value: product.print_area, color: HC.ink2, bold: false },
    { label: 'Good Review', value: product.good_review, color: HC.success, bold: false },
    { label: 'Bad Review', value: product.bad_review, color: HC.danger, bold: false },
    { label: 'Packing', value: product.packaging_links, color: HC.ink2, bold: false },
    { label: 'Other Packing', value: product.other_packaging, color: HC.ink2, bold: false },
    {
      label: 'Link',
      value: (() => {
        let links = [];
        if (product.product_type_links) {
          if (Array.isArray(product.product_type_links)) {
            links = product.product_type_links;
          } else if (typeof product.product_type_links === 'string') {
            try {
              links = JSON.parse(product.product_type_links);
            } catch {
              links = [product.product_type_links];
            }
          }
        } else if (product.product_type_link) {
          links = [product.product_type_link];
        }

        if (links.length === 0) return '—';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: HC.orange,
                  textDecoration: 'none',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  wordBreak: 'break-all'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = HC.orangeDark;
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = HC.orange;
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                🔗 {link.length > 60 ? link.substring(0, 60) + '...' : link}
              </a>
            ))}
          </div>
        );
      })(),
      color: HC.orange,
      bold: false
    },
    {
      label: 'Video',
      value: (() => {
        let vLinks = [];
        if (product.product_video_links && Array.isArray(product.product_video_links)) {
          vLinks = product.product_video_links;
        } else if (typeof product.product_video_links === 'string') {
          try { vLinks = JSON.parse(product.product_video_links); } catch { vLinks = [product.product_video_links]; }
        }
        vLinks = vLinks.filter(Boolean);
        if (vLinks.length === 0) return '—';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {vLinks.map((link, idx) => (
              <a key={idx} href={link} target="_blank" rel="noopener noreferrer"
                style={{ color: '#7c3aed', textDecoration: 'none', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6, wordBreak: 'break-all' }}
                onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
                onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}
              >
                ▶ {link.length > 60 ? link.substring(0, 60) + '...' : link}
              </a>
            ))}
          </div>
        );
      })(),
      color: '#7c3aed',
      bold: false
    },
    { label: 'Status', value: product.status || 'draft', color: HC.brown, bold: true },
  ];

  const statusKey = product.status === 'reject' ? 'rejected' : product.status;

  const handleMediaClick = (idx) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 800, background: HC.orangePale, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>

          <div style={{ padding: '13px 20px', background: HC.ink, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 4, height: 22, borderRadius: 99, background: `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', fontFamily: "'Inter',sans-serif" }}>Chi tiết sản phẩm</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'Inter',sans-serif", marginTop: 1 }}>{product.product_type || `#${product.id}`}</div>
            </div>
            <Badge status={statusKey} />
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,166,35,0.2)'; e.currentTarget.style.color = HC.orange; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>✕</button>
          </div>

          <div style={{ height: 220, flexShrink: 0, background: '#2a1a00', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: mediaUrls.length ? 'pointer' : 'default' }}
            onClick={() => { if (mediaUrls.length) handleMediaClick(0); }}>
            {mediaUrls.length > 0 ? (
              isVideo(mediaUrls[0]) ? (
                <video src={mediaUrls[0]} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={mediaUrls[0]} alt="" style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
              )
            ) : (
              <div style={{ color: HC.muted2, textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 8 }}>📷</div><div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif", marginTop: 6 }}>Không có ảnh</div></div>
            )}
            {mediaUrls.length > 1 && (
              <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#fff' }}>
                {mediaUrls.length} media
              </div>
            )}
          </div>

          {mediaUrls.length > 1 && (
            <div style={{ display: 'flex', gap: 6, padding: '10px', overflowX: 'auto', background: '#1f1400', borderTop: `1px solid ${HC.border}` }}>
              {mediaUrls.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => handleMediaClick(idx)}
                  style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${idx === lightboxIndex ? HC.orange : 'transparent'}`, flexShrink: 0 }}
                >
                  {isVideo(url) ? (
                    <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <div style={{
              background: HC.surface,
              borderRadius: 16,
              overflow: 'hidden',
              border: `1.5px solid ${HC.border}`,
              boxShadow: `0 4px 18px ${HC.orangeGlow}`
            }}>
              <CardHeader icon="📦" title="Thông tin sản phẩm" subtitle="Product details" badge={fmtDate(product.deadline_date) || 'No deadline'} />
              <div style={{ background: HC.surface }}>
                {productRows.map((r, idx) => <InfoRow key={r.label} label={r.label} value={r.value} valueColor={r.color} valueBold={r.bold} idx={idx} isLast={idx === productRows.length - 1} />)}
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 20px', background: HC.surface, borderTop: `1.5px solid ${HC.border}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
            {product.status === 'pending' && onReject && (
              <button onClick={onReject} style={{ padding: '10px 24px', borderRadius: 10, background: '#fff', color: HC.danger, border: `1.5px solid ${HC.danger}`, cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: "'Inter',sans-serif" }}>Từ chối</button>
            )}
            {product.status === 'pending' && onApprove && (
              <button onClick={() => onApprove(product)} style={{ padding: '10px 24px', borderRadius: 10, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: "'Inter',sans-serif" }}>Duyệt</button>
            )}
            <button onClick={onClose} style={{ padding: '10px 28px', borderRadius: 10, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: "'Inter',sans-serif", boxShadow: `0 4px 16px ${HC.orangeGlow}` }}>Đóng</button>
          </div>
        </div>
      </div>

      {lightboxOpen && <Lightbox mediaUrls={mediaUrls} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
    </>
  );
}
