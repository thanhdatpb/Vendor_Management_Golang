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

  return {
    id: decodeURIComponent(matched[1]),
    slug: matched[2] ? decodeURIComponent(matched[2]) : '',
  };
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
