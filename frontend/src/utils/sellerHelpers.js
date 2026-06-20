// ════════════════════════════════════════════════════════
//  SELLER HELPERS — Utility functions dùng chung
//  xlsx được import DYNAMIC — chỉ load khi user click Export
// ════════════════════════════════════════════════════════
import { API_BASE_URL, LS_A_SELECTIONS } from '../constants/sellerTheme';

// ─── LocalStorage helpers ────────────────────────────────
export const lsGet = (key, fallback) => {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
};
export const lsSet = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// ─── Date formatter ─────────────────────────────────────
export const fmtDate = iso => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return iso; }
};

// ─── DateTime formatter (date + HH:MM) ──────────────────
export const fmtDateTime = iso => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('vi-VN');
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { date, time };
  } catch { return { date: iso, time: '' }; }
};

// ─── Media URL helpers ───────────────────────────────────
export const getMediaUrls = (product) => {
  if (!product) return [];
  let urls = [];

  if (product.media_urls && Array.isArray(product.media_urls) && product.media_urls.length) {
    urls = urls.concat(product.media_urls.map(url =>
      url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
    ));
  } else if (product.media_url) {
    const full = product.media_url.startsWith('http')
      ? product.media_url
      : `${API_BASE_URL}${product.media_url.startsWith('/') ? '' : '/'}${product.media_url}`;
    urls.push(full);
  } else if (product.media_path) {
    let cleanPath = product.media_path;
    if (cleanPath.startsWith('storage/')) cleanPath = cleanPath.replace('storage/', '');
    if (cleanPath.startsWith('/storage/')) cleanPath = cleanPath.replace('/storage/', '');
    urls.push(`${API_BASE_URL}/storage/${cleanPath}`);
  }

  if (product.product_type_links && Array.isArray(product.product_type_links)) {
    urls = urls.concat(product.product_type_links);
  } else if (product.product_type_link) {
    urls.push(product.product_type_link);
  } else if (typeof product.product_type_links === 'string') {
    try {
      urls = urls.concat(JSON.parse(product.product_type_links));
    } catch {
      urls.push(product.product_type_links);
    }
  }

  return [...new Set(urls)].filter(url => typeof url === 'string' && url.trim() !== '');
};

export const getMediaUrl = (product) => {
  const urls = getMediaUrls(product);
  return urls.length ? urls[0] : null;
};

// Chỉ trả về ảnh/video upload (media_urls / media_url / media_path) — không gộp product_type_links
export const getProductImages = (product) => {
  if (!product) return [];
  let urls = [];
  if (product.media_urls && Array.isArray(product.media_urls) && product.media_urls.length) {
    urls = product.media_urls.map(url =>
      url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
    );
  } else if (product.media_url) {
    const full = product.media_url.startsWith('http')
      ? product.media_url
      : `${API_BASE_URL}${product.media_url.startsWith('/') ? '' : '/'}${product.media_url}`;
    urls.push(full);
  } else if (product.media_path) {
    let cleanPath = product.media_path;
    if (cleanPath.startsWith('storage/')) cleanPath = cleanPath.replace('storage/', '');
    if (cleanPath.startsWith('/storage/')) cleanPath = cleanPath.replace('/storage/', '');
    urls.push(`${API_BASE_URL}/storage/${cleanPath}`);
  }
  return [...new Set(urls)].filter(u => typeof u === 'string' && u.trim() !== '');
};

// Chỉ trả về product_type_links (link tham khảo) — không gộp ảnh upload
export const getProductLinks = (product) => {
  if (!product) return [];
  let links = [];
  if (product.product_type_links && Array.isArray(product.product_type_links)) {
    links = product.product_type_links;
  } else if (typeof product.product_type_links === 'string') {
    try { links = JSON.parse(product.product_type_links); } catch { links = [product.product_type_links]; }
  } else if (product.product_type_link) {
    links = [product.product_type_link];
  }
  return links.filter(u => typeof u === 'string' && u.trim() !== '');
};

// ─── Excel Export (async — xlsx ~500KB chỉ load khi cần) ──
export async function exportProductsToExcel(products, productVendors, filename) {
  // Dynamic import: chỉ tải xlsx khi user click nút Export
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default ?? xlsxModule;

  filename = filename || 'products.xlsx';
  productVendors = productVendors || {};

  const bdr = {
    top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
    left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } },
  };
  const hStyle = (bg) => ({
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Arial' },
    fill: { fgColor: { rgb: bg || 'F59E0B' }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: bdr,
  });
  const dStyle = (even, txtRgb, center) => ({
    font: { sz: 10, name: 'Arial', color: { rgb: txtRgb || '3D2B0F' } },
    fill: { fgColor: { rgb: even ? 'FFFBF4' : 'FFFFFF' }, patternType: 'solid' },
    alignment: { horizontal: center ? 'center' : 'left', vertical: 'center', wrapText: true }, border: bdr,
  });
  const fmtNum = v => (v !== null && v !== undefined && v !== '') ? Number(v).toFixed(2) : '';

  const PROD_COLS = [
    'Date Request', 'Deadline Date', 'Product Type', 'Image',
    'Product Type Link', 'Đặc tính kĩ thuật', 'Chất liệu',
    'Vùng In/Thiết kế', 'Good Review', 'Bad Review',
    'Packing', 'Other Packing', 'Approve the request',
  ];

  const row1 = ['No', 'Seller', ...Array(12).fill('')];
  const row2 = ['', ...PROD_COLS];
  const prodRows = products.map((p, i) => {
    const img = getMediaUrl(p) || '';
    return [
      i + 1, fmtDate(p.created_at) || '', fmtDate(p.deadline_date) || '',
      p.product_type || '', img, p.product_type_link || '',
      p.other_specs || '', p.material || '', p.print_area || '',
      p.good_review || '', p.bad_review || '',
      p.packaging_links || '', p.other_packaging || '', p.status || 'draft',
    ];
  });

  const vHdr1 = ['Z', 'Vendor Type', 'Detail', '', 'Pricing', '', 'Economy', '', 'Fast', '', 'Express', '', 'Overnight', ''];
  const vHdr2 = ['', '', 'Size', 'Optional', 'Pricing 1', 'Pricing 2', 'Ship', 'Total', 'Ship', 'Total', 'Ship', 'Total', 'Ship', 'Total'];

  const vendorRows = products
    .filter(p => { const vendors = productVendors[p.id]; return vendors && vendors.length > 0; })
    .map(p => {
      const vendors = productVendors[p.id] || [];
      const aSelections = lsGet(LS_A_SELECTIONS, {})[p.id] || {};
      const selectedVendors = vendors.filter((v, i) => {
        const key = v.id ? String(v.id) : `idx_${i}`;
        return aSelections[key]?.checked;
      });
      const av = selectedVendors[0] || vendors[0];
      return [
        p.product_type || '', av.vendor_type || '', av.size || '', av.optional || '',
        fmtNum(av.pricing1), fmtNum(av.pricing2),
        fmtNum(av.eco_price), fmtNum(av.eco_total),
        fmtNum(av.fast_price), fmtNum(av.fast_total),
        fmtNum(av.express_price), fmtNum(av.express_total),
        fmtNum(av.overnight_price), fmtNum(av.overnight_total),
      ];
    });

  const sepRow = Array(14).fill('');
  const aoa = [row1, row2, ...prodRows, sepRow, vHdr1, vHdr2, ...vendorRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const np = prodRows.length; const vs = np + 3;

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 0, c: 13 } },
    { s: { r: vs, c: 0 }, e: { r: vs + 1, c: 0 } }, { s: { r: vs, c: 1 }, e: { r: vs + 1, c: 1 } },
    { s: { r: vs, c: 2 }, e: { r: vs, c: 3 } }, { s: { r: vs, c: 4 }, e: { r: vs, c: 5 } },
    { s: { r: vs, c: 6 }, e: { r: vs, c: 7 } }, { s: { r: vs, c: 8 }, e: { r: vs, c: 9 } },
    { s: { r: vs, c: 10 }, e: { r: vs, c: 11 } }, { s: { r: vs, c: 12 }, e: { r: vs, c: 13 } },
  ];
  ws['!cols'] = [
    { wch: 5 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 34 }, { wch: 22 },
    { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ];
  ws['!rows'] = [
    { hpt: 28 }, { hpt: 32 }, ...prodRows.map(() => ({ hpt: 22 })),
    { hpt: 8 }, { hpt: 28 }, { hpt: 28 }, ...vendorRows.map(() => ({ hpt: 22 })),
  ];

  try {
    const enc = (r, c) => XLSX.utils.encode_cell({ r, c });
    const setStyle = (ref, style) => { if (ws[ref]) ws[ref].s = style; };
    for (let c = 0; c < 14; c++) { setStyle(enc(0, c), hStyle('F59E0B')); setStyle(enc(1, c), hStyle('F59E0B')); }
    prodRows.forEach((_, i) => { const even = i % 2 === 0; for (let c = 0; c < 14; c++) setStyle(enc(2 + i, c), dStyle(even, null, c === 0)); });
    for (let c = 0; c < 14; c++) { const isDark = (c >= 8 && c <= 9) || (c >= 12 && c <= 13); const bg = isDark ? 'E09415' : 'F59E0B'; setStyle(enc(vs, c), hStyle(bg)); setStyle(enc(vs + 1, c), hStyle(bg)); }
    vendorRows.forEach((_, i) => {
      const even = i % 2 === 0;
      for (let c = 0; c < 14; c++) {
        const ref = enc(vs + 2 + i, c); if (!ws[ref]) continue;
        if (c === 0) ws[ref].s = dStyle(even, 'E09415', false);
        else if (c === 4 || c === 5) ws[ref].s = dStyle(even, 'E09415', true);
        else if (c === 7 || c === 9 || c === 11 || c === 13) ws[ref].s = dStyle(even, '16a34a', true);
        else ws[ref].s = dStyle(even, null, c >= 2);
      }
    });
  } catch (styleErr) { console.warn('[exportExcel] Cell styles skipped:', styleErr.message); }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, filename);
}
