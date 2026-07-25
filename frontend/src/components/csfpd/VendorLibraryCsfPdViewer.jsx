// ════════════════════════════════════════════════════════════════════════════
//  VENDOR LIBRARY VIEWER — CSF / PD (read-only, ẩn giá, gộp Link Template)
//  Tái sử dụng dữ liệu Thư Viện Vendor (giống Seller) nhưng:
//   - Không hiển thị BẤT KỲ trường giá nào (Target Cost, Economy Price, Total...)
//   - Gộp "Thông tin chung về phôi" + "Link Template" (lấy từ phần Về giá) vào 1 bảng duy nhất
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { HC } from '../../constants/sellerTheme';
import { vendorLibraryApi } from '../../services/api';

// ── Style helpers ─────────────────────────────────────────────────────────────
const TH = (extra = {}) => ({
  padding: '7px 8px', fontWeight: 800, fontSize: 9.5, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: '#fff', background: HC.orangeDark,
  border: `1px solid ${HC.orange}`, fontFamily: "'Nunito',sans-serif",
  verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap', ...extra,
});
const TD = (idx, extra = {}) => ({
  padding: '7px 8px', fontSize: 12, color: HC.ink2, border: `1px solid ${HC.border}`,
  background: idx % 2 === 0 ? HC.surface : HC.surface2,
  fontFamily: "'Nunito Sans',sans-serif", verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'break-word', ...extra,
});
const fmtNA = (v) => (v !== null && v !== undefined && v !== '' ? v : '—');
const naStyle = { background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 800, border: '1px solid #fcd34d' };

// ── Project filter helpers (giống logic của VendorLibraryViewer) ──────────────
function extractFileProject(filename) {
  if (!filename) return null;
  const fn = filename.toLowerCase();
  if (fn.includes('p.hapify84')) return 'hapify84';
  if (fn.includes('p.happy')) return 'happy';
  if (fn.includes('p.creative')) return 'creative';
  if (fn.includes('p.global')) return 'global';
  return null;
}

// New Arrivals chỉ hiệu lực trong TUẦN upload (tuần bắt đầu thứ Hai) — giống logic
// của VendorLibraryViewer. Sang thứ Hai tuần kế tiếp, file rời khỏi tab này.
function isWithinCurrentWeek(importedAt) {
  if (!importedAt) return false;
  const t = new Date(importedAt).getTime();
  if (!Number.isFinite(t)) return false;
  const now = new Date();
  const daysSinceMonday = now.getDay() === 0 ? 6 : now.getDay() - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday, 0, 0, 0, 0);
  return t >= monday.getTime();
}

// ── Ghép Link Template (từ bảng giá) vào từng dòng thông tin chung ────────────
const normStr = (s) => (s || '').toString().trim().toLowerCase().replace(/[()'"“”‘’]/g, '').replace(/\s+/g, ' ').trim();

function withStickyKy(pricing) {
  let lastKy = '';
  return (pricing || []).map(p => {
    const pk = (p.kyHieu || '').trim();
    if (pk) lastKy = pk;
    return { ...p, _effKy: pk || lastKy };
  });
}

function pickLinkTemplate(generalRow, processedPricing, singleVendorFile) {
  if (!processedPricing.length) return '';
  const rowKy = (generalRow.kyHieu || '').trim();
  let candidates = [];
  if (rowKy) candidates = processedPricing.filter(p => p._effKy === rowKy);
  if (!candidates.length) {
    const rpt = normStr(generalRow.productType);
    if (rpt) {
      candidates = processedPricing.filter(p => {
        const ppt = normStr(p.productType);
        return ppt && (ppt === rpt || ppt.includes(rpt) || rpt.includes(ppt));
      });
    }
  }
  if (!candidates.length && singleVendorFile) candidates = processedPricing;
  const withLink = candidates.find(p => p.linkTemplate);
  return withLink ? withLink.linkTemplate : '';
}

// ── Bảng gộp: Thông tin chung về phôi + Link Template ─────────────────────────
function MergedInfoTable({ generalInfo, pricing }) {
  const rows = generalInfo || [];
  const processedPricing = useMemo(() => withStickyKy(pricing), [pricing]);

  if (rows.length === 0) return <div style={{ padding: 24, color: HC.muted, textAlign: 'center' }}>Không có dữ liệu.</div>;

  const uniqueLinks = [...new Set(rows.map(r => (r.linkFolder || '').trim()).filter(Boolean))];
  const fileLevelLink = uniqueLinks.length === 1 ? uniqueLinks[0] : null;

  const singleVendorFile = rows.length === 1;
  const showKyHieu = rows.some(r => r.kyHieu);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', minWidth: 1000 }}>
        <thead>
          <tr>
            <th style={{ ...TH(), width: '9%', textAlign: 'left' }}>Vendor Name</th>
            <th style={{ ...TH(), width: '10%', textAlign: 'left' }}>Product Type</th>
            {showKyHieu && <th style={{ ...TH(), width: '4%' }}>Ký hiệu</th>}
            <th style={{ ...TH(), width: '9%', textAlign: 'left' }}>Hình ảnh</th>
            <th style={{ ...TH(), width: '9%', textAlign: 'left' }}>Chất liệu</th>
            <th style={{ ...TH(), width: '7%', textAlign: 'left' }}>Chi tiết Size</th>
            <th style={{ ...TH(), width: '9%', textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.3 }}>AVG TG (Vendor)</th>
            <th style={{ ...TH(), width: '8%', textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.3 }}>AVG TG (Thực tế)</th>
            <th style={{ ...TH(), width: '14%', textAlign: 'left' }}>Notes</th>
            <th style={{ ...TH(), width: '8%', textAlign: 'left' }}>Link Folder</th>
            <th style={{ ...TH(), width: '9%', textAlign: 'left' }}>Link Template</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const linkTemplate = pickLinkTemplate(r, processedPricing, singleVendorFile);
            const folderLink = r.linkFolder || fileLevelLink || '';
            const isSharedFolder = !r.linkFolder && !!fileLevelLink;
            return (
              <tr key={r.id || i}>
                <td style={{ ...TD(i) }}>
                  {r.vendorName ? <span style={{ fontWeight: 700, color: HC.ink }}>{r.vendorName}</span> : <span style={naStyle}>N/A</span>}
                </td>
                <td style={{ ...TD(i) }}>
                  {r.productType ? <span style={{ fontWeight: 700, color: HC.ink }}>{r.productType}</span> : <span style={naStyle}>N/A</span>}
                </td>
                {showKyHieu && (
                  <td style={{ ...TD(i), textAlign: 'center' }}>
                    {r.kyHieu ? <span style={{ fontWeight: 900, color: HC.orangeDark }}>{r.kyHieu}</span> : <span style={naStyle}>N/A</span>}
                  </td>
                )}
                <td style={{ ...TD(i) }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {r.images && r.images.length > 0 ? r.images.map((img, idx) => (
                      <a key={idx} href={img} target="_blank" rel="noreferrer">
                        <img src={img} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: `1px solid ${HC.border}` }} />
                      </a>
                    )) : <span style={{ color: HC.muted, fontSize: 10, fontStyle: 'italic' }}>Không có ảnh</span>}
                  </div>
                </td>
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{fmtNA(r.chatLieu)}</td>
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                  {r.chiTietSizeImage && (
                    <a href={r.chiTietSizeImage} target="_blank" rel="noreferrer" style={{ display: 'block', marginBottom: r.chiTietSize ? 6 : 0 }}>
                      <img src={r.chiTietSizeImage} alt="Size Guide" loading="lazy" style={{ width: '100%', maxWidth: '100%', borderRadius: 4, border: `1px solid ${HC.border}`, objectFit: 'contain' }} />
                    </a>
                  )}
                  {r.chiTietSize ? r.chiTietSize : (!r.chiTietSizeImage ? '—' : '')}
                </td>
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4, color: HC.success }}>{fmtNA(r.avgTimeVendor)}</td>
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4, color: HC.warning }}>{fmtNA(r.avgTimeActual)}</td>
                <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{fmtNA(r.notes)}</td>
                <td style={{ ...TD(i) }}>
                  {folderLink
                    ? <a href={folderLink} target="_blank" rel="noreferrer" title={isSharedFolder ? `${folderLink}\n(dùng chung cả file)` : folderLink}
                        style={{ color: isSharedFolder ? HC.muted : HC.orangeDark, textDecoration: 'underline', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: isSharedFolder ? 'italic' : 'normal' }}>
                        🔗 Folder{isSharedFolder && <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.7 }}>(chung)</span>}
                      </a>
                    : <span style={{ color: HC.muted2 }}>—</span>}
                </td>
                <td style={{ ...TD(i) }}>
                  {linkTemplate
                    ? <a href={linkTemplate} target="_blank" rel="noreferrer" title={linkTemplate} style={{ color: HC.orangeDark, textDecoration: 'underline', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔗 Template</a>
                    : <span style={{ color: HC.muted2 }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Card cho 1 file thư viện ───────────────────────────────────────────────────
function LibraryCard({ entry, highlighted }) {
  const [expanded, setExpanded] = useState(!!highlighted);
  const [hovered, setHovered] = useState(false);

  const importDate = entry.importedAt
    ? new Date(entry.importedAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12,
        border: `1.5px solid ${hovered ? HC.orangeMid : HC.border}`,
        boxShadow: hovered ? '0 6px 20px rgba(0,0,0,0.09)' : '0 1px 4px rgba(0,0,0,0.06)',
        overflow: 'hidden', marginBottom: 14,
        transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.18s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        background: '#fff',
      }}
    >
      <div
        onClick={() => setExpanded(p => !p)}
        style={{
          padding: '10px 14px',
          background: hovered ? HC.orangeLight : '#fff',
          borderLeft: `3px solid ${HC.orange}`,
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
          transition: 'background 0.18s',
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: HC.orangeLight,
          border: `1px solid ${HC.orangeMid}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 15, flexShrink: 0,
        }}>📄</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 800, fontSize: 12.5, color: HC.ink, fontFamily: "'Nunito',sans-serif",
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3,
          }}>
            {entry.filename?.replace(/\.xlsx?$/i, '')}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              padding: '2px 8px', borderRadius: 99, background: HC.orangeLight,
              border: `1px solid ${HC.orangeMid}`, color: HC.orangeDark, fontSize: 9.5,
              fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>{entry.title}</span>
            <span style={{ fontSize: 10.5, color: HC.muted }}>{importDate}</span>
            <span style={{ fontSize: 10.5, color: HC.muted2 }}>{entry.generalInfo?.length || 0} sản phẩm</span>
          </div>
        </div>

        <div style={{
          width: 22, height: 22, borderRadius: 6, background: HC.orangeLight,
          border: `1px solid ${HC.orangeMid}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: HC.orangeDark, transition: 'transform 0.2s', transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block' }}>▾</span>
        </div>
      </div>

      {expanded && (
        <div style={{ background: HC.surface }}>
          <MergedInfoTable generalInfo={entry.generalInfo} pricing={entry.pricing} />
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VendorLibraryCsfPdViewer({ projectKey }) {
  const [rawFiles, setRawFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Best Seller lưu trên server (field `bestSeller` trong từng dòng generalInfo)
  // → derive từ dữ liệu fetch về, không đọc localStorage nữa.
  const bestSellerIds = useMemo(() => {
    const s = new Set();
    for (const f of rawFiles) {
      for (const r of (f.generalInfo || [])) {
        if (r && r.bestSeller) s.add(r.id);
      }
    }
    return s;
  }, [rawFiles]);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await vendorLibraryApi.get('all');
      setRawFiles(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setFetchError(err?.response?.data?.message || err?.message || 'Không thể kết nối server. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  const displayFiles = useMemo(() => {
    let files = rawFiles;

    // Lọc theo project được chọn — file không có ký hiệu P.xxx thì hiện cho mọi project
    if (projectKey) {
      files = files.filter(f => {
        const fp = extractFileProject(f.filename);
        return !fp || fp === projectKey;
      });
    }

    if (activeTab === 'best_seller') {
      files = files.map(f => f.generalInfo ? { ...f, generalInfo: f.generalInfo.filter(r => bestSellerIds.has(r.id)) } : f)
        .filter(f => f.generalInfo && f.generalInfo.length > 0);
    } else if (activeTab === 'new_products') {
      files = files.filter(f => f.sourceTab === 'new_products' && isWithinCurrentWeek(f.importedAt));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      files = files.filter(f => f.filename?.toLowerCase().includes(q) || f.title?.toLowerCase().includes(q));
    }

    return [...files].sort((a, b) => {
      const ta = a.importedAt ? new Date(a.importedAt).getTime() : 0;
      const tb = b.importedAt ? new Date(b.importedAt).getTime() : 0;
      return tb - ta;
    });
  }, [rawFiles, projectKey, activeTab, searchQuery, bestSellerIds]);

  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '10px 24px', borderRadius: 12, border: `2px solid ${activeTab === id ? HC.orange : HC.border}`,
        background: activeTab === id ? HC.orangeLight : HC.surface,
        color: activeTab === id ? HC.orangeDark : HC.muted,
        fontSize: 13, fontWeight: activeTab === id ? 900 : 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: `1.5px solid ${HC.border}`, paddingBottom: 8, flexWrap: 'wrap' }}>
        <TabButton id="all" label="Tổng quan Vendor & Sản phẩm" />
        <TabButton id="new_products" label="New Arrivals" />
        <TabButton id="best_seller" label="Best Seller" />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ padding: '2px 12px', borderRadius: 99, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, color: HC.orangeDark, fontSize: 11, fontWeight: 800 }}>
            {displayFiles.length} file
          </span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Tìm theo tên file hoặc loại sản phẩm..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: 12, paddingRight: searchQuery ? 30 : 12, paddingTop: 7, paddingBottom: 7,
                borderRadius: 20, border: `1.5px solid ${HC.borderStrong}`, background: HC.surface,
                color: HC.ink, fontSize: 12, fontFamily: "'Nunito Sans',sans-serif", outline: 'none',
                width: 280, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: HC.muted, fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>
            )}
          </div>
        </div>
      </div>

      {fetchError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#b91c1c', marginBottom: 3 }}>⚠️ Không thể tải dữ liệu thư viện</div>
            <div style={{ fontSize: 11, color: '#991b1b' }}>{fetchError}</div>
          </div>
          <button onClick={fetchLibrary} style={{ padding: '6px 14px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>↺ Thử lại</button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: HC.muted }}>Đang tải thư viện...</div>
        ) : displayFiles.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', background: HC.surface, borderRadius: 16, border: `2px dashed ${HC.border}` }}>
            <div style={{ fontSize: 40, opacity: 0.5, marginBottom: 10 }}>{searchQuery.trim() ? '🔍' : activeTab === 'best_seller' ? '⭐' : '📂'}</div>
            <div style={{ fontWeight: 800, color: HC.muted, fontSize: 14 }}>
              {searchQuery.trim() ? `Không tìm thấy file nào khớp với "${searchQuery}"` : activeTab === 'best_seller' ? 'Chưa có sản phẩm nào được đánh dấu Best Seller' : 'Chưa có thư viện vendor nào'}
            </div>
          </div>
        ) : (
          displayFiles.map(entry => <LibraryCard key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
