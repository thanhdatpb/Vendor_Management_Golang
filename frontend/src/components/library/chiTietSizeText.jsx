// ════════════════════════════════════════════════════════════════════════════
//  Render ô "Chi tiết Size" — dùng chung cho Vendor/Admin và các view read-only.
//
//  Tách khỏi VendorLibraryViewer.jsx vì lý do KÍCH THƯỚC BUNDLE: view của
//  CSF/PD/Marvel chỉ cần đúng hàm `renderChiTietSizeText`, nhưng import nó từ
//  viewer là kéo theo cả chunk viewer (~206 KB) vào đường tải của ba bộ phận
//  chỉ-đọc — những người không bao giờ mở màn hình quản lý thư viện.
//
//  Viewer vẫn re-export hàm này để mọi nơi gọi cũ không phải đổi.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';

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

/**
 * Render text "Chi tiết Size": thay từng link docs.google.com bằng chip logo
 * gọn, giữ nguyên phần text còn lại (kể cả xuống dòng, nhờ
 * `whiteSpace: pre-wrap` ở ô cha).
 */
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
