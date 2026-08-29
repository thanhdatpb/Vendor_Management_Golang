import { API_BASE_URL } from './constants';
import { fmtVNDate } from '../../utils/vnTime';

export const fmt = n => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n || 0);

const toImageEmbedUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  const driveFile = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (driveFile) return `https://drive.google.com/thumbnail?id=${driveFile[1]}&sz=w400`;
  const driveOpen = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (driveOpen) return `https://drive.google.com/thumbnail?id=${driveOpen[1]}&sz=w400`;
  const driveUc = url.match(/drive\.google\.com\/uc\?.*[?&]id=([^&]+)/);
  if (driveUc) return `https://drive.google.com/thumbnail?id=${driveUc[1]}&sz=w400`;
  return url;
};

export const fmtDate = iso => fmtVNDate(iso, '—');

export const normalizeList = resp => {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.data)) return resp.data;
  if (Array.isArray(resp.data?.data?.data)) return resp.data.data.data;
  if (Array.isArray(resp.data?.data)) return resp.data.data;
  if (Array.isArray(resp.data?.products)) return resp.data.products;
  return [];
};

// Normalize any absolute https://domain/storage/... URL to relative /storage/...
const toStorageRelUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('http') && url.includes('/storage/')) {
    return url.substring(url.indexOf('/storage/'));
  }
  if (url.startsWith('/storage/')) return url;
  if (!url.startsWith('http')) return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  return url;
};

export const getMediaUrls = (product) => {
  if (!product) return [];
  let urls = [];

  if (product.media_urls && Array.isArray(product.media_urls) && product.media_urls.length) {
    urls = urls.concat(product.media_urls.map(toStorageRelUrl));
  } else if (product.media_url) {
    urls.push(toStorageRelUrl(product.media_url));
  } else if (product.media_path) {
    let path = product.media_path;
    if (path.startsWith('storage/')) path = path.replace('storage/', '');
    if (path.startsWith('/storage/')) path = path.replace('/storage/', '');
    if (path.startsWith('http')) urls.push(path);
    else urls.push(`${API_BASE_URL}/storage/${path}`);
  }

  if (product.product_type_links && Array.isArray(product.product_type_links)) {
    urls = urls.concat(product.product_type_links.map(toImageEmbedUrl));
  } else if (product.product_type_link) {
    urls.push(toImageEmbedUrl(product.product_type_link));
  } else if (typeof product.product_type_links === 'string') {
    try {
      urls = urls.concat(JSON.parse(product.product_type_links).map(toImageEmbedUrl));
    } catch {
      urls.push(toImageEmbedUrl(product.product_type_links));
    }
  }

  return [...new Set(urls)].filter(url => typeof url === 'string' && url.trim() !== '');
};

export const normalizeProduct = (p) => {
  let links = [];
  if (p.product_type_links) {
    if (Array.isArray(p.product_type_links)) {
      links = p.product_type_links;
    } else if (typeof p.product_type_links === 'string') {
      try { links = JSON.parse(p.product_type_links); }
      catch { links = [p.product_type_links]; }
    }
  } else if (p.product_type_link) {
    links = [p.product_type_link];
  }
  let project = p.project;
  if (project === 'Global Deputy Project') {
    project = 'Hapify84 Project';
  }
  return {
    ...p,
    project: project,
    product_type_links: links,
    media_urls: p.media_urls || (p.media_url ? [p.media_url] : [])
  };
};
