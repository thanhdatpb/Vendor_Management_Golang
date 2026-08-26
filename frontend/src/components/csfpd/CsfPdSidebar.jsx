// ════════════════════════════════════════════════════════
//  CSF / PD SIDEBAR — Dark Slate Theme (dựa theo SellerSidebar)
// ════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { HC } from '../../constants/sellerTheme';
import { HCLogo } from '../seller/SellerUI';
import UserAvatar from '../shared/UserAvatar';

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

function NavItem({ item, isActive, isCollapsed, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
        padding: isCollapsed ? '11px' : '11px 16px', marginBottom: 4, borderRadius: 10,
        background: isActive ? DARK.bgActive : hovered ? DARK.bgHover : 'transparent',
        border: `1px solid ${isActive ? DARK.borderActive : 'transparent'}`,
        cursor: 'pointer', transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'visible', justifyContent: isCollapsed ? 'center' : 'flex-start',
      }}
    >
      {isActive && (
        <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 28, background: DARK.accent, borderRadius: '0 3px 3px 0', boxShadow: `0 0 8px ${DARK.accent}80` }} />
      )}
      <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: isActive ? DARK.accent : hovered ? DARK.text : DARK.textMuted, transition: 'color 0.18s ease', flexShrink: 0 }}>
        {item.icon}
      </div>
      {!isCollapsed && (
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500, color: isActive ? DARK.textActive : hovered ? DARK.text : DARK.textMuted, fontFamily: "'Inter',sans-serif", transition: 'color 0.18s ease', letterSpacing: '0.01em' }}>
            {item.label}
          </div>
        </div>
      )}
      {!isCollapsed && isActive && (
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: DARK.accent, boxShadow: `0 0 0 3px ${DARK.accent}30`, flexShrink: 0 }} />
      )}
      {isCollapsed && hovered && (
        <div style={{ position: 'absolute', left: 'calc(100% + 12px)', top: '50%', transform: 'translateY(-50%)', background: '#0f172a', color: '#f1f5f9', fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif", padding: '6px 12px', borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {item.label}
          <div style={{ position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)', border: '5px solid transparent', borderRightColor: '#0f172a' }} />
        </div>
      )}
    </div>
  );
}

export default function CsfPdSidebar({ active, setActive, sidebarOpen, setSidebarOpen, user, logout, menu, roleLabel, displayName }) {
  const [showLogout, setShowLogout] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);

  useEffect(() => { if (!sidebarOpen) setShowLogout(false); }, [sidebarOpen]);

  const nameToShow = displayName || user?.full_name || user?.name || roleLabel;

  return (
    <div style={{
      width: sidebarOpen ? 260 : 68, background: DARK.bg, display: 'flex', flexDirection: 'column',
      transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'visible', position: 'relative',
      boxShadow: '4px 0 24px rgba(0,0,0,0.25)', borderRight: `1px solid ${DARK.border}`, zIndex: 100, flexShrink: 0,
    }}>
      <div
        onClick={() => setSidebarOpen(!sidebarOpen)}
        onMouseEnter={() => setLogoHovered(true)}
        onMouseLeave={() => setLogoHovered(false)}
        style={{
          padding: sidebarOpen ? '22px 18px' : '22px 12px', borderBottom: `1px solid ${DARK.border}`,
          display: 'flex', alignItems: 'center', gap: 12, justifyContent: sidebarOpen ? 'flex-start' : 'center',
          flexShrink: 0, cursor: 'pointer', background: logoHovered ? DARK.bgHover : 'transparent', transition: 'background 0.18s ease',
        }}
      >
        <div style={{ width: 40, height: 40, borderRadius: 11, background: logoHovered ? 'rgba(249,115,22,0.22)' : 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(249,115,22,0.25)', flexShrink: 0, transition: 'background 0.18s ease' }}>
          <HCLogo size={24} color={HC.orange} />
        </div>
        {sidebarOpen && (
          <div>
            <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 14.5, fontFamily: "'Inter',sans-serif", letterSpacing: '-0.01em' }}>Happy Creative LLC</div>
            <div style={{ color: HC.orange, fontSize: 9, letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', marginTop: 3, opacity: 0.85 }}>Vendor Management</div>
          </div>
        )}
      </div>

      {sidebarOpen ? (
        <div
          onClick={() => setShowLogout(v => !v)}
          style={{ margin: '14px 12px', padding: '12px 14px', borderRadius: 12, background: DARK.cardBg, border: `1px solid ${showLogout ? 'rgba(249,115,22,0.3)' : DARK.border}`, flexShrink: 0, cursor: 'pointer', transition: 'border-color 0.18s ease' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <UserAvatar user={user} size={36} radius={10} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameToShow}</div>
              <div style={{ fontSize: 10, color: DARK.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <UserOutlined style={{ fontSize: 9, color: HC.orange }} />
                <span>{roleLabel}</span>
              </div>
            </div>
          </div>
          {showLogout && (
            <div
              onClick={(e) => { e.stopPropagation(); logout(); }}
              style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(248,113,113,0.2)', display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', cursor: 'pointer' }}
            >
              <LogoutOutlined style={{ fontSize: 12 }} />
              <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>Đăng xuất</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '8px 8px 0' }}>
          <div
            onClick={() => setShowLogout(v => !v)}
            style={{ padding: '11px', borderRadius: 10, background: showLogout ? DARK.bgActive : 'transparent', border: `1px solid ${showLogout ? DARK.borderActive : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          >
            <UserAvatar user={user} size={30} radius={8} />
            {showLogout && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); setShowLogout(false); }} />
                <div style={{ position: 'absolute', left: 'calc(100% + 12px)', top: '50%', transform: 'translateY(-50%)', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px', zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', minWidth: 165 }}>
                  <div style={{ padding: '4px 6px 10px', borderBottom: `1px solid ${DARK.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontFamily: "'Inter',sans-serif" }}>{nameToShow}</div>
                    <div style={{ fontSize: 10, color: DARK.textMuted, marginTop: 3 }}>{roleLabel}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); logout(); }}
                    style={{ width: '100%', marginTop: 8, padding: '7px 10px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, color: '#f87171', fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                  >
                    <LogoutOutlined /> Đăng xuất
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <nav style={{ flex: 1, padding: sidebarOpen ? '4px 10px' : '4px 8px', overflowY: 'auto', overflowX: 'visible', scrollbarWidth: 'none' }}>
        <style>{`nav::-webkit-scrollbar { display: none; }`}</style>
        {menu.map(item => (
          <NavItem key={item.id} item={item} isActive={active === item.id} isCollapsed={!sidebarOpen} onClick={() => setActive(item.id)} />
        ))}
      </nav>
    </div>
  );
}
