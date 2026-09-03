// ════════════════════════════════════════════════════════════════════════════
//  VENDOR LIBRARY VIEWER — Thư Viện File (Happy Creative Format)
//  Mỗi file Excel import → lưu localStorage → hiển thị thành card riêng
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { HC } from '../utils/constants';
import { parseHappyCreativeLibrary, downloadVendorLibraryTemplate, exportVendorLibraryFiles } from '../../../utils/vendorExcel';
import api, { vendorLibraryApi } from '../../../services/api';
import { normalizeVendorMediaUrl } from '../../../utils/vendorMedia';
import { subscribeVendorLibraryChanges } from '../../../services/echo';
import AppToast from '../../shared/AppToast';
import ExportVendorFilesModal from '../../shared/ExportVendorFilesModal';
import ShareProjectsModal from '../../shared/ShareProjectsModal';
import Lightbox from '../components/Lightbox';
import { fileSharedProjects, fileVisibleToProject, PROJECTS } from '../../../constants/projects';
import { timeValue, fmtVNDateTimeShort, vnStartOfWeek } from '../../../utils/vnTime';

// ── Style helpers ─────────────────────────────────────────────────────────────
const TH = (extra = {}) => ({
  padding: '7px 8px', fontWeight: 800, fontSize: 9.5, textTransform: 'uppercase',
  letterSpacing: '0.05em', color: '#fff', background: HC.orangeDark,
  border: `1px solid ${HC.orange}`, fontFamily: "'Inter',sans-serif",
  verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'nowrap', ...extra,
});
// Header cột SỐ (Price Ship / Price Ship Item 2 / Total…): cho xuống dòng, gọn,
// vì nội dung cột chỉ là giá trị $ nhỏ → tiêu đề dài xuống dòng thay vì kéo ngang.
const THnum = (extra = {}) => ({
  padding: '4px 2px', fontWeight: 800, fontSize: 9, textTransform: 'uppercase',
  letterSpacing: 0, color: '#fff', background: HC.orangeDark,
  border: `1px solid ${HC.orange}`, fontFamily: "'Inter',sans-serif",
  verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'normal', lineHeight: 1.1, ...extra,
});
const TD = (idx, extra = {}) => ({
  padding: '6px 5px', fontSize: 12, color: HC.ink2, border: `1px solid ${HC.border}`,
  background: idx % 2 === 0 ? HC.surface : HC.surface2,
  fontFamily: "'Inter',sans-serif", verticalAlign: 'top', wordBreak: 'break-word', overflowWrap: 'break-word', ...extra,
});
// Ô SỐ trong body: không bẻ dòng giá trị, padding hẹp để cột nhỏ vẫn đủ chứa "$XX.XX".
const TDnum = (idx, extra = {}) => ({
  padding: '6px 3px', fontSize: 11.5, color: HC.ink2, border: `1px solid ${HC.border}`,
  background: idx % 2 === 0 ? HC.surface : HC.surface2,
  fontFamily: "'Inter',sans-serif", verticalAlign: 'middle', textAlign: 'right',
  whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', ...extra,
});
const fmt$ = (v) => (v !== null && v !== undefined ? `$${Number(v).toFixed(2)}` : '—');
const fmtNA = (v) => (v !== null && v !== undefined && v !== '' ? v : '—');

// Link video YouTube (youtube.com / youtu.be) không phải ảnh → <img> sẽ vỡ.
const isYouTubeUrl = (u) => typeof u === 'string' && /(?:youtube\.com|youtu\.be)/i.test(u);
// Link Google Drive (drive.google.com) cũng không phải ảnh → hiển thị logo Drive.
const isGoogleDriveUrl = (u) => typeof u === 'string' && /(?:drive|docs)\.google\.com/i.test(u);

// "Chi tiết Size" là text tự do, đôi khi dán kèm link Google Docs/Sheets/Slides/Forms
// (VD link kích thước viền khung) → URL rất dài làm cột vỡ layout. Bắt link
// docs.google.com trong text để thay bằng logo + nhãn gọn thay vì hiện cả URL.
const GDOCS_URL_RE = /(https?:\/\/docs\.google\.com\/\S+)/gi;
// Tách dấu câu đóng (), ], ., , ... dính ngay sau URL (VD "...(xem tại link)." trong
// Excel) ra khỏi phần URL thật, để không kéo luôn dấu câu vào bên trong link.
function splitTrailingPunctuation(url) {
  const m = url.match(/^(.*?)([)\]}>,.;:'"]*)$/);
  return m ? [m[1], m[2]] : [url, ''];
}
function googleDocsKind(url) {
  if (/\/spreadsheets\//i.test(url)) return { label: 'Sheet', color: '#0f9d58' };
  if (/\/presentation\//i.test(url)) return { label: 'Slide', color: '#f4b400' };
  if (/\/forms\//i.test(url)) return { label: 'Form', color: '#673ab7' };
  return { label: 'Doc', color: '#4285f4' };
}
// Icon trang tài liệu gọn (viền + gạch dòng), màu theo loại Google Docs/Sheets/Slides/Forms.
function GoogleDocsIcon({ color, size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M5 2h9l5 5v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="#fff" stroke={color} strokeWidth="1.6" />
      <path d="M14 2v5h5" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M7.5 12h9M7.5 15h9M7.5 18h6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
// Chip logo + nhãn thay cho URL Google Docs/Sheets dài, bấm mở tab mới, hover xem full URL.
function GoogleDocsLinkChip({ url }) {
  const { label, color } = googleDocsKind(url);
  return (
    <a href={url} target="_blank" rel="noreferrer" title={url}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px 1px 4px', margin: '0 2px', borderRadius: 10, background: '#fff', border: `1px solid ${color}`, color, textDecoration: 'none', fontSize: 10, fontWeight: 700, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
      <GoogleDocsIcon color={color} />
      {label}
    </a>
  );
}
// Render text "Chi tiết Size": thay từng link docs.google.com bằng chip logo gọn,
// giữ nguyên phần text còn lại (kể cả xuống dòng, nhờ whiteSpace: pre-wrap ở ô cha).
// Export để dùng chung ở view read-only CSF/PD (components/csfpd/VendorLibraryView.jsx).
export function renderChiTietSizeText(text) {
  const parts = String(text).split(GDOCS_URL_RE);
  if (parts.length === 1) return text;
  return parts.map((part, idx) => {
    if (idx % 2 === 0) return part;
    const [cleanUrl, trailing] = splitTrailingPunctuation(part);
    return (
      <React.Fragment key={idx}>
        <GoogleDocsLinkChip url={cleanUrl} />
        {trailing}
      </React.Fragment>
    );
  });
}

// Ảnh link ngoài (vd CDN của công cụ khác dán vào ô Excel) không đưa lên
// storage của mình — nhưng bấm xem KHÔNG được điều hướng thẳng (target=_blank)
// tới link đó, vì server CDN gốc có thể trả Content-Disposition: attachment
// khiến trình duyệt tự tải file xuống thay vì cho xem. Mở trong Lightbox tại
// chỗ (chỉ render <img>, không điều hướng) thì luôn xem được, bất kể header
// CDN gốc trả gì.
function AuthenticatedImage({ url, siblingUrls, index, style, ...rest }) {
  const normalizedUrl = normalizeVendorMediaUrl(url);
  const requiresAuth = typeof normalizedUrl === 'string' &&
    normalizedUrl.startsWith('/api/vendor-library/images/');
  const [objectUrl, setObjectUrl] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxUrls, setLightboxUrls] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lightboxObjectUrlsRef = useRef([]);

  useEffect(() => {
    if (!requiresAuth) {
      setObjectUrl(null);
      return undefined;
    }

    const controller = new AbortController();
    const apiPath = normalizedUrl.replace(/^\/api/, '');
    api.get(apiPath, { responseType: 'blob', signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) setObjectUrl(URL.createObjectURL(response.data));
      })
      .catch((error) => {
        if (error.name !== 'CanceledError' && error.code !== 'ERR_CANCELED') {
          console.error('Không thể tải ảnh Vendor Library:', error);
        }
      });

    return () => {
      controller.abort();
    };
  }, [normalizedUrl, requiresAuth]);

  useEffect(() => () => {
    if (objectUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  // Dọn blob URL Lightbox lúc unmount đột ngột (trường hợp thường revoke ở closeLightbox).
  useEffect(() => () => {
    lightboxObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    lightboxObjectUrlsRef.current = [];
  }, []);

  const src = requiresAuth ? (objectUrl || undefined) : normalizedUrl;

  // Mở Lightbox với TOÀN BỘ ảnh anh em (siblingUrls) thay vì chỉ ảnh vừa bấm,
  // để có nút chuyển qua/về khi ô có từ 2 ảnh trở lên. Ảnh cần auth phải fetch
  // blob riêng cho từng ảnh (thumbnail chỉ tự fetch ảnh của chính nó).
  const openLightbox = async () => {
    const list = (siblingUrls && siblingUrls.length > 0) ? siblingUrls : [url];
    const targetIdx = index || 0;
    const resolved = await Promise.all(list.map(async (u) => {
      const norm = normalizeVendorMediaUrl(u);
      if (typeof norm === 'string' && norm.startsWith('/api/vendor-library/images/')) {
        try {
          const apiPath = norm.replace(/^\/api/, '');
          const response = await api.get(apiPath, { responseType: 'blob' });
          const objUrl = URL.createObjectURL(response.data);
          lightboxObjectUrlsRef.current.push(objUrl);
          return objUrl;
        } catch (error) {
          console.error('Không thể tải ảnh Vendor Library:', error);
          return null;
        }
      }
      return norm;
    }));

    const valid = resolved.map((r, i) => ({ r, i })).filter((e) => e.r);
    if (!valid.length) return;
    const newIndex = valid.findIndex((e) => e.i === targetIdx);
    setLightboxUrls(valid.map((e) => e.r));
    setLightboxIndex(newIndex >= 0 ? newIndex : 0);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    lightboxObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    lightboxObjectUrlsRef.current = [];
    setLightboxUrls(null);
  };

  return (
    <>
      <img
        src={src}
        style={{ cursor: src ? 'zoom-in' : undefined, ...style }}
        onClick={(e) => { e.stopPropagation(); if (src) openLightbox(); }}
        {...rest}
      />
      {lightboxOpen && lightboxUrls && lightboxUrls.length > 0 && (
        <Lightbox mediaUrls={lightboxUrls} initialIndex={lightboxIndex} onClose={closeLightbox} />
      )}
    </>
  );
}
// Thumbnail 40x40 trong cột Hình ảnh: link YouTube → logo YouTube, link Google Drive
// → logo Drive (bấm mở); còn lại → ảnh như cũ. Người dùng nhận ra ngay không phải ảnh lỗi.
export function MediaThumb({ url, siblingUrls, index }) {
  if (isYouTubeUrl(url)) {
  url = normalizeVendorMediaUrl(url);
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
    <AuthenticatedImage url={url} siblingUrls={siblingUrls} index={index} alt="" loading="lazy" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4, border: `1px solid ${HC.border}` }} />
  );
}

// Một file "New Arrivals" chỉ còn là hàng mới TRONG TUẦN nó được upload (tuần bắt
// đầu từ thứ Hai). Sang thứ Hai của tuần kế tiếp, importedAt < mốc thứ Hai tuần
// hiện tại → hết hiển thị ở tab New Arrivals + hết badge "Mới", trở về file thường.
function isWithinCurrentWeek(importedAt) {
  if (!importedAt) return false;
  const t = timeValue(importedAt, NaN);
  if (!Number.isFinite(t)) return false;
  // Ranh giới tuần phải là nửa đêm thứ Hai Ở VIỆT NAM, không phải nửa đêm theo
  // máy người xem — nếu không, người ngồi khác múi giờ thấy tab New Arrivals
  // đổi nội dung sớm/muộn hơn phần còn lại của team.
  return t >= vnStartOfWeek();
}

// ── Ô số click-để-sửa tại chỗ ────────────────────────────────────────────────
// Vendor không có nút "Sửa" nên cho phép nhấn thẳng vào từng giá trị để chỉnh.
// Enter/blur = lưu (gọi onCommit → onSave), Esc = huỷ. readOnly → chỉ hiển thị.
function EditableNum({ value, display, onCommit, readOnly, align = 'right', extraStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const skip = useRef(false);
  if (readOnly) return <span style={extraStyle}>{display}</span>;
  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value ?? ''); setEditing(true); }}
        title="Nhấn để sửa"
        style={{ cursor: 'pointer', display: 'block', borderRadius: 3, padding: '1px 2px', ...extraStyle }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,166,35,0.18)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >{display}</span>
    );
  }
  const commit = () => {
    setEditing(false);
    if (String(draft ?? '') !== String(value ?? '')) onCommit(draft);
  };
  return (
    <input
      type="number" step="0.01" autoFocus value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => { if (skip.current) { skip.current = false; setEditing(false); } else commit(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') { skip.current = true; e.currentTarget.blur(); }
      }}
      style={{ width: '100%', padding: '4px 2px', fontSize: 11, borderRadius: 4, border: `1px solid ${HC.orange}`, textAlign: align, boxSizing: 'border-box', outline: 'none', ...extraStyle }}
    />
  );
}

// Giống EditableNum nhưng cho VĂN BẢN (Product Type / Size / Optional): hiển thị
// như text bình thường, nhấn mới hiện ô sửa — không luôn hiện khung input.
// readOnly → chỉ hiển thị (Seller/CSF/PD). `display` = nội dung hiển thị lúc chưa sửa.
function EditableText({ value, display, onCommit, readOnly, align = 'left', placeholder, extraStyle }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const skip = useRef(false);
  if (readOnly) return <span style={extraStyle}>{display}</span>;
  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value ?? ''); setEditing(true); }}
        title="Nhấn để sửa"
        style={{ cursor: 'pointer', display: 'block', borderRadius: 3, padding: '1px 2px', minHeight: 15, ...extraStyle }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(245,166,35,0.18)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >{display}</span>
    );
  }
  const commit = () => {
    setEditing(false);
    if (String(draft ?? '') !== String(value ?? '')) onCommit(draft);
  };
  return (
    <input
      type="text" autoFocus value={draft} placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => { if (skip.current) { skip.current = false; setEditing(false); } else commit(); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') { skip.current = true; e.currentTarget.blur(); }
      }}
      style={{ width: '100%', padding: '4px 4px', fontSize: 11, borderRadius: 4, border: `1px solid ${HC.orange}`, textAlign: align, boxSizing: 'border-box', outline: 'none', ...extraStyle }}
    />
  );
}

// ── Project visibility helpers ────────────────────────────────────────────────
// Quy tắc "file này project nào thấy" nằm ở constants/projects.js (dùng chung với
// bản CSF/PD và index bảng tính giá): ưu tiên danh sách chia sẻ tường minh
// `file.projects`, không có thì lùi về ký hiệu `P.xxx` trong tên file.

// Lấy project string của user hiện tại từ localStorage.
// Ưu tiên: user.project → user.name → user.seller_name (để không cần re-login)
function getCurrentUserProject() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const role = (u.role || '').toLowerCase().replace(/[-_\s]/g, '');
    // Admin và Staff B luôn thấy tất cả — không lọc theo project
    if (role === 'admin' || role === 'staffb' || role === 'vendor') return { skip: true };
    const key = (u.project || u.name || u.seller_name || '').trim().toLowerCase();
    return { skip: false, key };
  } catch { return { skip: false, key: '' }; }
}

// Vendor role chỉ cần dán/sửa Link Template — không cần Thao tác (Sửa/Xóa cả dòng giá).
function isCurrentUserVendor() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    const rawRole = typeof u.role === 'object' ? u.role?.name : u.role;
    const role = (rawRole || '').toString().toLowerCase().replace(/[-_\s]/g, '');
    return role === 'vendor';
  } catch { return false; }
}

// Hợp nhất generalInfo theo id: giữ nguyên toàn bộ dòng của bản gốc, thay dòng nào
// có bản chỉnh sửa tương ứng (khớp id), và thêm dòng hoàn toàn mới nếu có.
// Dùng để KHÔNG mất dòng đang bị ẩn khi lưu từ một view đã lọc dòng (VD: tab Best
// Seller chỉ hiển thị các dòng best-seller). generalInfo chỉ được sửa tại chỗ,
// không có thao tác xóa dòng, nên việc giữ lại dòng bị ẩn là an toàn.
function mergeGeneralInfoById(rawRows = [], viewRows = []) {
  const viewById = new Map((viewRows || []).filter(r => r && r.id != null).map(r => [r.id, r]));
  const rawIds = new Set((rawRows || []).map(r => r?.id));
  const merged = (rawRows || []).map(r => (r && viewById.has(r.id) ? viewById.get(r.id) : r));
  const additions = (viewRows || []).filter(r => !r || r.id == null || !rawIds.has(r.id));
  return [...merged, ...additions];
}

// ── Section 1 Table ──────────────────────────────────────────────────────────
function GeneralInfoTable({ rows, onSave, readOnly, selectable, selectedIds, onSelectRow, onSelectAll, bestSellerIds, toggleBestSeller, mode, onSampleStatusChange }) {
  const [editIdx, setEditIdx] = useState(-1);
  const [editForm, setEditForm] = useState(null);

  if (!rows || rows.length === 0) return <div style={{ padding: 24, color: HC.muted, textAlign: 'center' }}>Không có dữ liệu thông tin chung.</div>;

  // Nếu toàn bộ file chỉ có đúng 1 link folder khác nhau → dùng chung cho các row trống
  const uniqueLinks = [...new Set(rows.map(r => (r.linkFolder || '').trim()).filter(Boolean))];
  const fileLevelLink = uniqueLinks.length === 1 ? uniqueLinks[0] : null;

  const startEdit = (idx, row) => {
    setEditIdx(idx);
    setEditForm({
      vendorName: row.vendorName || '',
      productType: row.productType || '',
      kyHieu: row.kyHieu || '',
      linkFolder: row.linkFolder || '',
      chatLieu: row.chatLieu || '',
      chiTietSize: row.chiTietSize || '',
      chiTietSizeImage: row.chiTietSizeImage || '',
      avgTimeVendor: row.avgTimeVendor || '',
      avgTimeActual: row.avgTimeActual || '',
      notes: row.notes || '',
      img0: row.images?.[0] || '',
      img1: row.images?.[1] || '',
      img2: row.images?.[2] || '',
      img3: row.images?.[3] || '',
    });
  };

  const saveEdit = (idx) => {
    const newRows = [...rows];
    const images = [editForm.img0, editForm.img1, editForm.img2, editForm.img3].filter(Boolean);
    newRows[idx] = {
      ...newRows[idx],
      vendorName: editForm.vendorName,
      productType: editForm.productType,
      kyHieu: editForm.kyHieu,
      linkFolder: editForm.linkFolder,
      chatLieu: editForm.chatLieu,
      chiTietSize: editForm.chiTietSize,
      chiTietSizeImage: editForm.chiTietSizeImage,
      avgTimeVendor: editForm.avgTimeVendor,
      avgTimeActual: editForm.avgTimeActual,
      notes: editForm.notes,
      images,
    };
    setEditIdx(-1);
    setEditForm(null);
    onSave(newRows);
  };

  // Trạng thái đặt Sample — chỉ role Vendor được đổi, các role khác chỉ xem.
  // Lưu qua endpoint riêng (nhẹ) thay vì ghi đè cả blob thư viện.
  const isVendorUser = isCurrentUserVendor();
  const canToggleSample = isVendorUser && typeof onSampleStatusChange === 'function';

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
      <thead>
        <tr>
          {!readOnly && <th style={{ ...TH({ background: '#8B6914' }), width: '3%', textAlign: 'center' }} title="Đánh dấu Best Seller">⭐</th>}
          {selectable && (() => {
            const allChecked = rows.length > 0 && rows.every(r => selectedIds?.has(r.id));
            const someChecked = !allChecked && rows.some(r => selectedIds?.has(r.id));
            return (
              <th style={{ ...TH(), width: '3%', textAlign: 'center', cursor: 'pointer' }} onClick={onSelectAll} title={allChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả trong file này'}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${allChecked ? '#fff' : 'rgba(255,255,255,0.6)'}`, background: allChecked ? '#fff' : someChecked ? 'rgba(255,255,255,0.3)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {allChecked && <span style={{ color: HC.orangeDark, fontSize: 10, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                    {someChecked && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900, lineHeight: 1 }}>−</span>}
                  </div>
                </div>
              </th>
            );
          })()}
          <th style={{ ...TH(), width: '9%' }}>Vendor Name</th>
          <th style={{ ...TH(), width: '10%' }}>Product Type</th>
          <th style={{ ...TH(), width: '9%' }}>Hình ảnh</th>
          <th style={{ ...TH(), width: '9%' }}>Chất liệu</th>
          <th style={{ ...TH(), width: '7%' }}>Chi tiết Size</th>
          <th style={{ ...TH(), width: '10%', whiteSpace: 'normal', lineHeight: 1.3 }}>AVG TG (Vendor)</th>
          <th style={{ ...TH(), width: '8%', whiteSpace: 'normal', lineHeight: 1.3 }}>AVG TG (Thực tế)</th>
          <th style={{ ...TH(), width: '13%' }}>Notes</th>
          <th style={{ ...TH(), width: '9%' }}>Sample Status</th>
          <th style={{ ...TH(), width: '8%' }}>Link Folder</th>
          {!readOnly && <th style={{ ...TH(), width: '5%' }}>Thao tác</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const isEditing = editIdx === i;
          const isBestSeller = bestSellerIds?.has(r.id);
          return (
            <tr key={i} style={{ background: isBestSeller ? 'rgba(255,215,0,0.07)' : undefined }}>
              {!readOnly && (
                <td style={{ ...TD(i), textAlign: 'center', cursor: 'pointer', background: isBestSeller ? 'rgba(255,215,0,0.15)' : undefined, transition: 'background 0.2s' }} onClick={() => toggleBestSeller && toggleBestSeller(r.id)} title={isBestSeller ? 'Bỏ đánh dấu Best Seller' : 'Đánh dấu Best Seller'}>
                  <div style={{ fontSize: 16, transition: 'all 0.25s ease', transform: isBestSeller ? 'scale(1.25)' : 'scale(1)', opacity: isBestSeller ? 1 : 0.15, filter: isBestSeller ? 'drop-shadow(0 0 5px rgba(255,200,0,0.9))' : 'none' }}>⭐</div>
                </td>
              )}
              {selectable && (
                <td style={{ ...TD(i), textAlign: 'center', cursor: 'pointer', userSelect: 'none' }} onClick={() => onSelectRow(r.id)}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selectedIds?.has(r.id) ? HC.orange : HC.muted2}`, background: selectedIds?.has(r.id) ? HC.orange : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', transition: 'all 0.15s', flexShrink: 0 }}>
                    {selectedIds?.has(r.id) && <span style={{ color: '#fff', fontSize: 11, fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                </td>
              )}
              <td style={{ ...TD(i), textAlign: 'center', verticalAlign: 'middle' }}>
                {isEditing ? (
                  <input type="text" placeholder="Vendor Name..." value={editForm.vendorName} onChange={e => setEditForm(p => ({ ...p, vendorName: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box', textAlign: 'center' }} />
                ) : (
                  r.vendorName
                    ? <span style={{ fontWeight: 700, color: HC.ink }}>{r.vendorName}</span>
                    : <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 800, border: '1px solid #fcd34d' }}>N/A</span>
                )}
              </td>
              <td style={{ ...TD(i) }}>
                {isEditing ? (
                  <input type="text" placeholder="Product Type..." value={editForm.productType} onChange={e => setEditForm(p => ({ ...p, productType: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
                ) : (
                  r.productType
                    ? <span style={{ fontWeight: 700, color: HC.ink }}>{r.productType}</span>
                    : <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 800, border: '1px solid #fcd34d' }}>N/A</span>
                )}
              </td>
              <td style={{ ...TD(i) }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {['img0','img1','img2','img3'].map((k, n) => (
                      <input key={k} type="text" placeholder={`URL Hình ${n+1}`} value={editForm[k]} onChange={e => setEditForm(p => ({ ...p, [k]: e.target.value }))} style={{ width: '100%', padding: 3, fontSize: 10, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {r.images && r.images.length > 0 ? r.images.map((img, idx) => (
                      <MediaThumb key={idx} url={img} siblingUrls={r.images} index={idx} />
                    )) : <span style={{ color: HC.muted, fontSize: 10, fontStyle: 'italic' }}>Không có ảnh</span>}
                  </div>
                )}
              </td>
              <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                {isEditing ? (
                  <textarea rows={3} placeholder="Chất liệu..." value={editForm.chatLieu} onChange={e => setEditForm(p => ({ ...p, chatLieu: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box', resize: 'vertical' }} />
                ) : fmtNA(r.chatLieu)}
              </td>
              <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input type="text" placeholder="URL ảnh size guide..." value={editForm.chiTietSizeImage} onChange={e => setEditForm(p => ({ ...p, chiTietSizeImage: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 10, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
                    <textarea rows={2} placeholder="Chi tiết size (text)..." value={editForm.chiTietSize} onChange={e => setEditForm(p => ({ ...p, chiTietSize: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 10, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box', resize: 'vertical' }} />
                  </div>
                ) : (
                  <>
                    {r.chiTietSizeImage && (
                      <div style={{ display: 'block', marginBottom: r.chiTietSize ? 6 : 0 }}>
                        {isGoogleDriveUrl(r.chiTietSizeImage)
                          ? <MediaThumb url={r.chiTietSizeImage} />
                          : <AuthenticatedImage url={r.chiTietSizeImage} alt="Size Guide" loading="lazy" style={{ width: '100%', maxWidth: '100%', borderRadius: 4, border: `1px solid ${HC.border}`, objectFit: 'contain' }} />}
                      </div>
                    )}
                    {r.chiTietSize ? renderChiTietSizeText(r.chiTietSize) : (!r.chiTietSizeImage ? '—' : '')}
                  </>
                )}
              </td>
              <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4, color: HC.success }}>
                {isEditing ? (
                  <input type="text" placeholder="VD: 3-5 ngày" value={editForm.avgTimeVendor} onChange={e => setEditForm(p => ({ ...p, avgTimeVendor: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
                ) : fmtNA(r.avgTimeVendor)}
              </td>
              <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4, color: HC.warning }}>
                {isEditing ? (
                  <input type="text" placeholder="VD: 5-7 ngày" value={editForm.avgTimeActual} onChange={e => setEditForm(p => ({ ...p, avgTimeActual: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
                ) : fmtNA(r.avgTimeActual)}
              </td>
              <td style={{ ...TD(i), whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                {isEditing ? (
                  <textarea rows={3} placeholder="Ghi chú..." value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box', resize: 'vertical' }} />
                ) : fmtNA(r.notes)}
              </td>
              <td style={{ ...TD(i), textAlign: 'center' }}>
                {(() => {
                  const hasSample = r.sampleStatus === 'has_sample';
                  const label = hasSample ? 'Đã có sample' : 'Chưa có sample';
                  const badgeStyle = {
                    padding: '4px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap', display: 'inline-block',
                    background: hasSample ? '#dcfce7' : '#fef3c7',
                    color: hasSample ? '#166534' : '#92400e',
                    border: `1.5px solid ${hasSample ? '#86efac' : '#fcd34d'}`,
                  };
                  return canToggleSample ? (
                    <button
                      onClick={() => onSampleStatusChange(r.id, hasSample ? 'no_sample' : 'has_sample')}
                      title="Click để đổi trạng thái"
                      style={{ ...badgeStyle, cursor: 'pointer' }}
                    >{label}</button>
                  ) : (
                    <span style={badgeStyle}>{label}</span>
                  );
                })()}
              </td>
              <td style={{ ...TD(i) }}>
                {isEditing ? (
                  <input type="text" placeholder="Link Folder..." value={editForm.linkFolder} onChange={e => setEditForm(p => ({ ...p, linkFolder: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
                ) : (() => {
                  const link = r.linkFolder || fileLevelLink || '';
                  const isShared = !r.linkFolder && !!fileLevelLink;
                  return link
                    ? <a href={link} target="_blank" rel="noreferrer" title={isShared ? `${link}\n(dùng chung cả file)` : link}
                        style={{ color: isShared ? HC.muted : HC.orangeDark, textDecoration: 'underline', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: isShared ? 'italic' : 'normal' }}>
                        🔗 Folder{isShared && <span style={{ fontSize: 9, marginLeft: 3, opacity: 0.7 }}>(chung)</span>}
                      </a>
                    : <span style={{ color: HC.muted2 }}>—</span>;
                })()}
              </td>
              {!readOnly && (
                <td style={{ ...TD(i), textAlign: 'center' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button onClick={() => saveEdit(i)} style={{ padding: '4px 6px', borderRadius: 4, background: HC.success, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Lưu</button>
                      <button onClick={() => setEditIdx(-1)} style={{ padding: '4px 6px', borderRadius: 4, background: HC.muted, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Hủy</button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(i, r)} style={{ padding: '4px 6px', borderRadius: 4, background: 'rgba(212,160,23,0.15)', color: HC.gold, border: `1px solid ${HC.goldLight}`, cursor: 'pointer', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>✏️ Sửa</button>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Add Row Form (hiển thị dạng card khi bảng trống) ────────────────────────
function AddRowForm({ addForm, setAddForm, saveAddRow, onCancel, shipMethods }) {
  return (
    <div style={{ border: `1.5px solid ${HC.orange}`, borderRadius: 10, padding: 16, marginTop: 8, background: '#fffbeb' }}>
      <div style={{ fontWeight: 800, fontSize: 12, color: HC.orangeDark, marginBottom: 14, fontFamily: "'Inter',sans-serif" }}>➕ Dòng giá mới</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[['Ký hiệu', 'kyHieu', 'A, B...'],['Product Type','productType','Loại sản phẩm...'],['Size','size','S/M/L...'],['Optional','optional','Optional...']].map(([lbl,key,ph]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: HC.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lbl}</label>
            <input type="text" placeholder={ph} value={addForm[key]} onChange={e => setAddForm(p => ({ ...p, [key]: e.target.value }))} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6, border: `1.5px solid ${HC.border}`, boxSizing: 'border-box', outline: 'none' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {[['Pricing 1 (P1)','pricing1'],['Pricing 2 (P2)','pricing2']].map(([lbl,key]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: HC.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lbl}</label>
            <input type="number" step="0.01" placeholder="0.00" value={addForm[key]} onChange={e => setAddForm(p => ({ ...p, [key]: e.target.value }))} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6, border: `1.5px solid ${HC.border}`, boxSizing: 'border-box', textAlign: 'right', color: '#b45309', fontWeight: 700, outline: 'none' }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
        {shipMethods.map(m => (
          <div key={m.label} style={{ border: `1.5px solid ${m.bg}33`, borderRadius: 8, padding: '8px 8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 800, fontSize: 10, color: m.bg, textAlign: 'center', textTransform: 'uppercase' }}>{m.label}</div>
            {[['Price Ship', m.priceKey, HC.muted], ['Price Ship Item 2', m.item2Key, HC.muted], ['Total (fulfill)', m.totalKey, HC.success]].map(([lbl, key, clr]) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: 9, fontWeight: 700, color: HC.muted, textTransform: 'uppercase' }}>{lbl}</label>
                <input type="number" step="0.01" placeholder="0.00" value={addForm[key]} onChange={e => setAddForm(p => ({ ...p, [key]: e.target.value }))} style={{ padding: '5px 6px', fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'right', color: clr, fontWeight: 700, boxSizing: 'border-box', outline: 'none' }} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
        <label style={{ fontSize: 10, fontWeight: 800, color: HC.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Link Template</label>
        <input type="text" placeholder="https://..." value={addForm.linkTemplate} onChange={e => setAddForm(p => ({ ...p, linkTemplate: e.target.value }))} style={{ padding: '6px 8px', fontSize: 11, borderRadius: 6, border: `1.5px solid ${HC.border}`, boxSizing: 'border-box', outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 7, border: `1px solid ${HC.border}`, background: HC.surface, color: HC.muted, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
        <button onClick={saveAddRow} style={{ padding: '7px 20px', borderRadius: 7, border: 'none', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>💾 Lưu dòng giá</button>
      </div>
    </div>
  );
}

// ── Section 2 Table ──────────────────────────────────────────────────────────
function PricingTable({ rows, onSave, readOnly, generalInfo, canDeleteRow }) {
  const [editIdx, setEditIdx] = useState(-1);
  const [editForm, setEditForm] = useState(null);
  const [addingRow, setAddingRow] = useState(false);
  const [addForm, setAddForm] = useState(null);
  const showActions = !readOnly && !isCurrentUserVendor();
  // Xóa dòng size/giá không còn hoạt động: Vendor (không readOnly) và Admin
  // (readOnly nhưng canManage) đều được — tách riêng khỏi "Sửa" cả dòng, vì
  // Admin vẫn không được sửa trực tiếp giá trị ô (chỉ được dọn dòng thừa).
  const showActionsCol = showActions || canDeleteRow;

  const mkAddForm = () => ({
    kyHieu: '', productType: '', size: '', optional: '',
    pricing1: '', pricing2: '',
    eco_price: '', eco_total: '', eco_price_item2: '',
    ground_price: '', ground_total: '', ground_price_item2: '',
    express_price: '', express_total: '', express_price_item2: '',
    twoday_price: '', twoday_total: '', twoday_price_item2: '',
    overnight_price: '', overnight_total: '', overnight_price_item2: '',
    linkTemplate: '',
  });

  const saveAddRow = () => {
    const toNum = v => (v === '' || v === null || v === undefined) ? null : Number(v);
    const newRow = {
      id: `add_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      kyHieu: addForm.kyHieu,
      productType: addForm.productType,
      size: addForm.size,
      optional: addForm.optional,
      pricing1: toNum(addForm.pricing1), pricing2: toNum(addForm.pricing2),
      eco_price: toNum(addForm.eco_price), eco_total: toNum(addForm.eco_total), eco_price_item2: toNum(addForm.eco_price_item2),
      ground_price: toNum(addForm.ground_price), ground_total: toNum(addForm.ground_total), ground_price_item2: toNum(addForm.ground_price_item2),
      express_price: toNum(addForm.express_price), express_total: toNum(addForm.express_total), express_price_item2: toNum(addForm.express_price_item2),
      twoday_price: toNum(addForm.twoday_price), twoday_total: toNum(addForm.twoday_total), twoday_price_item2: toNum(addForm.twoday_price_item2),
      overnight_price: toNum(addForm.overnight_price), overnight_total: toNum(addForm.overnight_total), overnight_price_item2: toNum(addForm.overnight_price_item2),
      linkTemplate: addForm.linkTemplate,
    };
    if (onSave) onSave([...(rows || []), newRow]);
    setAddingRow(false);
    setAddForm(null);
  };

  const updateLinkTemplate = (idx, value) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], linkTemplate: value };
    if (onSave) onSave(newRows);
  };

  // Sửa tại chỗ MỘT ô giá trị số (click-để-sửa). '' → null; số hợp lệ → Number.
  const updateCellValue = (idx, field, value) => {
    const num = (value === '' || value === null || value === undefined) ? null : Number(value);
    if (num !== null && !Number.isFinite(num)) return; // bỏ qua nhập không hợp lệ
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], [field]: num };
    if (onSave) onSave(newRows);
  };

  // Sửa tại chỗ MỘT ô văn bản (Product Type / Size / Optional) — lưu chuỗi as-is.
  // Cho phép cả role vendor sửa (chỉ chặn theo readOnly), không cần vào chế độ Sửa.
  const updateTextValue = (idx, field, value) => {
    const newRows = [...rows];
    newRows[idx] = { ...newRows[idx], [field]: value };
    if (onSave) onSave(newRows);
  };

  if (!rows || rows.length === 0) return (
    <div>
      <div style={{ padding: 24, color: HC.muted, textAlign: 'center' }}>Không có dữ liệu giá.</div>
      {!readOnly && (
        addingRow && addForm
          ? <AddRowForm addForm={addForm} setAddForm={setAddForm} saveAddRow={saveAddRow} onCancel={() => { setAddingRow(false); setAddForm(null); }} shipMethods={[
              { label: 'Economy', priceKey: 'eco_price', totalKey: 'eco_total', item2Key: 'eco_price_item2', bg: '#1d6b3a' },
              { label: 'Ground', priceKey: 'ground_price', totalKey: 'ground_total', item2Key: 'ground_price_item2', bg: HC.orangeDark },
              { label: 'Express', priceKey: 'express_price', totalKey: 'express_total', item2Key: 'express_price_item2', bg: '#1e4fa0' },
              { label: '2 Days', priceKey: 'twoday_price', totalKey: 'twoday_total', item2Key: 'twoday_price_item2', bg: '#7c3aed' },
              { label: 'Overnight', priceKey: 'overnight_price', totalKey: 'overnight_total', item2Key: 'overnight_price_item2', bg: '#b91c1c' },
            ]} />
          : <button onClick={() => { setAddingRow(true); setAddForm(mkAddForm()); }} style={{ width: '100%', padding: '9px 0', marginTop: 8, borderRadius: 8, border: `1.5px dashed ${HC.orangeMid}`, background: HC.orangeLight, color: HC.orangeDark, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>➕ Thêm dòng size/giá</button>
      )}
    </div>
  );


  // Strip parens/quotes/extra-spaces so "Canvas (1.5")" matches "Canvas 1.5""
  const normStr = s => (s || '').toString().trim().toLowerCase().replace(/[()'"""'']/g, '').replace(/\s+/g, ' ').trim();

  // kyHieu → vendorName từ generalInfo
  const kyHieuToVendor = {};
  (generalInfo || []).forEach(r => { if (r.kyHieu) kyHieuToVendor[r.kyHieu] = r.vendorName || r.kyHieu || ''; });

  // productType → vendorName từ generalInfo (dùng khi pricing row không có kyHieu)
  const ptToVendor = {};
  (generalInfo || []).forEach(g => { if (g.productType && g.vendorName) ptToVendor[normStr(g.productType)] = g.vendorName; });

  // Vendor không có kyHieu trong generalInfo → dùng làm fallback cho pricing rows không có kyHieu
  const untaggedVendorNames = [...new Set((generalInfo || []).filter(g => !g.kyHieu && g.vendorName).map(g => g.vendorName))];
  const untaggedVendorName = untaggedVendorNames.length === 1 ? untaggedVendorNames[0] : '';

  const uniqueVendorNames = [...new Set((generalInfo || []).map(g => g.vendorName || g.kyHieu).filter(Boolean))];

  // Sticky kyHieu propagation: nhiều Excel chỉ ghi kyHieu ở row đầu của mỗi vendor block
  let _lastKy = '';
  const processedRows = rows.map(r => {
    const pk = (r.kyHieu || '').trim();
    if (pk) _lastKy = pk;
    return { ...r, _effKy: pk || _lastKy };
  });

  const startEdit = (idx, row) => {
    setEditIdx(idx);
    setEditForm({
      kyHieu: row.kyHieu || '',
      productType: row.productType || '',
      size: row.size ?? '',
      optional: row.optional ?? '',
      pricing1: row.pricing1 ?? '',
      pricing2: row.pricing2 ?? '',
      eco_price: row.eco_price ?? '',
      eco_total: row.eco_total ?? '',
      eco_price_item2: row.eco_price_item2 ?? '',
      ground_price: row.ground_price ?? '',
      ground_total: row.ground_total ?? '',
      ground_price_item2: row.ground_price_item2 ?? '',
      express_price: row.express_price ?? '',
      express_total: row.express_total ?? '',
      express_price_item2: row.express_price_item2 ?? '',
      twoday_price: row.twoday_price ?? '',
      twoday_total: row.twoday_total ?? '',
      twoday_price_item2: row.twoday_price_item2 ?? '',
      overnight_price: row.overnight_price ?? '',
      overnight_total: row.overnight_total ?? '',
      overnight_price_item2: row.overnight_price_item2 ?? '',
    });
  };

  const saveEdit = (idx) => {
    const newRows = [...rows];
    const toNum = v => (v === '' || v === null || v === undefined) ? null : Number(v);
    newRows[idx] = {
      ...newRows[idx],
      kyHieu: editForm.kyHieu,
      productType: editForm.productType,
      size: editForm.size,
      optional: editForm.optional,
      pricing1: toNum(editForm.pricing1),
      pricing2: toNum(editForm.pricing2),
      eco_price: toNum(editForm.eco_price),
      eco_total: toNum(editForm.eco_total),
      eco_price_item2: toNum(editForm.eco_price_item2),
      ground_price: toNum(editForm.ground_price),
      ground_total: toNum(editForm.ground_total),
      ground_price_item2: toNum(editForm.ground_price_item2),
      express_price: toNum(editForm.express_price),
      express_total: toNum(editForm.express_total),
      express_price_item2: toNum(editForm.express_price_item2),
      twoday_price: toNum(editForm.twoday_price),
      twoday_total: toNum(editForm.twoday_total),
      twoday_price_item2: toNum(editForm.twoday_price_item2),
      overnight_price: toNum(editForm.overnight_price),
      overnight_total: toNum(editForm.overnight_total),
      overnight_price_item2: toNum(editForm.overnight_price_item2),
    };
    setEditIdx(-1);
    setEditForm(null);
    if (onSave) onSave(newRows);
  };

  const deleteRow = (idx) => {
    const newRows = rows.filter((_, i) => i !== idx);
    if (onSave) onSave(newRows);
  };

  const shipMethods = [
    { label: 'Economy', priceKey: 'eco_price', totalKey: 'eco_total', item2Key: 'eco_price_item2' },
    { label: 'Ground', priceKey: 'ground_price', totalKey: 'ground_total', item2Key: 'ground_price_item2' },
    { label: 'Express', priceKey: 'express_price', totalKey: 'express_total', item2Key: 'express_price_item2' },
    { label: '2 Days', priceKey: 'twoday_price', totalKey: 'twoday_total', item2Key: 'twoday_price_item2' },
    { label: 'Overnight', priceKey: 'overnight_price', totalKey: 'overnight_total', item2Key: 'overnight_price_item2' },
  ];

  const shipBg = ['#1d6b3a', HC.orangeDark, '#1e4fa0', '#7c3aed', '#b91c1c'];
  const naStyle = { background: '#fef3c7', color: '#92400e', padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 800, border: '1px solid #fcd34d' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1160, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 78 }} />{/* Vendor Name */}
          <col style={{ width: 104 }} />{/* Product Type */}
          <col style={{ width: 50 }} />{/* Size */}
          <col style={{ width: 46 }} />{/* Optional */}
          <col style={{ width: 50 }} />{/* P1 */}
          <col style={{ width: 46 }} />{/* P2 */}
          {shipMethods.map((m) => [
            <col key={`${m.label}-c1`} style={{ width: 50 }} />,
            <col key={`${m.label}-c2`} style={{ width: 50 }} />,
            <col key={`${m.label}-c3`} style={{ width: 54 }} />,
          ])}
          <col style={{ width: 72 }} />{/* Link Template */}
          {showActionsCol && <col style={{ width: 54 }} />}
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} style={{ ...TH(), whiteSpace: 'normal', lineHeight: 1.15 }}>Vendor Name</th>
            <th rowSpan={2} style={{ ...TH() }}>Product Type</th>
            <th colSpan={2} style={{ ...TH() }}>Detail</th>
            <th colSpan={2} style={{ ...TH() }}>Pricing</th>
            {shipMethods.map((m, si) => (
              <th key={m.label} colSpan={3} style={{ ...TH(), background: shipBg[si] }}>{m.label}</th>
            ))}
            <th rowSpan={2} style={{ ...TH(), whiteSpace: 'normal', lineHeight: 1.15 }}>Link Template</th>
            {showActionsCol && <th rowSpan={2} style={{ ...TH() }}>Thao tác</th>}
          </tr>
          <tr>
            <th style={{ ...TH() }}>Size</th>
            <th style={{ ...TH() }}>Optional</th>
            <th style={{ ...TH({ background: '#b45309' }) }}>P1</th>
            <th style={{ ...TH({ background: '#b45309' }) }}>P2</th>
            {shipMethods.map((m, si) => [
              <th key={`${m.label}-price`} style={{ ...THnum({ background: shipBg[si], opacity: 0.85 }) }}>Price Ship</th>,
              <th key={`${m.label}-item2`} style={{ ...THnum({ background: shipBg[si], opacity: 0.7 }) }}>Price Ship Item 2</th>,
              <th key={`${m.label}-total`} style={{ ...THnum({ background: shipBg[si] }) }}>Total (fulfill)</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {processedRows.map((r, i) => {
            const isEditing = editIdx === i;
            return (
              <tr key={i}>
                <td style={{ ...TD(i), textAlign: 'center', verticalAlign: 'middle' }}>
                  {isEditing ? (
                    <input type="text" placeholder="A, B..." value={editForm.kyHieu} onChange={e => setEditForm(p => ({ ...p, kyHieu: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'center', fontWeight: 900, color: HC.orangeDark }} />
                  ) : (() => {
                    const vName = (() => {
                      // 1. Dùng effective kyHieu (có sticky propagation)
                      if (r._effKy) return kyHieuToVendor[r._effKy] || r._effKy;
                      // 2. Lookup trực tiếp theo productType từ generalInfo
                      const rpt = normStr(r.productType);
                      if (rpt) {
                        if (ptToVendor[rpt]) return ptToVendor[rpt];
                        const matchKey = Object.keys(ptToVendor).find(k => k.includes(rpt) || rpt.includes(k));
                        if (matchKey) return ptToVendor[matchKey];
                      }
                      // 3. Nếu generalInfo chỉ có 1 vendor không có kyHieu → dùng làm mặc định
                      if (untaggedVendorName) return untaggedVendorName;
                      // 4. Nếu cả file chỉ có 1 vendor duy nhất
                      if (uniqueVendorNames.length === 1) return uniqueVendorNames[0];
                      return '';
                    })();
                    return vName
                      ? <span style={{ fontWeight: 700, color: HC.ink }}>{vName}</span>
                      : <span style={naStyle}>N/A</span>;
                  })()}
                </td>
                <td style={{ ...TD(i) }}>
                  {isEditing ? (
                    <input type="text" placeholder="Product Type..." value={editForm.productType} onChange={e => setEditForm(p => ({ ...p, productType: e.target.value }))} style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}` }} />
                  ) : (
                    <EditableText readOnly={readOnly} align="left" placeholder="Product Type..."
                      value={r.productType} onCommit={v => updateTextValue(i, 'productType', v)}
                      display={r.productType ? <span style={{ fontWeight: 700 }}>{r.productType}</span> : <span style={naStyle}>N/A</span>} />
                  )}
                </td>
                <td style={{ ...TD(i), textAlign: 'center' }}>
                  {isEditing ? (
                    <input type="text" value={editForm.size} onChange={e => setEditForm(p => ({ ...p, size: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'center', boxSizing: 'border-box' }} />
                  ) : (
                    <EditableText readOnly={readOnly} align="center"
                      value={r.size} onCommit={v => updateTextValue(i, 'size', v)} display={fmtNA(r.size)} />
                  )}
                </td>
                <td style={{ ...TD(i), textAlign: 'center' }}>
                  {isEditing ? (
                    <input type="text" value={editForm.optional} onChange={e => setEditForm(p => ({ ...p, optional: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'center', boxSizing: 'border-box' }} />
                  ) : (
                    <EditableText readOnly={readOnly} align="center"
                      value={r.optional} onCommit={v => updateTextValue(i, 'optional', v)} display={fmtNA(r.optional)} />
                  )}
                </td>
                <td style={{ ...TDnum(i), fontWeight: 700, color: '#b45309' }}>
                  {isEditing ? (
                    <input type="number" step="0.01" value={editForm.pricing1} onChange={e => setEditForm(p => ({ ...p, pricing1: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'right', boxSizing: 'border-box' }} />
                  ) : <EditableNum readOnly={readOnly} value={r.pricing1} display={fmt$(r.pricing1)} onCommit={v => updateCellValue(i, 'pricing1', v)} />}
                </td>
                <td style={{ ...TDnum(i), fontWeight: 700, color: '#b45309' }}>
                  {isEditing ? (
                    <input type="number" step="0.01" value={editForm.pricing2} onChange={e => setEditForm(p => ({ ...p, pricing2: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'right', boxSizing: 'border-box' }} />
                  ) : <EditableNum readOnly={readOnly} value={r.pricing2} display={fmt$(r.pricing2)} onCommit={v => updateCellValue(i, 'pricing2', v)} />}
                </td>
                {shipMethods.map((m) => [
                  <td key={`${m.label}-price`} style={{ ...TDnum(i), color: HC.muted }}>
                    {isEditing ? (
                      <input type="number" step="0.01" value={editForm[m.priceKey]} onChange={e => setEditForm(p => ({ ...p, [m.priceKey]: e.target.value }))} style={{ width: '100%', padding: '4px 2px', fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'right', boxSizing: 'border-box' }} />
                    ) : <EditableNum readOnly={readOnly} value={r[m.priceKey]} display={fmt$(r[m.priceKey])} onCommit={v => updateCellValue(i, m.priceKey, v)} />}
                  </td>,
                  <td key={`${m.label}-item2`} style={{ ...TDnum(i), color: HC.muted }}>
                    {isEditing ? (
                      <input type="number" step="0.01" value={editForm[m.item2Key]} onChange={e => setEditForm(p => ({ ...p, [m.item2Key]: e.target.value }))} style={{ width: '100%', padding: '4px 2px', fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'right', boxSizing: 'border-box' }} />
                    ) : <EditableNum readOnly={readOnly} value={r[m.item2Key]} display={fmt$(r[m.item2Key])} onCommit={v => updateCellValue(i, m.item2Key, v)} />}
                  </td>,
                  <td key={`${m.label}-total`} style={{ ...TDnum(i), fontWeight: 700, color: r[m.totalKey] != null ? HC.success : HC.muted2 }}>
                    {isEditing ? (
                      <input type="number" step="0.01" value={editForm[m.totalKey]} onChange={e => setEditForm(p => ({ ...p, [m.totalKey]: e.target.value }))} style={{ width: '100%', padding: '4px 2px', fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'right', boxSizing: 'border-box', color: HC.success, fontWeight: 700 }} />
                    ) : <EditableNum readOnly={readOnly} value={r[m.totalKey]} display={fmt$(r[m.totalKey])} onCommit={v => updateCellValue(i, m.totalKey, v)} extraStyle={{ color: r[m.totalKey] != null ? HC.success : HC.muted2, fontWeight: 700 }} />}
                  </td>,
                ])}
                <td style={{ ...TD(i) }}>
                  {!readOnly ? (
                    <input
                      type="text"
                      placeholder="Dán link"
                      defaultValue={r.linkTemplate || ''}
                      onBlur={e => {
                        const v = e.target.value.trim();
                        if (v !== (r.linkTemplate || '')) updateLinkTemplate(i, v);
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                      style={{ width: '100%', padding: 5, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }}
                    />
                  ) : (() => {
                    const link = r.linkTemplate || '';
                    return link
                      ? <a href={link} target="_blank" rel="noreferrer" title={link} style={{ color: HC.orangeDark, textDecoration: 'underline', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔗 Template</a>
                      : <span style={{ color: HC.muted2 }}>—</span>;
                  })()}
                </td>
                {showActionsCol && (
                  <td style={{ ...TD(i), textAlign: 'center' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button onClick={() => saveEdit(i)} style={{ padding: '4px 8px', borderRadius: 4, background: HC.success, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Lưu</button>
                        <button onClick={() => setEditIdx(-1)} style={{ padding: '4px 8px', borderRadius: 4, background: HC.muted, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Hủy</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {showActions && (
                          <button onClick={() => startEdit(i, r)} style={{ padding: '4px 8px', borderRadius: 4, background: 'rgba(212,160,23,0.15)', color: HC.gold, border: `1px solid ${HC.goldLight}`, cursor: 'pointer', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>✏️ Sửa</button>
                        )}
                        {canDeleteRow && (
                          <button onClick={() => { if (window.confirm('Xóa dòng size này? Không thể hoàn tác.')) deleteRow(i); }} style={{ padding: '4px 8px', borderRadius: 4, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', cursor: 'pointer', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>🗑 Xóa</button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {/* Dòng thêm mới inline */}
          {!readOnly && addingRow && addForm && (
            <tr style={{ background: '#fffbeb', outline: `2px solid ${HC.orange}` }}>
              <td style={{ ...TD(processedRows.length), padding: '5px 6px' }}>
                <input type="text" placeholder="Ký hiệu..." value={addForm.kyHieu} onChange={e => setAddForm(p => ({ ...p, kyHieu: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.orange}`, boxSizing: 'border-box', fontWeight: 900, color: HC.orangeDark }} />
              </td>
              <td style={{ ...TD(processedRows.length), padding: '5px 6px' }}>
                <input type="text" placeholder="Product Type..." value={addForm.productType} onChange={e => setAddForm(p => ({ ...p, productType: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
              </td>
              <td style={{ ...TD(processedRows.length), padding: '5px 6px', textAlign: 'center' }}>
                <input type="text" placeholder="S/M/L..." value={addForm.size} onChange={e => setAddForm(p => ({ ...p, size: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'center', boxSizing: 'border-box' }} />
              </td>
              <td style={{ ...TD(processedRows.length), padding: '5px 6px', textAlign: 'center' }}>
                <input type="text" placeholder="..." value={addForm.optional} onChange={e => setAddForm(p => ({ ...p, optional: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'center', boxSizing: 'border-box' }} />
              </td>
              <td style={{ ...TD(processedRows.length), padding: '5px 6px', textAlign: 'right' }}>
                <input type="number" step="0.01" placeholder="0.00" value={addForm.pricing1} onChange={e => setAddForm(p => ({ ...p, pricing1: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'right', boxSizing: 'border-box', color: '#b45309', fontWeight: 700 }} />
              </td>
              <td style={{ ...TD(processedRows.length), padding: '5px 6px', textAlign: 'right' }}>
                <input type="number" step="0.01" placeholder="0.00" value={addForm.pricing2} onChange={e => setAddForm(p => ({ ...p, pricing2: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'right', boxSizing: 'border-box', color: '#b45309', fontWeight: 700 }} />
              </td>
              {shipMethods.map(m => [
                <td key={`nadd-${m.label}-p`} style={{ ...TD(processedRows.length), padding: '5px 6px', textAlign: 'right' }}>
                  <input type="number" step="0.01" placeholder="0.00" value={addForm[m.priceKey]} onChange={e => setAddForm(p => ({ ...p, [m.priceKey]: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'right', boxSizing: 'border-box' }} />
                </td>,
                <td key={`nadd-${m.label}-t`} style={{ ...TD(processedRows.length), padding: '5px 6px', textAlign: 'right' }}>
                  <input type="number" step="0.01" placeholder="0.00" value={addForm[m.totalKey]} onChange={e => setAddForm(p => ({ ...p, [m.totalKey]: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, textAlign: 'right', boxSizing: 'border-box', color: HC.success, fontWeight: 700 }} />
                </td>,
              ])}
              <td style={{ ...TD(processedRows.length), padding: '5px 6px' }}>
                <input type="text" placeholder="Link Template..." value={addForm.linkTemplate} onChange={e => setAddForm(p => ({ ...p, linkTemplate: e.target.value }))} style={{ width: '100%', padding: 4, fontSize: 11, borderRadius: 4, border: `1px solid ${HC.border}`, boxSizing: 'border-box' }} />
              </td>
              <td style={{ ...TD(processedRows.length), textAlign: 'center', padding: '5px 6px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button onClick={saveAddRow} style={{ padding: '4px 8px', borderRadius: 4, background: HC.success, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Lưu</button>
                  <button onClick={() => { setAddingRow(false); setAddForm(null); }} style={{ padding: '4px 8px', borderRadius: 4, background: HC.muted, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700 }}>Hủy</button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {!readOnly && !addingRow && (
        <button
          onClick={() => { setAddingRow(true); setAddForm(mkAddForm()); }}
          style={{ width: '100%', marginTop: 8, padding: '9px 0', borderRadius: 8, border: `1.5px dashed ${HC.orangeMid}`, background: HC.orangeLight, color: HC.orangeDark, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
        >➕ Thêm dòng size/giá</button>
      )}
    </div>
  );
}

// ── Single Library File Card ──────────────────────────────────────────────────
// Nút chia sẻ nhỏ trên header card — mũi tên cong sang phải (biểu tượng "share").
// Quyền xem theo project khai báo tường minh qua đây, không còn suy từ ký hiệu
// `P.xxx` trong tên file — nên đổi tên file (bên dưới, click vào tên) chỉ còn
// là đổi nhãn hiển thị, không ảnh hưởng project nào thấy file.
function ShareButton({ onClick, title }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label="Chia sẻ file cho project"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
        border: `1px solid ${hover ? HC.orangeMid : HC.border}`,
        background: hover ? HC.orangeLight : '#f4f4f5',
        color: hover ? HC.orangeDark : '#3f3f46',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0, transition: 'all 0.15s',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5V18a7.5 7.5 0 0 1 7.5-7.5h6" />
        <polyline points="13.5 6 18 10.5 13.5 15" />
      </svg>
    </button>
  );
}

function LibraryCard({ entry, idx = 0, onDelete, onUpdate, onShare, canShare, readOnly, selectable, selectedIds, onSelectRow, onSelectAll, bestSellerIds, toggleBestSeller, mode, highlighted, onSampleStatusChange }) {
  const [activeSection, setActiveSection] = useState('general');
  const [expanded, setExpanded] = useState(!!highlighted);
  const [hovered, setHovered] = useState(false);
  const [renamingFile, setRenamingFile] = useState(false);
  const [filenameDraft, setFilenameDraft] = useState('');

  // Đổi tên file (chỉ Vendor/Admin — canShare): giữ nguyên phần đuôi .xlsx/.xls gốc,
  // chỉ thay phần tên hiển thị (đã bỏ đuôi) mà người dùng gõ.
  const commitRename = () => {
    setRenamingFile(false);
    const trimmed = filenameDraft.trim();
    if (!trimmed) return;
    const ext = (entry.filename.match(/\.xlsx?$/i) || [''])[0];
    const newFilename = /\.xlsx?$/i.test(trimmed) ? trimmed : `${trimmed}${ext}`;
    if (newFilename !== entry.filename) onUpdate({ ...entry, filename: newFilename });
  };

  useEffect(() => {
    if (highlighted) setExpanded(true);
  }, [highlighted]);

  const fileRowIds = entry.generalInfo?.map(r => r.id) || [];

  const handleSelectAllInFile = () => {
    if (onSelectAll) onSelectAll(fileRowIds);
  };

  // Nhãn "ai thấy file này" — chỉ hiện cho người có quyền chia sẻ (Vendor/Admin).
  const sharedProjects = fileSharedProjects(entry);
  const shareLabel = (() => {
    if (!sharedProjects) return null; // file cũ: vẫn theo ký hiệu P.xxx trong tên
    if (sharedProjects.length === 0) return 'Mọi project';
    return sharedProjects
      .map(id => PROJECTS.find(p => p.id === id)?.label || id)
      .join(', ');
  })();

  const importDate = fmtVNDateTimeShort(entry.importedAt);

  // Badge: tên các vendor đang có trong phôi này (thay vì category) để nhìn nhanh phôi có vendor nào.
  const vendorNames = [...new Set((entry.generalInfo || []).map(r => r.vendorName).filter(Boolean))];
  const vendorNamesLabel = vendorNames.length ? vendorNames.join(', ') : entry.title;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12,
        border: `1.5px solid ${highlighted ? HC.orange : hovered ? HC.orangeMid : HC.border}`,
        boxShadow: highlighted ? `0 0 0 3px ${HC.orangeGlow}, 0 6px 20px rgba(0,0,0,0.09)` : hovered ? '0 6px 20px rgba(0,0,0,0.09)' : '0 1px 4px rgba(0,0,0,0.06)',
        overflow: 'hidden', marginBottom: 14,
        transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.18s',
        transform: hovered ? 'translateY(-1px)' : 'none',
        background: highlighted ? HC.orangePale || '#fffbeb' : '#fff',
      }}
    >
      {/* Card Header */}
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
        {/* File icon */}
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: HC.orangeLight,
          border: `1px solid ${HC.orangeMid}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, flexShrink: 0,
        }}>📄</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Filename — Vendor/Admin (canShare) bấm vào tên để đổi, không làm toggle mở rộng card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            {renamingFile ? (
              <input
                autoFocus
                size={Math.max(filenameDraft.length, 1)}
                value={filenameDraft}
                onChange={e => setFilenameDraft(e.target.value)}
                onClick={e => e.stopPropagation()}
                onBlur={commitRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
                  if (e.key === 'Escape') { e.preventDefault(); setRenamingFile(false); }
                }}
                style={{
                  fontWeight: 800, fontSize: 12.5, color: HC.ink,
                  fontFamily: "'Inter',sans-serif", flex: '0 1 auto', minWidth: 0, maxWidth: '100%',
                  padding: '2px 6px', borderRadius: 4, border: `1.5px solid ${HC.orange}`,
                  outline: 'none', background: '#fff',
                }}
              />
            ) : (
              <span
                onClick={canShare ? (e) => {
                  e.stopPropagation();
                  setFilenameDraft(entry.filename.replace(/\.xlsx?$/i, ''));
                  setRenamingFile(true);
                } : undefined}
                title={canShare ? 'Bấm để đổi tên file' : entry.filename}
                style={{
                  fontWeight: 800, fontSize: 12.5, color: HC.ink,
                  fontFamily: "'Inter',sans-serif",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  flex: 1, minWidth: 0,
                  cursor: canShare ? 'text' : 'default',
                }}
              >
                {entry.filename.replace(/\.xlsx?$/i, '')}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {mode === 'all' && entry.sourceTab === 'new_products' && isWithinCurrentWeek(entry.importedAt) && (
              <span style={{ padding: '1px 6px', borderRadius: 4, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mới</span>
            )}
            <span
              title={vendorNames.length ? `Vendor: ${vendorNamesLabel}` : entry.title}
              style={{
                padding: '2px 8px', borderRadius: 99,
                background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`,
                color: HC.orangeDark, fontSize: 9.5, fontWeight: 800,
                letterSpacing: '0.05em', textTransform: 'uppercase',
                maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >
              {vendorNamesLabel}
            </span>
            <span style={{ fontSize: 10.5, color: HC.muted }}>
              {importDate}
            </span>
            <span style={{ fontSize: 10.5, color: HC.muted2 }}>
              {entry.generalInfo?.length || 0} sản phẩm · {entry.pricing?.length || 0} dòng giá
            </span>
            {canShare && shareLabel && (
              <span
                title={`Project được xem file này: ${shareLabel}`}
                style={{
                  padding: '1px 8px', borderRadius: 99,
                  background: sharedProjects.length === 0 ? '#ecfdf5' : '#eff6ff',
                  border: `1px solid ${sharedProjects.length === 0 ? '#a7f3d0' : '#bfdbfe'}`,
                  color: sharedProjects.length === 0 ? '#047857' : '#1d4ed8',
                  fontSize: 9.5, fontWeight: 800, maxWidth: 260,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {sharedProjects.length === 0 ? '🌐 Mọi project' : `👥 ${shareLabel}`}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {canShare && (
            <ShareButton
              onClick={(e) => { e.stopPropagation(); onShare(entry); }}
              title={shareLabel
                ? `Chia sẻ file — đang cho: ${shareLabel}`
                : 'Chia sẻ file cho project (hiện đang theo ký hiệu P.xxx trong tên file)'}
            />
          )}
          {!readOnly && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
              title="Xóa file này"
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid #fecaca', background: '#fef2f2',
                color: '#dc2626', fontSize: 10.5, fontWeight: 700,
                cursor: 'pointer', transition: 'background 0.15s',
              }}
            >Xóa</button>
          )}
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{
              fontSize: 11, color: HC.orangeDark,
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              display: 'inline-block',
            }}>▾</span>
          </div>
        </div>
      </div>

      {expanded && (
        <div>
          {/* Section Tabs */}
          <div style={{ display: 'flex', gap: 0, background: HC.cream, borderBottom: `1.5px solid ${HC.border}` }}>
            {[
              { id: 'general', label: '📋 Thông tin chung về phôi', count: entry.generalInfo?.length },
              { id: 'pricing', label: '💰 Về giá', count: entry.pricing?.length },
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveSection(tab.id)} style={{
                padding: '11px 20px', border: 'none',
                borderBottom: activeSection === tab.id ? `2.5px solid ${HC.orange}` : '2.5px solid transparent',
                background: activeSection === tab.id ? HC.surface : 'transparent',
                color: activeSection === tab.id ? HC.orangeDark : HC.muted,
                fontSize: 12, fontWeight: activeSection === tab.id ? 900 : 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: "'Inter',sans-serif", transition: 'all 0.15s',
              }}>
                {tab.label}
                <span style={{
                  padding: '1px 8px', borderRadius: 99,
                  background: activeSection === tab.id ? HC.orangeLight : HC.border,
                  color: activeSection === tab.id ? HC.orangeDark : HC.muted,
                  fontSize: 10, fontWeight: 800,
                }}>
                  {tab.count ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Section Content */}
          <div style={{ background: HC.surface }}>
            {activeSection === 'general' && <GeneralInfoTable rows={entry.generalInfo} onSave={(newRows) => onUpdate({ ...entry, generalInfo: newRows })} readOnly={readOnly} selectable={selectable} selectedIds={selectedIds} onSelectRow={onSelectRow} onSelectAll={handleSelectAllInFile} bestSellerIds={bestSellerIds} toggleBestSeller={toggleBestSeller} mode={mode} onSampleStatusChange={onSampleStatusChange} />}
            {activeSection === 'pricing' && <PricingTable rows={entry.pricing} generalInfo={entry.generalInfo} onSave={(newRows) => onUpdate({ ...entry, pricing: newRows })} readOnly={readOnly} canDeleteRow={canShare} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Manual Add Modal ─────────────────────────────────────────────────────────
const inputSt = (extra = {}) => ({
  width: '100%', padding: '7px 10px', fontSize: 12,
  borderRadius: 6, border: `1.5px solid ${HC.border}`,
  fontFamily: "'Inter',sans-serif", color: HC.ink,
  background: '#fff', outline: 'none', boxSizing: 'border-box', ...extra,
});

const labelSt = {
  fontSize: 10.5, fontWeight: 800, color: HC.muted,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  marginBottom: 4, display: 'block',
};

function FieldGroup({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={labelSt}>{label}</label>
      {children}
    </div>
  );
}

function ManualAddModal({ onClose, onSave, mode }) {
  const [activeTab, setActiveTab] = useState('general');
  const [filename, setFilename] = useState('');
  const [title, setTitle] = useState('');
  const [saveError, setSaveError] = useState('');

  const mkGeneral = () => ({
    _key: `${Date.now()}_${Math.random()}`,
    vendorName: '', productType: '', kyHieu: '',
    linkFolder: '', chatLieu: '', chiTietSize: '',
    chiTietSizeImage: '', avgTimeVendor: '', avgTimeActual: '',
    notes: '', img0: '', img1: '', img2: '', img3: '',
  });

  const mkPricing = () => ({
    _key: `${Date.now()}_${Math.random()}`,
    kyHieu: '', productType: '', size: '', optional: '',
    pricing1: '', pricing2: '',
    eco_price: '', eco_total: '', eco_price_item2: '',
    ground_price: '', ground_total: '', ground_price_item2: '',
    express_price: '', express_total: '', express_price_item2: '',
    twoday_price: '', twoday_total: '', twoday_price_item2: '',
    overnight_price: '', overnight_total: '', overnight_price_item2: '',
    linkTemplate: '',
  });

  const [generalRows, setGeneralRows] = useState([mkGeneral()]);
  const [pricingRows, setPricingRows] = useState([mkPricing()]);

  const updateGeneral = (key, field, val) =>
    setGeneralRows(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r));

  const updatePricing = (key, field, val) =>
    setPricingRows(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r));

  const handleSave = () => {
    if (!filename.trim()) { setSaveError('Vui lòng nhập tên file.'); return; }
    setSaveError('');
    const ts = Date.now();
    const toNum = v => (v === '' || v === null || v === undefined) ? null : Number(v);

    const generalInfo = generalRows.map((r, i) => ({
      id: `manual_${ts}_${i}`,
      vendorName: r.vendorName,
      productType: r.productType || title,
      kyHieu: r.kyHieu,
      linkFolder: r.linkFolder,
      chatLieu: r.chatLieu,
      chiTietSize: r.chiTietSize,
      chiTietSizeImage: r.chiTietSizeImage,
      avgTimeVendor: r.avgTimeVendor,
      avgTimeActual: r.avgTimeActual,
      notes: r.notes,
      images: [r.img0, r.img1, r.img2, r.img3].filter(Boolean),
    }));

    const pricing = pricingRows.map((r, i) => ({
      id: `manual_p_${ts}_${i}`,
      kyHieu: r.kyHieu,
      productType: r.productType || title,
      size: r.size,
      optional: r.optional,
      pricing1: toNum(r.pricing1), pricing2: toNum(r.pricing2),
      eco_price: toNum(r.eco_price), eco_total: toNum(r.eco_total), eco_price_item2: toNum(r.eco_price_item2),
      ground_price: toNum(r.ground_price), ground_total: toNum(r.ground_total), ground_price_item2: toNum(r.ground_price_item2),
      express_price: toNum(r.express_price), express_total: toNum(r.express_total), express_price_item2: toNum(r.express_price_item2),
      twoday_price: toNum(r.twoday_price), twoday_total: toNum(r.twoday_total), twoday_price_item2: toNum(r.twoday_price_item2),
      overnight_price: toNum(r.overnight_price), overnight_total: toNum(r.overnight_total), overnight_price_item2: toNum(r.overnight_price_item2),
      linkTemplate: r.linkTemplate,
    }));

    onSave({
      id: `${ts}_${Math.random().toString(36).slice(2)}`,
      filename: filename.trim(),
      importedAt: new Date().toISOString(),
      title: title.trim() || filename.trim(),
      generalInfo,
      pricing,
      sourceTab: mode === 'new_products' ? 'new_products' : 'all',
    });
  };

  const shipMethods = [
    { label: 'Economy',   pk: 'eco_price',      tk: 'eco_total',      i2: 'eco_price_item2',      color: '#1d6b3a' },
    { label: 'Ground',    pk: 'ground_price',   tk: 'ground_total',   i2: 'ground_price_item2',   color: HC.orangeDark },
    { label: 'Express',   pk: 'express_price',  tk: 'express_total',  i2: 'express_price_item2',  color: '#1e4fa0' },
    { label: '2 Days',    pk: 'twoday_price',   tk: 'twoday_total',   i2: 'twoday_price_item2',   color: '#7c3aed' },
    { label: 'Overnight', pk: 'overnight_price',tk: 'overnight_total',i2: 'overnight_price_item2',color: '#b91c1c' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 1020, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', animation: 'scaleIn 0.2s ease-out' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: `linear-gradient(135deg, ${HC.orangeLight}, #fff)` }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: HC.ink, fontFamily: "'Inter',sans-serif" }}>➕ Thêm mới Vendor thủ công</div>
            <div style={{ fontSize: 11, color: HC.muted, marginTop: 2 }}>Nhập dữ liệu thủ công — sẽ hiển thị như file Excel đã import</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${HC.border}`, background: HC.surface, color: HC.muted, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* File Info */}
        <div style={{ padding: '14px 24px', borderBottom: `1.5px solid ${HC.border}`, background: HC.cream, flexShrink: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FieldGroup label="Tên file *">
              <input
                type="text" placeholder="VD: HC_Cap_NewVendor_01.xlsx"
                value={filename} onChange={e => { setFilename(e.target.value); setSaveError(''); }}
                style={inputSt({ borderColor: saveError ? '#dc2626' : HC.border })}
              />
              {saveError && <span style={{ fontSize: 10, color: '#dc2626', marginTop: 3 }}>{saveError}</span>}
            </FieldGroup>
            <FieldGroup label="Loại sản phẩm (Badge)">
              <input type="text" placeholder="VD: CAP, GENERAL MUG..." value={title} onChange={e => setTitle(e.target.value)} style={inputSt()} />
            </FieldGroup>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1.5px solid ${HC.border}`, flexShrink: 0 }}>
          {[
            { id: 'general', label: '📋 Thông tin chung về phôi', count: generalRows.length },
            { id: 'pricing', label: '💰 Về giá', count: pricingRows.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '11px 20px', border: 'none',
              borderBottom: activeTab === tab.id ? `2.5px solid ${HC.orange}` : '2.5px solid transparent',
              background: activeTab === tab.id ? HC.surface : 'transparent',
              color: activeTab === tab.id ? HC.orangeDark : HC.muted,
              fontSize: 12, fontWeight: activeTab === tab.id ? 900 : 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: "'Inter',sans-serif", transition: 'all 0.15s',
            }}>
              {tab.label}
              <span style={{ padding: '1px 8px', borderRadius: 99, background: activeTab === tab.id ? HC.orangeLight : HC.border, color: activeTab === tab.id ? HC.orangeDark : HC.muted, fontSize: 10, fontWeight: 800 }}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── General Info Tab ── */}
          {activeTab === 'general' && (
            <div>
              {generalRows.map((r, i) => (
                <div key={r._key} style={{ border: `1.5px solid ${HC.border}`, borderRadius: 10, padding: 16, marginBottom: 14, background: HC.surface }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, color: HC.orangeDark, fontFamily: "'Inter',sans-serif" }}>Dòng {i + 1}</span>
                    {generalRows.length > 1 && (
                      <button onClick={() => setGeneralRows(prev => prev.filter(x => x._key !== r._key))} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>✕ Xóa dòng</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr', gap: 12, marginBottom: 12 }}>
                    <FieldGroup label="Vendor Name"><input type="text" placeholder="Tên vendor..." value={r.vendorName} onChange={e => updateGeneral(r._key, 'vendorName', e.target.value)} style={inputSt()} /></FieldGroup>
                    <FieldGroup label="Product Type"><input type="text" placeholder="Loại sản phẩm..." value={r.productType} onChange={e => updateGeneral(r._key, 'productType', e.target.value)} style={inputSt()} /></FieldGroup>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <FieldGroup label="AVG TG (Vendor)"><input type="text" placeholder="VD: 3-5 ngày" value={r.avgTimeVendor} onChange={e => updateGeneral(r._key, 'avgTimeVendor', e.target.value)} style={inputSt({ color: HC.success })} /></FieldGroup>
                    <FieldGroup label="AVG TG (Thực tế)"><input type="text" placeholder="VD: 5-7 ngày" value={r.avgTimeActual} onChange={e => updateGeneral(r._key, 'avgTimeActual', e.target.value)} style={inputSt({ color: HC.warning })} /></FieldGroup>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <FieldGroup label="Chất liệu"><textarea rows={3} placeholder="Mô tả chất liệu..." value={r.chatLieu} onChange={e => updateGeneral(r._key, 'chatLieu', e.target.value)} style={{ ...inputSt(), resize: 'vertical' }} /></FieldGroup>
                    <FieldGroup label="Notes"><textarea rows={3} placeholder="Ghi chú..." value={r.notes} onChange={e => updateGeneral(r._key, 'notes', e.target.value)} style={{ ...inputSt(), resize: 'vertical' }} /></FieldGroup>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <FieldGroup label="URL Ảnh Size Guide"><input type="text" placeholder="https://..." value={r.chiTietSizeImage} onChange={e => updateGeneral(r._key, 'chiTietSizeImage', e.target.value)} style={inputSt()} /></FieldGroup>
                    <FieldGroup label="Chi tiết Size (text)"><input type="text" placeholder="VD: S/M/L/XL..." value={r.chiTietSize} onChange={e => updateGeneral(r._key, 'chiTietSize', e.target.value)} style={inputSt()} /></FieldGroup>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <FieldGroup label="Link Folder"><input type="text" placeholder="https://drive.google.com/..." value={r.linkFolder} onChange={e => updateGeneral(r._key, 'linkFolder', e.target.value)} style={inputSt()} /></FieldGroup>
                  </div>
                  <div>
                    <label style={labelSt}>Hình ảnh (URL)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {['img0','img1','img2','img3'].map((k, n) => (
                        <input key={k} type="text" placeholder={`Hình ${n + 1}`} value={r[k]} onChange={e => updateGeneral(r._key, k, e.target.value)} style={inputSt({ fontSize: 11 })} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setGeneralRows(prev => [...prev, mkGeneral()])}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: `1.5px dashed ${HC.orangeMid}`, background: HC.orangeLight, color: HC.orangeDark, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
              >+ Thêm dòng thông tin chung</button>
            </div>
          )}

          {/* ── Pricing Tab ── */}
          {activeTab === 'pricing' && (
            <div>
              {pricingRows.map((r, i) => (
                <div key={r._key} style={{ border: `1.5px solid ${HC.border}`, borderRadius: 10, padding: 16, marginBottom: 14, background: HC.surface }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontWeight: 800, fontSize: 12, color: HC.orangeDark, fontFamily: "'Inter',sans-serif" }}>Dòng giá {i + 1}</span>
                    {pricingRows.length > 1 && (
                      <button onClick={() => setPricingRows(prev => prev.filter(x => x._key !== r._key))} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>✕ Xóa dòng</button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                    <FieldGroup label="Product Type"><input type="text" placeholder="Loại sản phẩm..." value={r.productType} onChange={e => updatePricing(r._key, 'productType', e.target.value)} style={inputSt()} /></FieldGroup>
                    <FieldGroup label="Size"><input type="text" placeholder="S/M/L..." value={r.size} onChange={e => updatePricing(r._key, 'size', e.target.value)} style={inputSt({ textAlign: 'center' })} /></FieldGroup>
                    <FieldGroup label="Optional"><input type="text" placeholder="Optional..." value={r.optional} onChange={e => updatePricing(r._key, 'optional', e.target.value)} style={inputSt({ textAlign: 'center' })} /></FieldGroup>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                    <FieldGroup label="Pricing 1 (P1)"><input type="number" step="0.01" placeholder="0.00" value={r.pricing1} onChange={e => updatePricing(r._key, 'pricing1', e.target.value)} style={inputSt({ textAlign: 'right', color: '#b45309', fontWeight: 700 })} /></FieldGroup>
                    <FieldGroup label="Pricing 2 (P2)"><input type="number" step="0.01" placeholder="0.00" value={r.pricing2} onChange={e => updatePricing(r._key, 'pricing2', e.target.value)} style={inputSt({ textAlign: 'right', color: '#b45309', fontWeight: 700 })} /></FieldGroup>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <FieldGroup label="Link Template"><input type="text" placeholder="https://..." value={r.linkTemplate} onChange={e => updatePricing(r._key, 'linkTemplate', e.target.value)} style={inputSt()} /></FieldGroup>
                  </div>
                  <label style={labelSt}>Phí vận chuyển</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                    {shipMethods.map(m => (
                      <div key={m.label} style={{ border: `1.5px solid ${m.color}33`, borderRadius: 8, padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: '#fff' }}>
                        <div style={{ fontWeight: 800, fontSize: 10, color: m.color, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{m.label}</div>
                        <FieldGroup label="Price Ship"><input type="number" step="0.01" placeholder="0.00" value={r[m.pk]} onChange={e => updatePricing(r._key, m.pk, e.target.value)} style={inputSt({ fontSize: 11, textAlign: 'right' })} /></FieldGroup>
                        <FieldGroup label="Price Ship Item 2"><input type="number" step="0.01" placeholder="0.00" value={r[m.i2]} onChange={e => updatePricing(r._key, m.i2, e.target.value)} style={inputSt({ fontSize: 11, textAlign: 'right' })} /></FieldGroup>
                        <FieldGroup label="Total (fulfill)"><input type="number" step="0.01" placeholder="0.00" value={r[m.tk]} onChange={e => updatePricing(r._key, m.tk, e.target.value)} style={inputSt({ fontSize: 11, textAlign: 'right', color: HC.success, fontWeight: 700 })} /></FieldGroup>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <button
                onClick={() => setPricingRows(prev => [...prev, mkPricing()])}
                style={{ width: '100%', padding: 10, borderRadius: 8, border: `1.5px dashed ${HC.orangeMid}`, background: HC.orangeLight, color: HC.orangeDark, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
              >+ Thêm dòng giá</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: `1.5px solid ${HC.border}`, display: 'flex', justifyContent: 'flex-end', gap: 12, flexShrink: 0, background: HC.cream }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${HC.border}`, background: HC.surface, color: HC.ink, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Hủy</button>
          <button onClick={handleSave} style={{ padding: '9px 26px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: `0 4px 14px ${HC.orangeGlow}` }}>
            💾 Lưu Vendor
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
/**
 * @param {boolean} readOnly   không cho sửa dữ liệu trong bảng (Seller/Admin).
 * @param {boolean} canManage  vẫn được dùng các thao tác quản lý THƯ VIỆN (thêm
 *   vendor, tải template, import Excel, chia sẻ project) kể cả khi readOnly.
 *   Admin xem read-only nhưng có toàn quyền quản lý thư viện nên bật cờ này.
 */
export default function VendorLibraryViewer({ readOnly = false, canManage = false, mode = 'all', selectable = false, selectedIds, onSelectRow, onSelectAll, onLibraryLoaded, highlightFileId, onHighlightCleared }) {
  // rawFiles = dữ liệu gốc từ API (chưa filter theo product)
  const [rawFiles, setRawFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [showExportPicker, setShowExportPicker] = useState(false);
  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  // File đang mở hộp thoại "Chia sẻ cho project" (null = đóng)
  const [shareTarget, setShareTarget] = useState(null);
  const [sharingSave, setSharingSave] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);
  const highlightRef = useRef(null);
  // Bỏ qua đúng một tín hiệu realtime kế tiếp — dùng khi chính máy này vừa ghi
  // (xem effect đồng bộ ở dưới).
  const skipNextSyncRef = useRef(false);
  // Đang import/lưu thì KHÔNG cho refresh nền chen vào: nó vừa reset cờ
  // dataLoaded vừa thay rawFiles ngay dưới tay người dùng, làm thao tác ghi
  // đang chạy dở tính trên một danh sách khác.
  const writingRef = useRef(false);

  // libraryFiles = rawFiles đã filter theo product (chỉ trong readOnly + mode all)
  const libraryFiles = useMemo(() => {
    if (!readOnly || mode !== 'all') return rawFiles;
    // Nếu user có project (hoặc role admin) → project-based filter xử lý trong displayFiles,
    // không cần filter theo vendor được assign vào sản phẩm.
    const { skip, key: userProjectKey } = getCurrentUserProject();
    if (skip || userProjectKey) return rawFiles;
    try {
      const LS_PRODUCT_VENDORS = 'STAFF_PRODUCT_VENDORS_V1';
      const assigned = JSON.parse(localStorage.getItem(LS_PRODUCT_VENDORS) || '{}');
      const assignedIds = new Set();

      Object.values(assigned).forEach(list => {
        (list || []).forEach(v => {
          if (v.is_excel) assignedIds.add(v.excel_row_id || v.id);
        });
      });

      if (assignedIds.size === 0) return [];

      return rawFiles.map(file => {
        if (!file.generalInfo) return file;
        const filteredGeneral = file.generalInfo.filter(r => assignedIds.has(r.id));
        if (filteredGeneral.length === 0) return null;
        // Include both kyHieu and vendorName — pricing rows may use vendorName as their kyHieu tag
        const assignedKyHieus = new Set([
          ...filteredGeneral.map(r => r.kyHieu).filter(Boolean),
          ...filteredGeneral.map(r => (r.vendorName || '').trim()).filter(Boolean),
        ]);
        // Sticky kyHieu propagation: Excel format has kyHieu only on the first row of each vendor block.
        // Carry the last seen non-empty kyHieu forward so every row knows its vendor.
        const filteredPricing = (() => {
          if (assignedKyHieus.size === 0) return file.pricing || [];
          let lastKyHieu = '';
          return (file.pricing || []).filter(p => {
            const pk = (p.kyHieu || '').trim();
            if (pk) lastKyHieu = pk;
            const effective = pk || lastKyHieu;
            if (!effective) return true; // no vendor identifier at all — include
            return assignedKyHieus.has(effective);
          });
        })();
        return { ...file, generalInfo: filteredGeneral, pricing: filteredPricing };
      }).filter(Boolean);
    } catch { return rawFiles; }
  }, [rawFiles, readOnly, mode, dataLoaded]);

  useEffect(() => {
    if (highlightFileId && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, [highlightFileId, libraryFiles]);

  // Best Seller giờ lưu trên server (field `bestSeller` trong từng dòng generalInfo)
  // → derive trực tiếp từ dữ liệu fetch về, KHÔNG đọc localStorage nữa. Nhờ vậy
  // Vendor đánh dấu ⭐ thì Seller/CSF/PD (cùng fetch 1 blob) đều thấy.
  const bestSellerIds = useMemo(() => {
    const s = new Set();
    for (const f of rawFiles) {
      for (const r of (f.generalInfo || [])) {
        if (r && r.bestSeller) s.add(r.id);
      }
    }
    return s;
  }, [rawFiles]);

  // Toggle ⭐: cập nhật lạc quan trong bộ nhớ rồi gọi endpoint nhẹ chỉ sửa 1 field
  // trên server; lỗi thì hoàn tác. Cùng cơ chế với handleSampleStatusChange.
  const toggleBestSeller = useCallback(async (rowId) => {
    const next = !bestSellerIds.has(rowId);
    const apply = (val) => setRawFiles(prev => prev.map(f => ({
      ...f,
      generalInfo: (f.generalInfo || []).map(r => (r.id === rowId ? { ...r, bestSeller: val } : r)),
    })));
    apply(next);
    try {
      skipNextSyncRef.current = true; // tín hiệu của chính mình dội về — bỏ qua
      await vendorLibraryApi.setBestSeller(rowId, next);
    } catch (err) {
      apply(!next);
      showToast('error', `Không lưu được Best Seller: ${err?.response?.data?.message || err.message || 'lỗi kết nối'}`);
    }
  }, [bestSellerIds]);

  // Migrate 1 lần: các ⭐ Best Seller cũ chỉ nằm trong localStorage của máy Vendor.
  // Sau khi chuyển sang lưu server, đẩy các id cũ lên server đúng một lần (chỉ ở
  // view có quyền sửa = Vendor) rồi dọn key + đặt cờ đã-migrate để không chạy lại.
  const migratedRef = useRef(false);
  useEffect(() => {
    if (readOnly || !dataLoaded || migratedRef.current) return;
    if (localStorage.getItem('BEST_SELLER_MIGRATED_V1')) return;
    let legacyIds = [];
    try { legacyIds = JSON.parse(localStorage.getItem('BEST_SELLER_EXCEL_IDS_V1') || '[]'); } catch { legacyIds = []; }
    migratedRef.current = true;
    if (!legacyIds.length) {
      localStorage.setItem('BEST_SELLER_MIGRATED_V1', '1');
      return;
    }
    const known = new Set();
    const already = new Set();
    for (const f of rawFiles) for (const r of (f.generalInfo || [])) {
      known.add(r.id);
      if (r.bestSeller) already.add(r.id);
    }
    const toPush = legacyIds.filter(id => known.has(id) && !already.has(id));
    (async () => {
      for (const id of toPush) {
        try { await vendorLibraryApi.setBestSeller(id, true); } catch { /* bỏ qua từng id lỗi */ }
      }
      if (toPush.length) {
        const pushSet = new Set(toPush);
        setRawFiles(prev => prev.map(f => ({
          ...f,
          generalInfo: (f.generalInfo || []).map(r => (pushSet.has(r.id) ? { ...r, bestSeller: true } : r)),
        })));
      }
      localStorage.setItem('BEST_SELLER_MIGRATED_V1', '1');
      localStorage.removeItem('BEST_SELLER_EXCEL_IDS_V1');
    })();
  }, [readOnly, dataLoaded, rawFiles]);

  // File đã filter theo mode + search — dùng cho cả badge count lẫn list render
  const displayFiles = useMemo(() => {
    let files = libraryFiles;
    if (mode === 'bestseller' || mode === 'best_seller') {
      files = files.map(file => {
        if (!file.generalInfo) return file;
        return { ...file, generalInfo: file.generalInfo.filter(r => bestSellerIds.has(r.id)) };
      }).filter(file => file.generalInfo && file.generalInfo.length > 0);
    } else if (mode === 'new_products') {
      // Chỉ hiển thị file upload vào New Arrivals TRONG TUẦN hiện tại (từ thứ Hai).
      // Sang tuần mới, file cũ tự rời khỏi đây và về "Tổng quan" như file thường.
      files = files.filter(file => file.sourceTab === 'new_products' && isWithinCurrentWeek(file.importedAt));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      files = files.filter(file =>
        file.filename?.toLowerCase().includes(q) ||
        file.title?.toLowerCase().includes(q) ||
        (file.generalInfo || []).some(r => (r.productType || '').toLowerCase().includes(q)) ||
        (file.pricing || []).some(r => (r.productType || '').toLowerCase().includes(q))
      );
    }
    // Lọc theo project của user (chỉ áp dụng khi readOnly — Staff B/Admin thấy tất cả).
    // Tab "New Arrivals" (new_products): vendor upload lên đây phải hiển thị cho TẤT CẢ
    // project/seller, không lọc theo project.
    //
    // File đã được chia sẻ tường minh (`projects`) đi theo danh sách đó; file chưa
    // chia sẻ giữ NGUYÊN cách cũ là suy theo ký hiệu P.xxx trong tên file, nên các
    // project đang tra cứu không bị mất file nào khi tính năng này lên.
    if (readOnly && mode !== 'new_products') {
      const { skip, key: userProjectKey } = getCurrentUserProject();
      if (!skip && userProjectKey) {
        files = files.filter(file => fileVisibleToProject(file, userProjectKey));
      }
    }
    // File mới upload nhất lên đầu
    return [...files].sort((a, b) => {
      const ta = timeValue(a.importedAt);
      const tb = timeValue(b.importedAt);
      return tb - ta;
    });
  }, [libraryFiles, mode, bestSellerIds, searchQuery]);

  /**
   * @param {{ silent?: boolean }} opts
   *   silent = làm mới NỀN (realtime / quay lại tab). Bản đang hiển thị vẫn
   *   dùng được nên KHÔNG hạ `dataLoaded` và KHÔNG bật spinner.
   *
   * Vì sao quan trọng: mọi nút ghi đều chặn bằng `if (!dataLoaded)`. Trước
   * đây refresh nền hạ cờ này xuống ngay lập tức rồi mới gọi API, nên trong
   * lúc chờ mạng mọi thao tác ghi đều bị từ chối.
   *
   * Ca lỗi thật (2026-08-21, thư viện 92 file): bấm "Import thư viện Excel"
   * → hộp thoại chọn file của HĐH mở ra, cửa sổ trình duyệt MẤT focus; chọn
   * file xong hộp thoại đóng, cửa sổ LẤY LẠI focus → handler focus gọi
   * fetchLibrary → dataLoaded = false. Sự kiện change của input file bắn ra
   * ngay sau đó → handleImport thấy cờ false → "Dữ liệu thư viện chưa tải
   * xong. Vui lòng đợi rồi thử lại." Thư viện càng nhiều file, blob càng lâu
   * về, càng chắc chắn dính.
   */
  const fetchLibrary = useCallback(async ({ silent = false } = {}) => {
    setFetchError(null);
    if (!silent) setDataLoaded(false);
    try {
      const res = await vendorLibraryApi.get(mode);
      const data = Array.isArray(res.data) ? res.data : [];

      // Lưu raw data — filter theo product được thực hiện trong useMemo (libraryFiles)
      setRawFiles(data);
      setDataLoaded(true);
      if (onLibraryLoaded) onLibraryLoaded(data);
    } catch (err) {
      console.error('Error fetching vendor library:', err);
      // Làm mới nền hỏng thì im lặng bỏ qua: bản đang xem vẫn dùng được, không
      // việc gì phải dựng banner lỗi đỏ lên giữa lúc người dùng đang thao tác.
      if (!silent) {
        setFetchError(err?.response?.data?.message || err?.message || 'Không thể kết nối server. Vui lòng thử lại.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [mode, readOnly, onLibraryLoaded]);

  // ─── Đồng bộ thư viện (mục 16) ───────────────────────────────────────────
  // Trước đây chỉ tải lúc mount: sau khi Vendor import file mới, người đang mở
  // tab vẫn thấy bản cũ — và nếu họ mở bảng tính giá thì tính trên giá vốn cũ
  // mà không hay biết. Nay làm mới theo Pusher, và theo lượt quay lại tab để
  // bù cho trường hợp Pusher chưa cấu hình hoặc rớt kết nối.
  //
  // `skipNextRef`: chính máy này vừa ghi thì sự kiện của mình dội về, không
  // cần tải lại (state đã đúng) — tránh nhấp nháy bảng.
  useEffect(() => {
    fetchLibrary();

    // Lần tải đầu ở trên là loại KHÔNG silent (cần spinner + cờ dataLoaded).
    // Ba nguồn dưới đây đều là làm mới NỀN.
    const refreshInBackground = () => {
      if (writingRef.current) return; // đang import/lưu — đừng thay dữ liệu dưới tay người dùng
      fetchLibrary({ silent: true });
    };
    const refreshWhenVisible = () => { if (!document.hidden) refreshInBackground(); };
    const unsubscribe = subscribeVendorLibraryChanges(() => {
      if (skipNextSyncRef.current) { skipNextSyncRef.current = false; return; }
      refreshInBackground();
    });
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [fetchLibrary]);

  // Quản lý thư viện = thêm vendor / template / import Excel / chia sẻ project.
  // Vendor (không readOnly) và Admin (readOnly nhưng canManage) đều được.
  const canManageLibrary = !readOnly || canManage;

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const saveLibrary = async (newData) => {
    if (!dataLoaded) {
      showToast('error', 'Dữ liệu chưa được tải xong, không thể lưu. Vui lòng thử lại.');
      return false;
    }
    try {
      writingRef.current = true;
      skipNextSyncRef.current = true; // tín hiệu của chính mình dội về — bỏ qua
      await vendorLibraryApi.save(newData, mode);
      setRawFiles(newData);
      if (onLibraryLoaded) onLibraryLoaded(newData);
      return true;
    } catch (err) {
      console.error('Error saving vendor library:', err);
      showToast('error', `Lỗi lưu dữ liệu: ${err?.response?.data?.message || err.message || 'Không thể kết nối server'}`);
      return false;
    } finally {
      writingRef.current = false;
    }
  };

  const handleImport = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!files.length) return;

    if (!dataLoaded) {
      showToast('error', 'Dữ liệu thư viện chưa tải xong. Vui lòng đợi rồi thử lại.');
      return;
    }

    setImporting(true);
    writingRef.current = true;
    setImportErrors([]);
    const errors = [];
    const newEntries = [];

    for (const file of files) {
      if (!['xlsx', 'xls'].includes(file.name.split('.').pop().toLowerCase())) {
        errors.push(`${file.name}: Chỉ hỗ trợ file .xlsx / .xls`);
        continue;
      }
      try {
        const result = await parseHappyCreativeLibrary(file);
        newEntries.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          filename: file.name.replace(/\.xlsx?$/i, ''),
          importedAt: new Date().toISOString(),
          title: result.title,
          generalInfo: result.generalInfo,
          pricing: result.pricing,
          sourceTab: mode === 'new_products' ? 'new_products' : 'all',
          projects: [], // mặc định share MỌI project — cần giới hạn thì tự chia sẻ lại
        });
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    if (newEntries.length > 0) {
      const map = Object.fromEntries(libraryFiles.map(e => [e.filename, e]));
      newEntries.forEach(ne => { map[ne.filename] = ne; });
      const updated = Object.values(map);
      await saveLibrary(updated);
    }

    if (errors.length > 0 && newEntries.length === 0) {
      showToast('error', `Import thất bại`);
    }

    setImportErrors(errors);
    setImporting(false);
    writingRef.current = false;
  }, [libraryFiles, dataLoaded]);

  const handleExportSelected = async (selectedIds) => {
    const selectedFiles = displayFiles.filter((f) => selectedIds.includes(f.id));
    setExporting(true);
    try {
      await exportVendorLibraryFiles(selectedFiles, { includePricing: true });
      setShowExportPicker(false);
    } catch (err) {
      showToast('error', err.message || 'Xuất file thất bại');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = (id) => {
    setDeleteConfirm({ type: 'single', id });
  };

  const handleClearAll = () => {
    setDeleteConfirm({ type: 'all' });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'all') {
      await saveLibrary([]);
    } else if (deleteConfirm.type === 'single') {
      const updated = libraryFiles.filter(e => e.id !== deleteConfirm.id);
      await saveLibrary(updated);
    }
    setDeleteConfirm(null);
  };

  const handleUpdateEntry = async (updatedEntry) => {
    // Ở các tab lọc dòng (VD: Best Seller chỉ hiện dòng best-seller), generalInfo
    // truyền lên đây chỉ là tập ĐÃ LỌC. Ghi đè nguyên file bằng tập này sẽ xóa mất
    // các dòng đang bị ẩn → hợp nhất theo id với bản gốc (rawFiles) trước khi lưu.
    const rawEntry = rawFiles.find(e => e.id === updatedEntry.id);
    const merged = rawEntry
      ? { ...updatedEntry, generalInfo: mergeGeneralInfoById(rawEntry.generalInfo, updatedEntry.generalInfo) }
      : updatedEntry;
    const updated = rawFiles.map(e => e.id === merged.id ? merged : e);
    await saveLibrary(updated);
  };

  // Toggle trạng thái Sample: cập nhật lạc quan trong bộ nhớ (badge đổi ngay),
  // gọi endpoint nhẹ chỉ sửa 1 field trên server; lỗi thì hoàn tác lại.
  const handleSampleStatusChange = async (rowId, status) => {
    const applyStatus = (s) => setRawFiles(prev => prev.map(f => ({
      ...f,
      generalInfo: (f.generalInfo || []).map(r => (r.id === rowId ? { ...r, sampleStatus: s } : r)),
    })));
    applyStatus(status);
    try {
      skipNextSyncRef.current = true; // tín hiệu của chính mình dội về — bỏ qua
      await vendorLibraryApi.setSampleStatus(rowId, status);
    } catch (err) {
      applyStatus(status === 'has_sample' ? 'no_sample' : 'has_sample');
      showToast('error', `Không lưu được trạng thái sample: ${err?.response?.data?.message || err.message || 'lỗi kết nối'}`);
    }
  };

  // Lưu danh sách project được xem file — ghi thẳng field `projects` của file đó.
  // Mảng rỗng vẫn được ghi (khác với "chưa có field"): đó là ý "chia sẻ cho mọi
  // project", trong khi vắng field nghĩa là file cũ còn theo tên P.xxx.
  const handleShareSave = async (projects) => {
    if (!shareTarget) return;
    setSharingSave(true);
    const updated = rawFiles.map(f => (f.id === shareTarget.id ? { ...f, projects } : f));
    const saved = await saveLibrary(updated);
    setSharingSave(false);
    if (saved) setShareTarget(null);
  };

  const handleManualAdd = async (entry) => {
    const updated = [...rawFiles, entry];
    const saved = await saveLibrary(updated);
    if (saved) setShowManualAdd(false);
  };

  return (
    <div>
      {/* Hidden file input — multiple */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple
        style={{ display: 'none' }}
        onChange={handleImport}
      />

      <AppToast toast={toast} onClose={() => setToast(null)} />

      {showExportPicker && (
        <ExportVendorFilesModal
          HC={HC}
          files={displayFiles}
          exporting={exporting}
          onConfirm={handleExportSelected}
          onClose={() => setShowExportPicker(false)}
        />
      )}

      {/* Action Bar — nhóm nút (Export/Thêm mới/Template/Import) LUÔN ở hàng đầu,
          bên phải, giống hệt vị trí ở role Vendor. Filter theo sản phẩm (chỉ có ở
          role readOnly như Admin/Seller) không được đẩy cả nhóm nút xuống hàng
          dưới — nếu thiếu chỗ thì phần filter/search tự xuống dòng RIÊNG trong khu
          bên trái, không đụng vào nhóm nút bên phải. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'nowrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink, fontFamily: "'Inter',sans-serif" }}>
            {(mode === 'bestseller' || mode === 'best_seller') ? 'Danh sách Vendor Best Seller' : mode === 'new_products' ? 'New Arrivals' : 'Tổng quan Vendor & Sản phẩm'}
          </div>
          <span style={{ padding: '2px 12px', borderRadius: 99, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, color: HC.orangeDark, fontSize: 11, fontWeight: 800 }}>
            {displayFiles.length} file
          </span>
          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Tìm theo tên file hoặc loại sản phẩm..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: 12, paddingRight: searchQuery ? 30 : 12, paddingTop: 7, paddingBottom: 7,
                borderRadius: 20, border: `1.5px solid ${HC.borderStrong}`,
                background: HC.surface, color: HC.ink, fontSize: 12,
                fontFamily: "'Inter',sans-serif", outline: 'none',
                width: 280, transition: 'border-color 0.15s, box-shadow 0.15s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}
              onFocus={e => { e.target.style.borderColor = HC.orangeDark; e.target.style.boxShadow = `0 0 0 3px ${HC.orangeGlow}`; }}
              onBlur={e => { e.target.style.borderColor = HC.borderStrong; e.target.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', color: HC.muted, fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
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
          {canManageLibrary && (
          <>
            <button
              onClick={() => setShowManualAdd(true)}
              style={{
                padding: '9px 18px', borderRadius: 10,
                border: `1.5px solid ${HC.orangeMid}`,
                background: HC.orangeLight, color: HC.orangeDark,
                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all 0.15s',
              }}
            >
              ➕ Thêm mới vendor
            </button>
            <button
              onClick={() => downloadVendorLibraryTemplate()}
              title="Tải file Excel mẫu — điền vào rồi import ngược lên"
              style={{
                padding: '9px 18px', borderRadius: 10,
                border: `1.5px solid ${HC.border}`,
                background: HC.surface, color: HC.ink,
                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7,
                transition: 'all 0.15s',
              }}
            >
              📄 Template mẫu
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: importing ? HC.muted2 : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', fontSize: 12, fontWeight: 800, cursor: importing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {importing ? 'Đang import...' : 'Import thư viện Excel'}
            </button>
          </>
          )}
        </div>
      </div>

      {/* API fetch error banner */}
      {fetchError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#b91c1c', marginBottom: 3 }}>⚠️ Không thể tải dữ liệu thư viện</div>
            <div style={{ fontSize: 11, color: '#991b1b' }}>{fetchError}</div>
          </div>
          <button onClick={fetchLibrary} style={{ padding: '6px 14px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>↺ Thử lại</button>
        </div>
      )}

{/* Import Errors */}
      {importErrors.length > 0 && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1.5px solid #fecaca' }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: '#b91c1c', marginBottom: 6 }}>⚠️ Có {importErrors.length} file lỗi:</div>
          {importErrors.map((err, i) => (
            <div key={i} style={{ fontSize: 11, color: '#991b1b', marginTop: 3 }}>• {err}</div>
          ))}
        </div>
      )}



      {/* Library list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {(() => {
          if (loading) {
             return <div style={{ textAlign: 'center', padding: 40, color: HC.muted }}>Đang tải thư viện...</div>;
          }

          if (displayFiles.length === 0) {
            const isSearch = !!searchQuery.trim();
            return (
              <div style={{ padding: 40, textAlign: 'center', background: HC.surface, borderRadius: 16, border: `2px dashed ${HC.border}` }}>
                <div style={{ fontSize: 40, opacity: 0.5, marginBottom: 10 }}>{isSearch ? '🔍' : (mode === 'bestseller' || mode === 'best_seller') ? '⭐' : '📂'}</div>
                <div style={{ fontWeight: 800, color: HC.muted, fontSize: 14 }}>
                  {isSearch ? `Không tìm thấy file nào khớp với "${searchQuery}"` : (mode === 'bestseller' || mode === 'best_seller') ? 'Chưa có sản phẩm nào được đánh dấu Best Seller' : 'Chưa có thư viện vendor mới'}
                </div>
                {isSearch
                  ? <button onClick={() => setSearchQuery('')} style={{ marginTop: 12, padding: '6px 16px', borderRadius: 20, border: `1px solid ${HC.borderStrong}`, background: HC.surface, color: HC.muted, fontSize: 12, cursor: 'pointer' }}>Xóa tìm kiếm</button>
                  : (mode === 'bestseller' || mode === 'best_seller') && <div style={{ fontSize: 12, color: HC.muted2, marginTop: 6 }}>Hãy vào "Tổng quan Vendor & Sản phẩm" và click biểu tượng ⭐ trên sản phẩm để đánh dấu.</div>
                }
              </div>
            );
          }

          return displayFiles.map((entry, idx) => (
            <div key={entry.id} ref={highlightFileId === entry.id ? highlightRef : null}>
              <LibraryCard
                entry={entry}
                idx={idx}
                onDelete={handleDelete}
                onUpdate={handleUpdateEntry}
                onShare={setShareTarget}
                canShare={canManageLibrary}
                readOnly={readOnly}
                selectable={selectable}
                selectedIds={selectedIds}
                onSelectRow={onSelectRow}
                onSelectAll={onSelectAll}
                bestSellerIds={bestSellerIds}
                toggleBestSeller={toggleBestSeller}
                mode={mode}
                highlighted={highlightFileId === entry.id}
                onSampleStatusChange={handleSampleStatusChange}
              />
            </div>
          ));
        })()}
      </div>

      {/* Share to projects Modal */}
      {shareTarget && (
        <ShareProjectsModal
          HC={HC}
          entry={shareTarget}
          saving={sharingSave}
          onConfirm={handleShareSave}
          onClose={() => { if (!sharingSave) setShareTarget(null); }}
        />
      )}

      {/* Manual Add Modal */}
      {showManualAdd && (
        <ManualAddModal
          mode={mode}
          onClose={() => setShowManualAdd(false)}
          onSave={handleManualAdd}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ background: '#fff', padding: 24, borderRadius: 12, width: 400, boxShadow: HC.shadowStrong, animation: 'scaleIn 0.2s ease-out' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: 18, color: '#dc2626', fontFamily: "'Inter',sans-serif" }}>Xác nhận xóa</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: 14, color: HC.muted, lineHeight: 1.5 }}>
              {deleteConfirm.type === 'all' 
                ? `Bạn có chắc chắn muốn xóa toàn bộ ${rawFiles.length} file thư viện? Hành động này không thể hoàn tác.`
                : 'Bạn có chắc chắn muốn xóa file thư viện này? Hành động này không thể hoàn tác.'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 16px', borderRadius: 8, background: HC.surface, border: `1px solid ${HC.border}`, color: HC.ink, cursor: 'pointer', fontWeight: 700 }}>Hủy</button>
              <button onClick={executeDelete} style={{ padding: '8px 16px', borderRadius: 8, background: '#dc2626', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>Xác nhận xóa</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
