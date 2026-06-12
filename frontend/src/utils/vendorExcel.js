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
  const n = parseFloat(String(value).replace(/[^\d.-]/g, ''));
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
               const n = parseFloat(String(val).replace(/[^\d.-]/g, ''));
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
                    overnight_price: parseN(row[12]),
                    overnight_total: parseN(row[13])
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
