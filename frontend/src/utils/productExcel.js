/**
 * Chuẩn import Excel form sản phẩm (Seller / Staff A).
 */

const PRODUCT_COL_ALIASES = {
  deadline_date: ['deadline date', 'deadline_date', 'han chot', 'hạn chót'],
  product_type: ['product type', 'product_type', 'loai san pham', 'loại sản phẩm'],
  product_type_link: ['product type link', 'product_type_link', 'link san pham'],
  other_specs: ['dac tinh ky thuat', 'đặc tính kĩ thuật', 'other_specs', 'dac tinh'],
  material: ['chat lieu', 'chất liệu', 'material'],
  print_area: ['vung in/thiet ke', 'vùng in/thiết kế', 'print_area', 'vung in'],
  good_review: ['good review', 'good_review'],
  bad_review: ['bad review', 'bad_review'],
  packaging_links: ['packing', 'packaging_links', 'packaging'],
  other_packaging: ['other packing', 'other_packaging'],
};

const normalizeKey = (key) =>
  String(key ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

function buildColMap(headerRow) {
  const colMap = {};
  headerRow.forEach((cell, idx) => {
    const nk = normalizeKey(cell);
    if (!nk) return;
    for (const [field, aliases] of Object.entries(PRODUCT_COL_ALIASES)) {
      if (aliases.some((a) => nk === a || nk.includes(a))) {
        if (colMap[field] === undefined) colMap[field] = idx;
      }
    }
    if (nk === 'product type' || nk === 'product_type') colMap.product_type = idx;
  });
  return colMap;
}

export function parseExcelDate(value) {
  if (!value && value !== 0) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  if (!s) return '';
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}

function getCell(row, colMap, field) {
  const idx = colMap[field];
  if (idx === undefined) return '';
  const val = row[idx];
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function buildProductPayload(row, colMap) {
  const productType = getCell(row, colMap, 'product_type');
  if (!productType) return null;

  const link = getCell(row, colMap, 'product_type_link');
  const links = link ? [link.startsWith('http') ? link : `https://${link}`] : [];

  return {
    deadline_date: parseExcelDate(getCell(row, colMap, 'deadline_date')),
    product_type: productType,
    product_type_links: links,
    other_specs: getCell(row, colMap, 'other_specs'),
    material: getCell(row, colMap, 'material'),
    print_area: getCell(row, colMap, 'print_area'),
    good_review: getCell(row, colMap, 'good_review'),
    bad_review: getCell(row, colMap, 'bad_review'),
    packaging_links: getCell(row, colMap, 'packaging_links'),
    other_packaging: getCell(row, colMap, 'other_packaging'),
  };
}

export async function parseSellerProductsExcel(file) {
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
        let headerRowIdx = -1;
        let colMap = {};

        for (let r = 0; r < aoa.length; r++) {
          const row = aoa[r] || [];
          const cells = row.map((c) => normalizeKey(c));
          if (cells.some((c) => c === 'product type' || c.includes('product type'))) {
            headerRowIdx = r;
            colMap = buildColMap(row);
            break;
          }
        }

        if (headerRowIdx < 0 || colMap.product_type === undefined) {
          reject(new Error('Không tìm thấy cột "Product Type". Dùng Export để tải file mẫu.'));
          return;
        }

        const products = [];
        for (let r = headerRowIdx + 1; r < aoa.length; r++) {
          const row = aoa[r] || [];
          const first = String(row[0] ?? '').trim();
          const second = normalizeKey(row[1]);

          if (first === 'Z' || second.includes('vendor type')) break;
          if (row.every((c) => String(c).trim() === '')) continue;

          const payload = buildProductPayload(row, colMap);
          if (payload) products.push(payload);
        }

        if (products.length === 0) {
          reject(new Error('Không có dòng sản phẩm hợp lệ (cần có Product Type).'));
          return;
        }

        resolve(products);
      } catch (err) {
        reject(new Error('Lỗi đọc file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc file'));
    reader.readAsArrayBuffer(file);
  });
}

export async function exportProductsImportTemplate(filename = 'products_import_template.xlsx') {
  const xlsxModule = await import('xlsx');
  const XLSX = xlsxModule.default ?? xlsxModule;

  const headers = [
    'Deadline Date', 'Product Type', 'Product Type Link', 'Đặc tính kĩ thuật',
    'Chất liệu', 'Vùng In/Thiết kế', 'Good Review', 'Bad Review',
    'Packing', 'Other Packing',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, Array(headers.length).fill('')]);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, filename);
}
