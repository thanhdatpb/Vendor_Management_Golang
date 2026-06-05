// ════════════════════════════════════════════════════════
//  SELLER SIDEBAR
// ════════════════════════════════════════════════════════
import { useState } from 'react';
import {
  MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined,
  UserOutlined, CalendarOutlined, ToolOutlined,
} from '@ant-design/icons';
import { HC } from '../../constants/sellerTheme';
import { HCLogo, MENU } from './SellerUI';

export default function SellerSidebar({ active, setActive, sidebarOpen, setSidebarOpen, user, logout }) {
  const [hoveredItem, setHoveredItem] = useState(null);

  return (
    <div style={{
      width: sidebarOpen ? 280 : 80,
      background: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: '2px 0 12px rgba(0, 0, 0, 0.05)',
      borderRight: `1px solid ${HC.border}`,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `radial-gradient(circle at 20% 40%, ${HC.orange}08 1px, transparent 1px)`,
        backgroundSize: '24px 24px', pointerEvents: 'none', opacity: 0.4,
      }} />

      {/* Logo */}
      <div style={{
        padding: sidebarOpen ? '28px 24px' : '28px 20px',
        borderBottom: `1px solid ${HC.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
        justifyContent: sidebarOpen ? 'space-between' : 'center',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: `linear-gradient(135deg, ${HC.orange}10, ${HC.orange}05)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${HC.orange}20`, boxShadow: `0 2px 8px ${HC.orange}10`, flexShrink: 0,
          }}>
            <HCLogo size={28} color={HC.orange} />
          </div>
          {sidebarOpen && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{ color: HC.ink, fontWeight: 900, fontSize: 16, fontFamily: "'Nunito',sans-serif", letterSpacing: '-0.02em' }}>
                Happy Creative LLC
              </div>
              <div style={{ color: HC.orange, fontSize: 10, letterSpacing: '0.2em', fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>
                Seller Dashboard
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User card */}
      {sidebarOpen && (
        <div style={{
          margin: '20px 16px', padding: '16px', borderRadius: 16,
          background: `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`,
          border: `1px solid ${HC.orangeMid}`, animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, color: '#fff',
            }}>
              <ToolOutlined />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>
                {user?.sellerName || user?.seller_name || user?.name || 'Seller'}
              </div>
              <div style={{ fontSize: 10, color: HC.brown, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <UserOutlined style={{ fontSize: 10, color: HC.orange }} />
                <span>Seller</span>
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, color: HC.muted, paddingTop: 8, borderTop: `1px solid ${HC.orangeMid}`, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CalendarOutlined style={{ fontSize: 10 }} />
            <span>Last login: {new Date().toLocaleDateString('vi-VN')}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: sidebarOpen ? '8px 16px' : '8px 12px', marginTop: 8 }}>
        {MENU.map(item => {
          const isActive = active === item.id;
          const isHovered = hoveredItem === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setActive(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: sidebarOpen ? '12px 16px' : '12px',
                marginBottom: 6, borderRadius: 12,
                background: isActive ? `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})` : 'transparent',
                border: `1px solid ${isActive ? HC.orangeMid : 'transparent'}`,
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered && !isActive ? 'translateX(4px)' : 'none',
                position: 'relative', overflow: 'hidden',
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 3, height: 32,
                  background: `linear-gradient(180deg, ${HC.orange}, ${HC.orangeDark})`,
                  borderRadius: '0 4px 4px 0',
                }} />
              )}
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: isActive ? `linear-gradient(135deg, ${HC.orange}20, ${HC.orange}10)` : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: isActive ? HC.orange : HC.muted,
                transition: 'all 0.2s ease', flexShrink: 0,
              }}>
                {item.icon}
              </div>
              {sidebarOpen && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: isActive ? 800 : 600, color: isActive ? HC.orangeDark : HC.brown, fontFamily: "'Nunito',sans-serif", transition: 'color 0.2s ease' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 10, color: HC.muted, marginTop: 2, fontFamily: "'Nunito Sans',sans-serif", opacity: 0.7 }}>
                    {item.desc}
                  </div>
                </div>
              )}
              {!sidebarOpen && isActive && (
                <div style={{ position: 'absolute', right: 8, width: 6, height: 6, borderRadius: '50%', background: HC.orange }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: sidebarOpen ? '16px 16px 24px' : '16px 12px 24px' }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            width: '100%', padding: '10px', borderRadius: 12, background: HC.cream,
            border: `1px solid ${HC.border}`, color: HC.brown, cursor: 'pointer',
            fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, transition: 'all 0.2s ease', fontFamily: "'Nunito',sans-serif",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = HC.orangeLight; e.currentTarget.style.borderColor = HC.orangeMid; e.currentTarget.style.color = HC.orangeDark; }}
          onMouseLeave={e => { e.currentTarget.style.background = HC.cream; e.currentTarget.style.borderColor = HC.border; e.currentTarget.style.color = HC.brown; }}
        >
          {sidebarOpen ? <><MenuFoldOutlined /><span>Thu gọn menu</span></> : <MenuUnfoldOutlined />}
        </button>

        <button
          onClick={logout}
          style={{
            width: '100%', marginTop: 12, padding: '10px', borderRadius: 12,
            background: '#fee2e2', border: '1px solid #fecaca', color: HC.danger,
            cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, transition: 'all 0.2s ease', fontFamily: "'Nunito',sans-serif",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.borderColor = '#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fecaca'; }}
        >
          <LogoutOutlined />
          {sidebarOpen && <span>Đăng xuất</span>}
        </button>

        {sidebarOpen && (
          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 9, fontWeight: 800, color: HC.muted2, letterSpacing: '0.2em', fontFamily: "'Nunito',sans-serif" }}>
            #IT'S ALWAYS DAY 1
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
      `}</style>
    </div>
  );
}
