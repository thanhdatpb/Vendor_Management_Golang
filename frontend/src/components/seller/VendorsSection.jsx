// ════════════════════════════════════════════════════════
//  VENDORS SECTION — Thư Viện File
//
//  Ba chế độ (Tổng quan / New Arrivals / Best Seller) chọn ở submenu sidebar và
//  nằm trên URL (`/seller/vendors?view=…`) — SellerDashboard đọc rồi truyền
//  `mode` xuống, nên ở đây không còn hàng tab.
// ════════════════════════════════════════════════════════
import React from 'react';
import VendorLibraryViewer from '../vendor/sections/VendorLibraryViewer';
import { VENDOR_LIBRARY_MODES } from '../../utils/vendorLibraryMode';

export default function VendorsSection({
  mode = VENDOR_LIBRARY_MODES.ALL,
  onModeCountsChange,
  highlightFileId,
  onHighlightCleared,
}) {
  return (
    <VendorLibraryViewer
      readOnly={true}
      mode={mode}
      onModeCountsChange={onModeCountsChange}
      // Highlight đi kèm link tới một file cụ thể: chỉ có nghĩa ở danh sách đầy
      // đủ, hai chế độ còn lại có thể không chứa file đó.
      highlightFileId={mode === VENDOR_LIBRARY_MODES.ALL ? highlightFileId : null}
      onHighlightCleared={onHighlightCleared}
    />
  );
}
