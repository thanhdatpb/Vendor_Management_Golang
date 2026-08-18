// ════════════════════════════════════════════════════════
//  STAFF A (SELLER) DASHBOARD — TechStore Hub
//  Refactored: mỗi component nằm trong file riêng
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationApi } from '../services/api';
import { subscribeNotificationChanges } from '../services/echo';

import { HC } from '../constants/sellerTheme';
import useIsMobile from '../hooks/useIsMobile';
import SellerSidebar from '../components/seller/SellerSidebar';
import SellerNotificationCenter from '../components/seller/SellerNotificationCenter';
import ProductsSection from '../components/seller/ProductsSection';
import VendorsSection from '../components/seller/VendorsSection';
import SetupPriceSection from '../components/seller/SetupPriceSection';

// ══════════════════════════════════════════════════════════
//  MAIN SELLER DASHBOARD
// ══════════════════════════════════════════════════════════
export default function SellerDashboard() {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [active, setActive] = useState('products');
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia('(max-width:767px)').matches);
  const [requestNotifications, setRequestNotifications] = useState([]);
  const [newsNotifications, setNewsNotifications] = useState([]);
  const [highlightedProductId, setHighlightedProductId] = useState(null);
  const [pendingOpenProductId, setPendingOpenProductId] = useState(null);
  const [vendorHighlightFileId, setVendorHighlightFileId] = useState(null);

  const handleViewVendorLibrary = (fileId) => {
    setVendorHighlightFileId(fileId || null);
    setActive('vendors');
  };

  const PAGE_TITLES = {
    products: 'Danh Sách Sản Phẩm',
    vendors: 'Vendors — Nhà Cung Cấp',
    setup_price: 'Setup Price — Cài Đặt Giá',
  };

  // ─── Load Request Notifications ────────────────────────
  const loadRequestNotifications = useCallback(() => {
    const requests = [];

    // 1. Từ API (Admin duyệt/từ chối/vendor_assigned/feedback/deadline)
    notificationApi.list()
      .then(r => {
        const apiNotifs = r.data.data || [];
        apiNotifs.forEach(n => {
          // Tin từ Vendor có tab riêng (loadNewsNotifications) — bỏ khỏi tab yêu cầu
          // để không hiện hai lần trong chuông.
          if (n.type === 'news') return;
          const productName = n.data?.product_type || n.product_type || 'Sản phẩm';
          const productId = n.data?.product_id || n.product_id || null;
          const exists = requests.some(ex => ex.id === `api_${n.id}`);
          if (!exists) {
            requests.push({
              id: `api_${n.id}`,
              type: n.type,
              source: 'api',
              title: n.title || 'Thông báo',
              message: n.body || '',
              time: new Date(n.created_at).toLocaleString('vi-VN'),
              read: n.is_read || false,
              productId,
              productType: productName,
              timestamp: n.created_at,
            });
          }
        });

        setRequestNotifications(prev => {
          const prevMap = Object.fromEntries(prev.map(n => [n.id, n]));
          const merged = requests.map(n => ({ ...n, read: prevMap[n.id]?.read === true ? true : n.read }));
          const allIds = new Set(merged.map(n => n.id));
          const kept = prev.filter(n => !allIds.has(n.id));
          return [...merged, ...kept].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 100);
        });
      })
      .catch(err => console.error('Lỗi load API notifications:', err));

    // 2. Từ STAFF_B_NOTIFICATIONS (vendor_assigned + seller_feedback)
    try {
      const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
      staffBNotifs.forEach(n => {
        if (n.type === 'vendor_assigned' || n.type === 'seller_feedback') {
          const productName = n.productName || n.product_type || n.productType || 'Sản phẩm';
          const icon = n.type === 'vendor_assigned' ? '🏪' : '💬';
          const title = n.type === 'vendor_assigned' ? 'Vendor đã được gán' : 'Phản hồi từ Staff B';
          const exists = requests.some(ex => ex.id === `staffb_${n.id}`);
          if (!exists) {
            requests.push({
              id: `staffb_${n.id}`, type: n.type, source: 'staffb',
              icon, title, message: n.message || '',
              time: n.time || new Date(n.created_at || Date.now()).toLocaleString('vi-VN'),
              read: n.is_read || false, productId: n.productId,
              productType: productName, vendorType: n.vendorType,
              timestamp: n.created_at || Date.now(),
            });
          }
        }
      });
    } catch (err) { console.error('Lỗi load Staff B notifications:', err); }

    // 3. Từ STAFF_A_NOTIFICATIONS (feedback_from_b)
    try {
      const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      staffANotifs.forEach(n => {
        if (n.type === 'feedback_from_b') {
          requests.push({
            id: `staffa_${n.id}`, type: 'feedback_from_b', source: 'staffb',
            icon: n.icon || '💬', title: n.title || 'Staff B đã gửi phản hồi',
            message: n.message || '',
            time: n.time || new Date(n.timestamp || Date.now()).toLocaleString('vi-VN'),
            read: n.is_read || false, productId: n.productId,
            productType: n.productType, vendorKey: n.vendorKey,
            timestamp: n.timestamp || n.id,
          });
        }
      });
    } catch (err) { console.error('Lỗi load STAFF_A_NOTIFICATIONS:', err); }

    requests.sort((a, b) => new Date(b.time) - new Date(a.time));
    setRequestNotifications(prev => {
      const prevMap = Object.fromEntries(prev.map(n => [n.id, n]));
      const merged = requests.map(n => ({ ...n, read: prevMap[n.id]?.read === true ? true : n.read }));
      const allIds = new Set(merged.map(n => n.id));
      const kept = prev.filter(n => !allIds.has(n.id));
      return [...merged, ...kept].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 100);
    });
  }, []);

  // ─── Load News Notifications ────────────────────────────
  // Tin từ Vendor đến qua API: Vendor bấm Gửi → server tạo notification type 'news'
  // cho từng tài khoản Seller. Bản cũ chỉ đọc localStorage nên Seller không bao giờ
  // nhận được — Vendor ghi vào localStorage của chính máy Vendor, mà main.jsx còn
  // xoá sạch key SELLER_NOTIFICATIONS/STAFF_B_NOTIFICATIONS mỗi lần app khởi động.
  const loadNewsNotifications = useCallback(() => {
    notificationApi.list()
      .then(r => {
        const news = (r.data?.data || [])
          .filter(n => n.type === 'news')
          .map(n => ({
            id: `api_${n.id}`,
            type: 'news',
            icon: n.data?.icon || '📰',
            title: n.title || 'Tin tức mới',
            message: n.body || '',
            time: new Date(n.created_at).toLocaleString('vi-VN'),
            read: n.is_read || false,
            timestamp: n.created_at,
            source: 'staff_b',
          }));

        setNewsNotifications(prev => {
          const prevMap = Object.fromEntries(prev.map(n => [n.id, n]));
          return news
            .map(n => ({ ...n, read: prevMap[n.id]?.read === true ? true : n.read }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 100);
        });
      })
      .catch(err => console.error('Lỗi load tin tức:', err));
  }, []);

  // ─── Mark as read ───────────────────────────────────────
  const markRequestAsRead = useCallback((notificationId) => {
    if (notificationId.startsWith('api_')) {
      notificationApi.readOne(notificationId.replace('api_', '')).catch(err => console.error(err));
    }
    if (notificationId.startsWith('staffb_')) {
      try {
        const notifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
        const originalId = notificationId.replace('staffb_', '');
        localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(
          notifs.map(n => String(n.id) === originalId ? { ...n, is_read: true } : n)
        ));
        window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS' }));
      } catch (err) { console.error(err); }
    }
    setRequestNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
  }, []);

  const markNewsAsRead = useCallback((notificationId) => {
    // Tin từ API mang id dạng api_<id> → báo đã đọc lên server, để mở lại ở máy khác
    // cũng không còn đếm là chưa đọc.
    if (String(notificationId).startsWith('api_')) {
      notificationApi.readOne(String(notificationId).replace('api_', '')).catch(err => console.error(err));
    }
    setNewsNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, read: true } : n));
  }, []);

  // ─── Navigation handlers ────────────────────────────────
  const handleRequestClick = useCallback((notification) => {
    if (notification.productId) {
      setPendingOpenProductId(notification.productId);
      setActive('products');
    }
  }, []);

  const handleNewsClick = useCallback(() => {}, []);

  // ─── Polling & storage sync ─────────────────────────────
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
    const handleStorageChange = (e) => {
      if (['STAFF_B_NOTIFICATIONS', 'STAFF_A_NOTIFICATIONS'].includes(e.key)) loadRequestNotifications();
      if (['STAFF_B_NOTIFICATIONS', 'SELLER_NOTIFICATIONS'].includes(e.key)) loadNewsNotifications();
    };
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

  // Mở sản phẩm khi chuyển tab
  useEffect(() => {
    if (active === 'products' && pendingOpenProductId) {
      setHighlightedProductId(pendingOpenProductId);
      setPendingOpenProductId(null);
    }
  }, [active, pendingOpenProductId]);

  const renderSection = () => {
    switch (active) {
      case 'products': return <ProductsSection highlightedProductId={highlightedProductId} onHighlightCleared={() => setHighlightedProductId(null)} onViewVendorLibrary={handleViewVendorLibrary} />;
      case 'vendors': return <VendorsSection highlightFileId={vendorHighlightFileId} onHighlightCleared={() => setVendorHighlightFileId(null)} />;
      case 'setup_price': return <SetupPriceSection />;
      default: return null;
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${HC.cream}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: ${HC.orangeMid}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${HC.orange}; }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', background: `linear-gradient(135deg, ${HC.orangePale} 0%, ${HC.cream} 100%)`, fontFamily: "'Inter',sans-serif", color: HC.ink, overflow: 'hidden' }}>
        <SellerSidebar active={active} setActive={setActive} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} user={user} logout={logout} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Topbar */}
          <div style={{ height: 72, background: `linear-gradient(135deg, ${HC.surface}, ${HC.surface2})`, borderBottom: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 14px' : '0 32px', gap: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.02)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 16, minWidth: 0 }}>
              {isMobile ? (
                <button
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Mở menu"
                  style={{ width: 42, height: 42, borderRadius: 12, background: '#fff', border: `1.5px solid ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', flexShrink: 0 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={HC.ink2} strokeWidth="2.2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
                </button>
              ) : (
                <div style={{ width: 4, height: 32, borderRadius: 99, background: `linear-gradient(to bottom, ${HC.orange}, ${HC.orangeDark})`, flexShrink: 0 }} />
              )}
              <div style={{ color: HC.ink, fontWeight: 900, fontSize: isMobile ? 15 : 16, fontFamily: "'Inter',sans-serif", letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {PAGE_TITLES[active]}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
              {!isMobile && (
                <div style={{ color: HC.muted, fontSize: 12, fontWeight: 600 }}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              )}
              <SellerNotificationCenter
                requestNotifications={requestNotifications}
                newsNotifications={newsNotifications}
                markRequestAsRead={markRequestAsRead}
                markNewsAsRead={markNewsAsRead}
                onRequestClick={handleRequestClick}
                onNewsClick={handleNewsClick}
              />
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 14 : 32 }}>
            {renderSection()}
          </div>
        </div>
      </div>
    </>
  );
}
