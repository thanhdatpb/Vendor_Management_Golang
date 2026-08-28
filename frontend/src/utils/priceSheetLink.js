// ════════════════════════════════════════════════════════
//  LINK RIÊNG CHO 1 BẢNG TÍNH GIÁ — /price-sheets/:id
//  Dùng ở cả danh sách Seller, danh sách Admin và header PriceSheetPage.
// ════════════════════════════════════════════════════════

export const priceSheetPath = (id) => `/price-sheets/${id}`;

export const priceSheetUrl = (id) => `${window.location.origin}${priceSheetPath(id)}`;

/**
 * Copy link vào clipboard. Clipboard API (`navigator.clipboard`) cần HTTPS/
 * secure context — fallback `textarea` + `execCommand` cho HTTP nội bộ / trình
 * duyệt cũ, để nút Copy không câm lặng thất bại trên môi trường đó.
 */
export async function copyPriceSheetLink(id) {
  const url = priceSheetUrl(id);

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
