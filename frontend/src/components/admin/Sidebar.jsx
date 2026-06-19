import React, { useState, useEffect } from 'react';
import {
  MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { HC, MENU } from './constants';
import { HCLogo } from './ui';

const DARK = {
  bg:            'var(--hc-dark-bg)',
  bgHover:       'var(--hc-dark-bg-hover)',
  bgActive:      'var(--hc-dark-active)',
  border:        'var(--hc-dark-border)',
  borderActive:  'rgba(249,115,22,0.4)',
  text:          'var(--hc-dark-text)',
  textMuted:     'var(--hc-dark-text-muted)',
  textActive:    '#fff',
  accent:        HC.orange,
  cardBg:        'var(--hc-dark-bg-hover)',
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
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: isCollapsed ? '11px' : '11px 16px',
        marginBottom: 4,
        borderRadius: 10,
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
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
          height: 28,
          background: DARK.accent,
          borderRadius: '0 3px 3px 0',
          boxShadow: `0 0 8px ${DARK.accent}80`,
        }} />
      )}

      <div style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        color: isActive ? DARK.accent : hovered ? DARK.text : DARK.textMuted,
        transition: 'color 0.18s ease',
        flexShrink: 0,
      }}>
        {item.icon}
      </div>

      {!isCollapsed && (
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 13.5,
            fontWeight: isActive ? 700 : 500,
            color: isActive ? DARK.textActive : hovered ? DARK.text : DARK.textMuted,
            fontFamily: "'Nunito',sans-serif",
            transition: 'color 0.18s ease',
            letterSpacing: '0.01em',
          }}>
            {item.label}
          </div>
        </div>
      )}

      {!isCollapsed && isActive && (
        <div style={{
          width: 5, height: 5, borderRadius: '50%',
          background: DARK.accent,
          boxShadow: `0 0 0 3px ${DARK.accent}30`,
          flexShrink: 0,
        }} />
      )}

      {isCollapsed && hovered && (
        <div style={{
          position: 'absolute',
          left: 'calc(100% + 12px)',
          top: '50%',
          transform: 'translateY(-50%)',
          background: '#0f172a',
          color: '#f1f5f9',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "'Nunito',sans-serif",
          padding: '6px 12px',
          borderRadius: 8,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.08)',
          animation: 'hc-slide-down 0.15s ease',
        }}>
          {item.label}
          <div style={{
            position: 'absolute',
            right: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            border: '5px solid transparent',
            borderRightColor: '#0f172a',
          }} />
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ active, setActive, sidebarOpen, setSidebarOpen, user, logout }) {
  const [lastActiveTime, setLastActiveTime] = useState(
    () => localStorage.getItem(`LAST_ACTIVE_${user?.role || 'admin'}`) || Date.now().toString()
  );

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
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
  };

  return (
    <div style={{
      width: sidebarOpen ? 260 : 68,
      background: DARK.bg,
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      overflow: 'visible',
      position: 'relative',
      boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
      borderRight: `1px solid ${DARK.border}`,
      zIndex: 100,
      flexShrink: 0,
    }}>
      {/* Logo header */}
      <div style={{
        padding: sidebarOpen ? '22px 18px' : '22px 12px',
        borderBottom: `1px solid ${DARK.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        justifyContent: sidebarOpen ? 'flex-start' : 'center',
        flexShrink: 0,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 11,
          background: `rgba(249,115,22,0.15)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `1px solid rgba(249,115,22,0.25)`,
          flexShrink: 0,
        }}>
          <HCLogo size={24} color={HC.orange} />
        </div>
        {sidebarOpen && (
          <div style={{ animation: 'hc-fade-in 0.25s ease' }}>
            <div style={{
              color: '#f1f5f9',
              fontWeight: 800,
              fontSize: 14.5,
              fontFamily: "'Nunito',sans-serif",
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}>
              Happy Creative LLC
            </div>
            <div style={{
              color: HC.orange,
              fontSize: 9,
              letterSpacing: '0.2em',
              fontWeight: 700,
              textTransform: 'uppercase',
              marginTop: 3,
              opacity: 0.85,
            }}>
              Vendor Management
            </div>
          </div>
        )}
      </div>

      {/* User card */}
      {sidebarOpen && (
        <div style={{
          margin: '14px 12px',
          padding: '12px 14px',
          borderRadius: 12,
          background: DARK.cardBg,
          border: `1px solid ${DARK.border}`,
          animation: 'hc-fade-in 0.25s ease',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
              fontWeight: 800,
              color: '#fff',
              fontFamily: "'Nunito',sans-serif",
              flexShrink: 0,
            }}>
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#f1f5f9',
                fontFamily: "'Nunito',sans-serif",
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {(user?.name === 'Admin' ? 'CCO' : user?.name) || 'CCO'}
              </div>
              <div style={{
                fontSize: 10,
                color: DARK.textMuted,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 2,
              }}>
                <CrownOutlined style={{ fontSize: 9, color: HC.orange }} />
                <span>Administrator</span>
              </div>
            </div>
          </div>
          <div style={{
            fontSize: 10,
            color: '#4ade80',
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${DARK.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <div className="hc-pulse-dot" style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#4ade80',
              flexShrink: 0,
            }} />
            <span style={{ fontWeight: 600 }}>
              Online · {formatLastActive(lastActiveTime)}
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{
        flex: 1,
        padding: sidebarOpen ? '4px 10px' : '4px 8px',
        overflowY: 'auto',
        overflowX: 'visible',
        scrollbarWidth: 'none',
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

      {/* Footer buttons */}
      <div style={{ padding: sidebarOpen ? '10px 10px 18px' : '10px 8px 18px', flexShrink: 0 }}>
        <GhostButton
          onClick={() => setSidebarOpen(!sidebarOpen)}
          fullWidth
          icon={sidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          label={sidebarOpen ? 'Thu gọn' : null}
        />

        <GhostButton
          onClick={logout}
          fullWidth
          icon={<LogoutOutlined />}
          label={sidebarOpen ? 'Đăng xuất' : null}
          danger
          style={{ marginTop: 6 }}
        />

        {sidebarOpen && (
          <div style={{
            marginTop: 14,
            textAlign: 'center',
            fontSize: 9,
            fontWeight: 700,
            color: 'rgba(148,163,184,0.4)',
            letterSpacing: '0.2em',
            fontFamily: "'Nunito',sans-serif",
          }}>
            #IT'S ALWAYS DAY 1
          </div>
        )}
      </div>

      <style>{`
        @keyframes hc-fade-in {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes hc-slide-down {
          from { opacity: 0; transform: translateY(-50%) translateX(-6px); }
          to   { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
        @keyframes hc-pulse-dot {
          0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
          50%       { box-shadow: 0 0 0 4px rgba(74,222,128,0); }
        }
        .hc-pulse-dot { animation: hc-pulse-dot 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function GhostButton({ onClick, icon, label, danger = false, fullWidth = false, style = {} }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: fullWidth ? '100%' : 'auto',
        padding: '8px',
        borderRadius: 9,
        background: hovered
          ? danger ? 'rgba(248,113,113,0.08)' : DARK.bgHover
          : 'transparent',
        border: `1px solid ${
          hovered
            ? danger ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.18)'
            : DARK.border
        }`,
        color: danger
          ? hovered ? '#f87171' : DARK.textMuted
          : hovered ? DARK.text : DARK.textMuted,
        cursor: 'pointer',
        fontSize: 13,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        transition: 'all 0.18s ease',
        fontFamily: "'Nunito',sans-serif",
        fontWeight: 600,
        ...style,
      }}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}
