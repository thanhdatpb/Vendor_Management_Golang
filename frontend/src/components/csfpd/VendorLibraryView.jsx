// ════════════════════════════════════════════════════════════════════════════
//  VENDOR LIBRARY VIEW — bảng DÙNG CHUNG cho các bộ phận read-only.
//
//  Component này KHÔNG tự quyết bộ phận nào thấy gì. Nó nhận `department`
//  (khai báo ở ./departments.js) rồi dựng bảng theo đúng khai báo đó.
//  → Muốn đổi gì cho MỘT bộ phận: sửa ./departments.js, hoặc file bọc riêng
//    của bộ phận đó (CsfVendorLibrary / PdVendorLibrary / MarvelVendorLibrary).
//    KHÔNG sửa file này trừ khi đổi cho tất cả.
//
//  Điểm chung của mọi bộ phận dùng view này:
//   - Không hiển thị BẤT KỲ trường giá nào (Target Cost, Economy Price, Total...)
//   - Gộp "Thông tin chung về phôi" + "Link Template" (lấy từ phần Về giá) vào 1 bảng duy nhất
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HC } from '../../constants/sellerTheme';
import { vendorLibraryApi } from '../../services/api';
import { subscribeVendorLibraryChanges } from '../../services/echo';
import { stripHiddenFields, currentUserRole } from '../../constants/vendorFieldVisibility';
import { departmentFor } from './departments';
import { exportVendorLibraryFiles } from '../../utils/vendorExcel';
import AppToast from '../shared/AppToast';
import ExportVendorFilesModal from '../shared/ExportVendorFilesModal';
import { renderChiTietSizeText } from '../vendor/sections/VendorLibraryViewer';
import { fileVisibleToProject } from '../../constants/projects';
import { timeValue, fmtVNDateTimeShort, vnStartOfWeek } from '../../utils/vnTime';
import LibraryFileModal from '../library/LibraryFileModal';
import { copyLibraryFileLink, libraryFilePath, parseLibraryFilePath } from '../../utils/libraryFileLink';

// ── Style helpers ─────────────────────────────────────────────────────────────
const TH = (extra = {}) => ({
  padding: '7px 8px', fontWeight: 800, fontSize: 9.5, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: '#fff', background: HC.orangeDark,
  border: `1px solid ${HC.orange}`, fontFamily: "'Inter',sans-serif",
  verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap', ...extra,
});
const TD = (idx, extra = {}) => ({
  padding: '7px 8px', fontSize: 12, color: HC.ink2, border: `1px solid ${HC.border}`,
  background: idx % 2 === 0 ? HC.surface : HC.surface2,
  fontFamily: "'Inter',sans-serif", verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'break-word', ...extra,
});
const fmtNA = (v) => (v !== null && v !== undefined && v !== '' ? v : '—');
const naStyle = { background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 800, border: '1px solid #fcd34d' };

// Link YouTube / Google Drive không phải ảnh → thay <img> vỡ bằng logo tương ứng (giống VendorLibraryViewer).
const isYouTubeUrl = (u) => typeof u === 'string' && /(?:youtube\.com|youtu\.be)/i.test(u);
const isGoogleDriveUrl = (u) => typeof u === 'string' && /drive\.google\.com/i.test(u);
function MediaThumb({ url }) {
  if (isYouTubeUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" title="Video YouTube — bấm để mở"
        style={{ width: 40, height: 40, borderRadius: 4, border: `1px solid ${HC.border}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="26" height="26" viewBox="0 0 24 24" aria-label="YouTube">
          <rect x="1" y="5" width="22" height="14" rx="4" fill="#FF0000" />
          <path d="M10 8.5l6 3.5-6 3.5z" fill="#fff" />
        </svg>
      </a>
    );
  }
  if (isGoogleDriveUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" title="Google Drive — bấm để mở"
        style={{ width: 40, height: 40, borderRadius: 4, border: `1px solid ${HC.border}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="24" height="22" viewBox="0 0 87.3 78" aria-label="Google Drive">
          <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
          <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
          <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 11.5z" fill="#ea4335" />
          <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
          <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
          <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
        </svg>
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: `1px solid ${HC.border}` }} />
    </a>
  );
}

// ── Project filter ────────────────────────────────────────────────────────────
// Quy tắc "project nào xem được file" nằm ở constants/projects.js, dùng chung với
// VendorLibraryViewer: ưu tiên danh sách chia sẻ tường minh `file.projects` do
// Vendor/Admin đặt, file chưa chia sẻ thì vẫn theo ký hiệu `P.xxx` trong tên.

// New Arrivals chỉ hiệu lực trong TUẦN upload (tuần bắt đầu thứ Hai) — giống logic
// của VendorLibraryViewer. Sang thứ Hai tuần kế tiếp, file rời khỏi tab này.
function isWithinCurrentWeek(importedAt) {
  if (!importedAt) return false;
  const t = timeValue(importedAt, NaN);
  if (!Number.isFinite(t)) return false;
  // Ranh giới tuần phải là nửa đêm thứ Hai Ở VIỆT NAM, không phải nửa đêm theo
  // máy người xem — nếu không, người ngồi khác múi giờ thấy tab New Arrivals
  // đổi nội dung sớm/muộn hơn phần còn lại của team.
  return t >= vnStartOfWeek();
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
export function MergedInfoTable({ generalInfo, pricing, showLeadTime }) {
  const rows = generalInfo || [];
  const processedPricing = useMemo(() => withStickyKy(pricing), [pricing]);

  if (rows.length === 0) return <div style={{ padding: 24, color: HC.muted, textAlign: 'center' }}>Không có dữ liệu.</div>;

  const uniqueLinks = [...new Set(rows.map(r => (r.linkFolder || '').trim()).filter(Boolean))];
  const fileLevelLink = uniqueLinks.length === 1 ? uniqueLinks[0] : null;

  const singleVendorFile = rows.length === 1;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', minWidth: 1000 }}>
        <thead>
          <tr>
            <th style={{ ...TH(), width: '9%', textAlign: 'left' }}>Vendor Name</th>
            <th style={{ ...TH(), width: '10%', textAlign: 'left' }}>Product Type</th>
            <th style={{ ...TH(), width: '9%', textAlign: 'left' }}>Hình ảnh</th>
            <th style={{ ...TH(), width: '9%', textAlign: 'left' }}>Chất liệu</th>
            <th style={{ ...TH(), width: '7%', textAlign: 'left' }}>Chi tiết Size</th>
            {showLeadTime && <th style={{ ...TH(), width: '9%', textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.3 }}>AVG TG (Vendor)</th>}
            {showLeadTime && <th style={{ ...TH(), width: '8%', textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.3 }}>AVG TG (Thực tế)</th>}
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
                <td style={{ ...TD(i) }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {r.images && r.images.length > 0 ? r.images.map((img, idx) => (
                      <MediaThumb key={idx} url={img} />
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
                  {r.chiTietSize ? renderChiTietSizeText(r.chiTietSize) : (!r.chiTietSizeImage ? '—' : '')}
                </td>
                {showLeadTime && <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4, color: HC.success }}>{fmtNA(r.avgTimeVendor)}</td>}
                {showLeadTime && <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4, color: HC.warning }}>{fmtNA(r.avgTimeActual)}</td>}
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
function LibraryCard({ entry, highlighted, showLeadTime, onOpen, onCopyLink }) {
  const [expanded, setExpanded] = useState(!!highlighted);
  const [hovered, setHovered] = useState(false);

  const importDate = fmtVNDateTimeShort(entry.importedAt);

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
        onClick={() => (onOpen ? onOpen(entry) : setExpanded(p => !p))}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onKeyDown={onOpen ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(entry); }
        } : undefined}
        title={onOpen ? 'Mở file' : undefined}
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
            fontWeight: 800, fontSize: 12.5, color: HC.ink, fontFamily: "'Inter',sans-serif",
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

        {onCopyLink && (
          <button
            onClick={(e) => { e.stopPropagation(); onCopyLink(entry); }}
            title="Copy link tới file này"
            aria-label={`Copy link file ${entry.filename}`}
            style={{
              width: 26, height: 26, borderRadius: 7, cursor: 'pointer', flexShrink: 0,
              border: `1px solid ${HC.border}`, background: HC.surface,
              color: HC.brown, fontSize: 12, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >🔗</button>
        )}

        <div style={{
          width: 22, height: 22, borderRadius: 6, background: HC.orangeLight,
          border: `1px solid ${HC.orangeMid}`, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: HC.orangeDark, transition: 'transform 0.2s', transform: (onOpen || expanded) ? 'rotate(0deg)' : 'rotate(-90deg)', display: 'inline-block' }}>{onOpen ? '↗' : '▾'}</span>
        </div>
      </div>

      {expanded && !onOpen && (
        <div style={{ background: HC.surface }}>
          <MergedInfoTable generalInfo={entry.generalInfo} pricing={entry.pricing} showLeadTime={showLeadTime} />
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function VendorLibraryView({ projectKey, department }) {
  // Không có khai báo bộ phận → bản chặt nhất (không thấy gì thêm), thay vì
  // mặc định hiện hết.
  const dept = departmentFor(department?.key ?? department);
  const [rawFiles, setRawFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Cửa sổ 1 file, điều khiển bằng URL ─────────────────────────────
  // Cùng cơ chế với danh sách của Admin/Vendor/Seller: /library/:fileId mở cửa
  // sổ, lùi một bước là đóng. Danh sách không unmount nên giữ nguyên chỗ cuộn.
  const navigate = useNavigate();
  const location = useLocation();

  const openedFile = useMemo(() => {
    const link = parseLibraryFilePath(location.pathname);
    if (!link) return null;
    return rawFiles.find((f) => String(f.id) === link.id) || null;
  }, [location.pathname, rawFiles]);

  const openFile = useCallback((entry) => {
    navigate(libraryFilePath(entry.id, entry.filename), {
      state: { libraryBackground: location },
    });
  }, [navigate, location]);

  const closeFile = useCallback(() => { navigate(-1); }, [navigate]);

  const handleCopyLink = useCallback(async (entry) => {
    try {
      await copyLibraryFileLink(entry.id, entry.filename);
      showToast('success', 'Đã copy link file — dán vào Slack hoặc email để gửi đi.');
    } catch (err) {
      console.warn('Copy link file thư viện thất bại:', err?.message || err);
      showToast('error', 'Copy link thất bại. Kiểm tra quyền truy cập clipboard rồi thử lại.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

  const fetchLibrary = useCallback(async ({ silent = false } = {}) => {
    // `silent`: làm mới nền do realtime — không bật spinner để bảng đang đọc
    // không nhấp nháy dưới tay người dùng.
    if (!silent) setLoading(true);
    setFetchError(null);
    try {
      const res = await vendorLibraryApi.get('all');
      // Lưới an toàn: server là nơi thực thi việc lọc giá, nhưng nếu một bản
      // server cũ (hoặc cache của trình duyệt) còn trả giá về thì component
      // này cũng không có gì để render ra. Quy tắc "role nào thấy giá" nằm ở
      // constants/vendorFieldVisibility.js — một chỗ duy nhất.
      const files = Array.isArray(res.data) ? res.data : [];
      setRawFiles(stripHiddenFields(files, currentUserRole()));
    } catch (err) {
      setFetchError(err?.response?.data?.message || err?.message || 'Không thể kết nối server. Vui lòng thử lại.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // ─── Đồng bộ thư viện (mục 16) ───────────────────────────────────────────
  // CSF/PD dùng thư viện làm nguồn tra cứu chính thức khi hỗ trợ khách, nên
  // xem phải bản mới nhất. Trước đây chỉ tải lúc mount: Vendor import file mới
  // xong, CSF/PD đang mở tab vẫn tư vấn khách bằng dữ liệu cũ.
  useEffect(() => {
    fetchLibrary();

    const refreshWhenVisible = () => { if (!document.hidden) fetchLibrary({ silent: true }); };
    const unsubscribe = subscribeVendorLibraryChanges(() => fetchLibrary({ silent: true }));
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchLibrary]);

  const displayFiles = useMemo(() => {
    let files = rawFiles;

    // Lọc theo project được chọn — file chưa chia sẻ và không có ký hiệu P.xxx
    // thì hiện cho mọi project (giữ nguyên hành vi cũ).
    if (projectKey) {
      files = files.filter(f => fileVisibleToProject(f, projectKey));
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
      const ta = timeValue(a.importedAt);
      const tb = timeValue(b.importedAt);
      return tb - ta;
    });
  }, [rawFiles, projectKey, activeTab, searchQuery, bestSellerIds]);

  const handleExportSelected = async (selectedIds) => {
    const selectedFiles = displayFiles.filter((f) => selectedIds.includes(f.id));
    setExporting(true);
    try {
      await exportVendorLibraryFiles(selectedFiles, { includePricing: false });
      setShowExportPicker(false);
    } catch (err) {
      showToast('error', err.message || 'Xuất file thất bại');
    } finally {
      setExporting(false);
    }
  };

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
      <AppToast toast={toast} onClose={() => setToast(null)} />
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
                color: HC.ink, fontSize: 12, fontFamily: "'Inter',sans-serif", outline: 'none',
                width: 280, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: HC.muted, fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowExportPicker(true)}
          disabled={exporting}
          title="Chọn file Vendor cần xuất ra Excel theo file mẫu"
          style={{
            padding: '9px 18px', borderRadius: 10,
            border: `1.5px solid ${HC.orangeMid}`,
            background: HC.surface, color: HC.orangeDark,
            fontSize: 12, fontWeight: 800, cursor: exporting ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 7,
            transition: 'all 0.15s', opacity: exporting ? 0.6 : 1,
          }}
        >
          📤 Export file Vendor
        </button>
      </div>

      {showExportPicker && (
        <ExportVendorFilesModal
          HC={HC}
          files={displayFiles}
          exporting={exporting}
          onConfirm={handleExportSelected}
          onClose={() => setShowExportPicker(false)}
        />
      )}

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
          displayFiles.map(entry => (
            <LibraryCard
              key={entry.id}
              entry={entry}
              showLeadTime={dept.showLeadTime}
              onOpen={openFile}
              onCopyLink={handleCopyLink}
            />
          ))
        )}
      </div>

      {/* Cửa sổ 1 file — mở theo URL /library/:fileId */}
      {openedFile && (
        <LibraryFileModal
          title={(openedFile.filename || '').replace(/\.xlsx?$/i, '')}
          subtitle={`${openedFile.generalInfo?.length || 0} phôi · ${fmtVNDateTimeShort(openedFile.importedAt)}`}
          badges={
            <span style={{
              padding: '2px 8px', borderRadius: 99, background: HC.orangeLight,
              border: `1px solid ${HC.orangeMid}`, color: HC.orangeDark, fontSize: 9.5,
              fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase',
            }}>{openedFile.title}</span>
          }
          actions={
            <button
              onClick={() => handleCopyLink(openedFile)}
              style={{
                padding: '6px 12px', borderRadius: 9, cursor: 'pointer',
                border: `1.5px solid ${HC.borderStrong}`, background: HC.surface,
                color: HC.brown, fontSize: 11.5, fontWeight: 800,
              }}
            >🔗 Copy link</button>
          }
          footer="Esc, bấm ra ngoài, hoặc nút Back của trình duyệt đều đóng cửa sổ này."
          onClose={closeFile}
        >
          <MergedInfoTable
            generalInfo={openedFile.generalInfo}
            pricing={openedFile.pricing}
            showLeadTime={dept.showLeadTime}
          />
        </LibraryFileModal>
      )}
    </div>
  );
}
