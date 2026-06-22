// ════════════════════════════════════════════════════════
//  SELLER SIDEBAR — Dark Slate Theme
// ════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { HC } from '../../constants/sellerTheme';
import { HCLogo, MENU } from './SellerUI';

const DARK = {
  bg:           'var(--hc-dark-bg)',
  bgHover:      'var(--hc-dark-bg-hover)',
  bgActive:     'var(--hc-dark-active)',
  border:       'var(--hc-dark-border)',
  borderActive: 'rgba(249,115,22,0.4)',
  text:         'var(--hc-dark-text)',
  textMuted:    'var(--hc-dark-text-muted)',
  textActive:   '#fff',
  accent:       HC.orange,
  cardBg:       'var(--hc-dark-bg-hover)',
};

function NavTooltipItem({ item, isActive, isCollapsed, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: 12,
        padding: isCollapsed ? '11px' : '11px 16px',
        marginBottom: 4, borderRadius: 10,
        background: isActive ? DARK.bgActive : hovered ? DARK.bgHover : 'transparent',
        border: `1px solid ${isActive ? DARK.borderActive : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'visible',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
      }}
    >
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 28, background: DARK.accent,
          borderRadius: '0 3px 3px 0', boxShadow: `0 0 8px ${DARK.accent}80`,
        }} />
      )}

      <div style={{
        width: 30, height: 30, borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
        color: isActive ? DARK.accent : hovered ? DARK.text : DARK.textMuted,
        transition: 'color 0.18s ease', flexShrink: 0,
      }}>
        {item.icon}
      </div>

      {!isCollapsed && (
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 13.5, fontWeight: isActive ? 700 : 500,
            color: isActive ? DARK.textActive : hovered ? DARK.text : DARK.textMuted,
            fontFamily: "'Nunito',sans-serif",
            transition: 'color 0.18s ease', letterSpacing: '0.01em',
          }}>
            {item.label}
          </div>
        </div>
      )}

      {!isCollapsed && isActive && (
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: DARK.accent, boxShadow: `0 0 0 3px ${DARK.accent}30`, flexShrink: 0,
        }} />
      )}

      {isCollapsed && hovered && (
        <div style={{
          position: 'absolute', left: 'calc(100% + 12px)', top: '50%',
          transform: 'translateY(-50%)',
          background: '#0f172a', color: '#f1f5f9',
          fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif",
          padding: '6px 12px', borderRadius: 8,
          whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
          animation: 'seller-slide-in 0.15s ease',
        }}>
          {item.label}
          <div style={{
            position: 'absolute', right: '100%', top: '50%',
            transform: 'translateY(-50%)',
            border: '5px solid transparent', borderRightColor: '#0f172a',
          }} />
        </div>
      )}
    </div>
  );
}

function CollapsedUserItem({ user, logout }) {
  const [hovered, setHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const displayName = user?.sellerName || user?.seller_name || user?.name || 'Seller';

  return (
    <div style={{ position: 'relative', marginBottom: 4 }}>
      <div
        onClick={() => setShowMenu(v => !v)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: '11px', borderRadius: 10,
          background: showMenu ? DARK.bgActive : hovered ? DARK.bgHover : 'transparent',
          border: `1px solid ${showMenu ? DARK.borderActive : 'transparent'}`,
          cursor: 'pointer', transition: 'all 0.18s ease',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: '#fff', flexShrink: 0,
        }}>
          <UserOutlined />
        </div>
      </div>

      {showMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setShowMenu(false)}
          />
          <div style={{
            position: 'absolute', left: 'calc(100% + 12px)', top: '50%',
            transform: 'translateY(-50%)',
            background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '10px', zIndex: 9999,
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)', minWidth: 165,
            animation: 'seller-slide-in 0.15s ease',
          }}>
            <div style={{
              position: 'absolute', right: '100%', top: '50%',
              transform: 'translateY(-50%)',
              border: '6px solid transparent', borderRightColor: '#0f172a',
            }} />
            <div style={{ padding: '4px 6px 10px', borderBottom: `1px solid ${DARK.border}` }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#f1f5f9',
                fontFamily: "'Nunito',sans-serif",
              }}>
                {displayName}
              </div>
              <div style={{
                fontSize: 10, color: DARK.textMuted, marginTop: 3,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <UserOutlined style={{ fontSize: 9, color: HC.orange }} />
                <span>Seller Account</span>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); logout(); }}
              style={{
                width: '100%', marginTop: 8, padding: '7px 10px',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 8, color: '#f87171',
                fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif",
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 7, transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.16)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}
            >
              <LogoutOutlined />
              Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function SellerSidebar({ active, setActive, sidebarOpen, setSidebarOpen, user, logout }) {
  const [lastActiveTime, setLastActiveTime] = useState(
    () => localStorage.getItem(`LAST_ACTIVE_${user?.role || 'seller'}`) || Date.now().toString()
  );
  const [showLogout, setShowLogout] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);

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

  useEffect(() => { if (!sidebarOpen) setShowLogout(false); }, [sidebarOpen]);

  const formatLastActive = (ts) => {
    const d = new Date(Number(ts));
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
  };

  const displayName = user?.sellerName || user?.seller_name || user?.name || 'Seller';

  return (
    <div style={{
      width: sidebarOpen ? 260 : 68,
      background: DARK.bg,
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'visible', position: 'relative',
      boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
      borderRight: `1px solid ${DARK.border}`,
      zIndex: 100, flexShrink: 0,
    }}>
      {/* Logo — click to collapse/expand */}
      <div
        onClick={() => setSidebarOpen(!sidebarOpen)}
        onMouseEnter={() => setLogoHovered(true)}
        onMouseLeave={() => setLogoHovered(false)}
        style={{
          padding: sidebarOpen ? '22px 18px' : '22px 12px',
          borderBottom: `1px solid ${DARK.border}`,
          display: 'flex', alignItems: 'center', gap: 12,
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          flexShrink: 0, cursor: 'pointer',
          background: logoHovered ? DARK.bgHover : 'transparent',
          transition: 'background 0.18s ease',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 11,
          background: logoHovered ? 'rgba(249,115,22,0.22)' : 'rgba(249,115,22,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(249,115,22,0.25)',
          flexShrink: 0, transition: 'background 0.18s ease',
        }}>
          <HCLogo size={24} color={HC.orange} />
        </div>
        {sidebarOpen && (
          <div style={{ animation: 'seller-fade-in 0.25s ease' }}>
            <div style={{
              color: '#f1f5f9', fontWeight: 800, fontSize: 14.5,
              fontFamily: "'Nunito',sans-serif", letterSpacing: '-0.01em',
            }}>
              Happy Creative LLC
            </div>
            <div style={{
              color: HC.orange, fontSize: 9, letterSpacing: '0.2em',
              fontWeight: 700, textTransform: 'uppercase', marginTop: 3, opacity: 0.85,
            }}>
              Vendor Management
            </div>
          </div>
        )}
      </div>

      {/* User section */}
      {sidebarOpen ? (
        /* Expanded: user card — click to toggle logout */
        <div
          onClick={() => setShowLogout(v => !v)}
          style={{
            margin: '14px 12px', padding: '12px 14px', borderRadius: 12,
            background: DARK.cardBg,
            border: `1px solid ${showLogout ? 'rgba(249,115,22,0.3)' : DARK.border}`,
            animation: 'seller-fade-in 0.25s ease',
            flexShrink: 0, cursor: 'pointer',
            transition: 'border-color 0.18s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#fff', flexShrink: 0,
            }}>
              <UserOutlined />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#f1f5f9',
                fontFamily: "'Nunito',sans-serif",
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {displayName}
              </div>
              <div style={{
                fontSize: 10, color: DARK.textMuted,
                display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
              }}>
                <UserOutlined style={{ fontSize: 9, color: HC.orange }} />
                <span>Seller Account</span>
              </div>
            </div>
          </div>

          <div style={{
            fontSize: 10, color: '#4ade80', marginTop: 10, paddingTop: 10,
            borderTop: `1px solid ${DARK.border}`,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: '#4ade80',
              animation: 'seller-pulse 2.5s ease-in-out infinite', flexShrink: 0,
            }} />
            <span style={{ fontWeight: 600 }}>Online · {formatLastActive(lastActiveTime)}</span>
          </div>

          {showLogout && (
            <div
              onClick={(e) => { e.stopPropagation(); logout(); }}
              style={{
                marginTop: 10, paddingTop: 10,
                borderTop: `1px solid rgba(248,113,113,0.2)`,
                display: 'flex', alignItems: 'center', gap: 8,
                color: '#f87171', cursor: 'pointer',
                animation: 'seller-fade-in 0.15s ease',
              }}
            >
              <LogoutOutlined style={{ fontSize: 12 }} />
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Nunito',sans-serif" }}>
                Đăng xuất
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Collapsed: user avatar with popup */
        <div style={{ padding: '8px 8px 0' }}>
          <CollapsedUserItem user={user} logout={logout} />
        </div>
      )}

      {/* Navigation */}
      <nav style={{
        flex: 1, padding: sidebarOpen ? '4px 10px' : '4px 8px',
        overflowY: 'auto', overflowX: 'visible', scrollbarWidth: 'none',
      }}>
        <style>{`nav::-webkit-scrollbar { display: none; }`}</style>
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


      <style>{`
        @keyframes seller-fade-in {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes seller-slide-in {
          from { opacity: 0; transform: translateY(-50%) translateX(-6px); }
          to   { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
        @keyframes seller-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
          50%       { box-shadow: 0 0 0 4px rgba(74,222,128,0); }
        }
        nav::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
