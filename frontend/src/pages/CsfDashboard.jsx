// ════════════════════════════════════════════════════════
//  CSF DASHBOARD — Xem Thư Viện Vendor theo từng project (không thấy giá)
//
//  Dùng chung cho role `csf` và `marvel`: hai role giống hệt nhau về quyền,
//  chỉ khác nhãn hiển thị → truyền qua prop `roleLabel` (xem route /marvel
//  trong App.jsx).
// ════════════════════════════════════════════════════════
import { useState } from 'react';
import { ShopOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { HC } from '../constants/sellerTheme';
import CsfPdSidebar from '../components/csfpd/CsfPdSidebar';
import VendorLibraryCsfPdViewer from '../components/csfpd/VendorLibraryCsfPdViewer';

const PROJECT_MENU = [
  { id: 'happy',     icon: <ShopOutlined />, label: 'Happy Project' },
  { id: 'creative',  icon: <ShopOutlined />, label: 'Creative Project' },
  { id: 'global',    icon: <ShopOutlined />, label: 'Global Project' },
  { id: 'hapify84',  icon: <ShopOutlined />, label: 'Hapify84 Project' },
];

export default function CsfDashboard({ roleLabel = 'CSF' }) {
  const { user, logout } = useAuth();
  const [active, setActive] = useState('happy');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeLabel = PROJECT_MENU.find(m => m.id === active)?.label || '';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${HC.cream}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: ${HC.orangeMid}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${HC.orange}; }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', background: `linear-gradient(135deg, ${HC.orangePale} 0%, ${HC.cream} 100%)`, fontFamily: "'Nunito Sans',sans-serif", color: HC.ink, overflow: 'hidden' }}>
        <CsfPdSidebar
          active={active}
          setActive={setActive}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          logout={logout}
          menu={PROJECT_MENU}
          roleLabel={roleLabel}
          displayName={user?.full_name || roleLabel}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 72, background: `linear-gradient(135deg, ${HC.surface}, ${HC.surface2})`, borderBottom: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', gap: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 4, height: 32, borderRadius: 99, background: `linear-gradient(to bottom, ${HC.orange}, ${HC.orangeDark})`, flexShrink: 0 }} />
              <div style={{ color: HC.ink, fontWeight: 900, fontSize: 16, fontFamily: "'Nunito',sans-serif", letterSpacing: '-0.01em' }}>
                Thư Viện Vendor — {activeLabel}
              </div>
            </div>
            <div style={{ color: HC.muted, fontSize: 12, fontWeight: 600 }}>
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
            <VendorLibraryCsfPdViewer projectKey={active} />
          </div>
        </div>
      </div>
    </>
  );
}
