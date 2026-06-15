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

        for (let r = 0; r < aoa.length; r++) {
          const row = aoa[r] || [];
          const col0 = cellStr(row[0]).toLowerCase();
          const col1 = cellStr(row[1]).toLowerCase();

          // Section 1 header: "Product Type" ở col 0 hoặc "Thông tin chung"
          if ((col0 === 'product type' || col0.includes('thông tin chung') || col0.includes('thong tin chung'))
              && generalInfoHeaderRow === -1) {
            generalInfoHeaderRow = r;
          }

          // Section 2 header: "Ký hiệu" ở col 0 + "product type" ở col 1
          if ((col0 === 'ký hiệu' || col0 === 'ky hieu' || col0 === 'kí hiệu')
              && col1.includes('product type') && pricingHeaderRow === -1) {
            pricingHeaderRow = r;
            pricingSubHeaderRow = r + 1;
          }

          // Dừng khi gặp "Setup giá bán"
          if (col0.includes('setup') && (col0.includes('giá') || col0.includes('gia'))) {
            setupRow = r;
            break;
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
          hRow.forEach((h, c) => {
            const s = cellStr(h).toLowerCase();
            if (s.includes('product type')) col_kyHieu = c; // Note: header là Product Type nhưng chứa ký hiệu
            if (s.includes('hình ảnh') || s.includes('video')) col_imagesStart = c;
            if (s.includes('chất liệu') || s.includes('material')) col_chatLieu = c;
            if (s.includes('chi tiết size') || s.includes('chi tiet size')) col_chiTietSize = c;
            if (s.includes('avg') && (s.includes('vendor') || s.includes('theo vendor'))) col_avgVendor = c;
            if (s.includes('avg') && (s.includes('thực tế') || s.includes('thuc te'))) col_avgActual = c;
            if (s.includes('notes') || s.includes('ghi chú')) col_notes = c;
            if (s.includes('link folder') || s.includes('thư mục')) col_linkFolder = c;
          });

          const endRow = pricingHeaderRow >= 0 ? pricingHeaderRow : aoa.length;
          for (let r = generalInfoHeaderRow + 1; r < endRow; r++) {
            const row = aoa[r] || [];
            if (row.every(c => cellStr(c) === '')) continue;
            
            const originalKyHieu = cellStr(row[col_kyHieu]);
            const kyHieuLower = originalKyHieu.toLowerCase().trim();
            
            // Bỏ qua các dòng trống hoặc dòng header trùng lặp
            if (!originalKyHieu || kyHieuLower.includes('thông tin') || kyHieuLower.includes('product type')) continue;

            // Nếu gặp tiêu đề của phần 2 ("Về giá") thì dừng đọc Section 1
            const isPricingSection = row.some(cell => {
              const str = cellStr(cell).toLowerCase().trim();
              return str === 'về giá' || str === 've gia' || str.includes('về giá') || str.includes('ve gia');
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

        if (generalInfo.length === 0 && pricing.length === 0) {
          reject(new Error('Không nhận diện được định dạng Happy Creative. Kiểm tra file Excel.'));
          return;
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
