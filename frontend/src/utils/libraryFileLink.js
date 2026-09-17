// ════════════════════════════════════════════════════════
//  LINK RIÊNG CHO 1 FILE THƯ VIỆN VENDOR — /library/:fileId
//
//  Cùng khuôn với utils/priceSheetLink.js (link của bảng tính giá): dùng ở
//  danh sách thư viện, cửa sổ file, và nút "Mở file" trong chuông thông báo.
//
//  URL trung lập với role — người gửi không cần biết người nhận là Admin,
//  Seller, CSF hay PD; server quyết định họ thấy gì (giá, AVG TG, phạm vi
//  project) khi mở link.
// ════════════════════════════════════════════════════════

/** Tiền tố dùng cho link tra theo TÊN file (link cũ trong mail chỉ có tên). */
export const LIBRARY_BY_NAME = 'by-name';

const decodePathPart = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

/**
 * Phần slug đọc được trong URL — chỉ để người đọc biết đang là file nào khi
 * link dán vào Slack. KHÔNG dùng để tra cứu: file luôn tìm theo id.
 * Bỏ dấu tiếng Việt, hạ chữ thường, gom mọi ký tự lạ thành "-".
 */
export const libraryFileSlug = (filename = '') =>
  String(filename)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\.xlsx?$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');

/**
 * Đường dẫn chuẩn của một file. `filename` là tuỳ chọn — không có thì link vẫn
 * mở đúng, chỉ khó đọc hơn.
 */
export const libraryFilePath = (id, filename) => {
  const base = `/library/${encodeURIComponent(String(id ?? ''))}`;
  const slug = libraryFileSlug(filename);
  return slug ? `${base}/${slug}` : base;
};

/** Đường dẫn tra theo TÊN file — trang sẽ tự chuyển hướng sang dạng chuẩn. */
export const libraryFileByNamePath = (filename) =>
  `/library/${LIBRARY_BY_NAME}/${encodeURIComponent(String(filename ?? ''))}`;

/**
 * Đọc link file từ một pathname. Trả `null` nếu URL hiện tại không phải link
 * file — danh sách dùng hàm này để biết có phải mở cửa sổ hay không, thay vì
 * mỗi nơi tự viết một regex khác nhau.
 *
 * @returns {{ id: string, slug: string }|null}
 */
export const parseLibraryFilePath = (pathname = '') => {
  const matched = String(pathname).match(/^\/library\/([^/]+)(?:\/([^/]*))?\/?$/);
  if (!matched) return null;

  const id = decodePathPart(matched[1]);
  const slug = matched[2] ? decodePathPart(matched[2]) : '';
  if (id === null || slug === null) return null;

  return {
    id,
    slug,
  };
};

/**
 * Đọc MỘT đoạn chữ người dùng dán vào (ô "Dán link file" khi cung cấp vendor).
 *
 * Nhận link đầy đủ (mọi origin — dev, staging, production), đường dẫn tương
 * đối, có hoặc không có slug, kèm `?row=<id phôi>`, và dạng cũ `by-name`.
 *
 * @returns {{ kind: 'file', key: string, id: string, rowId: string|null, raw: string }
 *          |{ kind: 'name', key: string, filename: string, rowId: string|null, raw: string }
 *          |{ kind: 'invalid', key: string, reason: 'price-sheet'|'not-library', raw: string }}
 */
export const parseLibraryFileToken = (token = '') => {
  const raw = String(token).trim();
  let pathname = raw;
  let search = '';
  try {
    const url = new URL(raw, 'http://placeholder.local');
    pathname = url.pathname;
    search = url.search;
  } catch {
    // giữ nguyên chuỗi gốc — regex bên dưới sẽ trả về invalid
  }

  const rowId = new URLSearchParams(search).get('row') || null;
  const byName = pathname.match(/^\/library\/by-name\/(.+?)\/?$/);
  if (byName) {
    const filename = decodePathPart(byName[1]);
    if (filename !== null) {
      return { kind: 'name', key: `name:${filename.toLowerCase()}`, filename, rowId, raw };
    }
  }

  const parsed = parseLibraryFilePath(pathname);
  if (parsed?.id) return { kind: 'file', key: parsed.id, id: parsed.id, rowId, raw };

  const reason = /\/price-sheets\//.test(pathname) ? 'price-sheet' : 'not-library';
  return { kind: 'invalid', key: `invalid:${raw}`, reason, raw };
};

/**
 * Đọc cả ô dán link: mỗi dòng (hoặc mỗi đoạn cách nhau bởi khoảng trắng) là
 * một link. Link trùng file được gộp làm một; nếu một bản trỏ cả file và một
 * bản chỉ trỏ một phôi (`?row=`) thì lấy cả file.
 *
 * @returns {{ links: ReturnType<typeof parseLibraryFileToken>[], duplicates: number }}
 */
export const parseLibraryFileLinks = (text = '') => {
  const byKey = new Map();
  let duplicates = 0;
  String(text).split(/\s+/).filter(Boolean).forEach((token) => {
    const link = parseLibraryFileToken(token);
    const seen = byKey.get(link.key);
    if (!seen) {
      byKey.set(link.key, link);
      return;
    }
    duplicates += 1;
    if (seen.rowId && !link.rowId) byKey.set(link.key, { ...seen, rowId: null });
  });
  return { links: [...byKey.values()], duplicates };
};

/**
 * Đích của nút "Mở file" trong một thông báo `library_updated`.
 *
 * Ưu tiên `file_id` (thông báo phát từ 2026-09 trở đi). Thông báo cũ chỉ mang
 * `filename` — đi đường tra theo tên, trang sẽ tự chuyển sang dạng chuẩn.
 * Trả `null` nếu thông báo không trỏ tới file nào (ví dụ loại gộp "N file vừa
 * cập nhật", cố ý không kèm tên file).
 *
 * Nhận cả bản đã phẳng hoá của dashboard lẫn bản còn nguyên `data` từ API.
 */
export const libraryTargetFromNotification = (notification) => {
  const data = notification?.data && typeof notification.data === 'object' ? notification.data : {};
  const id = notification?.file_id || data.file_id;
  const filename = notification?.filename || data.filename;

  if (id) return libraryFilePath(id, filename);
  return filename ? libraryFileByNamePath(filename) : null;
};

export const libraryFileUrl = (id, filename) =>
  `${window.location.origin}${libraryFilePath(id, filename)}`;

/**
 * Copy link vào clipboard, trả về chính URL đã copy.
 *
 * `navigator.clipboard` cần secure context (HTTPS hoặc localhost) — fallback
 * `textarea` + `execCommand` cho HTTP nội bộ và trình duyệt cũ, để nút Copy
 * không câm lặng thất bại ở đó. Giữ nguyên cách làm của priceSheetLink.js.
 */
export async function copyLibraryFileLink(id, filename) {
  const url = libraryFileUrl(id, filename);

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return url;
    } catch {
      // rơi xuống fallback bên dưới
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
  return url;
}
