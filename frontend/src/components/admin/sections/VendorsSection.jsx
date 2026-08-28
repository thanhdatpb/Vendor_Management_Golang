import React, { useState } from 'react';
import VendorLibraryViewer from '../../vendor/sections/VendorLibraryViewer';
import { HC } from '../constants';

export default function VendorsSection() {
  const [activeTab, setActiveTab] = useState('all');

  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '10px 24px', borderRadius: 12, border: `2px solid ${activeTab === id ? (id === 'best_seller' ? '#D4A017' : HC.orange) : HC.border}`,
        background: activeTab === id ? (id === 'best_seller' ? '#FDF5E6' : HC.orangeLight) : HC.surface,
        color: activeTab === id ? (id === 'best_seller' ? '#D4A017' : HC.orangeDark) : HC.muted,
        fontSize: 13, fontWeight: activeTab === id ? 900 : 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
      }}
      onMouseEnter={e => { if (activeTab !== id) e.currentTarget.style.background = HC.orangePale || '#FFFBF4'; }}
      onMouseLeave={e => { if (activeTab !== id) e.currentTarget.style.background = HC.surface; }}
    >
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>} {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: `1.5px solid ${HC.border}`, paddingBottom: 8 }}>
        <TabButton id="all" label="Tổng quan Vendor & Sản phẩm" />
        <TabButton id="new_products" label="New Arrivals" />
        <TabButton id="best_seller" label="Best Seller" />
      </div>

      {/* readOnly: Admin không sửa trực tiếp ô trong bảng.
          canManage: nhưng vẫn có toàn quyền quản lý thư viện — thêm vendor, tải
          template, import Excel và chia sẻ file cho project, giống Vendor. */}
      <VendorLibraryViewer readOnly={true} canManage={true} mode={activeTab} />
    </div>
  );
}
