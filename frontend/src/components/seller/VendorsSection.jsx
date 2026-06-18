// ════════════════════════════════════════════════════════
//  VENDORS SECTION — Thư Viện File
// ════════════════════════════════════════════════════════
import React, { useState } from 'react';
import VendorLibraryViewer from '../staff-b/sections/VendorLibraryViewer';
import { HC } from '../../constants/sellerTheme';

export default function VendorsSection() {
  const [activeTab, setActiveTab] = useState('all');

  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '10px 24px', borderRadius: 12, border: `2px solid ${activeTab === id ? (id === 'best_seller' ? '#D4A017' : HC.blue) : HC.border}`,
        background: activeTab === id ? (id === 'best_seller' ? '#FDF5E6' : HC.blueLight || '#E0F2FE') : HC.surface,
        color: activeTab === id ? (id === 'best_seller' ? '#D4A017' : HC.blueDark) : HC.muted,
        fontSize: 13, fontWeight: activeTab === id ? 900 : 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s'
      }}
      onMouseEnter={e => { if (activeTab !== id) e.currentTarget.style.background = HC.bluePale || '#F0F9FF'; }}
      onMouseLeave={e => { if (activeTab !== id) e.currentTarget.style.background = HC.surface; }}
    >
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>} {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: `1.5px solid ${HC.border}`, paddingBottom: 8 }}>
        <TabButton id="all" label="Tổng quan Vendor & Sản phẩm" icon="📚" />
        <TabButton id="new_products" label="Sản phẩm mới" icon="🆕" />
        <TabButton id="best_seller" label="Best Seller" icon="⭐" />
      </div>

      <VendorLibraryViewer readOnly={true} mode={activeTab} />
    </div>
  );
}
