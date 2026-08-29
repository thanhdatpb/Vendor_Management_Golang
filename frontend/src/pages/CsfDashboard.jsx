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
import { PROJECTS } from '../constants/projects';
import useSectionRoute from '../hooks/useSectionRoute';
import CsfPdSidebar from '../components/csfpd/CsfPdSidebar';
import CsfVendorLibrary from '../components/csfpd/CsfVendorLibrary';

// Danh sách project khai ở constants/projects.js — dùng chung với PD.
const PROJECT_MENU = PROJECTS.map(p => ({ id: p.id, icon: <ShopOutlined />, label: p.label }));

// Project đang xem nằm trên URL (/csf/happy, /marvel/creative…) — gửi link
// thẳng tới đúng project thay vì bảo người nhận 'vào rồi tự bấm sang tab'.
const PROJECT_SECTIONS = PROJECTS.map(p => ({ id: p.id, slug: p.id, title: `Thư Viện Vendor — ${p.label}` }));

/**
 * Dùng chung cho route /csf và /marvel. Hai bộ phận khác nhau ở NỘI DUNG bảng
 * nên mỗi bên truyền component thư viện của mình vào — xem components/csfpd/.
 */
export default function CsfDashboard({ basePath = '/csf', roleLabel = 'CSF', libraryComponent }) {
  // Gán ra biến hoa đầu để dùng làm tag JSX. Không destructure thẳng thành
  // `LibraryComponent`: project không cài eslint-plugin-react nên ESLint không
  // thấy JSX dùng tham số, sẽ báo nhầm "never used".
  const LibraryComponent = libraryComponent || CsfVendorLibrary;
  const { user, logout } = useAuth();
  const [active, setActive] = useSectionRoute({ basePath, sections: PROJECT_SECTIONS, fallback: 'happy' });
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeLabel = PROJECT_MENU.find(m => m.id === active)?.label || '';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${HC.cream}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: ${HC.orangeMid}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${HC.orange}; }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', background: `linear-gradient(135deg, ${HC.orangePale} 0%, ${HC.cream} 100%)`, fontFamily: "'Inter',sans-serif", color: HC.ink, overflow: 'hidden' }}>
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
              <div style={{ color: HC.ink, fontWeight: 900, fontSize: 16, fontFamily: "'Inter',sans-serif", letterSpacing: '-0.01em' }}>
                Thư Viện Vendor — {activeLabel}
              </div>
            </div>
            <div style={{ color: HC.muted, fontSize: 12, fontWeight: 600 }}>
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
            <LibraryComponent projectKey={active} />
          </div>
        </div>
      </div>
    </>
  );
}
