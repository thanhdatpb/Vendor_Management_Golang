import React from 'react';
import { DashboardOutlined, AppstoreOutlined, ShopOutlined } from '@ant-design/icons';

export const HC = {
  orange: '#F5A623', orangeDark: '#E09415', orangeDeep: '#C47F10',
  orangeLight: '#FEF3DC', orangeMid: '#FDE8B8', orangePale: '#FFFBF4',
  orangeGlow: 'rgba(245,166,35,0.15)', cream: '#FFF8EE', brown: '#7A5C32',
  brownLight: '#9C7A50', ink: '#1A0F00', ink2: '#3D2B0F', muted: '#B8956A',
  muted2: '#D4B896', surface: '#FFFFFF', surface2: '#FFFDF9', border: '#F0E4CC',
  borderStrong: '#E8D4A8', success: '#16a34a', danger: '#dc2626', warning: '#f59e0b',
  accent: '#E09415', shadow: '0 10px 30px rgba(245,166,35,0.08)', shadowStrong: '0 20px 50px rgba(245,166,35,0.14)',
};

export const STATUS_CFG = {
  pending: { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b', label: 'Chờ duyệt' },
  approved: { bg: '#ecfdf5', text: '#065f46', dot: '#16a34a', label: 'Đã duyệt' },
  rejected: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626', label: 'Từ chối' },
};

export const MENU = [
  { id: 'overview', icon: <DashboardOutlined />, label: 'Tổng Quan', desc: 'Overview' },
  { id: 'products', icon: <AppstoreOutlined />, label: 'Duyệt Form Sản Phẩm', desc: 'Form Approval Management' },
  { id: 'vendors', icon: <ShopOutlined />, label: 'Thư Viện Vendor', desc: 'Vendor Library' },
];

export const PAGE_TITLES = {
  overview: 'Overview — Tổng Quan',
  products: 'Products — Duyệt Form Sản Phẩm',
  vendors: 'Vendors — Thư Viện Vendor',
};

export const API_BASE_URL = import.meta.env.VITE_API_URL || "";
export const ITEMS_PER_PAGE = 20;
export const LS_SELLER_PRODUCTS = 'SELLER_PRODUCTS_V1';
