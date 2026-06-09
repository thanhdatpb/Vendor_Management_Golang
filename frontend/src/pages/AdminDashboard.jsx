import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { productApi } from '../services/api';
import { HC, PAGE_TITLES } from '../components/admin/constants';
import { normalizeList } from '../components/admin/utils';
import Sidebar from '../components/admin/Sidebar';
import NotificationCenter from '../components/admin/notifications/NotificationCenter';
import OverviewSection from '../components/admin/sections/OverviewSection';
import VendorsSection from '../components/admin/sections/VendorsSection';

window.sendNewsToAdmin = function (newsData) {
  try {
    const existingNews = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS_TO_ADMIN') || '[]');
    const newNotification = {
      id: `news_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: 'news',
      icon: newsData.icon || '📰',
      title: newsData.title || 'Thông báo mới từ Staff B',
      message: newsData.message || '',
      author: newsData.author || 'Staff B',
      timestamp: new Date().toISOString(),
      read: false,
      ...newsData
    };
    existingNews.unshift(newNotification);
    const trimmedNews = existingNews.slice(0, 200);
    localStorage.setItem('STAFF_B_NOTIFICATIONS_TO_ADMIN', JSON.stringify(trimmedNews));

    window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS_TO_ADMIN' }));
    window.dispatchEvent(new CustomEvent('newStaffNews', { detail: newNotification }));

    console.log('✅ Đã gửi thông báo đến Admin:', newNotification);
    return true;
  } catch (err) {
    console.error('❌ Lỗi gửi thông báo:', err);
    return false;
  }
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [active, setActive] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [requestNotifications, setRequestNotifications] = useState([]);
  const [newsNotifications, setNewsNotifications] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [viewProduct, setViewProduct] = useState(null);

  const loadPendingProducts = useCallback(async () => {
    try {
      const res = await productApi.pendingApprovals();
      const products = normalizeList(res);
      setPendingProducts(products);
    } catch (err) {
      console.error('Lỗi load pending products:', err);
    }
  }, []);

  const loadRequestNotifications = useCallback(() => {
    try {
      let staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      
      // Tự động fix lại text của các thông báo cũ còn kẹt trong localStorage
      let hasChanges = false;
      staffANotifs = staffANotifs.map(n => {
        if (n.type === 'new_form' && n.message && n.message.includes('thuộc Project')) {
          const match = n.message.match(/thuộc Project\s+"([^"]+)"/);
          const projectName = match ? match[1] : (n.project || 'Không xác định');
          hasChanges = true;
          return { ...n, message: `Seller của project ${projectName} vừa gửi form request mới.` };
        }
        return n;
      });
      if (hasChanges) {
        localStorage.setItem('STAFF_A_NOTIFICATIONS', JSON.stringify(staffANotifs));
      }

      const requests = staffANotifs
        .filter(n => n.type === 'new_form')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50);
      setRequestNotifications(prev => {
        const prevMap = Object.fromEntries(prev.map(n => [n.id, n]));
        return requests.map(n => ({
          ...n,
          read: prevMap[n.id]?.read === true ? true : (n.read || false),
        }));
      });
    } catch (err) {
      console.error('Error loading request notifications:', err);
    }
  }, []);

  const loadNewsNotifications = useCallback(() => {
    try {
      let staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS_TO_ADMIN') || '[]');
      const formattedNews = staffBNotifs.map(notif => ({
        id: notif.id || `news_${Date.now()}_${Math.random()}`,
        type: notif.type || 'news',
        icon: notif.icon || '📰',
        title: notif.title || 'Thông báo mới từ Staff B',
        message: notif.message || '',
        author: notif.author || 'Staff B',
        timestamp: notif.timestamp || new Date().toISOString(),
        read: notif.read || false,
      }));
      formattedNews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const sliced = formattedNews.slice(0, 50);
      setNewsNotifications(prev => {
        const prevMap = Object.fromEntries(prev.map(n => [n.id, n]));
        return sliced.map(n => ({
          ...n,
          read: prevMap[n.id]?.read === true ? true : n.read,
        }));
      });
    } catch (err) {
      console.error('Error loading news notifications:', err);
      setNewsNotifications([]);
    }
  }, []);

  const markRequestAsRead = useCallback((notificationId) => {
    try {
      const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      const updated = staffANotifs.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      localStorage.setItem('STAFF_A_NOTIFICATIONS', JSON.stringify(updated));
      setRequestNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error('Error marking request as read:', err);
    }
  }, []);

  const markNewsAsRead = useCallback((notificationId) => {
    try {
      const news = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS_TO_ADMIN') || '[]');
      const updated = news.map(n =>
        String(n.id) === notificationId ? { ...n, read: true } : n
      );
      localStorage.setItem('STAFF_B_NOTIFICATIONS_TO_ADMIN', JSON.stringify(updated));
      setNewsNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error('Error marking news as read:', err);
    }
  }, []);

  const handleRequestClick = useCallback(async (notification) => {
    const productId = notification.product_id;
    if (!productId) return;

    setActive('overview');

    let product = pendingProducts.find(p => String(p.id) === String(productId));

    if (product) {
      const normalizedProduct = {
        ...product,
        media_urls: product.media_urls || (product.media_url ? [product.media_url] : []),
        product_type_links: (() => {
          if (product.product_type_links) {
            if (Array.isArray(product.product_type_links)) return product.product_type_links;
            try { return JSON.parse(product.product_type_links); }
            catch { return [product.product_type_links]; }
          }
          if (product.product_type_link) return [product.product_type_link];
          return [];
        })()
      };
      setViewProduct(normalizedProduct);
      return;
    }

    try {
      const response = await productApi.getById(productId);
      const productData = response.data?.data || response.data;
      if (productData && Object.keys(productData).length > 0) {
        setViewProduct({
          ...productData,
          media_urls: productData.media_urls || (productData.media_url ? [productData.media_url] : []),
        });
      }
    } catch (err) {
      console.error('Error fetching product:', err);
    }
  }, [pendingProducts]);

  const handleNewsClick = useCallback(async (notification) => {
    console.log('Click vào tin tức:', notification);
  }, []);

  useEffect(() => {
    loadRequestNotifications();
    loadNewsNotifications();
    loadPendingProducts();

    const interval = setInterval(() => {
      loadPendingProducts();
      loadRequestNotifications();
      loadNewsNotifications();
    }, 15000);

    const handleStorageChange = (e) => {
      if (e.key === 'STAFF_A_NOTIFICATIONS') {
        loadRequestNotifications();
        loadNewsNotifications();
      }
      if (e.key === 'STAFF_B_NOTIFICATIONS_TO_ADMIN') {
        loadNewsNotifications();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const handleCustomNewsEvent = (event) => {
      if (event.detail) {
        loadNewsNotifications();
      }
    };
    window.addEventListener('newStaffNews', handleCustomNewsEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('newStaffNews', handleCustomNewsEvent);
      clearInterval(interval);
    };
  }, [loadRequestNotifications, loadNewsNotifications, loadPendingProducts]);

  const renderSection = () => {
    switch (active) {
      case 'overview':
        return <OverviewSection externalViewProduct={viewProduct} setExternalViewProduct={setViewProduct} />;
      case 'vendors':
        return <VendorsSection />;
      default:
        return <OverviewSection externalViewProduct={viewProduct} setExternalViewProduct={setViewProduct} />;
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Nunito+Sans:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: ${HC.cream}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb { background: ${HC.orangeMid}; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${HC.orange}; }
      `}</style>

      <div style={{
        display: 'flex',
        height: '100vh',
        background: `linear-gradient(135deg, ${HC.orangePale} 0%, ${HC.cream} 100%)`,
        fontFamily: "'Nunito Sans',sans-serif",
        color: HC.ink,
        overflow: 'hidden',
      }}>
        <Sidebar
          active={active}
          setActive={setActive}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          logout={logout}
        />

        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            height: 72,
            background: `linear-gradient(135deg, ${HC.surface}, ${HC.surface2})`,
            borderBottom: `1.5px solid ${HC.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            gap: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.02)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              <div style={{
                width: 4,
                height: 32,
                borderRadius: 99,
                background: `linear-gradient(to bottom, ${HC.orange}, ${HC.orangeDark})`,
                flexShrink: 0,
              }} />
              <div style={{
                color: HC.ink,
                fontWeight: 900,
                fontSize: 16,
                fontFamily: "'Nunito',sans-serif",
                letterSpacing: '-0.01em',
              }}>
                {PAGE_TITLES[active]}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              <div style={{ color: HC.muted, fontSize: 12, fontWeight: 600 }}>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <NotificationCenter
                notifications={requestNotifications}
                newsNotifications={newsNotifications}
                markAsRead={markRequestAsRead}
                markNewsAsRead={markNewsAsRead}
                onNotificationClick={handleRequestClick}
                onNewsClick={handleNewsClick}
              />
            </div>
          </div>

          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 32,
          }}>
            {renderSection()}
          </div>
        </div>
      </div>
    </>
  );
}