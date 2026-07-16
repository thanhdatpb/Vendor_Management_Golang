// ════════════════════════════════════════════════════════
//  VENDOR LIBRARY INDEX — tra cứu size + giá "Về giá" theo Product Type
//  Dùng cho PriceSheetWorkspace: lấy size thật từ thư viện, và tự động
//  suy ra Item Cost theo phương thức ship (Economy/Ground/Express/2 Days/Overnight)
//  từ cột "Total (Fulfill)" tương ứng trong thư viện.
// ════════════════════════════════════════════════════════
import { vendorLibraryApi } from '../services/api';

export const normalizeKey = (s) => (s ?? '').toString().trim().toLowerCase();

function extractFileProject(filename) {
  if (!filename) return null;
  const fn = filename.toLowerCase();
  if (fn.includes('p.hapify84')) return 'hapify84';
  if (fn.includes('p.happy')) return 'happy';
  if (fn.includes('p.creative')) return 'creative';
  if (fn.includes('p.global')) return 'global';
  return null;
}

// Khai báo phương thức ship → field tương ứng trong pricing row của thư viện.
// (khớp đúng cấu trúc parseHappyCreativeLibrary trong vendorExcel.js)
export const SHIP_METHODS = [
  { key: 'eco',       label: 'Economy',   totalField: 'eco_total',       priceField: 'eco_price' },
  { key: 'ground',    label: 'Ground',    totalField: 'ground_total',    priceField: 'ground_price' },
  { key: 'express',   label: 'Express',   totalField: 'express_total',   priceField: 'express_price' },
  { key: 'twoday',    label: '2 Days',    totalField: 'twoday_total',    priceField: 'twoday_price' },
  { key: 'overnight', label: 'Overnight', totalField: 'overnight_total', priceField: 'overnight_price' },
];
export const shipMethodLabel = (key) => SHIP_METHODS.find((m) => m.key === key)?.label || '';

/**
 * Tải + gom thư viện vendor (đã lọc theo project) thành index:
 *   { [normProductType]: { productType, vendor, filename, sizes:[...], bySize: { [normSize]: pricingRow } } }
 */
export async function loadVendorLibraryIndex(projectKey, skip) {
  const res = await vendorLibraryApi.get('all');
  const files = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
  const filtered = (skip || !projectKey) ? files : files.filter((f) => {
    const fp = extractFileProject(f.filename);
    return !fp || projectKey.includes(fp) || fp.includes(projectKey);
  });

  const index = {};
  filtered.forEach((file) => {
    const pricing = Array.isArray(file.pricing) ? file.pricing : [];
    pricing.forEach((p) => {
      const ptName = (p.productType || '').trim();
      if (!ptName) return;
      const key = normalizeKey(ptName);
      if (!index[key]) {
        index[key] = {
          productType: ptName,
          vendor: (p.kyHieu || '').trim(),
          filename: (file.filename || '').replace(/\.[^.]+$/, ''),
          sizes: [],
          bySize: {},
        };
      }
      const sizeLabel = (p.size && String(p.size).trim() && p.size !== 'N/A') ? String(p.size).trim() : '';
      if (!sizeLabel) return;
      const sKey = normalizeKey(sizeLabel);
      if (!index[key].bySize[sKey]) {
        index[key].bySize[sKey] = p;
        index[key].sizes.push(sizeLabel);
      }
    });
  });
  return index;
}

/** Liệt kê Product Type có trong thư viện (đã lọc project) → cho picker chọn. */
export function listLibraryProductTypes(index) {
  if (!index) return [];
  return Object.values(index)
    .map((v) => ({ productType: v.productType, vendor: v.vendor, sizeCount: (v.sizes || []).length }))
    .sort((a, b) => a.productType.localeCompare(b.productType, undefined, { numeric: true, sensitivity: 'base' }));
}

/** Tìm entry thư viện theo tên Product Type — khớp đúng trước, mờ (substring) sau. */
export function findLibraryEntry(index, productTypeName) {
  if (!index || !productTypeName) return null;
  const key = normalizeKey(productTypeName);
  if (index[key]) return index[key];
  const found = Object.values(index).find((v) => {
    const a = normalizeKey(v.productType);
    return a && (a.includes(key) || key.includes(a));
  });
  return found || null;
}

/** Lấy Total (Fulfill) của 1 size theo phương thức ship đã chọn. null nếu không có trong thư viện. */
export function getLibraryTotal(entry, sizeLabel, methodKey) {
  if (!entry || !methodKey) return null;
  const row = entry.bySize[normalizeKey(sizeLabel)];
  if (!row) return null;
  const field = SHIP_METHODS.find((m) => m.key === methodKey)?.totalField;
  if (!field) return null;
  const v = row[field];
  return (v === null || v === undefined || v === '') ? null : Number(v);
}
