// ════════════════════════════════════════════════════════
//  REQUEST DETAIL UI — mảnh ghép dùng chung cho các màn "chi tiết request"
//  (Seller, Vendor). Bố cục gốc là form duyệt request của Admin
//  (admin/modals/ProductViewerModal.jsx): header sáng, ảnh cột trái dạng
//  thumbnail, thông tin chia Section có tiêu đề.
//
//  HC lấy từ sellerTheme vì các role dùng chung đúng một bảng màu (constants
//  của vendor chỉ thêm gold*) — tránh 2 nguồn màu lệch nhau khi chỉnh theme.
// ════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  CheckOutlined, DislikeOutlined, ExportOutlined, LikeOutlined,
  PictureOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import { HC } from '../../constants/sellerTheme';

// Rộng bằng modal chi tiết request bên Admin (960px + 9cm) nới thêm biên để
// bảng so sánh 7 cột không bị bó hẹp. Form request phôi mới dùng chung hằng
// số này để các khung luôn thẳng cạnh nhau.
export const MODAL_MAX_WIDTH = 'min(1480px, 100%)';

export const FONT = "'Inter',sans-serif";

export const isVideoUrl = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

// Link lưu ở nhiều dạng: mảng, chuỗi JSON của mảng, hoặc 1 URL trơn.
export const toList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return [value];
    }
  }
  return [];
};

// Hiện domain + path (bỏ https://www.) — URL đầy đủ nằm ở tooltip.
export const shortUrl = (url) => {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return url;
  }
};

// Seller hay nối các đặc tính bằng ♦ / • / xuống dòng → tách thành danh sách.
// Bỏ gạch đầu dòng "- " người dùng tự gõ để không bị 2 ký hiệu cạnh dấu tick.
export const splitSpecs = (text) => (typeof text === 'string'
  ? text.split(/[♦•\n]+/).map(s => s.trim().replace(/^[-*+]\s*/, '').trim()).filter(Boolean)
  : []);

export const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Link ảnh người dùng dán có thể là trang Etsy / link hỏng → hiện icon thay vì khung trắng.
export function MediaView({ url, fit, alt = '', iconSize = 28 }) {
  const [failed, setFailed] = useState(false);
  const fill = { width: '100%', height: '100%', display: 'block' };
  if (failed) {
    return (
      <span style={{ ...fill, display: 'grid', placeItems: 'center', color: HC.muted2, fontSize: iconSize }}>
        <PictureOutlined />
      </span>
    );
  }
  return isVideoUrl(url)
    ? <video src={url} muted style={{ ...fill, objectFit: fit }} onError={() => setFailed(true)} />
    : <img src={url} alt={alt} style={{ ...fill, objectFit: fit }} onError={() => setFailed(true)} />;
}

export function Section({ title, last, children }) {
  return (
    <section style={{ padding: '16px 0', borderBottom: last ? 'none' : `1px solid ${HC.border}` }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: HC.brown, fontFamily: FONT }}>{title}</h3>
      {children}
    </section>
  );
}

export function Field({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: HC.brown, fontFamily: FONT }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 14, fontWeight: value ? 600 : 400, color: value ? HC.ink : HC.muted, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45, fontFamily: FONT }}>{value || '—'}</div>
    </div>
  );
}

export function ReviewCard({ good, label, value }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr)', gap: 10, padding: '11px 12px', borderRadius: 10, background: good ? '#f0fdf4' : '#fef2f2', border: `1px solid ${good ? '#bbf7d0' : '#fecaca'}`, color: good ? '#065f46' : '#991b1b' }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: good ? '#dcfce7' : '#fee2e2', color: good ? HC.success : HC.danger, fontSize: 15 }}>
        {good ? <LikeOutlined /> : <DislikeOutlined />}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: FONT }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: FONT }}>{value || '—'}</div>
      </div>
    </div>
  );
}

export function RefLink({ href, title, video }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      onClick={e => e.stopPropagation()}
      style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 16px', alignItems: 'center', gap: 12, padding: '9px 12px 9px 9px', border: `1px solid ${HC.border}`, borderRadius: 10, textDecoration: 'none', color: HC.ink, background: HC.surface, transition: 'background .15s, border-color .15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = HC.cream; e.currentTarget.style.borderColor = HC.borderStrong; }}
      onMouseLeave={e => { e.currentTarget.style.background = HC.surface; e.currentTarget.style.borderColor = HC.border; }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 16, background: video ? '#f5f3ff' : HC.orangeLight, color: video ? '#7c3aed' : HC.orangeDeep }}>
        {video ? <PlayCircleOutlined /> : <PictureOutlined />}
      </span>
      <span style={{ minWidth: 0, fontFamily: FONT }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: HC.brown, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortUrl(href)}</span>
      </span>
      <ExportOutlined style={{ color: HC.muted, fontSize: 14 }} />
    </a>
  );
}

// Dải 3 số quyết định của request — tách khỏi field thường vì đây là thứ
// người xem liếc đầu tiên.
export function SpecRail({ totalCost, productionTime, shippingTime, isMobile }) {
  const cell = { border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 12px', background: HC.surface };
  const key = { fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280' };
  const val = { marginTop: 3, fontSize: 15, fontWeight: 800, color: HC.ink, fontVariantNumeric: 'tabular-nums' };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 14 }}>
      <div style={{ ...cell, background: '#ecfdf5', borderColor: '#bbf7d0' }}>
        <div style={{ ...key, color: '#065f46' }}>Target cost</div>
        <div style={{ ...val, fontSize: 17, fontWeight: 900, color: '#065f46' }}>
          {totalCost != null && totalCost !== '' ? `$${totalCost}` : '—'}
        </div>
      </div>
      <div style={cell}>
        <div style={key}>Thời gian SX</div>
        <div style={val}>{productionTime || '—'}</div>
      </div>
      <div style={cell}>
        <div style={key}>Thời gian ship</div>
        <div style={val}>{shippingTime || '—'}</div>
      </div>
    </div>
  );
}

// Đặc tính kỹ thuật: nhiều ý thì thành checklist, 1 ý giữ nguyên đoạn văn.
export function SpecList({ text }) {
  const items = splitSpecs(text);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: HC.brown }}>Đặc tính kỹ thuật</div>
      {items.length > 1 ? (
        <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 6 }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0,1fr)', gap: 8, fontSize: 13.5, color: HC.ink2, lineHeight: 1.45, wordBreak: 'break-word' }}>
              <CheckOutlined style={{ color: HC.orangeDeep, fontSize: 12, marginTop: 4 }} />
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ marginTop: 2, fontSize: 14, fontWeight: text ? 600 : 400, color: text ? HC.ink : HC.muted, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>{items[0] || '—'}</div>
      )}
    </div>
  );
}

export function VendorEmptyState({ note = 'Bộ phận Vận hành sẽ gán nhà cung cấp phù hợp sau khi xem xét yêu cầu sản phẩm này.' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', background: HC.surface, borderRadius: 12, border: `1px dashed ${HC.borderStrong}`, textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: HC.cream, border: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={HC.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color: HC.ink, marginBottom: 6 }}>Chưa có nhà phân phối được gán</div>
      <div style={{ fontSize: 12, color: HC.muted, lineHeight: 1.6, maxWidth: 360 }}>{note}</div>
    </div>
  );
}

// Thanh tiêu đề khối "So sánh nhà phân phối" — dùng chung, chỗ khác nhau
// (nút Matrix của Vendor) truyền qua `actions`.
export function VendorBar({ vendors = [], totalCost, isMobile, actions }) {
  const uCount = new Set(vendors.map(v => (v.name || v.vendor_type || '').toString().trim()).filter(Boolean)).size || vendors.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: isMobile ? '10px 14px' : '11px 22px', background: HC.surface2, borderTop: `1px solid ${HC.border}`, borderBottom: `1px solid ${HC.border}`, flexShrink: 0 }}>
      <span style={{ fontWeight: 700, fontSize: 11, color: HC.brown, textTransform: 'uppercase', letterSpacing: '0.08em' }}>So sánh nhà phân phối</span>
      {vendors.length > 0 && (
        <span style={{ padding: '2px 10px', borderRadius: 999, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, color: HC.orangeDeep, fontSize: 11, fontWeight: 700 }}>{uCount} vendor</span>
      )}
      {totalCost != null && totalCost !== '' && (
        <span style={{ padding: '2px 10px', borderRadius: 999, background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#065f46', fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Target ${totalCost}</span>
      )}
      {actions && <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8 }}>{actions}</span>}
    </div>
  );
}

// Header sáng dùng chung: eyebrow + tiêu đề (Product Type) + hàng meta + nút đóng.
export function DetailHeader({ eyebrow, title, badges, meta, isMobile, onClose, actions }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 12 : 16, padding: isMobile ? '14px 14px 12px' : '18px 22px 16px', background: HC.surface2, borderBottom: `1px solid ${HC.border}`, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: HC.brown }}>{eyebrow}</div>
        <h2 style={{ margin: '3px 0 9px', fontSize: isMobile ? 18 : 21, fontWeight: 800, letterSpacing: '-0.01em', color: HC.ink, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', lineHeight: 1.25, wordBreak: 'break-word' }}>
          {title}
          {badges}
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 13, color: HC.ink2, fontVariantNumeric: 'tabular-nums' }}>{meta}</div>
      </div>
      {actions}
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        style={{ width: isMobile ? 40 : 36, height: isMobile ? 40 : 36, borderRadius: 10, border: `1px solid ${HC.border}`, background: HC.surface, color: HC.brown, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 15, transition: 'background .15s, color .15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = HC.orangeLight; e.currentTarget.style.color = HC.orangeDeep; }}
        onMouseLeave={e => { e.currentTarget.style.background = HC.surface; e.currentTarget.style.color = HC.brown; }}
      >✕</button>
    </div>
  );
}

// Cột ảnh bên trái: hero vuông bấm để phóng to + hàng thumbnail.
export function MediaColumn({ urls = [], current = 0, onSelect, onOpen, isMobile, alt = '', refLinkBadge = false, hint = 'Bấm ảnh để xem cỡ lớn' }) {
  return (
    <div style={{ background: HC.cream, borderRight: isMobile ? 'none' : `1px solid ${HC.border}`, borderBottom: isMobile ? `1px solid ${HC.border}` : 'none' }}>
      <div style={{ position: isMobile ? 'static' : 'sticky', top: 0, padding: isMobile ? 14 : 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {urls.length > 0 ? (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Phóng to ảnh ${current + 1}`}
            style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', maxHeight: isMobile ? 320 : 'none', borderRadius: 12, border: `1px solid ${HC.border}`, background: HC.orangeLight, overflow: 'hidden', padding: 0, cursor: 'zoom-in', display: 'block' }}
          >
            <MediaView key={urls[current]} url={urls[current]} fit="contain" alt={alt} iconSize={40} />
            <span style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.92)', color: HC.brown, display: 'grid', placeItems: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5M11 8v6M8 11h6"/></svg>
            </span>
            {urls.length > 1 && (
              <span style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(26,15,0,0.72)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{current + 1} / {urls.length}</span>
            )}
            {refLinkBadge && (
              <span style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(245,158,11,0.85)', borderRadius: 5, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Ref. Link</span>
            )}
          </button>
        ) : (
          <div style={{ width: '100%', aspectRatio: isMobile ? '16 / 9' : '1 / 1', borderRadius: 12, border: `1px dashed ${HC.borderStrong}`, background: HC.orangePale, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: HC.muted }}>
            <PictureOutlined style={{ fontSize: 32, color: HC.muted2 }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>Chưa có ảnh</span>
          </div>
        )}

        {urls.length > 1 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 5 : 4}, minmax(0,1fr))`, gap: 8 }}>
            {urls.map((url, idx) => (
              <button
                key={url + idx}
                type="button"
                onClick={() => onSelect?.(idx)}
                aria-label={`Ảnh ${idx + 1}`}
                aria-current={idx === current ? 'true' : undefined}
                style={{ aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', padding: 0, cursor: 'pointer', background: HC.orangeLight, border: `2px solid ${idx === current ? HC.orange : HC.border}`, display: 'block', transition: 'border-color .15s' }}
              >
                <MediaView url={url} fit="cover" iconSize={18} />
              </button>
            ))}
          </div>
        )}

        {urls.length > 0 && <div style={{ fontSize: 12, color: HC.brown }}>{hint}</div>}
      </div>
    </div>
  );
}
