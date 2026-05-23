import * as XLSX from 'xlsx';
import { API_BASE_URL } from './constants';

export const getMediaUrls = (product) => {
  if (!product) return [];
  if (product.media_urls && Array.isArray(product.media_urls) && product.media_urls.length) {
    return product.media_urls.map(url =>
      url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
    );
  }
  if (product.media_path) {
    const full = product.media_path.startsWith('http')
      ? product.media_path
      : `${API_BASE_URL}/storage/${product.media_path.replace(/^\/?storage\//, '')}`;
    return [full];
  }
  if (product.image_url) {
    const full = product.image_url.startsWith('http')
      ? product.image_url
      : `${API_BASE_URL}${product.image_url.startsWith('/') ? '' : '/'}${product.image_url}`;
    return [full];
  }
  return [];
};

export const fmtDate = iso => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('vi-VN'); } catch { return iso; }
};

export const lsGet = (key, fallback) => { 
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; } 
};

export const lsSet = (key, val) => { 
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { } 
};

export const playNotificationSound = () => {
  try {
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,U3RlYW0gRW5jb2RlciB2ZXJzaW9uIDENCkZpbGUgc291cmNlOiBodHRwOi8vY29tbWVudC5zc28ub3JnL3BsYXlzb3VuZC8NCkJpdHJhdGU6IDExMDI1DQpDaGFubmVsczogMQ0KU2FtcGxlcyA6IDEwMDAwDQpEYXRhIA0A';
    audio.volume = 0.4;
    audio.play().catch(e => console.log('Audio play failed:', e));
  } catch (e) { console.log('Cannot play sound:', e); }
};

export const normalizeVendorType = (value) => {
  const val = (value || '').toString().trim().toLowerCase();
  if (val === 'old') return 'Old';
  if (val === 'new') return 'New';
  if (val === 'bestseller' || val === 'best seller' || val === 'best' || val === 'bs') return 'Best Seller';
  return value;
};

export function parseVendorExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (!rawData || rawData.length === 0) {
          resolve([]);
          return;
        }

        const vendors = [];

        const mapColumn = (row, possibleNames) => {
          for (const name of possibleNames) {
            if (row[name] !== undefined && row[name] !== '') {
              return row[name];
            }
            const lowerName = name.toLowerCase();
            for (const key of Object.keys(row)) {
              if (key.toLowerCase() === lowerName) {
                return row[key];
              }
            }
          }
          return '';
        };

        for (let i = 0; i < rawData.length; i++) {
          const row = rawData[i];

          let productType = mapColumn(row, ['Product Type', 'product_type', 'product type', 'PRODUCT TYPE']);
          productType = productType.toString().trim();

          let vendorType = mapColumn(row, ['Vendor Type', 'vendor_type', 'vendor type', 'VENDOR TYPE']);
          vendorType = vendorType.toString().trim();

          if (!productType || !vendorType) {
            continue;
          }

          // Lấy vendor name từ cột Vendor Name hoặc name
          let vendorName = mapColumn(row, ['Vendor Name', 'vendor_name', 'VENDOR NAME', 'name', 'Name']);
          vendorName = vendorName ? vendorName.toString().trim() : '';

          const size = mapColumn(row, ['Size', 'size', 'SIZE']);
          const optional = mapColumn(row, ['Optional', 'optional', 'OPTIONAL']);

          const pricing1 = parseFloat(mapColumn(row, ['Pricing 1', 'pricing1', 'pricing 1', 'PRICING 1', 'Pricing1']) || 0);
          const pricing2 = parseFloat(mapColumn(row, ['Pricing 2', 'pricing2', 'pricing 2', 'PRICING 2', 'Pricing2']) || 0);
          const eco_price = parseFloat(mapColumn(row, ['Economy Price Ship', 'economy_price_ship', 'Economy Ship', 'economy ship', 'ECONOMY PRICE SHIP']) || 0);
          const eco_total = parseFloat(mapColumn(row, ['Economy Total', 'economy_total', 'Economy', 'economy', 'ECONOMY TOTAL']) || 0);
          const fast_price = parseFloat(mapColumn(row, ['Fast Price Ship', 'fast_price_ship', 'Fast Ship', 'fast ship', 'FAST PRICE SHIP']) || 0);
          const fast_total = parseFloat(mapColumn(row, ['Fast Total', 'fast_total', 'Fast', 'fast', 'FAST TOTAL']) || 0);
          const express_price = parseFloat(mapColumn(row, ['Express Price Ship', 'express_price_ship', 'Express Ship', 'express ship', 'EXPRESS PRICE SHIP']) || 0);
          const express_total = parseFloat(mapColumn(row, ['Express Total', 'express_total', 'Express', 'express', 'EXPRESS TOTAL']) || 0);
          const overnight_price = parseFloat(mapColumn(row, ['Overnight Price Ship', 'overnight_price_ship', 'Overnight Ship', 'overnight ship', 'OVERNIGHT PRICE SHIP']) || 0);
          const overnight_total = parseFloat(mapColumn(row, ['Overnight Total', 'overnight_total', 'Overnight', 'overnight', 'OVERNIGHT TOTAL']) || 0);

          const vendor = {
            name: vendorName,
            product_type: productType,
            vendor_type: normalizeVendorType(vendorType),
            size: size ? size.toString().trim() : '',
            optional: optional ? optional.toString().trim() : '',
            pricing1: isNaN(pricing1) ? null : pricing1,
            pricing2: isNaN(pricing2) ? null : pricing2,
            eco_price: isNaN(eco_price) ? null : eco_price,
            eco_total: isNaN(eco_total) ? null : eco_total,
            fast_price: isNaN(fast_price) ? null : fast_price,
            fast_total: isNaN(fast_total) ? null : fast_total,
            express_price: isNaN(express_price) ? null : express_price,
            express_total: isNaN(express_total) ? null : express_total,
            overnight_price: isNaN(overnight_price) ? null : overnight_price,
            overnight_total: isNaN(overnight_total) ? null : overnight_total,
          };

          vendors.push(vendor);
        }

        if (vendors.length === 0) {
          reject(new Error('Không tìm thấy dữ liệu vendor trong file. Vui lòng kiểm tra lại cột tiêu đề.'));
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
