import { API_BASE_URL } from './constants';
import { fmtVNDate } from '../../../utils/vnTime';

export const getMediaUrls = (product) => {
  if (!product) return [];
  let urls = [];

  if (product.media_urls && Array.isArray(product.media_urls) && product.media_urls.length) {
    urls = urls.concat(product.media_urls.map(url =>
      url.startsWith('http') ? url : `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
    ));
  } else if (product.media_path) {
    const full = product.media_path.startsWith('http')
      ? product.media_path
      : `${API_BASE_URL}/storage/${product.media_path.replace(/^\/?storage\//, '')}`;
    urls.push(full);
  } else if (product.image_url) {
    const full = product.image_url.startsWith('http')
      ? product.image_url
      : `${API_BASE_URL}${product.image_url.startsWith('/') ? '' : '/'}${product.image_url}`;
    urls.push(full);
  } else if (product.media_url) {
    const full = product.media_url.startsWith('http')
      ? product.media_url
      : `${API_BASE_URL}${product.media_url.startsWith('/') ? '' : '/'}${product.media_url}`;
    urls.push(full);
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

export const fmtDate = iso => fmtVNDate(iso);

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

export {
  normalizeVendorType,
  normalizeOptionalField,
  buildVendorPayload,
  vendorMatchesExisting,
  parseVendorExcel,
  VENDOR_TYPES as VENDOR_TYPE_LIST,
} from '../../../utils/vendorExcel';
