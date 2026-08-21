export const isGoogleDriveUrl = (url) =>
  typeof url === 'string' && /(?:drive|docs)\.google\.com/i.test(url);

export const isYouTubeUrl = (url) =>
  typeof url === 'string' && /(?:youtube\.com|youtu\.be)/i.test(url);

export const isSizeGuideMediaUrl = (url) =>
  isGoogleDriveUrl(url) ||
  (typeof url === 'string' && /^https?:\/\//i.test(url) && /\.(?:jpeg|jpg|gif|png)(?:[?#].*)?$/i.test(url));

// Production từng lưu URL upload theo APP_URL (ví dụ http://localhost/storage/...).
// Luôn đưa asset storage về cùng origin để browser gọi đúng Vendor Hub hiện tại.
export const normalizeVendorMediaUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  const storageIndex = trimmed.toLowerCase().indexOf('/storage/');
  if (storageIndex >= 0) {
    const storagePath = trimmed.slice(storageIndex);
    const match = storagePath.match(/^\/storage\/vendor-library\/([^/?#]+)/i);
    if (match) return `/api/vendor-library/images/${encodeURIComponent(decodeURIComponent(match[1]))}`;
    return storagePath;
  }
  return trimmed;
};
