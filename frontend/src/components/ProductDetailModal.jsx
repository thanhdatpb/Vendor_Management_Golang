import { useState, useEffect } from 'react';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { HC, STATUS_CFG, LS_PRODUCT_VENDORS } from '../constants/sellerTheme';
import { lsGet, fmtDate, getMediaUrls } from '../utils/sellerHelpers';

// ─── Sub-components ─────────────────────────────────────

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 999,
      background: cfg.bg, color: cfg.text,
      fontSize: 11, fontWeight: 800, letterSpacing: '0.02em',
      border: `1px solid ${cfg.dot}33`,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function InfoCard({ label, value, valueColor, bold, bg, border }) {
  return (
    <div style={{
      background: bg || '#f9fafb',
      border: `1px solid ${border || '#e5e7eb'}`,
      borderRadius: 10,
      padding: '10px 13px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: bold ? 800 : 600, color: valueColor || HC.ink, lineHeight: 1.4 }}>
        {value || '—'}
      </div>
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────

export default function ProductDetailModal({ product, productVendors, onClose, getStatus }) {
  const [vendors, setVendors] = useState(() => (productVendors || {})[product?.id] || []);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const mediaUrls = getMediaUrls(product);
  const status = getStatus ? getStatus(product) : (product?.status || 'draft');

  useEffect(() => {
    setVendors((productVendors || {})[product?.id] || []);
  }, [product?.id, productVendors]);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!product) return null;

  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));
  const Na = () => <span style={{ color: '#9ca3af', fontSize: 11, fontStyle: 'italic' }}>—</span>;

  // Parse links
  let links = [];
  if (product.product_type_links) {
    if (Array.isArray(product.product_type_links)) links = product.product_type_links;
    else { try { links = JSON.parse(product.product_type_links); } catch { links = [product.product_type_links]; } }
  } else if (product.product_type_link) links = [product.product_type_link];

  // Parse video links
  let videoLinks = [];
  if (product.product_video_links) {
    if (Array.isArray(product.product_video_links)) videoLinks = product.product_video_links;
    else { try { videoLinks = JSON.parse(product.product_video_links); } catch { videoLinks = [product.product_video_links]; } }
  }
  videoLinks = videoLinks.filter(Boolean);

  // Group vendors by name
  const groupedVendors = [];
  const groupMap = new Map();
  vendors.forEach((v, idx) => {
    const vName = ((v.name || v.vendor_type || '') + '').trim() || `vendor_${idx}`;
    if (!groupMap.has(vName)) {
      const g = { vendorName: vName, items: [], firstVendor: v };
      groupMap.set(vName, g);
      groupedVendors.push(g);
    }
    groupMap.get(vName).items.push(v);
  });

  const thStyle = {
    padding: '10px 12px',
    fontWeight: 700,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#78350f',
    background: '#fef3c7',
    borderRight: '1px solid #fde68a',
    borderBottom: '1.5px solid #fde68a',
    textAlign: 'center',
    whiteSpace: 'nowrap',
  };

  const tdStyle = (extra = {}) => ({
    padding: '10px 12px',
    verticalAlign: 'middle',
    borderRight: '1px solid #f3f4f6',
    borderBottom: '1px solid #f3f4f6',
    fontSize: 12,
    ...extra,
  });

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)',
          backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 999, padding: 16,
        }}
      >
        {/* Modal shell */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 1360, height: '92vh',
            background: '#ffffff', borderRadius: 20,
            boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
            border: '1px solid #e5e7eb',
            overflow: 'hidden', display: 'flex', flexDirection: 'column',
          }}
        >

          {/* ── Header ── */}
          <div style={{
            padding: '14px 20px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          }}>
            <div style={{ width: 4, height: 24, borderRadius: 99, background: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', fontFamily: "'Nunito', sans-serif", letterSpacing: '0.01em' }}>
                Chi tiết sản phẩm
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontFamily: "'Nunito Sans', sans-serif" }}>
                {product.product_type || `#${product.id}`}
              </div>
            </div>

            <StatusBadge status={status} />

            {/* Close button */}
            <button
              onClick={onClose}
              title="Đóng"
              style={{
                width: 32, height: 32, borderRadius: 9,
                border: '1.5px solid rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1, flexShrink: 0, transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.28)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
            >
              ✕
            </button>
          </div>

          {/* ── Body ── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* TOP: Media + Info */}
            <div style={{ display: 'flex', flexShrink: 0, borderBottom: '1.5px solid #f3f4f6', height: 310 }}>

              {/* Media panel */}
              <div style={{ width: 300, flexShrink: 0, borderRight: '1.5px solid #f3f4f6', background: '#111827', position: 'relative', overflow: 'hidden' }}>
                {mediaUrls.length > 0 ? (
                  isVideo(mediaUrls[currentMediaIndex]) ? (
                    <video
                      src={mediaUrls[currentMediaIndex]}
                      onClick={() => { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); }}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
                    />
                  ) : (
                    <img
                      src={mediaUrls[currentMediaIndex]}
                      alt=""
                      onClick={() => { setLightboxIndex(currentMediaIndex); setLightboxOpen(true); }}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
                    />
                  )
                ) : (
                  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                    <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
                    <div style={{ fontSize: 12 }}>Không có ảnh</div>
                  </div>
                )}

                {mediaUrls.length > 1 && (
                  <>
                    <button onClick={e => { e.stopPropagation(); setCurrentMediaIndex(p => (p - 1 + mediaUrls.length) % mediaUrls.length); }}
                      style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <LeftOutlined style={{ fontSize: 12 }} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setCurrentMediaIndex(p => (p + 1) % mediaUrls.length); }}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <RightOutlined style={{ fontSize: 12 }} />
                    </button>
                    <div style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: '3px 9px', fontSize: 10, color: '#fff' }}>
                      {currentMediaIndex + 1} / {mediaUrls.length}
                    </div>
                  </>
                )}
              </div>

              {/* Info panel */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', background: '#fff' }}>
                {/* Dates row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontWeight: 800, fontSize: 12, color: HC.ink }}>📋 Thông tin request</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, background: '#f9fafb', border: '1px solid #e5e7eb', fontSize: 10, fontWeight: 700, color: '#6b7280' }}>
                      {fmtDate(product.created_at) || '—'}
                    </span>
                    {product.deadline_date && (
                      <span style={{ padding: '3px 10px', borderRadius: 999, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 10, fontWeight: 700, color: '#dc2626' }}>
                        ⏰ {fmtDate(product.deadline_date)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 1: Key metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr', gap: 8, marginBottom: 8 }}>
                  <InfoCard
                    label="Product Type"
                    value={product.product_type}
                    valueColor={HC.orangeDark}
                    bold
                    bg="#fffbeb"
                    border="#fde68a"
                  />
                  <InfoCard label="⏱ Thời gian SX" value={product.production_time} valueColor={HC.brown} bold />
                  <InfoCard label="🚢 Thời gian Ship" value={product.shipping_time} valueColor={HC.brown} bold />
                  <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 13px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>💰 Target Cost</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#065f46' }}>
                      {product.total_cost != null ? `$${product.total_cost}` : '—'}
                    </div>
                  </div>
                </div>

                {/* Row 2: Spec fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr 1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <InfoCard label="Chất liệu" value={product.material} />
                  <InfoCard label="Vùng In" value={product.print_area} />
                  <InfoCard label="Đặc tính KT" value={product.other_specs} />
                  <InfoCard label="Packaging" value={product.packaging_links} />
                  <InfoCard label="Other Pkg" value={product.other_packaging} />
                </div>

                {/* Row 3: Links */}
                {links.length > 0 && (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 13px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>🔗 Links</span>
                    {links.map((link, idx) => (
                      <a key={idx} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '4px 12px', borderRadius: 20, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}` }}
                        onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                        onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                      >
                        🔗 Link {idx + 1}
                      </a>
                    ))}
                  </div>
                )}

                {/* Row 4: Video links */}
                {videoLinks.length > 0 && (
                  <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 13px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>▶ Video</span>
                    {videoLinks.map((link, idx) => (
                      <a key={idx} href={link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#7c3aed', textDecoration: 'none', padding: '4px 12px', borderRadius: 20, background: '#ede9fe', border: '1px solid #c4b5fd' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#ddd6fe'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#ede9fe'; }}
                      >
                        ▶ Video {idx + 1}
                      </a>
                    ))}
                  </div>
                )}

                {/* Row 5: Good / Bad Review */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>👍 Good Review</div>
                    <div style={{ fontSize: 12, color: '#166534', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 60, overflowY: 'auto' }}>
                      {product.good_review || <Na />}
                    </div>
                  </div>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px' }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>👎 Bad Review</div>
                    <div style={{ fontSize: 12, color: '#991b1b', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 60, overflowY: 'auto' }}>
                      {product.bad_review || <Na />}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTTOM: Vendor Table */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fafafa' }}>

              {/* Vendor section header — softened */}
              <div style={{
                padding: '10px 20px', flexShrink: 0,
                background: '#fef3c7',
                borderBottom: '1.5px solid #fde68a',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 16 }}>🏪</span>
                <span style={{ fontWeight: 800, fontSize: 12, color: '#78350f', fontFamily: "'Nunito', sans-serif" }}>
                  Nhà phân phối được gán
                </span>
                {vendors.length > 0 && (
                  <span style={{ marginLeft: 'auto', padding: '2px 10px', borderRadius: 20, background: 'rgba(120,53,15,0.1)', color: '#78350f', fontSize: 10, fontWeight: 700 }}>
                    {vendors.length} vendor
                  </span>
                )}
              </div>

              <div style={{ flex: 1, overflow: 'auto', padding: '14px 20px' }}>
                {vendors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 60, background: '#fff', borderRadius: 16, border: '1.5px dashed #e5e7eb' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>Chưa có nhà phân phối nào được gán</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>Bộ phận Vận hành sẽ gán nhà cung cấp sau khi xem xét sản phẩm này.</div>
                  </div>
                ) : (
                  <>
                    <div style={{ borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', background: '#fff' }}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: 880, borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th style={{ ...thStyle, width: 68, textAlign: 'center' }}>Ảnh</th>
                              <th style={{ ...thStyle, textAlign: 'left', minWidth: 130 }}>Vendor</th>
                              <th style={{ ...thStyle }}>Product Type</th>
                              <th style={{ ...thStyle, textAlign: 'left', minWidth: 140 }}>Chất liệu</th>
                              <th style={{ ...thStyle }}>T.gian SX</th>
                              <th style={{ ...thStyle }}>T.gian Ship</th>
                              <th style={{ ...thStyle }}>Size</th>
                              <th style={{ ...thStyle }}>Link Folder</th>
                              <th style={{ ...thStyle, borderRight: 'none', color: '#065f46', background: '#ecfdf5', borderBottom: '1.5px solid #bbf7d0' }}>Total Price</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groupedVendors.map((group, gIdx) => {
                              const v = group.firstVendor;
                              const rowBg = gIdx % 2 === 0 ? '#ffffff' : '#fafafa';
                              const rawMaterial = v.overview || '';
                              const materialText = rawMaterial.length > 70 ? rawMaterial.slice(0, 70) + '…' : rawMaterial || null;
                              const vendorLink = v.link_folder || null;

                              return group.items.map((vi, idx) => (
                                <tr key={`${gIdx}-${idx}`}
                                  style={{ background: rowBg, transition: 'background 0.1s' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = '#fffbeb'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
                                >
                                  {idx === 0 && (
                                    <td rowSpan={group.items.length} style={tdStyle({ textAlign: 'center', width: 68 })}>
                                      {v.media_url
                                        ? <img src={v.media_url} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb', display: 'block', margin: '0 auto' }} />
                                        : <div style={{ width: 48, height: 48, borderRadius: 8, background: '#f9fafb', border: '1px dashed #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, margin: '0 auto', color: '#9ca3af' }}>📷</div>
                                      }
                                    </td>
                                  )}

                                  {idx === 0 && (
                                    <td rowSpan={group.items.length} style={tdStyle({ textAlign: 'left' })}>
                                      <div style={{ fontWeight: 800, fontSize: 12, color: HC.ink }}>{v.name || v.vendor_type || <Na />}</div>
                                      {v.name && v.vendor_type && v.name !== v.vendor_type && (
                                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{v.vendor_type}</div>
                                      )}
                                    </td>
                                  )}

                                  {idx === 0 && (
                                    <td rowSpan={group.items.length} style={tdStyle({ textAlign: 'center' })}>
                                      {v.vendor_type
                                        ? <span style={{ fontWeight: 700, fontSize: 10, color: HC.orangeDark, padding: '3px 10px', borderRadius: 20, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, display: 'inline-block', whiteSpace: 'nowrap' }}>{v.vendor_type}</span>
                                        : <Na />
                                      }
                                    </td>
                                  )}

                                  {idx === 0 && (
                                    <td rowSpan={group.items.length} style={tdStyle({ textAlign: 'left' })}>
                                      {materialText ? <span style={{ color: '#374151', lineHeight: 1.5 }} title={rawMaterial}>{materialText}</span> : <Na />}
                                    </td>
                                  )}

                                  {idx === 0 && (
                                    <td rowSpan={group.items.length} style={tdStyle({ textAlign: 'center' })}>
                                      {product.production_time ? <span style={{ fontWeight: 700, color: HC.brown }}>{product.production_time}</span> : <Na />}
                                    </td>
                                  )}

                                  {idx === 0 && (
                                    <td rowSpan={group.items.length} style={tdStyle({ textAlign: 'center' })}>
                                      {product.shipping_time ? <span style={{ fontWeight: 700, color: HC.brown }}>{product.shipping_time}</span> : <Na />}
                                    </td>
                                  )}

                                  <td style={tdStyle({ textAlign: 'center' })}>
                                    {vi.size
                                      ? <>
                                          <div style={{ fontWeight: 700, color: HC.ink }}>{vi.size}</div>
                                          {vi.optional && <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2 }}>{vi.optional}</div>}
                                        </>
                                      : <Na />
                                    }
                                  </td>

                                  {idx === 0 && (
                                    <td rowSpan={group.items.length} style={tdStyle({ textAlign: 'center' })}>
                                      {vendorLink
                                        ? <a href={vendorLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '5px 10px', borderRadius: 7, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, transition: 'all 0.15s' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                                          >📁 Xem</a>
                                        : <Na />
                                      }
                                    </td>
                                  )}

                                  <td style={tdStyle({ textAlign: 'center', borderRight: 'none' })}>
                                    {vi.eco_total != null && vi.eco_total !== '' && vi.eco_total !== 0
                                      ? <span style={{ fontWeight: 900, fontSize: 14, color: '#059669' }}>${Number(vi.eco_total).toFixed(2)}</span>
                                      : <Na />
                                    }
                                  </td>
                                </tr>
                              ));
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, padding: '8px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#92400e' }}>
                      <span>ℹ️</span>
                      <span>Các ô hiển thị <strong>—</strong> đang chờ bộ phận Vận hành cập nhật thông tin vendor.</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Footer ── */}
          <div style={{
            padding: '12px 20px', background: '#fff',
            borderTop: '1.5px solid #f3f4f6',
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0,
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '9px 28px', borderRadius: 10,
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#fff', border: 'none', cursor: 'pointer',
                fontWeight: 800, fontSize: 13, letterSpacing: '0.01em',
                boxShadow: '0 2px 8px rgba(245,158,11,0.35)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && mediaUrls.length > 0 && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', cursor: 'pointer' }}
        >
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            {isVideo(mediaUrls[lightboxIndex])
              ? <video src={mediaUrls[lightboxIndex]} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12 }} />
              : <img src={mediaUrls[lightboxIndex]} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
            }
            {mediaUrls.length > 1 && (
              <>
                <button onClick={e => { e.stopPropagation(); setLightboxIndex(p => (p - 1 + mediaUrls.length) % mediaUrls.length); }}
                  style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40, width: 48, height: 48, cursor: 'pointer', color: '#fff', fontSize: 28 }}>‹</button>
                <button onClick={e => { e.stopPropagation(); setLightboxIndex(p => (p + 1) % mediaUrls.length); }}
                  style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40, width: 48, height: 48, cursor: 'pointer', color: '#fff', fontSize: 28 }}>›</button>
                <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: 20, color: '#fff', fontSize: 12 }}>
                  {lightboxIndex + 1} / {mediaUrls.length}
                </div>
              </>
            )}
            <button onClick={() => setLightboxOpen(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40, width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}
