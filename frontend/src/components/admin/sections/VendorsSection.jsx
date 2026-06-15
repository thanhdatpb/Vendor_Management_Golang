import React, { useState } from 'react';
import VendorLibraryViewer from '../../staff-b/sections/VendorLibraryViewer';
import { HC } from '../constants';

export default function VendorsSection() {
  const [activeTab, setActiveTab] = useState('all');

  const TabButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: activeTab === id ? 900 : 700,
        background: activeTab === id ? `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})` : HC.surface,
        color: activeTab === id ? '#fff' : HC.muted,
        boxShadow: activeTab === id ? '0 4px 12px rgba(234,88,12,0.3)' : 'none',
        transition: 'all 0.2s', fontFamily: "'Nunito',sans-serif",
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span> {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: `1.5px solid ${HC.border}`, paddingBottom: 8 }}>
        <TabButton id="all" label="Tất cả Vendor" icon="📚" />
        <TabButton id="new_products" label="Sản phẩm mới" icon="🆕" />
      </div>

      <VendorLibraryViewer readOnly={true} mode={activeTab} />
    </div>
  );
}
