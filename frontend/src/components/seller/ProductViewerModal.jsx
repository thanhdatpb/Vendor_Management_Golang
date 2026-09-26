// ════════════════════════════════════════════════════════
//  PRODUCT VIEWER MODAL (Seller)
//  Redesign theo bố cục form duyệt request của Admin
//  (admin/modals/ProductViewerModal.jsx): header sáng, ảnh
//  cột trái dạng thumbnail, thông tin chia Section có tiêu đề.
//  Giữ riêng cho Seller: dải Target Cost/SX/Ship và bảng so
//  sánh nhà phân phối chạy hết chiều ngang modal.
// ════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { CalendarOutlined, ExportOutlined, FieldTimeOutlined, FileOutlined, FolderOutlined } from '@ant-design/icons';
import { HC, LS_A_SELECTIONS } from '../../constants/sellerTheme';
import { lsGet, fmtDate, getProductImages, getProductLinks, toImageEmbedUrl } from '../../utils/sellerHelpers';
import { targetCostCeiling } from '../../utils/targetCost';
import { libraryFilePath } from '../../utils/libraryFileLink';
import { Badge } from './SellerUI';
import useIsMobile from '../../hooks/useIsMobile';
import useResizablePane from '../../hooks/useResizablePane';
import {
  MODAL_MAX_WIDTH, FONT, isVideoUrl, toList, initials,
  DetailHeader, MediaColumn, Section, Field, ReviewCard, RefLink,
  SpecRail, SpecList, VendorBar, VendorEmptyState, PaneResizer,
} from '../shared/RequestDetailUI';

// Dùng chung key với modal chi tiết của Admin/Vendor: quen tay kéo ở màn nào
// thì mở màn còn lại cũng ra đúng chiều cao đó.
const LS_REQUEST_PANE = 'REQUEST_DETAIL_PANE_V1';

export default function ProductViewerModal({ product, productVendors, onClose, getStatus }) {
  const isMobile = useIsMobile();
  // Ưu tiên dùng assigned_vendors từ API, fallback về localStorage
  const [vendors, setVendors] = useState(() => product?.assigned_vendors || productVendors[product?.id] || []);
  const [selections, setSelections] = useState(() => lsGet(LS_A_SELECTIONS, {})[product?.id] || {});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  // Khung trên (thông tin request) kéo cao/thấp được, nhớ theo người dùng.
  // Mobile xếp dọc nên không chia khung — giữ nguyên cách cuộn cũ.
  const {
    containerRef: paneContainerRef, ratio: paneRatio, collapsed: paneCollapsed,
    dragging: paneDragging, startDrag: startPaneDrag, onKeyDown: onPaneKeyDown,
    toggleCollapse: togglePane, reset: resetPane,
  } = useResizablePane({ storageKey: LS_REQUEST_PANE, enabled: !isMobile });
  const paneHeight = paneCollapsed ? 0 : `${(paneRatio * 100).toFixed(2)}%`;
  // Ảnh upload từ máy + link tham khảo (convert Drive URLs → embeddable)
  const mediaUrls = getProductImages(product);
  const referenceLinks = getProductLinks(product);
  const referenceImageUrls = referenceLinks.map(toImageEmbedUrl);
  // Gộp cả hai: ảnh upload trước, link sau
  const displayUrls = [...mediaUrls, ...referenceImageUrls];

  useEffect(() => {
    setVendors(product?.assigned_vendors || productVendors[product?.id] || []);
  }, [product?.id, product?.assigned_vendors, productVendors]);

  // Ảnh hỏng do MediaView tự xử lý; ở đây chỉ cần về ảnh đầu khi đổi sản phẩm.
  useEffect(() => { setCurrentMediaIndex(0); }, [product?.id]);

  // Staff A chốt vendor ở luồng riêng (ghi LS_A_SELECTIONS) → badge "Đã chọn N"
  // phải bắt kịp mà không cần đóng/mở lại modal.
  useEffect(() => {
    const sync = () => {
      setSelections(lsGet(LS_A_SELECTIONS, {})[product?.id] || {});
    };
    window.addEventListener('storage', sync);
    const id = setInterval(sync, 4000);
    return () => { window.removeEventListener('storage', sync); clearInterval(id); };
  }, [product?.id]);

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

  const vendorKey = (v, i) => v.id ? String(v.id) : `idx_${i}`;

  // Đã ẩn khỏi UI (Seller chỉ xem tổng quan, quyết định duyệt nằm ở cấp
  // Product), nhưng `selections` vẫn đọc từ LS_A_SELECTIONS để hiện badge
  // "Đã chọn N nhà cung cấp" — badge này do luồng của Staff A ghi vào.
  const selectedCount = Object.values(selections).filter(s => s?.checked).length;

  const groupedVendors = [];
  const groupMap = new Map();
  vendors.forEach((v, idx) => {
    const vName = ((v.name || v.vendor_type || '—') || '').toString().trim();
    if (!groupMap.has(vName)) {
      groupMap.set(vName, {
        vendorName: vName,
        items: [],
        firstVendor: v,
        key: vendorKey(v, idx)
      });
      groupedVendors.push(groupMap.get(vName));
    }
    groupMap.get(vName).items.push(v);
  });

  const sellerName = product.seller_name || product.sellerName || '';
  const videoLinks = toList(product.product_video_links).filter(Boolean);
  const current = Math.min(currentMediaIndex, Math.max(displayUrls.length - 1, 0));

  const gutter = isMobile ? 14 : 22;
  const metaItem = { display: 'inline-flex', alignItems: 'center', gap: 7 };
  const metaIcon = { color: HC.muted, fontSize: 14 };
  const twoCols = { display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: isMobile ? 10 : '12px 20px' };

  const openLightbox = () => { if (displayUrls.length) { setLightboxIndex(current); setLightboxOpen(true); } };

  return (
    <>
      <div onClick={isMobile ? undefined : onClose} style={{ position: 'fixed', inset: 0, background: isMobile ? HC.surface : 'rgba(26,15,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: isMobile ? 'stretch' : 'center', zIndex: 999, backdropFilter: isMobile ? 'none' : 'blur(2px)', padding: isMobile ? 0 : 16 }}>
        <div role="dialog" aria-modal="true" aria-label={product.product_type || 'Chi tiết request'} onClick={e => e.stopPropagation()} style={isMobile
          ? { width: '100%', height: '100%', background: HC.surface, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: FONT }
          : { width: '100%', maxWidth: MODAL_MAX_WIDTH, height: '92vh', background: HC.surface, borderRadius: 16, boxShadow: '0 32px 80px rgba(26,15,0,0.28)', border: `1px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: FONT }}>

          <DetailHeader
            eyebrow="Request sản phẩm"
            title={product.product_type || `#${product.id}`}
            isMobile={isMobile}
            onClose={onClose}
            badges={<>
              <Badge status={getStatus(product)} />
              {selectedCount > 0 && <span style={{ padding: '2px 10px', borderRadius: 999, background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#065f46', fontSize: 11, fontWeight: 700 }}>✓ Đã chọn {selectedCount} nhà cung cấp</span>}
            </>}
            meta={<>
              {sellerName && (
                <span style={metaItem}>
                  <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', background: HC.orangeMid, color: HC.orangeDeep, fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{initials(sellerName)}</span>
                  {sellerName}
                </span>
              )}
              {product.project && <span style={metaItem}><FolderOutlined style={metaIcon} />{product.project}</span>}
              <span style={metaItem}><CalendarOutlined style={metaIcon} />{`Gửi ${fmtDate(product.created_at)}`}</span>
              {product.deadline_date && (
                <span style={{ ...metaItem, gap: 6, padding: '1px 9px', borderRadius: 999, background: '#fef2f2', border: '1px solid #fecaca', color: HC.danger, fontWeight: 600 }}>
                  <FieldTimeOutlined />
                  <span>Deadline</span>
                  <span>{fmtDate(product.deadline_date)}</span>
                </span>
              )}
            </>}
          />

          {/* Khung chia đôi: thông tin request (trên) · bảng vendor (dưới) */}
          <div ref={paneContainerRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Body — cột ảnh (trái) + cột thông tin (phải); mobile xếp chồng */}
            <div style={{
              display: isMobile ? 'grid' : (paneCollapsed ? 'none' : 'grid'),
              gridTemplateColumns: isMobile ? '1fr' : '300px minmax(0,1fr)',
              alignItems: 'stretch', minHeight: 0,
              // Desktop: chiều cao do người dùng kéo (ratio); mobile giữ cuộn dọc như cũ.
              flex: isMobile ? 1 : '0 0 auto',
              height: isMobile ? 'auto' : paneHeight,
              overflowY: 'auto',
            }}>
              <MediaColumn
                urls={displayUrls}
                current={current}
                onSelect={setCurrentMediaIndex}
                onOpen={openLightbox}
                isMobile={isMobile}
                alt={product.product_type || ''}
                refLinkBadge={mediaUrls.length === 0 && displayUrls.length > 0}
              />

              <div style={{ minWidth: 0, padding: `4px ${gutter}px 6px` }}>
                <Section title="Thông số sản phẩm">
                  <SpecRail totalCost={product.total_cost} productionTime={product.production_time} shippingTime={product.shipping_time} isMobile={isMobile} />
                  <div style={twoCols}>
                    <Field label="Chất liệu" value={product.material} />
                    <Field label="Vùng in" value={product.print_area} />
                  </div>
                  <SpecList text={product.other_specs} />
                </Section>

                <Section title="Phản hồi khách hàng">
                  <div style={{ ...twoCols, gap: 10 }}>
                    <ReviewCard good label="Good review" value={product.good_review} />
                    <ReviewCard label="Bad review" value={product.bad_review} />
                  </div>
                </Section>

                <Section title="Đóng gói">
                  <div style={twoCols}>
                    <Field label="Packing" value={product.packaging_links} />
                    <Field label="Other packing" value={product.other_packaging} />
                  </div>
                </Section>

                <Section title="Tham khảo" last>
                  {referenceLinks.length + videoLinks.length > 0 ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {referenceLinks.map((link, idx) => (
                        <RefLink key={`img-${idx}`} href={link} title={referenceLinks.length > 1 ? `Link hình ảnh ${idx + 1}` : 'Link hình ảnh'} />
                      ))}
                      {videoLinks.map((link, idx) => (
                        <RefLink key={`vid-${idx}`} href={link} video title={videoLinks.length > 1 ? `Video sản phẩm ${idx + 1}` : 'Video sản phẩm'} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: HC.muted }}>Chưa có link tham khảo</div>
                  )}
                </Section>
              </div>
            </div>

            {/* ── Thanh chia kéo được: thu gọn thông tin request để xem bảng vendor ── */}
            {!isMobile && (
              <PaneResizer
                ratio={paneRatio}
                collapsed={paneCollapsed}
                dragging={paneDragging}
                onDragStart={startPaneDrag}
                onKeyDown={onPaneKeyDown}
                onToggle={togglePane}
                onReset={resetPane}
              />
            )}

            <VendorBar vendors={vendors} totalCost={product.total_cost} isMobile={isMobile} />

            <div style={{
              padding: isMobile ? '12px 14px 16px' : '14px 22px 18px', background: '#f8fafc',
              // Desktop: bảng vendor ăn hết phần còn lại sau khi kéo khung trên.
              flex: isMobile ? '0 1 auto' : 1, minHeight: 0,
              overflowY: isMobile ? 'visible' : 'auto',
            }}>
              {vendors.length === 0 ? (
                <VendorEmptyState />
              ) : (() => {
                // total_cost có thể là khoảng ("100-150") → lấy cận trên làm trần
                // so sánh. Number() trực tiếp sẽ ra NaN, khiến mọi vendor bị gắn
                // nhãn "Vượt target" và delta hiện "+$NaN".
                const target = targetCostCeiling(product.total_cost);

                // N/A phân biệt: thư viện trống vs chờ Staff B
                const NaLib = ({ title: tip } = {}) => (
                  <span style={{ fontSize: 10, color: '#cbd5e1', fontStyle: 'italic' }} title={tip || 'Chưa có trong thư viện vendor'}>—</span>
                );
                const NaStaff = () => (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 700, color: '#92400e', padding: '2px 7px', borderRadius: 4, background: '#fffbeb', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>
                    chờ Staff B
                  </span>
                );

                const TIER_META = [
                  { key: 'eco_total',       short: 'ECO',  label: 'Economy',   color: '#059669', bg: '#f0fdf4', border: '#bbf7d0' },
                  { key: 'ground_total',    short: 'GND',  label: 'Ground',    color: '#0284c7', bg: '#eff6ff', border: '#bfdbfe' },
                  { key: 'twoday_total',    short: '2DAY', label: '2 Days',    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
                  { key: 'express_total',   short: 'EXP',  label: 'Express',   color: '#b45309', bg: '#fff7ed', border: '#fed7aa' },
                  { key: 'overnight_total', short: 'OVN',  label: 'Overnight', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                ];

                // Helper: resolve total, fallback eco_total = pricing1+eco_price for legacy data
                const getTotal = (vi, key) => {
                  const v = Number(vi[key]);
                  if (vi[key] != null && vi[key] !== '' && v > 0) return v;
                  if (key === 'eco_total') {
                    const p1 = Number(vi.pricing1); const ep = Number(vi.eco_price);
                    if (p1 > 0 && ep > 0) return p1 + ep;
                  }
                  return null;
                };

                const getBestPrice = (items) => {
                  for (const vi of items) {
                    for (const t of TIER_META) {
                      const v = getTotal(vi, t.key);
                      if (v != null && v > 0) return v;
                    }
                  }
                  return null;
                };

                const groupPrices = groupedVendors.map(g => getBestPrice(g.items));
                const validPrices = groupPrices.filter(p => p != null);
                const lowestPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;

                const thS = (extra = {}) => ({
                  padding: '9px 12px', fontWeight: 800, fontSize: 10, color: '#6b7280',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  borderRight: `1px solid ${HC.border}`, borderBottom: `1.5px solid #e5e7eb`,
                  background: '#f8fafc', whiteSpace: 'nowrap', textAlign: 'center', ...extra,
                });
                const td = (extra = {}) => ({
                  padding: '11px 12px', verticalAlign: 'middle',
                  borderRight: `1px solid #f1f5f9`, borderBottom: `1px solid #f1f5f9`, ...extra,
                });

                return (
                  <div style={{ borderRadius: 12, border: `1.5px solid ${HC.border}`, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', minWidth: 990, borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ ...thS({ width: 60 }) }}>Ảnh</th>
                            <th style={{ ...thS({ textAlign: 'left', minWidth: 150 }) }}>Vendor</th>
                            <th style={{ ...thS({ textAlign: 'left', minWidth: 120 }) }}>Chất liệu</th>
                            <th style={{ ...thS({ width: 80 }) }}>Size</th>
                            <th style={{ ...thS({ width: 124 }) }}>T.gian Vendor</th>
                            <th style={{ ...thS({ width: 70 }) }}>Folder</th>
                            <th style={{ ...thS({ minWidth: 260, borderRight: 'none', color: '#059669' }) }}>Giá & So sánh Target</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedVendors.map((group, gIdx) => {
                            const v = group.firstVendor;
                            const vendorImg = v.media_url || (Array.isArray(v.images) && v.images[0]) || null;
                            const rawMaterial = v.overview || '';
                            const vendorLink = v.link_folder || null;

                            const bestPrice = getBestPrice(group.items);
                            const isBest = bestPrice != null && lowestPrice != null
                              && Math.abs(bestPrice - lowestPrice) < 0.001
                              && groupedVendors.length > 1;
                            const isWithinTarget = target != null && bestPrice != null && bestPrice <= target;

                            const rowBg = isBest ? '#f0fdf4' : gIdx % 2 === 0 ? '#fff' : '#fafafa';
                            const leftBorder = isBest ? '3px solid #22c55e' : '3px solid transparent';

                            // All sizes deduplicated by (size, product_type) — same size across different shapes shown separately
                            const _sizeEntries = [];
                            const _seenSizeKeys = new Set();
                            group.items.forEach(vi => {
                              if (!vi.size) return;
                              const _k = `${vi.size}|${(vi.product_type || '').trim()}`;
                              if (!_seenSizeKeys.has(_k)) { _seenSizeKeys.add(_k); _sizeEntries.push({ size: vi.size, pt: vi.product_type || '' }); }
                            });
                            const _sizeCount = {};
                            _sizeEntries.forEach(e => { _sizeCount[e.size] = (_sizeCount[e.size] || 0) + 1; });
                            const sizes = _sizeEntries.map(e => {
                              if (_sizeCount[e.size] > 1) {
                                const _m = e.pt.match(/\(Shape:\s*([^)]+)\)/i);
                                const _shape = _m ? _m[1].trim() : '';
                                return _shape ? `${e.size} (${_shape})` : e.size;
                              }
                              return e.size;
                            });

                            // Price range (min–max) per tier across all sizes
                            const tierRanges = TIER_META.map(t => {
                              const vals = group.items
                                .map(vi => getTotal(vi, t.key))
                                .filter(n => n != null && n > 0);
                              if (vals.length === 0) return null;
                              return { ...t, min: Math.min(...vals), max: Math.max(...vals) };
                            }).filter(Boolean);

                            return (
                              <tr key={group.key}
                                style={{ background: rowBg, transition: 'background 0.12s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = isBest ? '#dcfce7' : '#fff8f0'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = rowBg; }}
                              >
                                {/* Ảnh + BEST badge */}
                                <td style={{ ...td({ textAlign: 'center', width: 60, position: 'relative', borderLeft: leftBorder }) }}>
                                  {vendorImg
                                    ? <img src={vendorImg} loading="lazy" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: `1px solid ${HC.border}`, display: 'block', margin: '0 auto' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                                    : <div style={{ width: 44, height: 44, borderRadius: 8, background: HC.cream, border: `1px dashed ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', color: HC.muted2 }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                                      </div>
                                  }
                                  {isBest && (
                                    <div style={{ marginTop: 4, padding: '1px 5px', borderRadius: 4, background: '#16a34a', color: '#fff', fontSize: 7.5, fontWeight: 900, letterSpacing: '0.06em', textAlign: 'center' }}>BEST</div>
                                  )}
                                </td>

                                {/* Vendor name + badges */}
                                <td style={{ ...td({ textAlign: 'left' }) }}>
                                  <div style={{ fontWeight: 800, fontSize: 12, color: HC.ink }}>{v.name || v.vendor_type || '—'}</div>
                                  {v.name && v.vendor_type && v.name !== v.vendor_type && (
                                    <div style={{ fontSize: 10, color: HC.muted2, marginTop: 1 }}>{v.vendor_type}</div>
                                  )}
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                                    {isWithinTarget && (
                                      <span style={{ padding: '1px 7px', borderRadius: 4, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 9, fontWeight: 800, color: '#16a34a' }}>✓ Trong target</span>
                                    )}
                                    {!isWithinTarget && bestPrice != null && target != null && (
                                      <span style={{ padding: '1px 7px', borderRadius: 4, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 9, fontWeight: 700, color: '#dc2626' }}>Vượt target</span>
                                    )}
                                    {v.source_file_id && (
                                      // Mở đúng file gốc (link riêng /library/:fileId) ở tab mới — modal
                                      // này vẫn mở để so tiếp. File chưa chia sẻ cho project của Seller
                                      // thì trang file tự báo 403; thông tin ở đây vẫn đủ để duyệt.
                                      <a
                                        href={libraryFilePath(v.source_file_id, v.source_file_name)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        title={v.source_file_name ? `Mở file gốc: ${v.source_file_name}` : 'Mở file gốc trong Thư viện Vendor'}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 9, fontWeight: 700, color: HC.orangeDark, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, borderRadius: 4, padding: '1px 7px', textDecoration: 'none' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; }}
                                      ><FileOutlined aria-hidden="true" /> {v.source_file_name ? v.source_file_name.replace(/\.xlsx?$/i, '') : 'File gốc'} <ExportOutlined aria-hidden="true" /></a>
                                    )}
                                  </div>
                                </td>

                                {/* Chất liệu */}
                                <td style={{ ...td({ textAlign: 'left' }) }}>
                                  {rawMaterial
                                    ? <span style={{ color: HC.ink2, fontSize: 11, lineHeight: 1.5 }} title={rawMaterial}>{rawMaterial.length > 55 ? rawMaterial.slice(0, 55) + '…' : rawMaterial}</span>
                                    : <NaLib title="Thư viện chưa có thông tin chất liệu" />
                                  }
                                </td>

                                {/* Size — tất cả size dưới dạng pills */}
                                <td style={{ ...td({ textAlign: 'center', width: 80 }) }}>
                                  {sizes.length === 0
                                    ? <NaLib title="Thư viện chưa có thông tin size" />
                                    : (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
                                        {sizes.map((s, si) => (
                                          <span key={`${s}_${si}`} style={{ fontSize: 9, fontWeight: 700, color: HC.ink, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, padding: '2px 5px', whiteSpace: 'nowrap' }}>{s}</span>
                                        ))}
                                      </div>
                                    )
                                  }
                                </td>

                                {/* T.gian Vendor — thời gian do CHÍNH vendor này báo cáo (avg_time_vendor/avg_time_actual),
                                    KHÔNG phải production_time/shipping_time của request gốc (giống nhau cho mọi vendor) */}
                                <td style={{ ...td({ textAlign: 'left', width: 124 }) }}>
                                  {(v.avg_time_vendor || v.avg_time_actual)
                                    ? (
                                      <div style={{ fontSize: 10, lineHeight: 1.4 }}>
                                        {v.avg_time_vendor && <div style={{ fontWeight: 700, color: '#0284c7', whiteSpace: 'pre-line' }}>{v.avg_time_vendor}</div>}
                                        {v.avg_time_actual && <div style={{ fontWeight: 600, color: '#7c3aed', marginTop: v.avg_time_vendor ? 3 : 0, whiteSpace: 'pre-line' }}>Thực tế: {v.avg_time_actual}</div>}
                                      </div>
                                    )
                                    : <NaLib title="Vendor chưa cập nhật thời gian" />
                                  }
                                </td>

                                {/* Link Folder */}
                                <td style={{ ...td({ textAlign: 'center', width: 70 }) }}>
                                  {vendorLink
                                    ? <a href={vendorLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: HC.orange, textDecoration: 'none', padding: '4px 8px', borderRadius: 6, background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, transition: 'all 0.15s' }}
                                        onMouseEnter={e => e.currentTarget.style.background = HC.orangeMid}
                                        onMouseLeave={e => e.currentTarget.style.background = HC.orangeLight}
                                      >
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                                        Folder
                                      </a>
                                    : <NaStaff />
                                  }
                                </td>

                                {/* Giá & So sánh Target — khoảng min–max per tier */}
                                <td style={{ ...td({ borderRight: 'none', minWidth: 260 }) }}>
                                  {tierRanges.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      {tierRanges.map(({ short, label, min, max, color, bg, border: bc }, ti) => {
                                        const isPrimary = ti === 0;
                                        const delta = target != null ? min - target : null;
                                        const dColor = delta == null ? '#94a3b8'
                                          : delta <= 0 ? '#16a34a'
                                          : delta <= (target ?? 0) * 0.1 ? '#d97706'
                                          : '#dc2626';
                                        const dLabel = delta == null ? null
                                          : delta <= 0 ? `-$${Math.abs(delta).toFixed(2)} dưới target`
                                          : `+$${delta.toFixed(2)} trên target`;
                                        const priceLabel = min === max
                                          ? `$${min.toFixed(2)}`
                                          : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
                                        return (
                                          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                            <span style={{ fontSize: 8, fontWeight: 900, color, background: bg, border: `1px solid ${bc}`, padding: '2px 6px', borderRadius: 4, minWidth: 34, textAlign: 'center', letterSpacing: '0.04em', flexShrink: 0 }}>{short}</span>
                                            <span style={{ fontWeight: isPrimary ? 900 : 700, fontSize: isPrimary ? 14 : 12, color, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>{priceLabel}</span>
                                            {isPrimary && delta != null && (
                                              <span style={{ fontSize: 9, fontWeight: 800, color: dColor, padding: '2px 8px', borderRadius: 4, background: dColor + '14', border: `1px solid ${dColor}30`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                {dLabel}
                                              </span>
                                            )}
                                            {!isPrimary && (
                                              <span style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic' }}>{label}</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : <NaLib title="Thư viện chưa có dữ liệu giá" />}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Footer — "Đóng" là nút chính duy nhất */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: isMobile ? '12px 14px' : '14px 22px', background: HC.surface2, borderTop: `1px solid ${HC.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: HC.muted }}>
              {selectedCount > 0 && <span style={{ color: HC.success, fontWeight: 800 }}>✓ Đã chọn {selectedCount} vendor</span>}
            </div>
            <button onClick={onClose} style={{
              height: isMobile ? 44 : 40, padding: '0 28px', borderRadius: 10, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`,
              color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: FONT,
              width: isMobile ? '100%' : 'auto',
            }}>Đóng</button>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && displayUrls.length > 0 && (
        <div onClick={() => setLightboxOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)', cursor: 'pointer'
        }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            {isVideoUrl(displayUrls[lightboxIndex]) ? (
              <video src={displayUrls[lightboxIndex]} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12 }} />
            ) : (
              <img src={displayUrls[lightboxIndex]} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
            )}
            {displayUrls.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev - 1 + displayUrls.length) % displayUrls.length); }} style={{
                  position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
                  width: 48, height: 48, cursor: 'pointer', color: '#fff', fontSize: 28
                }}>‹</button>
                <button onClick={(e) => { e.stopPropagation(); setLightboxIndex(prev => (prev + 1) % displayUrls.length); }} style={{
                  position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
                  background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
                  width: 48, height: 48, cursor: 'pointer', color: '#fff', fontSize: 28
                }}>›</button>
                <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: 20, color: '#fff' }}>
                  {lightboxIndex + 1} / {displayUrls.length}
                </div>
              </>
            )}
            <button onClick={() => setLightboxOpen(false)} style={{
              position: 'absolute', top: 20, right: 20,
              background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
              width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 20
            }}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}
