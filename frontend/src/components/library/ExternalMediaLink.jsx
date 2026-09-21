// ════════════════════════════════════════════════════════════════════════════
//  Fallback cho ô "Hình ảnh" khi URL không hiển thị được như ảnh — thường là
//  link video/tài liệu bên ngoài (vd Lark: printwayfulfillment.jp.larksuite.com).
//  Hiện tên miền rút gọn thành link bấm mở ở tab mới thay cho <img> vỡ.
//
//  Dùng chung cho VendorLibraryViewer và view read-only CSF/PD/Marvel; nằm ở file
//  riêng để view read-only không kéo cả chunk viewer (xem chiTietSizeText.jsx).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { HC } from '../../constants/sellerTheme';
import { getExternalMediaLink } from '../../utils/vendorMedia';

export default function ExternalMediaLink({ url }) {
  const link = getExternalMediaLink(url);

  if (!link) {
    return <span style={{ color: HC.brown, fontSize: 10, lineHeight: 1.3 }}>Không thể hiển thị</span>;
  }

  return (
    <a
      href={link.href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${link.label} — bấm để mở\n${link.href}`}
      aria-label={link.label}
      // Ô ảnh nằm trong hàng bảng có thể bắt click (chọn dòng / mở lightbox).
      onClick={(event) => event.stopPropagation()}
      style={{
        color: HC.brown,
        display: 'inline-block',
        fontSize: 10.5,
        fontWeight: 700,
        lineHeight: 1.3,
        maxWidth: '100%',
        minWidth: 0,
        overflow: 'hidden',
        textDecoration: 'underline',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {link.label}
    </a>
  );
}
