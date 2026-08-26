/**
 * Chuẩn import/export Vendor Excel — dùng chung Staff B (và Admin nếu cần).
 */

import { isSizeGuideMediaUrl } from './vendorMedia';
export const VENDOR_TYPES = ['Old', 'New', 'Best Seller'];

export const VENDOR_EXCEL_HEADERS = [
  'Vendor Name', 'Product Type', 'Thông tin tổng quan', 'Image URL', 'Size', 'Optional',
  'Pricing 1', 'Pricing 2', 'Economy Price Ship', 'Economy Total',
  'Fast Price Ship', 'Fast Total', 'Express Price Ship', 'Express Total',
  'Overnight Price Ship', 'Overnight Total',
];

const COL_ALIASES = {
  name: ['vendor name', 'vendor_name', 'ten vendor', 'tên vendor', 'name'],
  product_type: ['product type', 'product_type', 'loại sản phẩm', 'loai san pham'],
  vendor_type: ['vendor type', 'vendor_type', 'loại vendor', 'loai vendor'],
  media_url: ['image url', 'image_url', 'image', 'hình ảnh', 'avatar', 'avatar url', 'media url'],
  overview: ['overview', 'thông tin tổng quan', 'thong tin tong quan', 'tổng quan', 'tong quan', 'chất liệu', 'chat lieu', 'description', 'mô tả', 'mo ta'],
  size: ['size', 'kích thước', 'kich thuoc', 'detail size'],
  optional: ['optional', 'tùy chọn', 'tuy chon', 'detail optional'],
  pricing1: ['pricing 1', 'pricing1', 'giá 1', 'gia 1'],
  pricing2: ['pricing 2', 'pricing2', 'giá 2', 'gia 2'],
  eco_price: ['economy price ship', 'economy ship', 'eco_price', 'economy ship price'],
  eco_total: ['economy total', 'eco_total', 'economy'],
  fast_price: ['fast price ship', 'fast ship', 'fast_price'],
  fast_total: ['fast total', 'fast_total', 'fast'],
  express_price: ['express price ship', 'express ship', 'express_price'],
  express_total: ['express total', 'express_total', 'express'],
  overnight_price: ['overnight price ship', 'overnight ship', 'overnight_price'],
  overnight_total: ['overnight total', 'overnight_total', 'overnight'],
};

const normalizeKey = (key) =>
  String(key ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

export function normalizeVendorType(value) {
  const raw = (value ?? '').toString().trim();
  if (!raw) return '';

  const val = normalizeKey(raw);
  if (val === 'old' || val === 'loai 1' || val === 'type 1' || val === 'loại 1') return 'Old';
  if (val === 'new' || val === 'loai 2' || val === 'type 2' || val === 'loại 2') return 'New';
  if (
    val === 'bestseller' || val === 'best seller' || val === 'best' || val === 'bs' ||
    val === 'loai 3' || val === 'loại 3' || val === 'type 3'
  ) return 'Best Seller';

  if (VENDOR_TYPES.includes(raw)) return raw;
  return '';
}

export function normalizeOptionalField(value) {
  const s = (value ?? '').toString().trim();
  return s === '' ? null : s;
}

function mapColumn(row, field) {
  const aliases = COL_ALIASES[field] || [];
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== '') return row[alias];
  }
  for (const [key, val] of Object.entries(row)) {
    const nk = normalizeKey(key);
    if (aliases.some((a) => nk === a || nk.includes(a))) {
      if (val !== undefined && val !== '') return val;
    }
  }
  return '';
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).trim().replace(',', '.');
  const n = parseFloat(str.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Chuyển 1 dòng Excel (object hoặc đã parse) → payload API vendor */
export function buildVendorPayload(row) {
  const productType = String(
    row.product_type || row['Product Type'] || mapColumn(row, 'product_type') || ''
  ).trim();

  const vendorTypeRaw = row.vendor_type || row['Vendor Type'] || mapColumn(row, 'vendor_type') || '';
  const vendorType = normalizeVendorType(vendorTypeRaw);

  const name = String(
    row.name || row['Vendor Name'] || row.vendor_name || mapColumn(row, 'name') || ''
  ).trim();

  const size = normalizeOptionalField(row.size ?? row.Size ?? mapColumn(row, 'size'));
  const optional = normalizeOptionalField(row.optional ?? row.Optional ?? mapColumn(row, 'optional'));
  const overview = normalizeOptionalField(row.overview ?? row.Overview ?? mapColumn(row, 'overview'));
  const mediaUrl = normalizeOptionalField(row.media_url ?? row['Image URL'] ?? mapColumn(row, 'media_url'));

  const getNum = (field, extraKeys = []) => {
    for (const k of [field, ...extraKeys]) {
      if (row[k] !== undefined && row[k] !== '') return parseNumber(row[k]);
    }
    return parseNumber(mapColumn(row, field));
  };

  // Nếu không có vendor_type (đã bỏ cột này), dùng mặc định 'New'
  const finalVendorType = vendorType || 'New';

  return {
    name,
    product_type: productType,
    vendor_type: finalVendorType,
    size,
    optional,
    overview,
    media_url: mediaUrl,
    pricing1: getNum('pricing1', ['Pricing 1', 'pricing1']) ?? 0,
    pricing2: getNum('pricing2', ['Pricing 2', 'pricing2']) ?? 0,
    eco_price: getNum('eco_price', ['Economy Price Ship', 'eco_price']),
    eco_total: getNum('eco_total', ['Economy Total', 'eco_total']),
    fast_price: getNum('fast_price', ['Fast Price Ship', 'fast_price']),
    fast_total: getNum('fast_total', ['Fast Total', 'fast_total']),
    express_price: getNum('express_price', ['Express Price Ship', 'express_price']),
    express_total: getNum('express_total', ['Express Total', 'express_total']),
    overnight_price: getNum('overnight_price', ['Overnight Price Ship', 'overnight_price']),
    overnight_total: getNum('overnight_total', ['Overnight Total', 'overnight_total']),
  };
}

export function vendorMatchesExisting(existing, payload) {
  return (
    existing.product_type === payload.product_type &&
    normalizeOptionalField(existing.size) === payload.size &&
    normalizeOptionalField(existing.optional) === payload.optional
  );
}

export async function parseVendorExcel(file) {
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default ?? xlsxModule;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) {
          reject(new Error('File Excel không có sheet dữ liệu'));
          return;
        }

        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        
        // 1. Kiểm tra format "Happy Creative" đặc biệt
        let isHappyFormat = false;
        let happyPricingRowIdx = -1;
        for (let r = 0; r < aoa.length; r++) {
            const row = aoa[r] || [];
            const col0 = String(row[0]).trim();
            const col1 = String(row[1]).trim();
            if (col0 === 'Ký hiệu' && col1.toLowerCase().startsWith('product type')) {
                isHappyFormat = true;
                happyPricingRowIdx = r;
                break;
            }
        }

        let vendors = [];

        if (isHappyFormat) {
            // Parse định dạng Happy Creative
            const generalInfo = {};
            let notesColIdx = 10;
            let chatLieuColIdx = 5;
            
            // Tìm cột Notes và Chất liệu từ các dòng đầu
            for(let r = 0; r < 10; r++) {
                const row = aoa[r] || [];
                for(let c = 0; c < row.length; c++) {
                   const val = String(row[c]).toLowerCase();
                   if(val.includes('notes')) notesColIdx = c;
                   if(val.includes('chất liệu') || val.includes('material')) chatLieuColIdx = c;
                }
            }

            for (let r = 0; r < happyPricingRowIdx; r++) {
                const row = aoa[r] || [];
                const kyHieu = String(row[0]).trim();
                // Bỏ qua các Ký hiệu không hợp lệ
                if (kyHieu && kyHieu.length <= 5 && kyHieu !== 'Ký hiệu' && !kyHieu.includes('CAP') && !kyHieu.includes('MUG')) {
                    const chatLieu = String(row[chatLieuColIdx] || '').trim();
                    const notes = String(row[notesColIdx] || '').trim();
                    if (chatLieu || notes) {
                        generalInfo[kyHieu] = { chatLieu, notes };
                    }
                }
            }

            const parseN = (val) => {
               if (val === 'N/A' || val === '' || val === null || val === undefined) return null;
               // Đổi phẩy sang chấm cho format số thập phân tiếng Việt (13,2 -> 13.2)
               const str = String(val).trim().replace(',', '.');
               const n = parseFloat(str.replace(/[^\d.-]/g, ''));
               return Number.isFinite(n) ? n : null;
            };

            for (let r = happyPricingRowIdx + 2; r < aoa.length; r++) {
                const row = aoa[r] || [];
                if (row.every(c => String(c).trim() === '')) continue;
                
                const kyHieu = String(row[0]).trim();
                const productType = String(row[1]).trim();
                if (!productType || productType.toLowerCase().includes('product type')) continue;

                let overview = '';
                if (generalInfo[kyHieu]) {
                    if (generalInfo[kyHieu].chatLieu) overview += 'Chất liệu:\n' + generalInfo[kyHieu].chatLieu + '\n\n';
                    if (generalInfo[kyHieu].notes) overview += 'Notes:\n' + generalInfo[kyHieu].notes;
                }

                vendors.push({
                    name: '', // Vendor name có thể để trống, tuỳ chỉnh sau
                    product_type: productType,
                    vendor_type: 'New', 
                    size: row[2] === 'N/A' ? null : String(row[2] || '').trim(),
                    optional: row[3] === 'N/A' ? null : String(row[3] || '').trim(),
                    overview: overview.trim(),
                    media_url: null,
                    pricing1: parseN(row[4]),
                    pricing2: parseN(row[5]),
                    eco_price: parseN(row[6]),
                    eco_total: parseN(row[7]),
                    fast_price: parseN(row[8]),
                    fast_total: parseN(row[9]),
                    express_price: parseN(row[10]),
                    express_total: parseN(row[11]),
                    overnight_price: parseN(row[14]),
                    overnight_total: parseN(row[15])
                });
            }
        } else {
            // Logic parse file chuẩn cũ
            let headerRowIdx = -1;

            for (let r = 0; r < aoa.length; r++) {
              const cells = (aoa[r] || []).map((c) => normalizeKey(c));
              const hasProduct = cells.some((c) => c === 'product type' || c === 'product_type' || c === 'loai san pham');
              const hasPricing = cells.some((c) => c.includes('pricing') || c.includes('economy') || c.includes('vendor name') || c.includes('vendor_name'));
              if (hasProduct && hasPricing) {
                headerRowIdx = r;
                break;
              }
            }

            if (headerRowIdx >= 0) {
              const headers = (aoa[headerRowIdx] || []).map((h) => normalizeKey(h));
              let lastVendorName = ''; 
              for (let r = headerRowIdx + 1; r < aoa.length; r++) {
                const rowArr = aoa[r] || [];
                if (rowArr.every((c) => String(c).trim() === '')) continue;

                const rowObj = {};
                headers.forEach((h, c) => {
                  if (h) rowObj[h] = rowArr[c];
                });

                const nameAliases = ['vendor name', 'vendor_name', 'ten vendor', 'tên vendor', 'name'];
                let currentName = '';
                for (const alias of nameAliases) {
                  if (rowObj[alias] !== undefined && String(rowObj[alias]).trim() !== '') {
                    currentName = String(rowObj[alias]).trim();
                    break;
                  }
                }
                if (currentName) {
                  lastVendorName = currentName;
                } else if (lastVendorName) {
                  const firstAlias = nameAliases.find(a => rowObj[a] !== undefined) || nameAliases[0];
                  rowObj[firstAlias] = lastVendorName;
                }

                const payload = buildVendorPayload(rowObj);
                if (!payload.product_type) continue;
                vendors.push(payload);
              }
            } else {
              const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });
              for (const row of rawData) {
                const payload = buildVendorPayload(row);
                if (!payload.product_type) continue;
                vendors.push(payload);
              }
            }
        }

        if (vendors.length === 0) {
          reject(new Error(
            'Không tìm thấy dữ liệu vendor hợp lệ. Dùng nút Export để tải file mẫu, điền Vendor Name + Product Type + giá.'
          ));
          return;
        }

        resolve(vendors);
      } catch (err) {
        reject(new Error('Lỗi đọc file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadVendorLibraryTemplate() {
  const a = document.createElement('a');
  a.href = '/template_vendor_library.xlsx';
  a.download = 'HC_Template vendor mẫu_by Đạt Trần_22_06_2026.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Export Thư viện Vendor → file Excel theo đúng layout của
//  "HC_Template vendor mẫu_by Đạt Trần_22_06_2026.xlsx" (2 khối: "Thông tin
//  chung về phôi" + "Về giá"). Mỗi (file × loại sản phẩm) → 1 sheet riêng,
//  vì bản mẫu chỉ thiết kế cho 1 loại sản phẩm / sheet.
//
//  includePricing=false (CSF/PD/Marvel) → bỏ hẳn khối "Về giá", KHÔNG chỉ ẩn
//  giá trị — theo đúng yêu cầu "không được public giá cho CSF/PD" ở CLAUDE.md.
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATE_COL_COUNT = 16; // A..P
const TEMPLATE_COL_WIDTHS = [
  { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
  { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 },
];

function padTemplateRow(arr) {
  const row = (arr || []).slice(0, TEMPLATE_COL_COUNT);
  while (row.length < TEMPLATE_COL_COUNT) row.push('');
  return row;
}

/** Gom generalInfo + pricing của 1 file thư viện thành các nhóm theo Product Type. */
function groupLibraryFileByProductType(file) {
  const groups = new Map();
  const keyFor = (productType) => (productType || file.title || file.filename || 'Khác').toString().trim() || 'Khác';

  const getGroup = (productType) => {
    const key = keyFor(productType);
    if (!groups.has(key)) groups.set(key, { productType: key, generalInfo: [], pricing: [] });
    return groups.get(key);
  };

  (file.generalInfo || []).forEach((row) => getGroup(row.productType).generalInfo.push(row));
  (file.pricing || []).forEach((row) => getGroup(row.productType).pricing.push(row));

  return [...groups.values()];
}

/** Dựng 1 sheet (AOA + merges) cho 1 nhóm (file × Product Type). */
function buildVendorTemplateSheet(group, includePricing) {
  const rows = [];
  const push = (arr) => rows.push(padTemplateRow(arr));

  push([]);
  push(['', '', '', group.productType || 'Template Vendor mẫu']);
  push([]);
  push([]);
  push(['Thông tin chung về phôi']);
  push([
    'Vendor Name', 'Product Type', 'Hình ảnh đại diện - Video', '', '', '',
    'Chất liệu', 'Chi tiết Size', 'AVG thời gian sx+ ship theo vendor', '',
    'AVG thời gian sx+ ship thực tế', 'Notes', '', '', '', 'Link Folder',
  ]);

  const generalRows = group.generalInfo.length ? group.generalInfo : [{}];
  generalRows.forEach((r) => {
    push([
      r.vendorName || '',
      r.productType || group.productType || '',
      (r.images && r.images[0]) || '',
      '', '', '',
      r.chatLieu || '',
      r.chiTietSize || '',
      r.avgTimeVendor || '',
      '',
      r.avgTimeActual || '',
      r.notes || '',
      '', '', '',
      r.linkFolder || '',
    ]);
  });

  const merges = [
    { s: { r: 1, c: 3 }, e: { r: 1, c: 15 } },
    { s: { r: 2, c: 3 }, e: { r: 2, c: 15 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 15 } },
    { s: { r: 5, c: 2 }, e: { r: 5, c: 5 } },
    { s: { r: 5, c: 8 }, e: { r: 5, c: 9 } },
    { s: { r: 5, c: 11 }, e: { r: 5, c: 14 } },
  ];

  if (includePricing) {
    const label2Row = rows.length;
    push(['Về giá']);

    const header2TopRow = rows.length;
    push([
      '', `Product Type (${group.productType || ''})`, 'Detail', '', 'Pricing 1', 'Pricing 2',
      'Shipping cost: Economy', '', 'Shipping cost: Fast', '', 'Shipping cost: Express', '',
      'Shipping cost: Overnight', '', 'Link Template', '',
    ]);

    const header2SubRow = rows.length;
    push([
      'Vendor Name', '', 'Size', 'Optional', '', '',
      'Price Ship', 'Total Price (fulfill)', 'Price Ship', 'Total Price (fulfill)',
      'Price Ship', 'Total Price (fulfill)', 'Price Ship', 'Total Price (fulfill)', '', '',
    ]);

    group.pricing.forEach((p) => {
      push([
        p.kyHieu || '',
        '',
        p.size || '',
        p.optional || '',
        p.pricing1 ?? '',
        p.pricing2 ?? '',
        p.eco_price ?? '',
        p.eco_total ?? '',
        p.ground_price ?? p.fast_price ?? '',
        p.ground_total ?? p.fast_total ?? '',
        p.express_price ?? '',
        p.express_total ?? '',
        p.overnight_price ?? '',
        p.overnight_total ?? '',
        '', '',
      ]);
    });

    merges.push(
      { s: { r: label2Row, c: 0 }, e: { r: label2Row, c: 15 } },
      { s: { r: header2TopRow, c: 1 }, e: { r: header2SubRow, c: 1 } },
      { s: { r: header2TopRow, c: 2 }, e: { r: header2TopRow, c: 3 } },
      { s: { r: header2TopRow, c: 4 }, e: { r: header2SubRow, c: 4 } },
      { s: { r: header2TopRow, c: 5 }, e: { r: header2SubRow, c: 5 } },
      { s: { r: header2TopRow, c: 6 }, e: { r: header2TopRow, c: 7 } },
      { s: { r: header2TopRow, c: 8 }, e: { r: header2TopRow, c: 9 } },
      { s: { r: header2TopRow, c: 10 }, e: { r: header2TopRow, c: 11 } },
      { s: { r: header2TopRow, c: 12 }, e: { r: header2TopRow, c: 13 } },
      { s: { r: header2TopRow, c: 14 }, e: { r: header2SubRow, c: 15 } },
    );
  }

  return { aoa: rows, merges };
}

function templateSheetName(base, used) {
  const clean = String(base || 'Sheet').replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet';
  let final = clean;
  let i = 2;
  while (used.has(final)) {
    const suffix = ` (${i++})`;
    final = clean.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(final);
  return final;
}

/**
 * Export danh sách file thư viện vendor đang hiển thị ra 1 workbook .xlsx theo
 * đúng layout file mẫu — mỗi (file × Product Type) là 1 sheet.
 *
 * @param {Array} files       danh sách file thư viện (đã filter theo tab/search/project)
 * @param {Object} opts
 * @param {boolean} opts.includePricing  false → bỏ hẳn khối "Về giá" (CSF/PD/Marvel không được xem giá)
 * @param {string}  opts.filenamePrefix
 */
export async function exportVendorLibraryToTemplate(files, { includePricing = true, filenamePrefix = 'HC_Vendor_Library' } = {}) {
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default ?? xlsxModule;

  const groups = [];
  (files || []).forEach((file) => groups.push(...groupLibraryFileByProductType(file)));

  if (groups.length === 0) {
    throw new Error('Không có dữ liệu để xuất file.');
  }

  const wb = XLSX.utils.book_new();
  const usedNames = new Set();

  groups.forEach((group) => {
    const { aoa, merges } = buildVendorTemplateSheet(group, includePricing);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;
    ws['!cols'] = TEMPLATE_COL_WIDTHS;
    XLSX.utils.book_append_sheet(wb, ws, templateSheetName(group.productType, usedNames));
  });

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}_${stamp}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  parseHappyCreativeLibrary — parse định dạng "Happy Creative" vendor library
//  Trả về: { title, generalInfo: [], pricing: [] }
// ─────────────────────────────────────────────────────────────────────────────
export async function parseHappyCreativeLibrary(file) {
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default ?? xlsxModule;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true, cellFormula: true });

        // Ưu tiên sheet đầu tiên không phải "Bản sao"
        let sheetName = wb.SheetNames[0];
        for (const name of wb.SheetNames) {
          if (!name.toLowerCase().includes('bản sao') && !name.toLowerCase().includes('ban sao')) {
            sheetName = name;
            break;
          }
        }
        const ws = wb.Sheets[sheetName];
        if (!ws) {
          reject(new Error('File Excel không có sheet dữ liệu'));
          return;
        }

        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // ── Tiện ích ─────────────────────────────────────────────────────────
        const cellStr = (v) => String(v ?? '').trim();
        const parseN = (val) => {
          if (val === 'N/A' || val === '' || val === null || val === undefined) return null;
          const str = cellStr(val).replace(',', '.');
          const n = parseFloat(str.replace(/[^\d.-]/g, ''));
          return Number.isFinite(n) ? n : null;
        };

        // ── Tìm title (tên loại sản phẩm, VD: "CAP", "MUG") ─────────────────
        let title = sheetName;
        for (let r = 0; r < Math.min(5, aoa.length); r++) {
          const row = aoa[r] || [];
          for (let c = 0; c < row.length; c++) {
            const v = cellStr(row[c]);
            if (v && v.length < 30 && !v.includes(':') && !v.includes('Ngày')) {
              const upper = v.toUpperCase();
              if (upper === upper && /^[A-Z\s]+$/.test(upper) && v.length >= 2) {
                title = v;
                break;
              }
            }
          }
        }

        // ── Tìm các row mốc ──────────────────────────────────────────────────
        let generalInfoHeaderRow = -1; // dòng header của Section 1
        let pricingHeaderRow = -1;     // dòng "Ký hiệu | Product Type (CAP)" của Section 2
        let pricingSubHeaderRow = -1;  // dòng "Size | Optional | ..." sub-header
        let setupRow = -1;             // dòng "Setup giá bán" — dừng đọc
        let veGiaSectionRow = -1;      // dòng label "Về giá" (format thứ 2)
        let altPricingHeaderRow = -1;  // dòng header pricing (format thứ 2)
        let altPtCol = 0;              // cột chứa "Product Type" trong alt format

        for (let r = 0; r < aoa.length; r++) {
          const row = aoa[r] || [];
          const col0 = cellStr(row[0]).toLowerCase();
          const col1 = cellStr(row[1]).toLowerCase();

          // Section 1 header: "Product Type" ở col 0, hoặc "Thông tin chung" ở col 0 hoặc col 1
          if ((col0 === 'product type'
              || col0.includes('thông tin chung') || col0.includes('thong tin chung')
              || col1.includes('thông tin chung') || col1.includes('thong tin chung'))
              && generalInfoHeaderRow === -1) {
            generalInfoHeaderRow = r;
          }

          // Section 2 header (format chuẩn): "Ký hiệu" ở col 0 + "product type" ở col 1
          const col0Norm = col0.normalize('NFD').replace(/[̀-ͯ]/g, '');
          if ((col0Norm === 'ky hieu' || col0Norm === 'ki hieu' || col0 === 'ky hieu')
              && col1.includes('product type') && pricingHeaderRow === -1) {
            pricingHeaderRow = r;
            pricingSubHeaderRow = r + 1;
          }

          // Section 2 header (format thứ 2 — "Về giá"): tìm dòng label "Về giá"
          // Dùng NFD normalization để tránh lỗi Unicode encoding của Excel
          if (veGiaSectionRow === -1 && row.some(c => {
            const s = cellStr(c).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
            return s === 've gia' || s.includes('ve gia');
          })) {
            veGiaSectionRow = r;
          }

          // Sau dòng "Về giá", tìm header row có "product type" ở cột 0, 1 hoặc 2
          // (không yêu cầu "detail" ở col1 vì nhiều file bỏ qua cột đó)
          if (veGiaSectionRow >= 0 && altPricingHeaderRow === -1 && r > veGiaSectionRow) {
            const rowCells = (row || []).map(c => cellStr(c).toLowerCase());
            const ptIdx = rowCells.slice(0, 3).findIndex(s => s.includes('product type'));
            if (ptIdx >= 0) {
              altPricingHeaderRow = r;
              altPtCol = ptIdx;
            }
          }

          // Dừng khi gặp "Setup giá bán"
          if (col0.includes('setup') && (col0.includes('giá') || col0.includes('gia'))) {
            setupRow = r;
            break;
          }
        }

        // Nếu generalInfoHeaderRow trỏ vào dòng label "Thông tin chung" (không phải dòng header cột),
        // tìm dòng header thực sự ở ngay phía sau (có "Chất liệu", "Hình ảnh", v.v.)
        if (generalInfoHeaderRow >= 0) {
          const labelRowCells = (aoa[generalInfoHeaderRow] || []).map(c => cellStr(c).toLowerCase());
          const isLabelRow = labelRowCells.some(s =>
            s.includes('thong tin chung') || s.includes('thông tin chung')
          );
          if (isLabelRow) {
            for (let r = generalInfoHeaderRow + 1; r < Math.min(generalInfoHeaderRow + 6, aoa.length); r++) {
              const hasColHeader = (aoa[r] || []).some(c => {
                const s = cellStr(c).toLowerCase();
                return s.includes('chất liệu') || s.includes('chat lieu') || s.includes('material')
                    || s.includes('hình ảnh') || s.includes('hinh anh')
                    || s.includes('chi tiết size') || s.includes('chi tiet size')
                    || s.includes('avg');
              });
              if (hasColHeader) { generalInfoHeaderRow = r; break; }
            }
          }
        }

        // ── Parse Section 1 — Thông tin chung về phôi ────────────────────────
        const generalInfo = [];
        // Excel row (0-based, cùng hệ tọa độ với anchor ảnh nhúng) của từng entry —
        // dùng để map ảnh nhúng trực tiếp vào ô (Insert Picture) về đúng dòng vendor.
        const entryExcelRows = [];

        // Khởi tạo cột mặc định
        let col_kyHieu = 0, col_imagesStart = 1;
        let col_chatLieu = 5, col_chiTietSize = 6;
        let col_avgVendor = 7, col_avgActual = 9, col_notes = 10, col_linkFolder = 11;

        if (generalInfoHeaderRow >= 0) {
          const hRow = aoa[generalInfoHeaderRow] || [];
          let imagesHeaderFound = false;
          let col_vendorName = -1;
          let col_productType1 = -1;

          // Pass 1: detect explicit 'ký hiệu' label → takes priority over old 'product type' fallback
          let kyHieuExplicit = -1;
          hRow.forEach((h, c) => {
            const s = cellStr(h).toLowerCase();
            const sNorm = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
            if (sNorm.includes('ky hieu') || sNorm.includes('ki hieu') || s.includes('ký hiệu') || s.includes('kí hiệu')) {
              kyHieuExplicit = c;
            }
          });
          if (kyHieuExplicit >= 0) col_kyHieu = kyHieuExplicit;

          // Pass 2: map all other columns by keyword
          hRow.forEach((h, c) => {
            const s = cellStr(h).toLowerCase();
            const sNorm = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
            // product type / loại sản phẩm
            const isProductType = s.includes('product type') || sNorm.includes('loai san pham') || s.includes('loại sản phẩm');
            if (isProductType) {
              if (kyHieuExplicit < 0) col_kyHieu = c;      // old format: "Product Type" col is the identifier
              else col_productType1 = c;                     // new template: separate product type column
            }
            if (s.includes('hình ảnh') || s.includes('hinh anh') || s.includes('video')) { col_imagesStart = c; imagesHeaderFound = true; }
            if (s.includes('chất liệu') || s.includes('chat lieu') || s.includes('material')) col_chatLieu = c;
            if (s.includes('chi tiết size') || s.includes('chi tiet size')) col_chiTietSize = c;
            if (s.includes('avg') && (s.includes('vendor') || s.includes('theo vendor'))) col_avgVendor = c;
            if (s.includes('avg') && (s.includes('thực tế') || s.includes('thuc te'))) col_avgActual = c;
            if (s.includes('notes') || s.includes('ghi chú') || s.includes('ghi chu')) col_notes = c;
            if (s.includes('link folder') || s.includes('thư mục') || s.includes('thu muc')) col_linkFolder = c;
            if (s.includes('tên vendor') || s.includes('ten vendor') || s.includes('vendor name') || s.includes('nhà cung cấp')) col_vendorName = c;
          });

          // Nếu không có header "Hình ảnh" tường minh mà cột chatLieu xuất hiện sớm (col ≤ 5),
          // suy ra các cột trước chatLieu là cột ảnh → bắt đầu từ col 0
          if (!imagesHeaderFound && col_chatLieu <= 5) {
            col_imagesStart = 0;
          }

          const endRow = pricingHeaderRow >= 0 ? pricingHeaderRow
                       : veGiaSectionRow >= 0 ? veGiaSectionRow
                       : aoa.length;
          for (let r = generalInfoHeaderRow + 1; r < endRow; r++) {
            const row = aoa[r] || [];
            if (row.every(c => cellStr(c) === '')) continue;

            const originalKyHieu = cellStr(row[col_kyHieu]);
            const kyHieuLower = originalKyHieu.toLowerCase().trim();

            // Bỏ qua dòng header trùng lặp
            if (kyHieuLower.includes('thông tin') || kyHieuLower.includes('product type')) continue;

            // Với format "Về giá" (không có cột Ký hiệu), col_kyHieu có thể trống.
            // Chỉ bỏ qua dòng nếu KHÔNG có dữ liệu ở bất kỳ cột nội dung nào.
            const hasContent = originalKyHieu
              || cellStr(row[col_chatLieu])
              || cellStr(row[col_chiTietSize])
              || cellStr(row[col_avgVendor])
              || cellStr(row[col_notes]);
            if (!hasContent) continue;

            // Nếu gặp tiêu đề của phần 2 ("Về giá") thì dừng đọc Section 1
            const isPricingSection = row.some(cell => {
              const str = cellStr(cell).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
              return str === 've gia' || str.includes('ve gia');
            });
            if (isPricingSection) break;

            // Trích xuất hình ảnh từ cell formula (nếu có `=IMAGE("url")`) hoặc từ URL trực tiếp
            const images = [];
            for (let c = col_imagesStart; c <= col_imagesStart + 3; c++) {
              const cell = ws[XLSX.utils.encode_cell({r, c})];
              if (cell && cell.f) {
                const m = cell.f.match(/image\(\s*["'](.*?)["']\s*\)/i);
                if (m && m[1]) images.push(m[1]);
              } else if (cell && cell.v && cellStr(cell.v).startsWith('http')) {
                images.push(cellStr(cell.v));
              }
            }

            // Kiểm tra ảnh trong cột Chi tiết Size
            let chiTietSizeImage = null;
            const sizeCell = ws[XLSX.utils.encode_cell({r, c: col_chiTietSize})];
            if (sizeCell && sizeCell.f) {
              const m = sizeCell.f.match(/image\(\s*["'](.*?)["']\s*\)/i);
              if (m && m[1]) chiTietSizeImage = m[1];
            } else if (sizeCell && sizeCell.v && cellStr(sizeCell.v).startsWith('http')) {
              const sizeUrl = cellStr(sizeCell.v);
              if (isSizeGuideMediaUrl(sizeUrl)) {
                chiTietSizeImage = sizeUrl;
              }
            }

            let chiTietSizeText = cellStr(row[col_chiTietSize]);
            if (chiTietSizeText.startsWith('http') && chiTietSizeText === chiTietSizeImage) {
              chiTietSizeText = ''; // Nếu text là URL ảnh thì bỏ qua text
            }

            generalInfo.push({
              id: 'row-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 6),
              vendorName: col_vendorName >= 0 ? cellStr(row[col_vendorName]) : '',
              productType: col_productType1 >= 0 ? cellStr(row[col_productType1]) : '',
              kyHieu: originalKyHieu,
              images,
              chatLieu: cellStr(row[col_chatLieu]),
              chiTietSize: chiTietSizeText,
              chiTietSizeImage,
              avgTimeVendor: cellStr(row[col_avgVendor]),
              avgTimeActual: cellStr(row[col_avgActual]),
              notes: cellStr(row[col_notes]),
              linkFolder: cellStr(row[col_linkFolder]),
            });
            entryExcelRows.push(r);
          }
        }

        // ── Parse Section 2 — Về giá ─────────────────────────────────────────
        const pricing = [];

        if (pricingHeaderRow >= 0) {
          const endRow = setupRow >= 0 ? setupRow : aoa.length;
          // Data bắt đầu từ sub-header + 1 (skip cả 2 dòng header)
          const dataStart = pricingSubHeaderRow >= 0 ? pricingSubHeaderRow + 1 : pricingHeaderRow + 2;

          let lastPricingKyHieu = '';
          for (let r = dataStart; r < endRow; r++) {
            const row = aoa[r] || [];
            if (row.every(c => cellStr(c) === '')) continue;

            const kyHieu = cellStr(row[0]);
            const productType = cellStr(row[1]);
            if (!productType || productType.toLowerCase().includes('product type')) continue;
            // Bỏ header rows lạc
            if (kyHieu.toLowerCase().includes('ký hiệu') || kyHieu.toLowerCase() === 'ky hieu') continue;

            // Propagate kyHieu: only first row of each vendor block has it; carry it forward
            if (kyHieu) lastPricingKyHieu = kyHieu;

            pricing.push({
              kyHieu: lastPricingKyHieu,
              productType,
              size: cellStr(row[2]) === 'N/A' ? '' : cellStr(row[2]),
              optional: cellStr(row[3]) === 'N/A' ? '' : cellStr(row[3]),
              pricing1: parseN(row[4]),
              pricing2: parseN(row[5]),
              eco_price: parseN(row[6]),
              eco_total: parseN(row[7]),
              ground_price: parseN(row[8]),
              ground_total: parseN(row[9]),
              express_price: parseN(row[10]),
              express_total: parseN(row[11]),
              twoday_price: parseN(row[12]),
              twoday_total: parseN(row[13]),
              overnight_price: parseN(row[14]),
              overnight_total: parseN(row[15]),
            });
          }
        }

        // ── Parse Section 2 (format thứ 2) — "Về giá" không có cột Ký hiệu ────
        // altPtCol xác định cột chứa Product Type (có thể là col0 hoặc col1)
        if (pricing.length === 0 && altPricingHeaderRow >= 0) {
          const endRow = setupRow >= 0 ? setupRow : aoa.length;

          // Đọc sub-header (dòng ngay sau group header) để detect vị trí cột chính xác
          const subRow = aoa[altPricingHeaderRow + 1] || [];
          const hasSubHeader = subRow.some(c => {
            const s = cellStr(c).toLowerCase();
            return s.includes('size') || s.includes('pricing') || s.includes('price ship') || s.includes('optional');
          });

          // Vị trí cột mặc định theo offset từ altPtCol
          let colSize = altPtCol + 1, colOptional = altPtCol + 2;
          let colP1 = altPtCol + 3, colP2 = altPtCol + 4;
          const shipCols = []; // [{price, total}, ...] — mỗi phần tử là 1 phương thức ship

          if (hasSubHeader) {
            const subCells = subRow.map(c => cellStr(c).toLowerCase());
            subCells.forEach((s, c) => {
              if (s.includes('size') && c > altPtCol && colSize === altPtCol + 1) colSize = c;
              else if (s.includes('optional') && c > altPtCol) colOptional = c;
              else if ((s.includes('pricing 1') || s === 'pricing1') && c > altPtCol) colP1 = c;
              else if ((s.includes('pricing 2') || s === 'pricing2') && c > altPtCol) colP2 = c;
            });

            // Tìm shipping method columns từ colP2 trở đi.
            // Mỗi method: "Price Ship" + "Total" + (mới) "Price Ship Item 2".
            // ⚠ "Price Ship Item 2" cũng chứa "price ship" → KHÔNG được coi là đầu 1 method mới.
            const isMethodStart = (c) =>
              (c.includes('price ship') || c.includes('price_ship')) && !c.includes('item 2') && !c.includes('item2');
            const isItem2 = (c) => c.includes('item 2') || c.includes('item2');
            let i = colP2 + 1;
            while (i < subCells.length && shipCols.length < 5) {
              if (isMethodStart(subCells[i])) {
                const priceCol = i;
                let totalCol = null, item2Col = null;
                for (let j = priceCol + 1; j < subCells.length; j++) {
                  if (isMethodStart(subCells[j])) break;                       // sang method kế tiếp
                  if (item2Col == null && isItem2(subCells[j])) item2Col = j;   // Price Ship Item 2
                  else if (totalCol == null && subCells[j].includes('total')) totalCol = j;
                }
                shipCols.push({ price: priceCol, total: totalCol, item2: item2Col });
                i = Math.max(priceCol, totalCol ?? priceCol, item2Col ?? priceCol) + 1;
              } else {
                i++;
              }
            }
          }

          // Fallback nếu không detect được từ sub-header
          if (shipCols.length === 0) {
            const base = altPtCol + 5;
            for (let m = 0; m < 5; m++) shipCols.push({ price: base + m * 2, total: base + m * 2 + 1 });
          }

          const dataStart = hasSubHeader ? altPricingHeaderRow + 2 : altPricingHeaderRow + 1;
          let lastKyHieu = '';

          // Pre-populate lastProductType từ group header "Product Type (Night Light)" → "Night Light"
          // Xử lý trường hợp merged cell kéo dài từ header xuống toàn bộ data rows
          // (khi đó row[altPtCol] luôn = "" trong data rows)
          let lastProductType = '';
          const groupHeaderCell = cellStr((aoa[altPricingHeaderRow] || [])[altPtCol]);
          const ptHeaderMatch = groupHeaderCell.match(/product type\s*[\(\[]\s*(.+?)\s*[\)\]]/i);
          if (ptHeaderMatch && ptHeaderMatch[1]) {
            lastProductType = ptHeaderMatch[1].trim();
          }

          for (let r = dataStart; r < endRow; r++) {
            const row = aoa[r] || [];
            if (row.every(c => cellStr(c) === '')) continue;

            const rawType = cellStr(row[altPtCol]);
            if (rawType.toLowerCase().includes('set up') || rawType.toLowerCase().includes('setup')) break;
            if (rawType.toLowerCase().includes('product type')) continue;

            if (rawType) lastProductType = rawType;
            if (!lastProductType) continue;

            // Propagate vendor name (col 0) across merged cells — same as lastProductType pattern
            if (altPtCol > 0) {
              const rawVendor = cellStr(row[0]);
              if (rawVendor) lastKyHieu = rawVendor;
            }

            const getShip = (idx, which) => {   // which: 'price' | 'total' | 'item2'
              const col = shipCols[idx];
              if (!col) return null;
              const colIdx = which === 'total' ? col.total : which === 'item2' ? col.item2 : col.price;
              return colIdx != null ? parseN(row[colIdx]) : null;
            };

            pricing.push({
              kyHieu: lastKyHieu,
              productType: lastProductType,
              size: cellStr(row[colSize]) === 'N/A' ? '' : cellStr(row[colSize]),
              optional: cellStr(row[colOptional]) === 'N/A' ? '' : cellStr(row[colOptional]),
              pricing1: parseN(row[colP1]),
              pricing2: parseN(row[colP2]),
              eco_price: getShip(0, 'price'),
              eco_total: getShip(0, 'total'),
              eco_price_item2: getShip(0, 'item2'),
              ground_price: getShip(1, 'price'),
              ground_total: getShip(1, 'total'),
              ground_price_item2: getShip(1, 'item2'),
              express_price: getShip(2, 'price'),
              express_total: getShip(2, 'total'),
              express_price_item2: getShip(2, 'item2'),
              twoday_price: getShip(3, 'price'),
              twoday_total: getShip(3, 'total'),
              twoday_price_item2: getShip(3, 'item2'),
              overnight_price: getShip(4, 'price'),
              overnight_total: getShip(4, 'total'),
              overnight_price_item2: getShip(4, 'item2'),
            });
          }
        }

        if (generalInfo.length === 0 && pricing.length === 0) {
          reject(new Error('Không nhận diện được định dạng Happy Creative. Kiểm tra file Excel.'));
          return;
        }

        // Cross-reference: fill productType in generalInfo from matching pricing rows
        const pricingByKyHieu = {};
        pricing.forEach(p => {
          if (p.kyHieu && !pricingByKyHieu[p.kyHieu]) pricingByKyHieu[p.kyHieu] = p.productType;
        });
        generalInfo.forEach(gi => {
          if (!gi.productType && gi.kyHieu && pricingByKyHieu[gi.kyHieu]) {
            gi.productType = pricingByKyHieu[gi.kyHieu];
          }
        });

        // Ảnh chèn trực tiếp vào ô (Insert Picture) không nằm trong cell.f / cell.v nên
        // XLSX không đọc được ở bước trên — trích riêng từ cấu trúc ZIP của file .xlsx
        // rồi upload lên server để lấy URL thật. Lỗi ở bước này không chặn import.
        try {
          await attachEmbeddedImages(e.target.result, sheetName, generalInfo, entryExcelRows);
        } catch (err) {
          console.warn('Không trích được ảnh nhúng trong Excel:', err);
        }

        resolve({ title, generalInfo, pricing });
      } catch (err) {
        reject(new Error('Lỗi đọc file thư viện: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsArrayBuffer(file);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Trích ảnh chèn trực tiếp vào ô Excel (Insert Picture — không phải công thức
//  =IMAGE("url") hay text URL). File .xlsx thực chất là 1 file ZIP: ảnh nhị phân
//  nằm ở xl/media/*, còn vị trí (dòng/cột) mỗi ảnh được neo vào thì nằm trong
//  xl/drawings/drawingN.xml. Không có 2 file này thì XLSX.js (SheetJS bản free)
//  hoàn toàn không đọc được — đây chính là lý do ảnh dán trực tiếp không hiện.
// ─────────────────────────────────────────────────────────────────────────────

const RELS_NS = '*'; // wildcard namespace — chấp nhận mọi prefix Excel export ra
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function resolveZipPath(baseDir, relTarget) {
  const parts = baseDir.split('/').filter(Boolean);
  for (const part of relTarget.split('/')) {
    if (part === '..') parts.pop();
    else if (part === '.' || part === '') continue;
    else parts.push(part);
  }
  return parts.join('/');
}

function parseXml(text) {
  return new DOMParser().parseFromString(text, 'application/xml');
}

async function readZipXml(zip, path) {
  const entry = zip.file(path);
  if (!entry) return null;
  const text = await entry.async('string');
  return parseXml(text);
}

function getRelId(el) {
  return el.getAttribute('r:id') || el.getAttributeNS(NS_R, 'id');
}

function getRelEmbed(el) {
  return el.getAttribute('r:embed') || el.getAttributeNS(NS_R, 'embed');
}

/** Tìm đường dẫn xl/worksheets/sheetN.xml tương ứng với tên sheet */
async function findSheetXmlPath(zip, sheetName) {
  const wbDoc = await readZipXml(zip, 'xl/workbook.xml');
  const relsDoc = await readZipXml(zip, 'xl/_rels/workbook.xml.rels');
  if (!wbDoc || !relsDoc) return null;

  const sheetEl = Array.from(wbDoc.getElementsByTagNameNS(RELS_NS, 'sheet'))
    .find((s) => s.getAttribute('name') === sheetName);
  if (!sheetEl) return null;

  const rId = getRelId(sheetEl);
  if (!rId) return null;

  const relEl = Array.from(relsDoc.getElementsByTagNameNS(RELS_NS, 'Relationship'))
    .find((r) => r.getAttribute('Id') === rId);
  if (!relEl) return null;

  return resolveZipPath('xl', relEl.getAttribute('Target') || '');
}

/** Tìm đường dẫn xl/drawings/drawingN.xml được sheet tham chiếu tới */
async function findDrawingPath(zip, sheetXmlPath) {
  const parts = sheetXmlPath.split('/');
  const fileName = parts.pop();
  const dir = parts.join('/');
  const relsDoc = await readZipXml(zip, `${dir}/_rels/${fileName}.rels`);
  if (!relsDoc) return null;

  const drawingRel = Array.from(relsDoc.getElementsByTagNameNS(RELS_NS, 'Relationship'))
    .find((r) => (r.getAttribute('Type') || '').includes('/drawing'));
  if (!drawingRel) return null;

  return resolveZipPath(dir, drawingRel.getAttribute('Target') || '');
}

/** Đọc drawingN.xml → danh sách { row, col, mediaPath } cho từng ảnh neo trong sheet */
async function findImageAnchors(zip, drawingPath) {
  const doc = await readZipXml(zip, drawingPath);
  if (!doc) return [];

  const parts = drawingPath.split('/');
  const fileName = parts.pop();
  const dir = parts.join('/');
  const relsDoc = await readZipXml(zip, `${dir}/_rels/${fileName}.rels`);

  const ridToMedia = {};
  if (relsDoc) {
    Array.from(relsDoc.getElementsByTagNameNS(RELS_NS, 'Relationship')).forEach((r) => {
      ridToMedia[r.getAttribute('Id')] = resolveZipPath(dir, r.getAttribute('Target') || '');
    });
  }

  const anchorEls = [
    ...Array.from(doc.getElementsByTagNameNS(RELS_NS, 'twoCellAnchor')),
    ...Array.from(doc.getElementsByTagNameNS(RELS_NS, 'oneCellAnchor')),
  ];

  const anchors = [];
  anchorEls.forEach((anchorEl) => {
    const fromEl = anchorEl.getElementsByTagNameNS(RELS_NS, 'from')[0];
    const blipEl = anchorEl.getElementsByTagNameNS(RELS_NS, 'blip')[0];
    if (!fromEl || !blipEl) return;

    const colEl = fromEl.getElementsByTagNameNS(RELS_NS, 'col')[0];
    const rowEl = fromEl.getElementsByTagNameNS(RELS_NS, 'row')[0];
    const col = colEl ? parseInt(colEl.textContent, 10) : 0;
    const row = rowEl ? parseInt(rowEl.textContent, 10) : 0;

    const rId = getRelEmbed(blipEl);
    const mediaPath = rId ? ridToMedia[rId] : null;
    if (!mediaPath || !Number.isFinite(row)) return;

    anchors.push({ row, col, mediaPath });
  });

  return anchors;
}

const SUPPORTED_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

/** Trả về [{ row, col, blob, ext }] cho mọi ảnh nhúng trực tiếp trong 1 sheet */
async function extractEmbeddedVendorImages(arrayBuffer, sheetName) {
  const JSZipModule = await import('jszip');
  const JSZip = JSZipModule.default ?? JSZipModule;
  const zip = await JSZip.loadAsync(arrayBuffer);

  const sheetXmlPath = await findSheetXmlPath(zip, sheetName);
  if (!sheetXmlPath) return [];
  const drawingPath = await findDrawingPath(zip, sheetXmlPath);
  if (!drawingPath) return [];
  const anchors = await findImageAnchors(zip, drawingPath);
  if (anchors.length === 0) return [];

  const results = [];
  for (const anchor of anchors) {
    const ext = (anchor.mediaPath.split('.').pop() || '').toLowerCase();
    if (!SUPPORTED_IMAGE_EXT.includes(ext)) continue; // bỏ qua .emf/.wmf — trình duyệt không hiển thị được
    const mediaEntry = zip.file(anchor.mediaPath);
    if (!mediaEntry) continue;
    const blob = await mediaEntry.async('blob');
    results.push({ row: anchor.row, col: anchor.col, blob, ext });
  }
  return results;
}

/**
 * Trích + upload ảnh nhúng trực tiếp trong Excel, rồi gắn URL vào đúng dòng
 * generalInfo (khớp theo excel row gần nhất ≤ row neo của ảnh). Sửa trực tiếp
 * (mutate) mảng generalInfo truyền vào.
 */
async function attachEmbeddedImages(arrayBuffer, sheetName, generalInfo, entryExcelRows) {
  const embedded = await extractEmbeddedVendorImages(arrayBuffer, sheetName);
  if (embedded.length === 0) return;

  const { vendorLibraryApi } = await import('../services/api');

  const formData = new FormData();
  embedded.forEach((img, idx) => {
    formData.append(`images[${idx}]`, img.blob, `embedded_${idx}.${img.ext}`);
  });

  const res = await vendorLibraryApi.uploadImages(formData);
  const urls = res.data?.urls || {};

  // Nhóm theo dòng generalInfo gần nhất (excelRow lớn nhất mà vẫn ≤ row neo ảnh),
  // sắp theo cột để giữ đúng thứ tự trái → phải như trong Excel.
  embedded.forEach((img, idx) => {
    const url = urls[idx];
    if (!url) return;

    let bestI = -1;
    for (let i = 0; i < entryExcelRows.length; i++) {
      if (entryExcelRows[i] <= img.row && (bestI === -1 || entryExcelRows[i] > entryExcelRows[bestI])) {
        bestI = i;
      }
    }
    if (bestI === -1) return;

    const entry = generalInfo[bestI];
    if (!entry.images) entry.images = [];
    if (entry.images.length < 6) entry.images.push({ url, col: img.col });
  });

  generalInfo.forEach((entry) => {
    if (!entry.images || entry.images.length === 0) return;
    entry.images = entry.images
      .map((v) => (typeof v === 'string' ? { url: v, col: -1 } : v))
      .sort((a, b) => a.col - b.col)
      .map((v) => v.url);
  });
}
