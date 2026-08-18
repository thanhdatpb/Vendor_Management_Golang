// ════════════════════════════════════════════════════════
//  PD DASHBOARD — Xem Thư Viện Vendor của MỌI project (không thấy giá,
//  và không thấy 2 cột AVG TG).
//
//  PD từng bị ghim theo project của tài khoản. Nay PD tra cứu được toàn bộ
//  project giống CSF: cột `project` trong DB vẫn còn nhưng không dùng để phân
//  quyền nữa, nên không phải đụng vào dữ liệu tài khoản và không ai bị đăng xuất.
// ════════════════════════════════════════════════════════
import { useMemo, useState } from 'react';
import { ShopOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { HC } from '../constants/sellerTheme';
import { PROJECTS } from '../constants/projects';
import CsfPdSidebar from '../components/csfpd/CsfPdSidebar';
import PdVendorLibrary from '../components/csfpd/PdVendorLibrary';

export default function PdDashboard() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const projectMenu = useMemo(
    () => PROJECTS.map(p => ({ id: p.id, icon: <ShopOutlined />, label: p.label })),
    []
  );

  const [active, setActive] = useState(null);
  const projectKey = active || projectMenu[0]?.id || null;
  const activeLabel = projectMenu.find(m => m.id === projectKey)?.label || '';

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
          active={projectKey}
          setActive={setActive}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          logout={logout}
          menu={projectMenu}
          roleLabel="PD"
          displayName={user?.full_name || 'PD'}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 72, background: `linear-gradient(135deg, ${HC.surface}, ${HC.surface2})`, borderBottom: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', gap: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 4, height: 32, borderRadius: 99, background: `linear-gradient(to bottom, ${HC.orange}, ${HC.orangeDark})`, flexShrink: 0 }} />
              <div style={{ color: HC.ink, fontWeight: 900, fontSize: 16, fontFamily: "'Inter',sans-serif", letterSpacing: '-0.01em' }}>
                Thư Viện Vendor {activeLabel ? `— ${activeLabel}` : ''}
              </div>
            </div>
            <div style={{ color: HC.muted, fontSize: 12, fontWeight: 600 }}>
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
            {projectKey ? (
              <PdVendorLibrary projectKey={projectKey} />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', background: HC.surface, borderRadius: 16, border: `2px dashed ${HC.border}` }}>
                <div style={{ fontSize: 40, opacity: 0.5, marginBottom: 10 }}>⚠️</div>
                <div style={{ fontWeight: 800, color: HC.muted, fontSize: 14 }}>
                  Tài khoản chưa được gán Project. Vui lòng liên hệ Admin.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
