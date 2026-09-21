export const isGoogleDriveUrl = (url) =>
  typeof url === 'string' && /(?:drive|docs)\.google\.com/i.test(url);

export const isYouTubeUrl = (url) =>
  typeof url === 'string' && /(?:youtube\.com|youtu\.be)/i.test(url);

export const isSizeGuideMediaUrl = (url) =>
  isGoogleDriveUrl(url) ||
  (typeof url === 'string' && /^https?:\/\//i.test(url) && /\.(?:jpeg|jpg|gif|png)(?:[?#].*)?$/i.test(url));

/**
 * Chuẩn hoá link media ngoài để dùng làm fallback khi URL không tải được như ảnh.
 * Chỉ cho phép HTTP(S), đồng thời lấy phần đầu hostname làm nhãn ngắn gọn:
 * `printwayfulfillment.jp.larksuite.com` → `printwayfulfillment`.
 */
export const getExternalMediaLink = (url) => {
  if (typeof url !== 'string' || !url.trim()) return null;

  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

    const hostnameParts = parsed.hostname.replace(/\.$/, '').split('.').filter(Boolean);
    if (hostnameParts[0]?.toLowerCase() === 'www') hostnameParts.shift();

    return {
      href: parsed.href,
      label: hostnameParts[0] || parsed.hostname || 'Liên kết',
    };
  } catch {
    return null;
  }
};

// Production từng lưu URL upload theo APP_URL (ví dụ http://localhost/storage/...).
// Luôn đưa asset storage về cùng origin để browser gọi đúng Vendor Hub hiện tại.
//
// Ảnh Vendor Library LUÔN phải đi qua route xác thực /api/vendor-library/images/{file}
// — bất kể đang lưu ở đĩa server ('/storage/vendor-library/...') hay object storage
// (Cloudflare R2/S3, URL dạng 'https://<bucket-host>/vendor-library/...' KHÔNG có tiền
// tố '/storage/'). Bắt theo segment '/vendor-library/' bất kể host đứng trước, để không
// bỏ sót case R2 — bỏ sót sẽ lộ ảnh thẳng qua URL công khai của R2, không cần đăng nhập.
export const normalizeVendorMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();

  const vendorLibraryMatch = trimmed.match(/\/vendor-library\/([^/?#]+)(?:[?#]|$)/i);
  if (vendorLibraryMatch) {
    return `/api/vendor-library/images/${encodeURIComponent(decodeURIComponent(vendorLibraryMatch[1]))}`;
  }

  const storageIndex = trimmed.toLowerCase().indexOf('/storage/');
  if (storageIndex >= 0) return trimmed.slice(storageIndex);

  return trimmed;
};
