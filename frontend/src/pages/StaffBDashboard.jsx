import React, { useState, useEffect, useCallback } from 'react';
import { AppstoreOutlined, ShopOutlined, BellOutlined, StarFilled, MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, CalendarOutlined } from '@ant-design/icons';
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
    return `Hoạt động lần cuối lúc ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
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

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');*{box-sizing:border-box;}::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-track{background:${HC.cream};}::-webkit-scrollbar-thumb{background:${HC.orangeMid};border-radius:99px;}::-webkit-scrollbar-thumb:hover{background:${HC.orange};}@keyframes pulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.8;transform:scale(1.15);}}`}</style>
      <div style={{ display: 'flex', height: '100vh', background: HC.orangePale, fontFamily: "'Nunito Sans',sans-serif", color: HC.ink, overflow: 'hidden' }}>
        <div style={{ width: sidebarOpen ? 280 : 80, background: '#FFFFFF', display: 'flex', flexDirection: 'column', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', overflow: 'hidden', position: 'relative', boxShadow: '2px 0 12px rgba(0, 0, 0, 0.05)', borderRight: `1px solid ${HC.border}` }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle at 20% 40%, ${HC.orange}08 1px, transparent 1px)`, backgroundSize: '24px 24px', pointerEvents: 'none', opacity: 0.4 }} />
          <div style={{ padding: sidebarOpen ? '28px 24px' : '28px 20px', borderBottom: `1px solid ${HC.border}`, display: 'flex', alignItems: 'center', gap: 12, justifyContent: sidebarOpen ? 'space-between' : 'center', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${HC.orange}10, ${HC.orange}05)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${HC.orange}20`, boxShadow: `0 2px 8px ${HC.orange}10`, flexShrink: 0 }}>
                <HCLogo size={28} color={HC.orange} />
              </div>
              {sidebarOpen && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <div style={{ color: HC.ink, fontWeight: 900, fontSize: 16, fontFamily: "'Nunito',sans-serif", letterSpacing: '-0.02em' }}>Happy Creative LLC</div>
                  <div style={{ color: HC.orange, fontSize: 10, letterSpacing: '0.2em', fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>Vendor Dashboard</div>
                </div>
              )}
            </div>
          </div>
          {sidebarOpen && (
            <div style={{ margin: '20px 16px', padding: '16px', borderRadius: 16, background: `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`, border: `1px solid ${HC.orangeMid}`, animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' }}><ShopOutlined /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>{(user?.name === 'Vendor' ? 'Vendor' : user?.name) || 'Vendor'}</div>
                  <div style={{ fontSize: 10, color: HC.brown, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}><StarFilled style={{ fontSize: 10, color: HC.orange }} /><span>Vendor</span></div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: HC.success, paddingTop: 8, borderTop: `1px solid ${HC.orangeMid}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: HC.success, boxShadow: `0 0 0 2px ${HC.success}33` }}></div>
                <span style={{ fontWeight: 700 }}>{formatLastActive(lastActiveTime)}</span>
              </div>
            </div>
          )}
          <nav style={{ flex: 1, padding: sidebarOpen ? '8px 16px' : '8px 12px', marginTop: 8 }}>
            {MENU.map(item => {
              const isActive = active === item.id;
              const isBest = item.id === 'library';
              return (
                <div key={item.id} onClick={() => setActive(item.id)} onMouseEnter={(e) => { e.currentTarget.style.transform = !isActive ? 'translateX(4px)' : 'none'; e.currentTarget.style.background = !isActive ? (isBest ? `${HC.gold}10` : `${HC.orange}10`) : undefined; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; if (!isActive) e.currentTarget.style.background = 'transparent'; }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: sidebarOpen ? '12px 16px' : '12px', marginBottom: 6, borderRadius: 12, background: isActive ? (isBest ? `${HC.goldLight}` : `linear-gradient(135deg, ${HC.orangeLight}, ${HC.cream})`) : 'transparent', border: `1px solid ${isActive ? (isBest ? HC.goldMid : HC.orangeMid) : 'transparent'}`, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden' }}>
                  {isActive && <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 32, background: isBest ? `linear-gradient(180deg, ${HC.gold}, #FFA500)` : `linear-gradient(180deg, ${HC.orange}, ${HC.orangeDark})`, borderRadius: '0 4px 4px 0' }} />}
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: isActive ? (isBest ? `${HC.gold}20` : `linear-gradient(135deg, ${HC.orange}20, ${HC.orange}10)`) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: isActive ? (isBest ? HC.gold : HC.orange) : HC.muted, transition: 'all 0.2s ease', flexShrink: 0 }}>{item.icon}</div>
                  {sidebarOpen && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: isActive ? 800 : 600, color: isActive ? (isBest ? HC.gold : HC.orangeDark) : HC.brown, fontFamily: "'Nunito',sans-serif", transition: 'color 0.2s ease' }}>{item.label}</div>
                      <div style={{ fontSize: 10, color: HC.muted, marginTop: 2, fontFamily: "'Nunito Sans',sans-serif", opacity: 0.7 }}>{item.id === 'products' ? 'Form Approval Management' : 'Vendor Library'}</div>
                    </div>
                  )}
                  {!sidebarOpen && isActive && <div style={{ position: 'absolute', right: 8, width: 6, height: 6, borderRadius: '50%', background: isBest ? HC.gold : HC.orange }} />}
                </div>
              );
            })}
          </nav>
          <div style={{ padding: sidebarOpen ? '16px 16px 24px' : '16px 12px 24px' }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ width: '100%', padding: '10px', borderRadius: 12, background: HC.cream, border: `1px solid ${HC.border}`, color: HC.brown, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s ease', fontFamily: "'Nunito',sans-serif" }} onMouseEnter={e => { e.currentTarget.style.background = HC.orangeLight; e.currentTarget.style.borderColor = HC.orangeMid; e.currentTarget.style.color = HC.orangeDark; }} onMouseLeave={e => { e.currentTarget.style.background = HC.cream; e.currentTarget.style.borderColor = HC.border; e.currentTarget.style.color = HC.brown; }}>
              {sidebarOpen ? <><MenuFoldOutlined /><span>Thu gọn menu</span></> : <MenuUnfoldOutlined />}
            </button>
            <button onClick={logout} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 12, background: '#fee2e2', border: `1px solid #fecaca`, color: HC.danger, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.2s ease', fontFamily: "'Nunito',sans-serif" }} onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.borderColor = '#f87171'; }} onMouseLeave={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.borderColor = '#fecaca'; }}>
              <LogoutOutlined />{sidebarOpen && <span>Đăng xuất</span>}
            </button>
            {sidebarOpen && <div style={{ marginTop: 20, textAlign: 'center', fontSize: 9, fontWeight: 800, color: HC.muted2, letterSpacing: '0.2em', fontFamily: "'Nunito',sans-serif" }}>#IT'S ALWAYS DAY 1</div>}
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