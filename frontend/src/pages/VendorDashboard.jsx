import React, { useState, useEffect, useCallback } from 'react';
import { LogoutOutlined, ShopOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';
import { subscribeNotificationChanges } from '../services/echo';

import { HCLogo } from '../components/vendor/ui/VendorUI';
import UserAvatar from '../components/shared/UserAvatar';
import VendorNotificationCenter from '../components/vendor/components/VendorNotificationCenter';
import NewsManagementSection from '../components/vendor/sections/NewsManagementSection';
import ProductsSection from '../components/vendor/sections/ProductsSection';
import VendorsSection from '../components/vendor/sections/VendorsSection';
import { HC, MENU, PAGE_TITLES } from '../components/vendor/utils/constants';
import { VENDOR_SECTIONS } from '../constants/dashboardSections';
import useSectionRoute from '../hooks/useSectionRoute';
import { timeValue, fmtVNDateTime, fmtVNLongDate } from '../utils/vnTime';

const DARK = {
  bg:          'var(--hc-dark-bg)',
  bgHover:     'var(--hc-dark-bg-hover)',
  bgActive:    'var(--hc-dark-active)',
  border:      'var(--hc-dark-border)',
  borderActive:'rgba(249,115,22,0.4)',
  text:        'var(--hc-dark-text)',
  textMuted:   'var(--hc-dark-text-muted)',
  textActive:  '#fff',
  accent:      HC.orange,
  cardBg:      'var(--hc-dark-bg-hover)',
};

export default function VendorDashboard() {
  const { user, logout } = useAuth();
  // Mục đang mở nằm trên URL (/vendor/products | /vendor/library |
  // /vendor/news) — bookmark / gửi link / F5 / Back đều giữ đúng mục.
  const [active, setActive] = useSectionRoute({ basePath: '/vendor', sections: VENDOR_SECTIONS, fallback: 'products' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLogout, setShowLogout] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [filterProductType, setFilterProductType] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [requestNotifications, setRequestNotifications] = useState([]);
  const [newsNotifications, setNewsNotifications] = useState([]);

  const loadRequestNotifications = useCallback(() => {
    const requests = [];
    notificationApi.list()
      .then(r => {
        const apiNotifs = r.data?.data || [];
        apiNotifs.forEach(n => {
          const productName = n.data?.product_type || n.product_type || '';
          const productId = n.data?.product_id || n.product_id || null;
          const sellerName = n.data?.seller_name || n.seller_name || '';
          requests.push({
            id: `api_${n.id}`, type: n.type, source: 'api',
            title: n.title || 'Thông báo',
            message: n.body || '',
            time: fmtVNDateTime(n.created_at), read: n.is_read || false,
            productId, productType: productName, sellerName, timestamp: n.created_at
          });
        });
      }).catch(() => { });

    try {
      const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      staffANotifs.forEach(n => {
        if (n.type === 'sample_approved' || n.type === 'sample_rejected') {
          const isApproved = n.type === 'sample_approved';
          requests.push({
            id: `staffa_${n.id}`, type: n.type, source: 'staffA', icon: isApproved ? '' : '',
            title: isApproved ? 'Seller đồng ý đặt Sample' : 'Seller từ chối đặt Sample',
            message: n.message || '', time: n.time || fmtVNDateTime(n.timestamp || Date.now()),
            read: n.read || false, productId: n.productId, productType: n.productType, vendorType: n.vendorType, sellerName: n.sellerName, sampleDetails: n.sampleDetails, timestamp: n.timestamp || Date.now()
          });
        }
      });
    } catch (err) { }

    try {
      const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
      staffBNotifs.forEach(n => {
        if (n.type === 'staff_a_approved_vendor') {
          requests.push({
            id: `staffb_${n.id}`, type: 'staff_a_approved_vendor', source: 'staffA', icon: n.icon || '',
            title: n.title || 'Staff A đã xác nhận vendor', message: n.message || '',
            time: n.time || fmtVNDateTime(n.timestamp || Date.now()), read: n.is_read || false,
            productId: n.productId, productType: n.productName || n.productType, vendorType: n.vendorType, sellerFeedback: n.sellerFeedback, timestamp: n.timestamp || n.id
          });
        }
      });
    } catch (err) { console.error('Lỗi load staff_a_approved_vendor:', err); }

    requests.sort((a, b) => timeValue(b.timestamp) - timeValue(a.timestamp));
    setRequestNotifications(requests.slice(0, 100));
  }, []);

  const loadNewsNotifications = useCallback(() => {
    const news = [];
    try {
      const allNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
      const newsNotifs = allNotifs.filter(n => n.type === 'news');
      newsNotifs.forEach(n => {
        news.push({
          id: `news_${n.id}`, type: 'news', icon: n.icon || '📰',
          title: n.title || 'Tin tức mới', message: n.message || '',
          time: n.time || fmtVNDateTime(n.created_at || Date.now()), read: n.read || false, timestamp: n.created_at || Date.now()
        });
      });
    } catch (err) { }
    news.sort((a, b) => timeValue(b.timestamp) - timeValue(a.timestamp));
    setNewsNotifications(news.slice(0, 100));
  }, []);

  const markRequestAsRead = useCallback(async (notificationId) => {
    if (notificationId.startsWith('api_')) {
      const realId = notificationId.replace('api_', '');
      try { await notificationApi.readOne(realId); } catch (err) { }
    } else if (notificationId.startsWith('staffb_')) {
      try {
        const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
        const originalId = notificationId.replace('staffb_', '');
        const updated = staffBNotifs.map(n => String(n.id) === originalId ? { ...n, is_read: true } : n);
        localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(updated));
        window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS' }));
      } catch (err) { }
    }
    setRequestNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
  }, []);

  const markNewsAsRead = useCallback((notificationId) => {
    try {
      const allNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
      const updated = allNotifs.map(n => String(n.id) === notificationId.replace('news_', '') ? { ...n, read: true } : n);
      localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(updated));
    } catch (err) { }
    setNewsNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
  }, []);

  const handleRequestClick = useCallback((notification) => {
    if (notification.productId) { setActive('products'); setSelectedProductId(notification.productId); }
  }, [setActive]);
  const handleNewsClick = useCallback((notification) => { console.log('Click vào tin tức:', notification); }, []);

  useEffect(() => {
    const refreshNotifications = () => {
      loadRequestNotifications();
      loadNewsNotifications();
    };
    const refreshWhenVisible = () => {
      if (!document.hidden) refreshNotifications();
    };

    refreshNotifications();
    const unsubscribeNotifications = subscribeNotificationChanges(user?.id, refreshNotifications);
    const interval = setInterval(() => {
      refreshWhenVisible();
    }, 15000);
    const handleStorageChange = (e) => { if (e.key === 'STAFF_A_NOTIFICATIONS') loadRequestNotifications(); };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      clearInterval(interval);
      unsubscribeNotifications();
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [user?.id, loadRequestNotifications, loadNewsNotifications]);

  useEffect(() => { if (!sidebarOpen) setShowLogout(false); }, [sidebarOpen]);

  const handleGotoVendors = (productType, productId) => {
    setFilterProductType(productType); setFilterProductId(String(productId)); setActive('library');
  };
  const handleAssignComplete = () => { setActive('products'); };

  const renderSection = () => {
    switch (active) {
      case 'products': return <ProductsSection onGotoVendors={handleGotoVendors} selectedProductId={selectedProductId} setSelectedProductId={setSelectedProductId} />;
      case 'library': return <VendorsSection filterProductType={filterProductType} filterProductId={filterProductId} onClearFilter={() => { setFilterProductType(''); setFilterProductId(''); }} onAssignComplete={handleAssignComplete} />;
      case 'news': return <NewsManagementSection />;
      default: return null;
    }
  };

  // ── Tooltip Nav Item helper ──────────────────────────────
  function VendorNavItem({ item, isActive, isCollapsed, onClick }) {
    const [hov, setHov] = useState(false);
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
          padding: isCollapsed ? '11px' : '11px 16px', marginBottom: 4, borderRadius: 10,
          background: isActive ? DARK.bgActive : hov ? DARK.bgHover : 'transparent',
          border: `1px solid ${isActive ? DARK.borderActive : 'transparent'}`,
          cursor: 'pointer', transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          overflow: 'visible',
        }}
      >
        {isActive && (
          <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 28, background: DARK.accent, borderRadius: '0 3px 3px 0', boxShadow: `0 0 8px ${DARK.accent}80` }} />
        )}
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: isActive ? DARK.accent : hov ? DARK.text : DARK.textMuted,
          transition: 'color 0.18s ease', flexShrink: 0,
        }}>{item.icon}</div>
        {!isCollapsed && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500, color: isActive ? DARK.textActive : hov ? DARK.text : DARK.textMuted, fontFamily: "'Inter',sans-serif", transition: 'color 0.18s ease', letterSpacing: '0.01em' }}>{item.label}</div>
          </div>
        )}
        {!isCollapsed && isActive && (
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: DARK.accent, boxShadow: `0 0 0 3px ${DARK.accent}30`, flexShrink: 0 }} />
        )}
        {isCollapsed && hov && (
          <div style={{ position: 'absolute', left: 'calc(100% + 12px)', top: '50%', transform: 'translateY(-50%)', background: '#0f172a', color: '#f1f5f9', fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif", padding: '6px 12px', borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {item.label}
            <div style={{ position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)', border: '5px solid transparent', borderRightColor: '#0f172a' }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:7px;height:7px;}
        ::-webkit-scrollbar-track{background:${HC.cream};border-radius:10px;}
        ::-webkit-scrollbar-thumb{background:${HC.orangeMid};border-radius:10px;}
        ::-webkit-scrollbar-thumb:hover{background:${HC.orange};}
        @keyframes vendor-pulse{0%,100%{box-shadow:0 0 0 0 rgba(74,222,128,0.5);}50%{box-shadow:0 0 0 4px rgba(74,222,128,0);}}
        @keyframes vendor-fadein{from{opacity:0;transform:translateX(-6px);}to{opacity:1;transform:translateX(0);}}
      `}</style>
      <div style={{ display: 'flex', height: '100vh', background: HC.orangePale, fontFamily: "'Inter',sans-serif", color: HC.ink, overflow: 'hidden' }}>
        {/* ── Sidebar ── */}
        <div style={{ width: sidebarOpen ? 260 : 68, background: DARK.bg, display: 'flex', flexDirection: 'column', transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'visible', position: 'relative', boxShadow: '4px 0 24px rgba(0,0,0,0.25)', borderRight: `1px solid ${DARK.border}`, zIndex: 100, flexShrink: 0 }}>
          {/* Logo — click to collapse/expand */}
          <div onClick={() => setSidebarOpen(!sidebarOpen)} onMouseEnter={() => setLogoHovered(true)} onMouseLeave={() => setLogoHovered(false)} style={{ padding: sidebarOpen ? '22px 18px' : '22px 12px', borderBottom: `1px solid ${DARK.border}`, display: 'flex', alignItems: 'center', gap: 12, justifyContent: sidebarOpen ? 'flex-start' : 'center', flexShrink: 0, cursor: 'pointer', background: logoHovered ? DARK.bgHover : 'transparent', transition: 'background 0.18s ease' }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: logoHovered ? 'rgba(249,115,22,0.22)' : 'rgba(249,115,22,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(249,115,22,0.25)', flexShrink: 0, transition: 'background 0.18s ease' }}>
              <HCLogo size={24} color={HC.orange} />
            </div>
            {sidebarOpen && (
              <div style={{ animation: 'vendor-fadein 0.25s ease' }}>
                <div style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 14.5, fontFamily: "'Inter',sans-serif", letterSpacing: '-0.01em' }}>Happy Creative LLC</div>
                <div style={{ color: HC.orange, fontSize: 9, letterSpacing: '0.2em', fontWeight: 700, textTransform: 'uppercase', marginTop: 3, opacity: 0.85 }}>Vendor Management</div>
              </div>
            )}
          </div>
          {/* User section */}
          {sidebarOpen ? (
            <div onClick={() => setShowLogout(v => !v)} style={{ margin: '14px 12px', padding: '12px 14px', borderRadius: 12, background: DARK.cardBg, border: `1px solid ${showLogout ? 'rgba(249,115,22,0.3)' : DARK.border}`, animation: 'vendor-fadein 0.25s ease', flexShrink: 0, cursor: 'pointer', transition: 'border-color 0.18s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserAvatar user={user} size={36} radius={10} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontFamily: "'Inter',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.full_name || user?.name || 'Vendor'}</div>
                  <div style={{ fontSize: 10, color: DARK.textMuted, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><ShopOutlined style={{ fontSize: 9, color: HC.orange }} /><span>Vendor Account</span></div>
                </div>
              </div>
              {showLogout && (
                <div onClick={(e) => { e.stopPropagation(); logout(); }} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(248,113,113,0.2)', display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', cursor: 'pointer', animation: 'vendor-fadein 0.15s ease' }}>
                  <LogoutOutlined style={{ fontSize: 12 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>Đăng xuất</span>
                </div>
              )}
            </div>
          ) : (
            <VendorCollapsedUser user={user} logout={logout} />
          )}
          {/* Nav */}
          <nav style={{ flex: 1, padding: sidebarOpen ? '4px 10px' : '4px 8px', overflowY: 'auto', overflowX: 'visible', scrollbarWidth: 'none' }}>
            {MENU.map(item => (
              <VendorNavItem key={item.id} item={item} isActive={active === item.id} isCollapsed={!sidebarOpen} onClick={() => setActive(item.id)} />
            ))}
          </nav>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 64, background: HC.surface, borderBottom: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, boxShadow: '0 2px 12px rgba(245,166,35,0.06)' }}>
            <div style={{ width: 3, height: 28, borderRadius: 99, background: active === 'library' ? `linear-gradient(to bottom,#FFD700,#FFA500)` : `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})`, flexShrink: 0 }} />
            <div style={{ flex: 1, color: HC.ink, fontWeight: 900, fontSize: 15, fontFamily: "'Inter',sans-serif", letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 10 }}>
              {PAGE_TITLES[active]}
              {active === 'library' && filterProductType && <span style={{ padding: '2px 10px', borderRadius: 999, background: HC.orangeLight, border: `1.5px solid ${HC.orange}`, color: HC.orangeDark, fontSize: 11, fontWeight: 800 }}>🔍 {filterProductType}</span>}
            </div>
            <div style={{ color: HC.muted, fontSize: 12, fontWeight: 600 }}>{fmtVNLongDate()}</div>
            <VendorNotificationCenter requestNotifications={requestNotifications} newsNotifications={newsNotifications} markRequestAsRead={markRequestAsRead} markNewsAsRead={markNewsAsRead} onRequestClick={handleRequestClick} onNewsClick={handleNewsClick} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{renderSection()}</div>
        </div>
      </div>
    </>
  );
}

function VendorCollapsedUser({ user, logout }) {
  const [hovered, setHovered] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const DARK_LOCAL = {
    bgHover: 'var(--hc-dark-bg-hover)', bgActive: 'var(--hc-dark-active)',
    borderActive: 'rgba(249,115,22,0.4)', border: 'var(--hc-dark-border)', textMuted: 'var(--hc-dark-text-muted)',
  };
  return (
    <div style={{ padding: '8px 8px 0', position: 'relative' }}>
      <div onClick={() => setShowMenu(v => !v)} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ padding: '11px', borderRadius: 10, background: showMenu ? DARK_LOCAL.bgActive : hovered ? DARK_LOCAL.bgHover : 'transparent', border: `1px solid ${showMenu ? DARK_LOCAL.borderActive : 'transparent'}`, cursor: 'pointer', transition: 'all 0.18s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <UserAvatar user={user} size={30} radius={8} />
      </div>
      {showMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setShowMenu(false)} />
          <div style={{ position: 'absolute', left: 'calc(100% + 12px)', top: '50%', transform: 'translateY(-50%)', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px', zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.55)', minWidth: 165 }}>
            <div style={{ position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)', border: '6px solid transparent', borderRightColor: '#0f172a' }} />
            <div style={{ padding: '4px 6px 10px', borderBottom: `1px solid ${DARK_LOCAL.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', fontFamily: "'Inter',sans-serif" }}>{user?.full_name || user?.name || 'Vendor'}</div>
              <div style={{ fontSize: 10, color: DARK_LOCAL.textMuted, marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}><ShopOutlined style={{ fontSize: 9, color: '#f97316' }} /><span>Vendor Account</span></div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); logout(); }}
              style={{ width: '100%', marginTop: 8, padding: '7px 10px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, color: '#f87171', fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif", cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.15s ease' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.16)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.08)'}>
              <LogoutOutlined />Đăng xuất
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function SidebarGhostBtn({ onClick, icon, label, danger = false, style = {} }) {
  const [hov, setHov] = useState(false);
  const DARK_BTN = {
    border: 'rgba(255,255,255,0.07)',
    bgHover: 'rgba(255,255,255,0.05)',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
  };
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '8px', borderRadius: 9,
        background: hov ? (danger ? 'rgba(248,113,113,0.08)' : DARK_BTN.bgHover) : 'transparent',
        border: `1px solid ${hov ? (danger ? 'rgba(248,113,113,0.35)' : 'rgba(255,255,255,0.18)') : DARK_BTN.border}`,
        color: danger ? (hov ? '#f87171' : DARK_BTN.textMuted) : (hov ? DARK_BTN.text : DARK_BTN.textMuted),
        cursor: 'pointer', fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        transition: 'all 0.18s ease', fontFamily: "'Inter',sans-serif", fontWeight: 600,
        ...style,
      }}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}
