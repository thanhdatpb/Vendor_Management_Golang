import React, { useState, useEffect } from 'react';
import { MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, CalendarOutlined, CrownOutlined } from '@ant-design/icons';
import { HC, MENU } from './constants';
import { HCLogo } from './ui';

export default function Sidebar({ active, setActive, sidebarOpen, setSidebarOpen, user, logout }) {
  const [hoveredItem, setHoveredItem] = useState(null);
  const [lastActiveTime, setLastActiveTime] = useState(() => localStorage.getItem(`LAST_ACTIVE_${user?.role || 'admin'}`) || Date.now().toString());

  useEffect(() => {
    const roleKey = `LAST_ACTIVE_${user?.role || 'admin'}`;
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
    return `Hoạt động lần cuối lúc ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

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
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(circle at 20% 40%, ${HC.orange}08 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
        pointerEvents: 'none',
        opacity: 0.4,
      }} />

      <div style={{
        padding: sidebarOpen ? '28px 24px' : '28px 20px',
        borderBottom: `1px solid ${HC.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: sidebarOpen ? 'flex-start' : 'center',
        position: 'relative',
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: `linear-gradient(135deg, ${HC.orange}10, ${HC.orange}05)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid ${HC.orange}20`,
          boxShadow: `0 2px 8px ${HC.orange}10`,
          flexShrink: 0,
        }}>
          <HCLogo size={28} color={HC.orange} />
        </div>
        {sidebarOpen && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={{
              color: HC.ink,
              fontWeight: 900,
              fontSize: 16,
              fontFamily: "'Nunito',sans-serif",
              letterSpacing: '-0.02em',
            }}>
              Happy Creative LLC
            </div>
            <div style={{
              color: HC.orange,
              fontSize: 10,
              letterSpacing: '0.2em',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginTop: 2,
            }}>
              CCO Portal
            </div>
          </div>
        )}
      </div>

      {sidebarOpen && (
        <div style={{
          margin: '20px 16px',
          padding: '16px',
          borderRadius: 16,
          background: `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`,
          border: `1px solid ${HC.orangeMid}`,
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 700,
              color: '#fff',
            }}>
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>
                {(user?.name === 'Admin' ? 'CCO' : user?.name) || 'CCO'}
              </div>
              <div style={{ fontSize: 10, color: HC.brown, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <CrownOutlined style={{ fontSize: 10, color: HC.orange }} />
                <span>Administrator</span>
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 10,
            color: HC.success,
            paddingTop: 8,
            borderTop: `1px solid ${HC.orangeMid}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: HC.success, boxShadow: `0 0 0 2px ${HC.success}33` }}></div>
            <span style={{ fontWeight: 700 }}>{formatLastActive(lastActiveTime)}</span>
          </div>
        </div>
      )}

      <nav style={{
        flex: 1,
        padding: sidebarOpen ? '8px 16px' : '8px 12px',
        marginTop: 8,
      }}>
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
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: sidebarOpen ? '12px 16px' : '12px',
                marginBottom: 6,
                borderRadius: 12,
                background: isActive
                  ? `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`
                  : 'transparent',
                border: `1px solid ${isActive ? HC.orangeMid : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isHovered && !isActive ? 'translateX(4px)' : 'none',
                position: 'relative',
                overflow: 'hidden',
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
                  ? `linear-gradient(135deg, ${HC.orange}20, ${HC.orange}10)`
                  : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                color: isActive ? HC.orange : HC.muted,
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}>
                {item.icon}
              </div>

              {sidebarOpen && (
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

              {!sidebarOpen && isActive && (
                <div style={{
                  position: 'absolute',
                  right: 8,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: HC.orange,
                }} />
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: sidebarOpen ? '16px 16px 24px' : '16px 12px 24px' }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            width: '100%',
            padding: sidebarOpen ? '10px' : '10px',
            borderRadius: 12,
            background: HC.cream,
            border: `1px solid ${HC.border}`,
            color: HC.brown,
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            fontFamily: "'Nunito',sans-serif",
          }}
        >
          {sidebarOpen ? (
            <>
              <MenuFoldOutlined />
              <span>Thu gọn menu</span>
            </>
          ) : (
            <MenuUnfoldOutlined />
          )}
        </button>

        <button
          onClick={logout}
          style={{
            width: '100%',
            marginTop: 12,
            padding: sidebarOpen ? '10px' : '10px',
            borderRadius: 12,
            background: '#fee2e2',
            border: `1px solid #fecaca`,
            color: HC.danger,
            cursor: 'pointer',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s ease',
            fontFamily: "'Nunito',sans-serif",
          }}
        >
          <LogoutOutlined />
          {sidebarOpen && <span>Đăng xuất</span>}
        </button>

        {sidebarOpen && (
          <div style={{
            marginTop: 20,
            textAlign: 'center',
            fontSize: 9,
            fontWeight: 800,
            color: HC.muted2,
            letterSpacing: '0.2em',
            fontFamily: "'Nunito',sans-serif",
          }}>
            #IT'S ALWAYS DAY 1
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
