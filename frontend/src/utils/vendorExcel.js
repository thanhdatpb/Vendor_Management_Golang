/**
 * Chuẩn import/export Vendor Excel — dùng chung Staff B (và Admin nếu cần).
 */

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

// ─────────────────────────────────────────────────────────────────────────────
//  downloadVendorLibraryTemplate — tải file Excel mẫu đúng định dạng HC parser
//
//  Section 1 — Thông tin chung về phôi (thứ tự cột khớp UI):
//    col 0 : Tên Vendor        → vendorName
//    col 1 : Loại sản phẩm    → productType (điền trực tiếp, không cần cross-ref)
//    col 2 : Ký hiệu           → kyHieu  (A, B, C… — dùng cross-ref Section 2 nếu col 1 trống)
//    col 3-6: Hình ảnh 1-4    → images[]
//    col 7 : Chất liệu         → chatLieu
//    col 8 : Chi tiết Size     → chiTietSize
//    col 9 : AVG TG (theo Vendor) → avgTimeVendor
//    col 10: AVG TG (Thực tế)  → avgTimeActual
//    col 11: Ghi chú           → notes
//    col 12: Thư mục / Link    → linkFolder
//
//  Section 2 — Về giá (vị trí cột cố định):
//    row A: col0="Ký hiệu", col1 chứa "Product Type" → pricingHeaderRow
//           + col 2+: tiêu đề nhóm lớn (DETAIL | PRICING | ECONOMY | GROUND | EXPRESS | 2 DAYS | OVERNIGHT)
//    row B: col labels (Size, Optional, Pricing 1...) → pricingSubHeaderRow (row A+1)
//    col 0: Ký hiệu | col 1: Product Type | col 2: Size | col 3: Optional
//    col 4: Pricing 1 | col 5: Pricing 2
//    col 6-7: Economy | col 8-9: Ground | col 10-11: Express
//    col 12-13: 2 Days | col 14-15: Overnight
// ─────────────────────────────────────────────────────────────────────────────
export async function downloadVendorLibraryTemplate() {
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default ?? xlsxModule;

  // ── Section 1: Thông tin chung về phôi ──────────────────────────────────────
  // col 0: Tên Vendor | col 1: Loại sản phẩm | col 2: Ký hiệu | col 3-6: Hình ảnh 1-4
  // col 7: Chất liệu | col 8: Chi tiết Size | col 9: AVG TG Vendor | col 10: AVG TG Thực tế
  // col 11: Ghi chú | col 12: Thư mục / Link
  const sec1Header = [
    'Tên Vendor',
    'Loại sản phẩm',
    'Ký hiệu',
    'Hình ảnh 1', 'Hình ảnh 2', 'Hình ảnh 3', 'Hình ảnh 4',
    'Chất liệu',
    'Chi tiết Size',
    'AVG TG (theo Vendor)',
    'AVG TG (Thực tế)',
    'Ghi chú',
    'Thư mục / Link',
  ];

  // ── Section 2: Về giá ────────────────────────────────────────────────────────
  // Row 7 = trigger pricingHeaderRow: col0="Ký hiệu", col1 chứa "Product Type"
  //         + tiêu đề nhóm lớn gộp vào cùng dòng (col 2+) để khớp visual UI
  const sec2Header = [
    'Ký hiệu', 'Product Type (Tên sản phẩm)',
    'DETAIL', '',
    'PRICING', '',
    'ECONOMY', '',
    'GROUND', '',
    'EXPRESS', '',
    '2 DAYS', '',
    'OVERNIGHT', '',
  ];
  // Sub-header: vị trí cột cố định (parser đọc theo index, row này được skip vì col1 trống)
  const sec2SubHeader = [
    '', '',
    'Size', 'Optional',
    'Pricing 1', 'Pricing 2',
    'Economy Price Ship', 'Economy Total (Fulfill)',
    'Ground Price Ship',  'Ground Total (Fulfill)',
    'Express Price Ship', 'Express Total (Fulfill)',
    '2Day Price Ship',    '2Day Total (Fulfill)',
    'Overnight Price Ship','Overnight Total (Fulfill)',
  ];

  const aoa = [
    // Row 0: Tên loại sản phẩm — chỉ dùng chữ HOA ASCII (CAP, MUG, POSTER…)
    // ➡ THAY "CAP" THÀNH TÊN LOẠI SẢN PHẨM CỦA BẠN
    ['CAP'],

    // Row 1: Label Section 1 (không xóa)
    ['Thông tin chung về phôi'],

    // Row 2: Header cột Section 1 (không xóa, không đổi tên)
    sec1Header,

    // Row 3-4: Dữ liệu mẫu — xóa/sửa tùy ý
    // col 0: Tên Vendor | col 1: Loại sản phẩm | col 2: Ký hiệu (phải khớp col 0 Section 2)
    // col 3: URL hình ảnh chính | col 8: URL ảnh size guide HOẶC text size (S/M/L/XL…)
    ['Tên Vendor A', 'AOP CAP', 'A', 'https://example.com/img1.jpg', '', '', '', 'Vải cotton 100%',   'S/M/L/XL', '3-5 ngày', '5-7 ngày', 'Ghi chú ví dụ', 'https://drive.google.com/folder1'],
    ['Tên Vendor B', 'CAP Creative', 'B', 'https://example.com/img2.jpg', '', '', '', 'Polyester cao cấp', 'One size', '4-6 ngày', '6-8 ngày', '', 'https://drive.google.com/folder2'],

    // Dòng trống ngăn cách
    [],
    [],

    // Row 7: Header kích hoạt parser Section 2 + tiêu đề nhóm lớn (không xóa, không đổi col 0 và col 1)
    sec2Header,

    // Row 8: Sub-header cột giá (không xóa, không đổi)
    sec2SubHeader,

    // Row 9+: Dữ liệu giá — xóa/sửa tùy ý
    // col 0: Ký hiệu khớp Section 1 | col 1: Tên sản phẩm đầy đủ
    // col 4-5: Pricing 1, 2 | col 6-15: giá ship từng phương thức
    ['A', 'AOP CAP - S/M',      'S/M',      '',         8.5,  9.5,  2.5, 11.0, 3.0, 11.5, 5.0, 13.5, 7.0, 15.5, 15.0, 23.5],
    ['A', 'AOP CAP - L/XL',     'L/XL',     '',         9.0, 10.0,  2.5, 11.5, 3.0, 12.0, 5.0, 14.0, 7.0, 16.0, 15.0, 24.0],
    ['B', 'CAP Creative - One', 'One size', 'Printed',  7.5,  8.5,  2.5, 10.0, 3.0, 10.5, 5.0, 12.5, 7.0, 14.5, 15.0, 22.5],
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // ── Column widths ────────────────────────────────────────────────────────────
  ws['!cols'] = [
    { wch: 22 }, // col 0:  Tên Vendor / Ký hiệu (sec2)
    { wch: 20 }, // col 1:  Loại sản phẩm / Product Type (sec2)
    { wch: 12 }, // col 2:  Ký hiệu / Size
    { wch: 34 }, // col 3:  Hình ảnh 1 / Optional
    { wch: 20 }, // col 4:  Hình ảnh 2 / Pricing 1
    { wch: 20 }, // col 5:  Hình ảnh 3 / Pricing 2
    { wch: 20 }, // col 6:  Hình ảnh 4 / Economy Price Ship
    { wch: 26 }, // col 7:  Chất liệu / Economy Total
    { wch: 26 }, // col 8:  Chi tiết Size / Ground Price
    { wch: 22 }, // col 9:  AVG TG Vendor / Ground Total
    { wch: 22 }, // col 10: AVG TG Thực tế / Express Price
    { wch: 26 }, // col 11: Ghi chú / Express Total
    { wch: 30 }, // col 12: Thư mục / 2Day Price
    { wch: 18 }, // col 13: — / 2Day Total
    { wch: 22 }, // col 14: — / Overnight Price
    { wch: 22 }, // col 15: — / Overnight Total
  ];

  // ── Row heights ──────────────────────────────────────────────────────────────
  ws['!rows'] = [
    { hpt: 20 }, // row 0 title
    { hpt: 18 }, // row 1 label
    { hpt: 32 }, // row 2 sec1 header
    { hpt: 18 }, // row 3 data
    { hpt: 18 }, // row 4 data
    {},          // row 5 empty
    {},          // row 6 empty
    { hpt: 28 }, // row 7 sec2 header + group labels
    { hpt: 28 }, // row 8 sub-header
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'CAP');
  XLSX.writeFile(wb, 'HC_VendorLibrary_Template.xlsx');
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
    reader.onload = (e) => {
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
            } else if (sizeCell && sizeCell.v && cellStr(sizeCell.v).startsWith('http') && cellStr(sizeCell.v).match(/\.(jpeg|jpg|gif|png)$/i)) {
              chiTietSizeImage = cellStr(sizeCell.v);
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
          }
        }

        // ── Parse Section 2 — Về giá ─────────────────────────────────────────
        const pricing = [];

        if (pricingHeaderRow >= 0) {
          const endRow = setupRow >= 0 ? setupRow : aoa.length;
          // Data bắt đầu từ sub-header + 1 (skip cả 2 dòng header)
          const dataStart = pricingSubHeaderRow >= 0 ? pricingSubHeaderRow + 1 : pricingHeaderRow + 2;

          for (let r = dataStart; r < endRow; r++) {
            const row = aoa[r] || [];
            if (row.every(c => cellStr(c) === '')) continue;

            const kyHieu = cellStr(row[0]);
            const productType = cellStr(row[1]);
            if (!productType || productType.toLowerCase().includes('product type')) continue;
            // Bỏ header rows lạc
            if (kyHieu.toLowerCase().includes('ký hiệu') || kyHieu.toLowerCase() === 'ky hieu') continue;

            pricing.push({
              kyHieu,
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

            // Tìm shipping method columns từ colP2 trở đi
            // Mỗi method: "price ship" rồi "total" đầu tiên sau đó
            // Bỏ qua "Total Price 2", "Total Price 3"... (extra columns trong một số format)
            let i = colP2 + 1;
            while (i < subCells.length && shipCols.length < 5) {
              if (subCells[i].includes('price ship') || subCells[i].includes('price_ship')) {
                const priceCol = i;
                let totalCol = null;
                for (let j = priceCol + 1; j < subCells.length; j++) {
                  if (subCells[j].includes('price ship') || subCells[j].includes('price_ship')) break;
                  if (subCells[j].includes('total')) { totalCol = j; break; }
                }
                shipCols.push({ price: priceCol, total: totalCol });
                i = totalCol != null ? totalCol + 1 : priceCol + 1;
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

            const getShip = (idx, isTotal) => {
              const col = shipCols[idx];
              if (!col) return null;
              const colIdx = isTotal ? col.total : col.price;
              return colIdx != null ? parseN(row[colIdx]) : null;
            };

            pricing.push({
              kyHieu: lastKyHieu,
              productType: lastProductType,
              size: cellStr(row[colSize]) === 'N/A' ? '' : cellStr(row[colSize]),
              optional: cellStr(row[colOptional]) === 'N/A' ? '' : cellStr(row[colOptional]),
              pricing1: parseN(row[colP1]),
              pricing2: parseN(row[colP2]),
              eco_price: getShip(0, false),
              eco_total: getShip(0, true),
              ground_price: getShip(1, false),
              ground_total: getShip(1, true),
              express_price: getShip(2, false),
              express_total: getShip(2, true),
              twoday_price: getShip(3, false),
              twoday_total: getShip(3, true),
              overnight_price: getShip(4, false),
              overnight_total: getShip(4, true),
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

        resolve({ title, generalInfo, pricing });
      } catch (err) {
        reject(new Error('Lỗi đọc file thư viện: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsArrayBuffer(file);
  });
}
