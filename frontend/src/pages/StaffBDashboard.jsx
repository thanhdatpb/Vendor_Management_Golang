import React, { useState, useEffect, useCallback } from 'react';
import { MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, ShopOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';

import { HCLogo } from '../components/staff-b/ui/StaffBUI';
import StaffBNotificationCenter from '../components/staff-b/components/StaffBNotificationCenter';
import NewsManagementSection from '../components/staff-b/sections/NewsManagementSection';
import ProductsSection from '../components/staff-b/sections/ProductsSection';
import VendorsSection from '../components/staff-b/sections/VendorsSection';
import { HC, MENU, PAGE_TITLES } from '../components/staff-b/utils/constants';

export default function StaffDashboard() {
  const { user, logout } = useAuth();
  const [lastActiveTime, setLastActiveTime] = useState(() => localStorage.getItem(`LAST_ACTIVE_${user?.role || 'staffb'}`) || Date.now().toString());

  useEffect(() => {
    const roleKey = `LAST_ACTIVE_${user?.role || 'staffb'}`;
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
  const [active, setActive] = useState('products');
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
          if (n.type === 'approved') {
            requests.push({
              id: `api_${n.id}`, type: 'approved', source: 'admin', icon: '✅',
              title: 'Form sản phẩm đã được duyệt',
              message: `Form sản phẩm "${n.product_type || ''}" của Seller "${n.seller_name || 'Seller'}" đã được Admin duyệt.`,
              time: new Date(n.created_at).toLocaleString('vi-VN'), read: n.is_read || false,
              productId: n.product_id, productType: n.product_type, sellerName: n.seller_name, timestamp: n.created_at
            });
          }
        });
      }).catch(() => { });

    try {
      const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      staffANotifs.forEach(n => {
        if (n.type === 'sample_approved' || n.type === 'sample_rejected') {
          const isApproved = n.type === 'sample_approved';
          requests.push({
            id: `staffa_${n.id}`, type: n.type, source: 'staffA', icon: isApproved ? '✅' : '❌',
            title: isApproved ? 'Seller đồng ý đặt Sample' : 'Seller từ chối đặt Sample',
            message: n.message || '', time: n.time || new Date(n.timestamp || Date.now()).toLocaleString('vi-VN'),
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
            id: `staffb_${n.id}`, type: 'staff_a_approved_vendor', source: 'staffA', icon: n.icon || '✅',
            title: n.title || 'Staff A đã xác nhận vendor', message: n.message || '',
            time: n.time || new Date(n.timestamp || Date.now()).toLocaleString('vi-VN'), read: n.is_read || false,
            productId: n.productId, productType: n.productName || n.productType, vendorType: n.vendorType, sellerFeedback: n.sellerFeedback, timestamp: n.timestamp || n.id
          });
        }
      });
    } catch (err) { console.error('Lỗi load staff_a_approved_vendor:', err); }

    requests.sort((a, b) => new Date(b.time) - new Date(a.time));
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
          time: n.time || new Date(n.created_at || Date.now()).toLocaleString('vi-VN'), read: n.read || false, timestamp: n.created_at || Date.now()
        });
      });
    } catch (err) { }
    news.sort((a, b) => new Date(b.time) - new Date(a.time));
    setNewsNotifications(news.slice(0, 100));
  }, []);

  const markRequestAsRead = useCallback(async (notificationId) => {
    if (notificationId.startsWith('api_')) {
      const realId = notificationId.replace('api_', '');
      try { await notificationApi.markAsRead(realId); } catch (err) { }
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
  }, []);
  const handleNewsClick = useCallback((notification) => { console.log('Click vào tin tức:', notification); }, []);

  useEffect(() => {
    loadRequestNotifications(); loadNewsNotifications();
    const interval = setInterval(() => { loadRequestNotifications(); loadNewsNotifications(); }, 100000);
    const handleStorageChange = (e) => { if (e.key === 'STAFF_A_NOTIFICATIONS') loadRequestNotifications(); };
    window.addEventListener('storage', handleStorageChange);
    return () => { clearInterval(interval); window.removeEventListener('storage', handleStorageChange); };
  }, [loadRequestNotifications, loadNewsNotifications]);

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
  function StaffBNavItem({ item, isActive, isCollapsed, onClick }) {
    const [hov, setHov] = useState(false);
    const isBest = item.id === 'library';
    const activeColor = isBest ? HC.gold : HC.orange;
    const activeDark  = isBest ? '#B8860B' : HC.orangeDark;
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', gap: 12,
          padding: isCollapsed ? '12px' : '12px 16px', marginBottom: 6, borderRadius: 12,
          background: isActive
            ? (isBest ? HC.goldLight : `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`)
            : hov ? `${activeColor}08` : 'transparent',
          border: `1px solid ${isActive ? (isBest ? HC.goldMid : HC.orangeMid) : 'transparent'}`,
          cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: hov && !isActive ? 'translateX(4px)' : 'none',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          overflow: 'visible',
        }}
      >
        {isActive && (
          <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 32, background: `linear-gradient(180deg, ${activeColor}, ${activeDark})`, borderRadius: '0 4px 4px 0' }} />
        )}
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: isActive ? `${activeColor}20` : hov ? `${activeColor}10` : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, color: isActive ? activeColor : hov ? activeDark : HC.muted,
          transition: 'all 0.2s ease', flexShrink: 0,
        }}>{item.icon}</div>
        {!isCollapsed && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: isActive ? 800 : 600, color: isActive ? activeDark : HC.brown, fontFamily: "'Nunito',sans-serif", transition: 'color 0.2s ease' }}>{item.label}</div>
          </div>
        )}
        {!isCollapsed && isActive && (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: activeColor, boxShadow: `0 0 0 3px ${activeColor}30` }} />
        )}
        {/* Tooltip when collapsed */}
        {isCollapsed && hov && (
          <div style={{ position: 'absolute', left: 'calc(100% + 12px)', top: '50%', transform: 'translateY(-50%)', background: 'rgba(26,15,0,0.90)', color: '#fff', fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif", padding: '6px 12px', borderRadius: 8, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
            {item.label}
            <div style={{ position: 'absolute', right: '100%', top: '50%', transform: 'translateY(-50%)', border: '5px solid transparent', borderRightColor: 'rgba(26,15,0,0.90)' }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:7px;height:7px;}
        ::-webkit-scrollbar-track{background:${HC.cream};border-radius:10px;}
        ::-webkit-scrollbar-thumb{background:${HC.orangeMid};border-radius:10px;}
        ::-webkit-scrollbar-thumb:hover{background:${HC.orange};}
        @keyframes staffb-pulse{0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,0.5);}50%{box-shadow:0 0 0 4px rgba(22,163,74,0);}}
        @keyframes staffb-fadein{from{opacity:0;transform:translateX(-8px);}to{opacity:1;transform:translateX(0);}}
      `}</style>
      <div style={{ display: 'flex', height: '100vh', background: HC.orangePale, fontFamily: "'Nunito Sans',sans-serif", color: HC.ink, overflow: 'hidden' }}>
        {/* ── Sidebar ── */}
        <div style={{ width: sidebarOpen ? 280 : 72, background: '#FFFFFF', display: 'flex', flexDirection: 'column', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'visible', position: 'relative', boxShadow: '4px 0 20px rgba(0,0,0,0.04)', borderRight: `1px solid ${HC.border}`, zIndex: 100, flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 20% 40%, ${HC.orange}06 1px, transparent 1px)`, backgroundSize: '24px 24px', pointerEvents: 'none', opacity: 0.5, overflow: 'hidden' }} />
          {/* Logo */}
          <div style={{ padding: sidebarOpen ? '24px 20px' : '24px 14px', borderBottom: `1px solid ${HC.border}`, display: 'flex', alignItems: 'center', gap: 12, justifyContent: sidebarOpen ? 'flex-start' : 'center', flexShrink: 0 }}>
            <div style={{ width: 42, height: 42, borderRadius: 13, background: `linear-gradient(135deg, ${HC.orange}15, ${HC.orange}05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${HC.orange}20`, boxShadow: `0 2px 8px ${HC.orange}12`, flexShrink: 0 }}>
              <HCLogo size={26} color={HC.orange} />
            </div>
            {sidebarOpen && (
              <div style={{ animation: 'staffb-fadein 0.3s ease' }}>
                <div style={{ color: HC.ink, fontWeight: 900, fontSize: 15, fontFamily: "'Nunito',sans-serif", letterSpacing: '-0.02em' }}>Happy Creative LLC</div>
                <div style={{ color: HC.orange, fontSize: 9.5, letterSpacing: '0.22em', fontWeight: 800, textTransform: 'uppercase', marginTop: 3 }}>Vendor Dashboard</div>
              </div>
            )}
          </div>
          {/* User card */}
          {sidebarOpen && (
            <div style={{ margin: '16px 14px', padding: '14px', borderRadius: 14, background: `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`, border: `1px solid ${HC.orangeMid}`, animation: 'staffb-fadein 0.3s ease', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff', boxShadow: `0 3px 10px ${HC.orange}40`, flexShrink: 0 }}><ShopOutlined /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: HC.ink, fontFamily: "'Nunito',sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(user?.name === 'Vendor' ? 'Vendor' : user?.name) || 'Vendor'}</div>
                  <div style={{ fontSize: 10, color: HC.brown, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><ShopOutlined style={{ fontSize: 9, color: HC.orange }} /><span>Vendor Account</span></div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: HC.success, paddingTop: 8, borderTop: `1px solid ${HC.orangeMid}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: HC.success, animation: 'staffb-pulse 2.5s ease-in-out infinite' }}></div>
                <span style={{ fontWeight: 700 }}>Online · {formatLastActive(lastActiveTime)}</span>
              </div>
            </div>
          )}
          {/* Nav */}
          <nav style={{ flex: 1, padding: sidebarOpen ? '6px 14px' : '6px 10px', overflowY: 'auto', overflowX: 'visible', scrollbarWidth: 'none' }}>
            {MENU.map(item => (
              <StaffBNavItem key={item.id} item={item} isActive={active === item.id} isCollapsed={!sidebarOpen} onClick={() => setActive(item.id)} />
            ))}
          </nav>
          {/* Footer */}
          <div style={{ padding: sidebarOpen ? '12px 14px 20px' : '12px 10px 20px', flexShrink: 0 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ width: '100%', padding: '9px', borderRadius: 11, background: HC.cream, border: `1px solid ${HC.border}`, color: HC.brown, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.2s ease', fontFamily: "'Nunito',sans-serif", fontWeight: 700 }} onMouseEnter={e => { e.currentTarget.style.background = HC.orangeLight; e.currentTarget.style.borderColor = HC.orangeMid; e.currentTarget.style.color = HC.orangeDark; }} onMouseLeave={e => { e.currentTarget.style.background = HC.cream; e.currentTarget.style.borderColor = HC.border; e.currentTarget.style.color = HC.brown; }}>
              {sidebarOpen ? <><MenuFoldOutlined /><span>Thu gọn</span></> : <MenuUnfoldOutlined />}
            </button>
            <button onClick={logout} style={{ width: '100%', marginTop: 8, padding: '9px', borderRadius: 11, background: '#fff5f5', border: '1px solid #fecaca', color: HC.danger, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'all 0.2s ease', fontFamily: "'Nunito',sans-serif", fontWeight: 700 }} onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#f87171'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fff5f5'; e.currentTarget.style.borderColor = '#fecaca'; }}>
              <LogoutOutlined />{sidebarOpen && <span>Đăng xuất</span>}
            </button>
            {sidebarOpen && <div style={{ marginTop: 16, textAlign: 'center', fontSize: 9, fontWeight: 800, color: HC.muted2, letterSpacing: '0.22em', fontFamily: "'Nunito',sans-serif" }}>#IT'S ALWAYS DAY 1</div>}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 64, background: HC.surface, borderBottom: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, boxShadow: '0 2px 12px rgba(245,166,35,0.06)' }}>
            <div style={{ width: 3, height: 28, borderRadius: 99, background: active === 'library' ? `linear-gradient(to bottom,#FFD700,#FFA500)` : `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})`, flexShrink: 0 }} />
            <div style={{ flex: 1, color: HC.ink, fontWeight: 900, fontSize: 15, fontFamily: "'Nunito',sans-serif", letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 10 }}>
              {PAGE_TITLES[active]}
              {active === 'library' && filterProductType && <span style={{ padding: '2px 10px', borderRadius: 999, background: HC.orangeLight, border: `1.5px solid ${HC.orange}`, color: HC.orangeDark, fontSize: 11, fontWeight: 800 }}>🔍 {filterProductType}</span>}
            </div>
            <div style={{ color: HC.muted, fontSize: 12, fontWeight: 600 }}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <StaffBNotificationCenter requestNotifications={requestNotifications} newsNotifications={newsNotifications} markRequestAsRead={markRequestAsRead} markNewsAsRead={markNewsAsRead} onRequestClick={handleRequestClick} onNewsClick={handleNewsClick} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>{renderSection()}</div>
        </div>
      </div>
    </>
  );
}