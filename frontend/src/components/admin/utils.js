import { API_BASE_URL } from './constants';

export const fmt = n => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n || 0);

export const fmtDate = iso => { 
  try { 
    return iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'; 
  } catch { 
    return '—'; 
  } 
};

export const normalizeList = resp => {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.data)) return resp.data;
  if (Array.isArray(resp.data?.data?.data)) return resp.data.data.data;
  if (Array.isArray(resp.data?.data)) return resp.data.data;
  if (Array.isArray(resp.data?.products)) return resp.data.products;
  return [];
};

export const getMediaUrls = (product) => {
  if (!product) return [];

  if (product.media_urls && Array.isArray(product.media_urls) && product.media_urls.length) {
    return product.media_urls.map(url => {
      if (url.startsWith('http')) return url;
      if (url.startsWith('/storage')) return `${API_BASE_URL}${url}`;
      return `${API_BASE_URL}/storage/${url}`;
    });
  }

  if (product.media_url) {
    const url = product.media_url;
    if (url.startsWith('http')) return [url];
    if (url.startsWith('/storage')) return [`${API_BASE_URL}${url}`];
    return [`${API_BASE_URL}/storage/${url}`];
  }

  if (product.media_path) {
    let path = product.media_path;
    if (path.startsWith('storage/')) {
      path = path.replace('storage/', '');
    }
    if (path.startsWith('/storage/')) {
      path = path.replace('/storage/', '');
    }
    if (path.startsWith('http')) return [path];
    return [`${API_BASE_URL}/storage/${path}`];
  }

  return [];
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
    project = 'Pilot Project';
  }
  return {
    ...p,
    project: project,
    product_type_links: links,
    media_urls: p.media_urls || (p.media_url ? [p.media_url] : [])
  };
};
