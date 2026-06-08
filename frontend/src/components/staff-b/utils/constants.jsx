import { AppstoreOutlined, ShopOutlined, NotificationOutlined } from '@ant-design/icons';
import React from 'react';

export const API_BASE_URL = import.meta.env.VITE_API_URL || ""; // "" = dùng Vite proxy → /storage → laravel
// export const API_BASE_URL = "http://localhost:8000/api";

export const ITEMS_PER_PAGE = 20;
export const VENDOR_PAGE_SIZE = 20;

export const LS_PRODUCT_VENDORS = 'STAFF_PRODUCT_VENDORS_V1';
export const LS_A_SELECTIONS = 'STAFF_A_SELECTIONS_V1';
export const LS_B_SELECTIONS = 'STAFF_B_SELECTIONS_V1';

export const HC = {
  orange: '#F5A623', orangeDark: '#E09415', orangeDeep: '#C47F10',
  orangeLight: '#FEF3DC', orangeMid: '#FDE8B8', orangePale: '#FFFBF4',
  orangeGlow: 'rgba(245,166,35,0.15)', cream: '#FFF8EE', brown: '#7A5C32',
  brownLight: '#9C7A50', ink: '#1A0F00', ink2: '#3D2B0F', muted: '#B8956A',
  muted2: '#D4B896', surface: '#FFFFFF', surface2: '#FFFDF9', border: '#F0E4CC',
  borderStrong: '#E8D4A8', success: '#16a34a', danger: '#dc2626', warning: '#f59e0b',
  gold: '#B8860B', goldLight: '#FFF8DC', goldMid: '#FFE97A',
  shadow: '0 10px 30px rgba(245,166,35,0.08)', shadowStrong: '0 20px 50px rgba(245,166,35,0.14)',
};

// ── MENU: Products | Library Vendor ─────────────────────────
export const MENU = [
  { id: 'products', icon: <AppstoreOutlined />, label: 'Quản Lý Form Duyệt' },
  { id: 'library', icon: <ShopOutlined />, label: 'Thư Viện Vendor' },
  { id: 'news', icon: <NotificationOutlined />, label: 'Tạo thông báo' },
];

export const PAGE_TITLES = {
  products: 'Product Approval — Quản Lý Form Duyệt',
  library: 'Library Vendor — Thư Viện Vendor',
  news: 'News Management — Tạo Thông Báo',
};

export const EMPTY_FORM = {
  deadline_date: '', product_type: '', media: null, product_type_link: '',
  other_specs: '', material: '', print_area: '', good_review: '', bad_review: '',
  packaging_links: '', other_packaging: '',
};

export const STATUS_CFG = { 
  draft: { bg: HC.orangeLight, text: HC.brown, dot: HC.muted, label: 'Draft' }, 
  pending: { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b', label: 'Pending' }, 
  approved: { bg: '#ecfdf5', text: '#065f46', dot: '#16a34a', label: 'Approved' }, 
  reject: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626', label: 'Rejected' } 
};

export const VENDOR_TYPES = ['Old', 'New', 'Best Seller'];

export const EXCEL_COL_MAP = {
  'vendor name': 'vendor_name', 'vendor_name': 'vendor_name',
  'product type': 'product_type', 'product_type': 'product_type', 'loại sản phẩm': 'product_type',
  'vendor type': 'vendor_type', 'vendor_type': 'vendor_type', 'loại vendor': 'vendor_type',
  'size': 'size', 'kích thước': 'size', 'optional': 'optional', 'tùy chọn': 'optional',
  'pricing 1': 'pricing1', 'pricing1': 'pricing1', 'giá 1': 'pricing1',
  'pricing 2': 'pricing2', 'pricing2': 'pricing2', 'giá 2': 'pricing2',
  'economy ship': 'eco_price', 'eco_price': 'eco_price',
  'economy total': 'eco_total', 'eco_total': 'eco_total', 'economy': 'eco_total',
  'fast ship': 'fast_price', 'fast_price': 'fast_price',
  'fast total': 'fast_total', 'fast_total': 'fast_total', 'fast': 'fast_total',
  'express ship': 'express_price', 'express_price': 'express_price',
  'express total': 'express_total', 'express_total': 'express_total', 'express': 'express_total',
  'overnight ship': 'overnight_price', 'overnight_price': 'overnight_price',
  'overnight total': 'overnight_total', 'overnight_total': 'overnight_total', 'overnight': 'overnight_total',
  'detail size': 'size', 'detail optional': 'optional',
};
