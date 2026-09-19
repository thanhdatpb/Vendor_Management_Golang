import React from 'react';
import VendorLibraryViewer from '../../vendor/sections/VendorLibraryViewer';
import { VENDOR_LIBRARY_MODES } from '../../../utils/vendorLibraryMode';

/**
 * Thư Viện Vendor của Admin.
 *
 * Ba chế độ (Tổng quan / New Arrivals / Best Seller) được chọn ở submenu của
 * sidebar và nằm trên URL (`/admin/vendors?view=…`). AdminDashboard đọc URL rồi
 * truyền `mode` xuống, nên không còn hàng tab riêng trong phần nội dung.
 *
 * `onModeCountsChange` báo ngược số file của New Arrivals / Best Seller lên để
 * sidebar hiển thị badge.
 */
export default function VendorsSection({ mode = VENDOR_LIBRARY_MODES.ALL, onModeCountsChange }) {
  // readOnly: Admin không sửa trực tiếp ô trong bảng.
  // canManage: nhưng vẫn có toàn quyền quản lý thư viện — thêm vendor, tải
  // template, import Excel và chia sẻ file cho project, giống Vendor.
  return (
    <VendorLibraryViewer
      readOnly={true}
      canManage={true}
      mode={mode}
      onModeCountsChange={onModeCountsChange}
    />
  );
}
