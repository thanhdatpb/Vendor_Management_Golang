import React, { useEffect, useState } from 'react';
import {
  CalendarOutlined, CheckOutlined, CloseOutlined, DislikeOutlined, ExportOutlined,
  FieldTimeOutlined, FolderOutlined, InfoCircleOutlined, LikeOutlined, PictureOutlined,
  PlayCircleOutlined, ZoomInOutlined,
} from '@ant-design/icons';
import { HC, STATUS_CFG } from '../constants';
import { fmtDate, getMediaUrls } from '../utils';
import { Badge } from '../ui';
import Lightbox from './Lightbox';
import useIsMobile from '../../../hooks/useIsMobile';

const FONT = "'Inter',sans-serif";

const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

// Link lưu ở nhiều dạng: mảng, chuỗi JSON của mảng, hoặc 1 URL trơn.
const toList = (value) => {
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
const shortUrl = (url) => {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return url;
  }
};

// Seller hay nối các đặc tính bằng ♦ / • / xuống dòng → tách thành danh sách.
// Bỏ gạch đầu dòng "- " Seller tự gõ để không bị 2 ký hiệu cạnh dấu tick.
const splitSpecs = (text) => (typeof text === 'string'
  ? text.split(/[♦•\n]+/).map(s => s.trim().replace(/^[-*+]\s*/, '').trim()).filter(Boolean)
  : []);

// Rộng 960px gốc + 2,5cm mỗi cạnh (1cm CSS ≈ 37,8px → ≈ 95px/cạnh).
const MODAL_MAX_WIDTH = 'calc(960px + 5cm)';

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// Link ảnh của Seller có thể là trang Etsy / link hỏng → hiện icon thay vì khung trắng.
function MediaView({ url, fit, alt = '', iconSize = 28 }) {
  const [failed, setFailed] = useState(false);
  const fill = { width: '100%', height: '100%', display: 'block' };
  if (failed) {
    return (
      <span style={{ ...fill, display: 'grid', placeItems: 'center', color: HC.muted2, fontSize: iconSize }}>
        <PictureOutlined />
      </span>
    );
  }
  return isVideo(url)
    ? <video src={url} muted onError={() => setFailed(true)} style={{ ...fill, objectFit: 'cover' }} />
    : <img src={url} alt={alt} onError={() => setFailed(true)} style={{ ...fill, objectFit: fit }} />;
}

function Section({ title, last, children }) {
  return (
    <section style={{ padding: '16px 0', borderBottom: last ? 'none' : `1px solid ${HC.border}` }}>
      <h3 style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: HC.brown, fontFamily: FONT }}>{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: HC.brown, fontFamily: FONT }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 14, fontWeight: value ? 600 : 400, color: value ? HC.ink : HC.muted, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45, fontFamily: FONT }}>{value || '—'}</div>
    </div>
  );
}

function ReviewCard({ tone, label, value }) {
  const good = tone === 'good';
  const cfg = good ? STATUS_CFG.approved : STATUS_CFG.rejected;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr)', gap: 10, padding: '11px 12px', borderRadius: 10, background: cfg.bg, border: `1px solid ${good ? '#bbf7d0' : '#fecaca'}`, color: cfg.text }}>
      <span style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', background: good ? '#dcfce7' : '#fee2e2', color: cfg.dot, fontSize: 15 }}>
        {good ? <LikeOutlined /> : <DislikeOutlined />}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: FONT }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 13.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: FONT }}>{value || '—'}</div>
      </div>
    </div>
  );
}

function RefLink({ href, title, video }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 16px', alignItems: 'center', gap: 12, padding: '9px 12px 9px 9px', border: `1px solid ${HC.border}`, borderRadius: 10, textDecoration: 'none', color: HC.ink, background: HC.surface, transition: 'background .15s, border-color .15s' }}
      onMouseEnter={e => { e.currentTarget.style.background = HC.cream; e.currentTarget.style.borderColor = HC.borderStrong; }}
      onMouseLeave={e => { e.currentTarget.style.background = HC.surface; e.currentTarget.style.borderColor = HC.border; }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 16, background: video ? '#f3e8ff' : HC.orangeLight, color: video ? '#7c3aed' : HC.orangeDeep }}>
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

export default function ProductViewerModal({ product, onClose, onApprove, onReject }) {
  const isMobile = useIsMobile();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Ảnh đang chọn gắn với id sản phẩm → mở sản phẩm khác thì tự về ảnh đầu.
  const [selected, setSelected] = useState({ productId: product?.id, index: 0 });
  const activeIndex = selected.productId === product?.id ? selected.index : 0;
  const setActiveIndex = (index) => setSelected({ productId: product?.id, index });
  const mediaUrls = getMediaUrls(product);

  useEffect(() => {
    if (!product) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (lightboxOpen) setLightboxOpen(false);
      else onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, lightboxOpen, onClose]);

  if (!product) return null;

  // Deadline do role Vendor đặt sau khi Admin duyệt → form chưa duyệt (chờ duyệt / từ chối)
  // chưa có deadline, nên chỉ hiện chip Deadline khi form đã duyệt.
  const showDeadline = product.status === 'approved';
  const statusKey = product.status === 'reject' ? 'rejected' : (product.status || 'draft');
  const isPending = product.status === 'pending';
  const hasActions = isPending && Boolean(onApprove || onReject);

  const sellerName = product.seller_name || product.sellerName || product.user_name || product.userName || '';
  const current = Math.min(activeIndex, Math.max(mediaUrls.length - 1, 0));
  const specItems = splitSpecs(product.other_specs);
  const imageLinks = (product.product_type_links ? toList(product.product_type_links) : toList(product.product_type_link)).filter(Boolean);
  const videoLinks = toList(product.product_video_links).filter(Boolean);

  const gutter = isMobile ? 14 : 22;
  const metaItem = { display: 'inline-flex', alignItems: 'center', gap: 7 };
  const metaIcon = { color: HC.muted, fontSize: 14 };
  const twoCols = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: isMobile ? 10 : '12px 20px' };
  const btnBase = { height: isMobile ? 44 : 40, padding: '0 18px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: FONT, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, flex: isMobile ? 1 : 'none', transition: 'background .15s, border-color .15s' };

  const openLightbox = () => { if (mediaUrls.length) setLightboxOpen(true); };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)', padding: isMobile ? 8 : 16 }}>
        <div role="dialog" aria-modal="true" aria-label={product.product_type || 'Chi tiết request'} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: MODAL_MAX_WIDTH, background: HC.surface, borderRadius: 16, boxShadow: '0 32px 80px rgba(26,15,0,0.28)', border: `1px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh', fontFamily: FONT }}>

          {/* Header — Product Type làm tiêu đề, Seller / Project / ngày gửi gom 1 dòng */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 12 : 16, padding: isMobile ? '14px 14px 12px' : '18px 22px 16px', background: HC.surface2, borderBottom: `1px solid ${HC.border}`, flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: HC.brown }}>Request từ Seller</div>
              <h2 style={{ margin: '3px 0 9px', fontSize: isMobile ? 18 : 21, fontWeight: 800, letterSpacing: '-0.01em', color: HC.ink, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 12px', lineHeight: 1.25, wordBreak: 'break-word' }}>
                {product.product_type || `#${product.id}`}
                <Badge status={statusKey} />
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 13, color: HC.ink2, fontVariantNumeric: 'tabular-nums' }}>
                {sellerName && (
                  <span style={metaItem}>
                    <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', background: HC.orangeMid, color: HC.orangeDeep, fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{initials(sellerName)}</span>
                    {sellerName}
                  </span>
                )}
                {product.project && <span style={metaItem}><FolderOutlined style={metaIcon} />{product.project}</span>}
                <span style={metaItem}><CalendarOutlined style={metaIcon} />{`Gửi ${fmtDate(product.created_at)}`}</span>
                {showDeadline && (
                  <span style={{ ...metaItem, gap: 6, padding: '1px 9px', borderRadius: 999, background: STATUS_CFG.rejected.bg, border: '1px solid #fecaca', color: HC.danger, fontWeight: 600 }}>
                    <FieldTimeOutlined />
                    <span>Deadline</span>
                    <span>{fmtDate(product.deadline_date)}</span>
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${HC.border}`, background: HC.surface, color: HC.brown, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: 14, transition: 'background .15s, color .15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = HC.orangeLight; e.currentTarget.style.color = HC.orangeDeep; }}
              onMouseLeave={e => { e.currentTarget.style.background = HC.surface; e.currentTarget.style.color = HC.brown; }}
            >
              <CloseOutlined />
            </button>
          </div>

          {/* Body — cột ảnh (trái) + cột thông tin (phải); mobile xếp chồng */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px minmax(0,1fr)', alignItems: 'stretch' }}>
            <div style={{ background: HC.cream, borderRight: isMobile ? 'none' : `1px solid ${HC.border}`, borderBottom: isMobile ? `1px solid ${HC.border}` : 'none' }}>
              {/* Cột ảnh cao bằng cột thông tin để giữ nền/viền; khối bên trong sticky để ảnh không trôi mất khi cuộn */}
              <div style={{ position: isMobile ? 'static' : 'sticky', top: 0, padding: isMobile ? 14 : 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {mediaUrls.length > 0 ? (
                  <button
                    type="button"
                    onClick={openLightbox}
                    aria-label={`Phóng to ảnh ${current + 1}`}
                    style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', maxHeight: isMobile ? 320 : 'none', borderRadius: 12, border: `1px solid ${HC.border}`, background: HC.orangeLight, overflow: 'hidden', padding: 0, cursor: 'zoom-in', display: 'block' }}
                  >
                    <MediaView key={mediaUrls[current]} url={mediaUrls[current]} fit="contain" alt={product.product_type || ''} iconSize={40} />
                    <span style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 8, background: 'rgba(255,255,255,0.92)', color: HC.brown, display: 'grid', placeItems: 'center', fontSize: 15 }}><ZoomInOutlined /></span>
                    {mediaUrls.length > 1 && (
                      <span style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(26,15,0,0.72)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 999, fontVariantNumeric: 'tabular-nums' }}>{current + 1} / {mediaUrls.length}</span>
                    )}
                  </button>
                ) : (
                  <div style={{ width: '100%', aspectRatio: isMobile ? '16 / 9' : '1 / 1', borderRadius: 12, border: `1px dashed ${HC.borderStrong}`, background: HC.orangePale, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: HC.muted }}>
                    <PictureOutlined style={{ fontSize: 32, color: HC.muted2 }} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Chưa có ảnh</span>
                  </div>
                )}

                {mediaUrls.length > 1 && (
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 5 : 4}, minmax(0,1fr))`, gap: 8 }}>
                    {mediaUrls.map((url, idx) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        aria-label={`Ảnh ${idx + 1}`}
                        aria-current={idx === current ? 'true' : undefined}
                        style={{ aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', padding: 0, cursor: 'pointer', background: HC.orangeLight, border: `2px solid ${idx === current ? HC.orange : HC.border}`, display: 'block', transition: 'border-color .15s' }}
                      >
                        <MediaView url={url} fit="cover" iconSize={18} />
                      </button>
                    ))}
                  </div>
                )}

                {mediaUrls.length > 0 && (
                  <div style={{ fontSize: 12, color: HC.brown }}>Bấm ảnh để xem cỡ lớn</div>
                )}
              </div>
            </div>

            <div style={{ minWidth: 0, padding: `4px ${gutter}px 6px` }}>
              <Section title="Thông số sản phẩm">
                <div style={twoCols}>
                  <Field label="Chất liệu" value={product.material} />
                  <Field label="Vùng in" value={product.print_area} />
                </div>
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: HC.brown }}>Đặc tính kỹ thuật</div>
                  {specItems.length > 1 ? (
                    <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'grid', gap: 6 }}>
                      {specItems.map((item, idx) => (
                        <li key={idx} style={{ display: 'grid', gridTemplateColumns: '16px minmax(0,1fr)', gap: 8, fontSize: 13.5, color: HC.ink2, lineHeight: 1.45, wordBreak: 'break-word' }}>
                          <CheckOutlined style={{ color: HC.orangeDeep, fontSize: 12, marginTop: 4 }} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ marginTop: 2, fontSize: 14, fontWeight: product.other_specs ? 600 : 400, color: product.other_specs ? HC.ink : HC.muted, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.45 }}>{specItems[0] || '—'}</div>
                  )}
                </div>
              </Section>

              <Section title="Phản hồi khách hàng">
                <div style={{ ...twoCols, gap: 10 }}>
                  <ReviewCard tone="good" label="Good review" value={product.good_review} />
                  <ReviewCard tone="bad" label="Bad review" value={product.bad_review} />
                </div>
              </Section>

              <Section title="Đóng gói">
                <div style={twoCols}>
                  <Field label="Packing" value={product.packaging_links} />
                  <Field label="Other packing" value={product.other_packaging} />
                </div>
              </Section>

              <Section title="Tham khảo" last>
                {imageLinks.length + videoLinks.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {imageLinks.map((link, idx) => (
                      <RefLink key={`img-${idx}`} href={link} title={imageLinks.length > 1 ? `Link hình ảnh ${idx + 1}` : 'Link hình ảnh'} />
                    ))}
                    {videoLinks.map((link, idx) => (
                      <RefLink key={`vid-${idx}`} href={link} video title={videoLinks.length > 1 ? `Video sản phẩm ${idx + 1}` : 'Video sản phẩm'} />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: HC.muted }}>Seller chưa gửi link tham khảo</div>
                )}
              </Section>
            </div>
          </div>

          {/* Footer — "Duyệt request" là nút chính duy nhất; không có thao tác duyệt thì chỉ còn "Đóng" */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px 20px', padding: isMobile ? '12px 14px' : '14px 22px', background: HC.surface2, borderTop: `1px solid ${HC.border}`, flexShrink: 0 }}>
            {isPending && onApprove && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: HC.brown }}>
                <InfoCircleOutlined style={{ color: HC.muted }} />
                Sau khi duyệt, Vendor nhận request và đặt deadline.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', width: isMobile ? '100%' : 'auto' }}>
              {isPending && onReject && (
                <button
                  type="button"
                  onClick={onReject}
                  style={{ ...btnBase, background: HC.surface, color: HC.danger, border: '1.5px solid #f3b4b4' }}
                  onMouseEnter={e => { e.currentTarget.style.background = STATUS_CFG.rejected.bg; e.currentTarget.style.borderColor = HC.danger; }}
                  onMouseLeave={e => { e.currentTarget.style.background = HC.surface; e.currentTarget.style.borderColor = '#f3b4b4'; }}
                >Từ chối</button>
              )}
              {isPending && onApprove && (
                <button
                  type="button"
                  onClick={() => onApprove(product)}
                  style={{ ...btnBase, background: HC.success, color: '#fff', border: `1.5px solid ${HC.success}`, boxShadow: '0 6px 16px rgba(22,163,74,0.25)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; e.currentTarget.style.borderColor = '#15803d'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = HC.success; e.currentTarget.style.borderColor = HC.success; }}
                ><CheckOutlined />Duyệt request</button>
              )}
              {!hasActions && (
                <button
                  type="button"
                  onClick={onClose}
                  style={{ ...btnBase, padding: '0 28px', background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', boxShadow: `0 4px 16px ${HC.orangeGlow}` }}
                >Đóng</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {lightboxOpen && <Lightbox mediaUrls={mediaUrls} initialIndex={current} onClose={() => setLightboxOpen(false)} />}
    </>
  );
}
