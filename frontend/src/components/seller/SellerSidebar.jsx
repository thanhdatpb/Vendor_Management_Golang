// ════════════════════════════════════════════════════════
//  SELLER SIDEBAR — Upgraded UI
// ════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import {
  MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { HC } from '../../constants/sellerTheme';
import { HCLogo, MENU } from './SellerUI';

// ── Tooltip-wrapped nav item ──────────────────────────────────
function NavTooltipItem({ item, isActive, isCollapsed, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: isCollapsed ? '12px' : '12px 16px',
        marginBottom: 6,
        borderRadius: 12,
        background: isActive
          ? `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`
          : hovered ? `${HC.orange}08` : 'transparent',
        border: `1px solid ${isActive ? HC.orangeMid : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered && !isActive ? 'translateX(4px)' : 'none',
        overflow: 'visible',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
      }}
    >
      {isActive && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
          height: 32,
          background: `linear-gradient(180deg, ${HC.orange}, ${HC.orangeDark})`,
          borderRadius: '0 4px 4px 0',
        }} />
      )}

      <div style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: isActive
          ? `linear-gradient(135deg, ${HC.orange}25, ${HC.orange}10)`
          : hovered ? `${HC.orange}10` : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 17,
        color: isActive ? HC.orange : hovered ? HC.orangeDark : HC.muted,
        transition: 'all 0.2s ease',
        flexShrink: 0,
      }}>
        {item.icon}
      </div>

      {!isCollapsed && (
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 14,
            fontWeight: isActive ? 800 : 600,
            color: isActive ? HC.orangeDark : HC.brown,
            fontFamily: "'Nunito',sans-serif",
            transition: 'color 0.2s ease',
          }}>
            {item.label}
          </div>
          <div style={{
            fontSize: 10,
            color: HC.muted,
            marginTop: 2,
            fontFamily: "'Nunito Sans',sans-serif",
            opacity: 0.7,
          }}>
            {item.desc}
          </div>
        </div>
      )}

      {!isCollapsed && isActive && (
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: HC.orange,
          boxShadow: `0 0 0 3px ${HC.orange}30`,
        }} />
      )}

      {/* Tooltip khi collapsed */}
      {isCollapsed && hovered && (
        <div style={{
          position: 'absolute',
          left: 'calc(100% + 12px)',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'rgba(26,15,0,0.90)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Nunito',sans-serif",
          padding: '6px 12px',
          borderRadius: 8,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'seller-slide-in 0.15s ease',
        }}>
          <div style={{ marginBottom: 1 }}>{item.label}</div>
          {item.desc && (
            <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>{item.desc}</div>
          )}
          <div style={{
            position: 'absolute',
            right: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            border: '5px solid transparent',
            borderRightColor: 'rgba(26,15,0,0.90)',
          }} />
        </div>
      )}
    </div>
  );
}

export default function SellerSidebar({ active, setActive, sidebarOpen, setSidebarOpen, user, logout }) {
  const [lastActiveTime, setLastActiveTime] = useState(
    () => localStorage.getItem(`LAST_ACTIVE_${user?.role || 'seller'}`) || Date.now().toString()
  );

  useEffect(() => {
    const roleKey = `LAST_ACTIVE_${user?.role || 'seller'}`;
    let timeout;
    const handleActivity = () => {
      if (!timeout) {
        const now = Date.now().toString();
        localStorage.setItem(roleKey, now);
        setLastActiveTime(now);
        timeout = setTimeout(() => { timeout = null; }, 60000);
      }
    };
    const handleStorage = (e) => { if (e.key === roleKey && e.newValue) setLastActiveTime(e.newValue); };
    window.addEventListener('click', handleActivity);
    window.addEventListener('storage', handleStorage);
    return () => { window.removeEventListener('click', handleActivity); window.removeEventListener('storage', handleStorage); };
  }, [user?.role]);

  const formatLastActive = (ts) => {
    const d = new Date(Number(ts));
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
  };

  return (
    <div style={{
      width: sidebarOpen ? 280 : 72,
      background: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'visible',
      position: 'relative',
      boxShadow: '4px 0 20px rgba(0, 0, 0, 0.04)',
      borderRight: `1px solid ${HC.border}`,
      zIndex: 100,
      flexShrink: 0,
    }}>
      {/* Dot pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(circle at 20% 40%, ${HC.orange}06 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        pointerEvents: 'none',
        opacity: 0.5,
        overflow: 'hidden',
      }} />

      {/* Logo */}
      <div style={{
        padding: sidebarOpen ? '24px 20px' : '24px 14px',
        borderBottom: `1px solid ${HC.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: sidebarOpen ? 'flex-start' : 'center',
        flexShrink: 0,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: 13,
          background: `linear-gradient(135deg, ${HC.orange}15, ${HC.orange}05)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1.5px solid ${HC.orange}20`,
          boxShadow: `0 2px 8px ${HC.orange}12`,
          flexShrink: 0,
        }}>
          <HCLogo size={26} color={HC.orange} />
        </div>
        {sidebarOpen && (
          <div style={{ animation: 'seller-fade-in 0.3s ease' }}>
            <div style={{ color: HC.ink, fontWeight: 900, fontSize: 15, fontFamily: "'Nunito',sans-serif", letterSpacing: '-0.02em' }}>
              Happy Creative LLC
            </div>
            <div style={{ color: HC.orange, fontSize: 9.5, letterSpacing: '0.22em', fontWeight: 800, textTransform: 'uppercase', marginTop: 3 }}>
              Seller Dashboard
            </div>
          </div>
        )}
      </div>

      {/* User card */}
      {sidebarOpen && (
        <div style={{
          margin: '16px 14px', padding: '14px', borderRadius: 14,
          background: `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`,
          border: `1px solid ${HC.orangeMid}`,
          animation: 'seller-fade-in 0.3s ease',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#fff',
              boxShadow: `0 3px 10px ${HC.orange}40`,
              flexShrink: 0,
            }}>
              <UserOutlined />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: HC.ink, fontFamily: "'Nunito',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.sellerName || user?.seller_name || user?.name || 'Seller'}
              </div>
              <div style={{ fontSize: 10, color: HC.brown, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <UserOutlined style={{ fontSize: 9, color: HC.orange }} />
                <span>Seller Account</span>
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 10, color: HC.success,
            paddingTop: 8, borderTop: `1px solid ${HC.orangeMid}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: HC.success,
              animation: 'seller-pulse 2.5s ease-in-out infinite',
            }} />
            <span style={{ fontWeight: 700 }}>Online · {formatLastActive(lastActiveTime)}</span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{
        flex: 1, padding: sidebarOpen ? '6px 14px' : '6px 10px',
        overflowY: 'auto', overflowX: 'visible',
        scrollbarWidth: 'none',
      }}>
        {MENU.map(item => (
          <NavTooltipItem
            key={item.id}
            item={item}
            isActive={active === item.id}
            isCollapsed={!sidebarOpen}
            onClick={() => setActive(item.id)}
          />
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: sidebarOpen ? '12px 14px 20px' : '12px 10px 20px', flexShrink: 0 }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            width: '100%', padding: '9px', borderRadius: 11,
            background: HC.cream, border: `1px solid ${HC.border}`,
            color: HC.brown, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, transition: 'all 0.2s ease', fontFamily: "'Nunito',sans-serif", fontWeight: 700,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = HC.orangeLight; e.currentTarget.style.borderColor = HC.orangeMid; e.currentTarget.style.color = HC.orangeDark; }}
          onMouseLeave={e => { e.currentTarget.style.background = HC.cream; e.currentTarget.style.borderColor = HC.border; e.currentTarget.style.color = HC.brown; }}
        >
          {sidebarOpen ? <><MenuFoldOutlined /><span>Thu gọn</span></> : <MenuUnfoldOutlined />}
        </button>

        <button
          onClick={logout}
          style={{
            width: '100%', marginTop: 8, padding: '9px', borderRadius: 11,
            background: '#fff5f5', border: '1px solid #fecaca',
            color: HC.danger, cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, transition: 'all 0.2s ease', fontFamily: "'Nunito',sans-serif", fontWeight: 700,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.borderColor = '#fecaca'; }}
        >
          <LogoutOutlined />
          {sidebarOpen && <span>Đăng xuất</span>}
        </button>

        {sidebarOpen && (
          <div style={{
            marginTop: 16, textAlign: 'center', fontSize: 9,
            fontWeight: 800, color: HC.muted2, letterSpacing: '0.22em',
            fontFamily: "'Nunito',sans-serif",
          }}>
            #IT'S ALWAYS DAY 1
          </div>
        )}
      </div>

      <style>{`
        @keyframes seller-fade-in {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes seller-slide-in {
          from { opacity: 0; transform: translateY(-50%) translateX(-6px); }
          to   { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
        @keyframes seller-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(22,163,74,0.5); }
          50%       { box-shadow: 0 0 0 4px rgba(22,163,74,0); }
        }
        nav::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
