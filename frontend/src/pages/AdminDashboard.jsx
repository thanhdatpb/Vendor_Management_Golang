import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { productApi, notificationApi } from '../services/api';
import { subscribeNotificationChanges, subscribeProductChanges } from '../services/echo';
import { HC, PAGE_TITLES } from '../components/admin/constants';
import { ADMIN_SECTIONS } from '../constants/dashboardSections';
import useSectionRoute from '../hooks/useSectionRoute';
import { normalizeList } from '../components/admin/utils';
import Sidebar from '../components/admin/Sidebar';
import NotificationCenter from '../components/admin/notifications/NotificationCenter';
import OverviewSection from '../components/admin/sections/OverviewSection';
import VendorsSection from '../components/admin/sections/VendorsSection';
import PriceSheetSection from '../components/admin/sections/PriceSheetSection';
import StaffManagementSection from '../components/admin/sections/StaffManagementSection';
import {
  VENDOR_LIBRARY_SUBMENU,
  vendorLibraryModeFromSearch,
  adminVendorLibraryPath,
} from '../components/admin/vendorLibraryNavigation';
import { fmtVNLongDate } from '../utils/vnTime';

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

    console.log('Đã gửi thông báo đến Admin:', newNotification);
    return true;
  } catch (err) {
    console.error('Lỗi gửi thông báo:', err);
    return false;
  }
};

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  // Mục đang mở nằm trên URL (/admin/overview | /admin/vendors |
  // /admin/price-sheets | /admin/staff). Trước đây là useState + sessionStorage
  // để nhớ tab khi remount (bấm "Quay lại" từ /price-sheets/:id); URL làm
  // đúng việc đó mà còn bookmark/gửi link/Back được, nên bỏ sessionStorage.
  const [active, setActive] = useSectionRoute({ basePath: '/admin', sections: ADMIN_SECTIONS, fallback: 'overview' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [requestNotifications, setRequestNotifications] = useState([]);
  const [newsNotifications, setNewsNotifications] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [viewProduct, setViewProduct] = useState(null);
  // Badge "N bảng" đứng cạnh tiêu đề trên topbar (cùng pattern với Seller) —
  // PriceSheetSection báo số bảng đang hiện lên đây thay vì tự dựng header riêng.
  const [priceSheetsCount, setPriceSheetsCount] = useState(null);

  // Thư Viện Vendor: chế độ con (Tổng quan / New Arrivals / Best Seller) nằm
  // trên query `?view=` để bookmark/Back được như mục chính. Số file của từng
  // chế độ do VendorLibraryViewer báo lên; giữ số gần nhất khi rời mục để lần mở
  // submenu sau không chớp "…".
  const location = useLocation();
  const navigate = useNavigate();
  const vendorLibraryMode = vendorLibraryModeFromSearch(location.search);
  const [vendorLibraryCounts, setVendorLibraryCounts] = useState(null);
  const openVendorLibraryMode = useCallback((mode) => {
    navigate(adminVendorLibraryPath(mode));
  }, [navigate]);
  const sidebarSubmenus = useMemo(() => ({
    vendors: {
      items: VENDOR_LIBRARY_SUBMENU,
      activeId: vendorLibraryMode,
      counts: vendorLibraryCounts,
      countsPending: active === 'vendors' && !vendorLibraryCounts,
      onSelect: openVendorLibraryMode,
    },
  }), [vendorLibraryMode, vendorLibraryCounts, active, openVendorLibraryMode]);

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
    const requests = [];

    // 1. Từ API (new_form)
    notificationApi.list()
      .then(r => {
        const apiNotifs = r.data?.data || [];
        apiNotifs.forEach(n => {
          // Type 'pending' là thông báo trùng lặp cũ (trước khi gộp về 1 thông báo
          // "new_form" duy nhất mỗi form request) — bỏ qua để không hiện song song
          // với thông báo "new_form" của cùng 1 form.
          if (n.type === 'pending') return;
          // 'news' là tin từ Vendor — có tab riêng (loadNewsNotifications), không
          // trộn vào tab yêu cầu để khỏi hiện hai lần.
          if (n.type === 'news') return;

          const productId = n.data?.product_id || n.product_id || null;
          const productType = n.data?.product_type || n.product_type || '';
          const sellerName = n.data?.seller_name || n.seller_name || '';
          requests.push({
            id: `api_${n.id}`,
            type: n.type,
            source: 'api',
            title: n.title || 'Thông báo',
            message: n.body || '',
            timestamp: n.created_at,
            read: n.is_read || false,
            productId,
            product_id: productId,
            productType,
            product_type: productType,
            sellerName,
          });
        });

        // 2. Từ localStorage STAFF_A_NOTIFICATIONS (new_form, fallback cũ)
        try {
          const lsNotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
          lsNotifs.filter(n => n.type === 'new_form').forEach(n => {
            if (!requests.some(r => r.product_id && String(r.product_id) === String(n.product_id) && r.source === 'api')) {
              requests.push({
                ...n,
                productId: n.product_id || n.productId,
                source: 'localStorage',
              });
            }
          });
        } catch { }

        requests.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setRequestNotifications(prev => {
          const prevMap = Object.fromEntries(prev.map(n => [n.id, n]));
          return requests.slice(0, 50).map(n => ({
            ...n,
            read: prevMap[n.id]?.read === true ? true : (n.read || false),
          }));
        });
      })
      .catch(() => {
        // Fallback: localStorage only
        try {
          const lsNotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
          const filtered = lsNotifs.filter(n => n.type === 'new_form')
            .map(n => ({ ...n, productId: n.product_id || n.productId }))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 50);
          setRequestNotifications(prev => {
            const prevMap = Object.fromEntries(prev.map(n => [n.id, n]));
            return filtered.map(n => ({ ...n, read: prevMap[n.id]?.read === true ? true : (n.read || false) }));
          });
        } catch { }
      });
  }, []);

  // Tin từ Vendor giờ đến qua API (Vendor bấm Gửi → server tạo notification type
  // 'news' cho từng Admin). Trước đây hàm này chỉ đọc localStorage nên chỉ thấy tin
  // do chính máy này ghi ra — Vendor gửi từ máy khác thì Admin không bao giờ nhận.
  // Vẫn đọc thêm localStorage để không mất các tin cũ còn tồn trên máy đang dùng.
  const loadNewsNotifications = useCallback(() => {
    const readLegacy = () => {
      try {
        const staffBNotifs = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS_TO_ADMIN') || '[]');
        return staffBNotifs.map(notif => ({
          id: notif.id || `news_${Date.now()}_${Math.random()}`,
          type: notif.type || 'news',
          icon: notif.icon || '📰',
          title: notif.title || 'Thông báo mới từ Staff B',
          message: notif.message || '',
          author: notif.author || 'Staff B',
          timestamp: notif.timestamp || new Date().toISOString(),
          read: notif.read || false,
        }));
      } catch (err) {
        console.error('Error loading legacy news notifications:', err);
        return [];
      }
    };

    const applyNews = (list) => {
      const sliced = list
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50);
      setNewsNotifications(prev => {
        const prevMap = Object.fromEntries(prev.map(n => [n.id, n]));
        return sliced.map(n => ({
          ...n,
          read: prevMap[n.id]?.read === true ? true : n.read,
        }));
      });
    };

    notificationApi.list()
      .then(r => {
        const apiNews = (r.data?.data || [])
          .filter(n => n.type === 'news')
          .map(n => ({
            id: `api_${n.id}`,
            type: 'news',
            icon: n.data?.icon || '📰',
            title: n.title || 'Thông báo mới từ Vendor',
            message: n.body || '',
            author: 'Vendor',
            timestamp: n.created_at,
            read: n.is_read || false,
          }));
        // Tin cũ trong localStorage có thể trùng tin vừa nhận qua API (cùng tiêu đề)
        // — bỏ bản localStorage để chuông không hiện hai dòng y hệt nhau.
        const apiTitles = new Set(apiNews.map(n => n.title));
        applyNews([...apiNews, ...readLegacy().filter(n => !apiTitles.has(n.title))]);
      })
      .catch(() => applyNews(readLegacy()));
  }, []);

  const markRequestAsRead = useCallback((notificationId) => {
    if (String(notificationId).startsWith('api_')) {
      const realId = String(notificationId).replace('api_', '');
      notificationApi.readOne(realId).catch(() => {});
    } else {
      try {
        const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
        const updated = staffANotifs.map(n => n.id === notificationId ? { ...n, read: true } : n);
        localStorage.setItem('STAFF_A_NOTIFICATIONS', JSON.stringify(updated));
      } catch { }
    }
    setRequestNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const markNewsAsRead = useCallback((notificationId) => {
    // Tin đến từ API mang id dạng api_<id> → báo đã đọc lên server để lần load sau
    // (kể cả trên máy khác) không còn đếm là chưa đọc.
    if (String(notificationId).startsWith('api_')) {
      notificationApi.readOne(String(notificationId).replace('api_', '')).catch(() => {});
    } else {
      try {
        const news = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS_TO_ADMIN') || '[]');
        const updated = news.map(n =>
          String(n.id) === notificationId ? { ...n, read: true } : n
        );
        localStorage.setItem('STAFF_B_NOTIFICATIONS_TO_ADMIN', JSON.stringify(updated));
      } catch (err) {
        console.error('Error marking news as read:', err);
      }
    }
    setNewsNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const handleRequestClick = useCallback(async (notification) => {
    const productId = notification.productId || notification.product_id;
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
  }, [pendingProducts, setActive]);

  const handleNewsClick = useCallback(async (notification) => {
    console.log('Click vào tin tức:', notification);
  }, []);

  useEffect(() => {
    const refreshNotifications = () => {
      loadRequestNotifications();
      loadNewsNotifications();
    };
    const refreshVisibleData = () => {
      if (document.hidden) return;
      refreshNotifications();
      loadPendingProducts();
    };

    refreshVisibleData();

    // Real-time qua Pusher — badge/số lượng chờ duyệt cập nhật ngay, không cần F5.
    const unsubscribePusher = subscribeProductChanges(() => { loadPendingProducts(); });
    const unsubscribeNotifications = subscribeNotificationChanges(user?.id, refreshNotifications);

    const interval = setInterval(() => {
      refreshVisibleData();
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
    window.addEventListener('focus', refreshVisibleData);
    document.addEventListener('visibilitychange', refreshVisibleData);

    const handleCustomNewsEvent = (event) => {
      if (event.detail) {
        loadNewsNotifications();
      }
    };
    window.addEventListener('newStaffNews', handleCustomNewsEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', refreshVisibleData);
      document.removeEventListener('visibilitychange', refreshVisibleData);
      window.removeEventListener('newStaffNews', handleCustomNewsEvent);
      clearInterval(interval);
      unsubscribePusher();
      unsubscribeNotifications();
    };
  }, [user?.id, loadRequestNotifications, loadNewsNotifications, loadPendingProducts]);

  const renderSection = () => {
    switch (active) {
      case 'overview':
        return <OverviewSection externalViewProduct={viewProduct} setExternalViewProduct={setViewProduct} />;
      case 'vendors':
        return <VendorsSection mode={vendorLibraryMode} onModeCountsChange={setVendorLibraryCounts} />;
      case 'pricesheets':
        return <PriceSheetSection onTotalCountChange={setPriceSheetsCount} />;
      case 'staff':
        return <StaffManagementSection />;
      default:
        return <OverviewSection externalViewProduct={viewProduct} setExternalViewProduct={setViewProduct} />;
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
      `}</style>

      <div style={{
        display: 'flex',
        height: '100vh',
        background: `linear-gradient(135deg, ${HC.orangePale} 0%, ${HC.cream} 100%)`,
        fontFamily: "'Inter',sans-serif",
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
          submenus={sidebarSubmenus}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={{
                  color: HC.ink,
                  fontWeight: 900,
                  fontSize: 16,
                  fontFamily: "'Inter',sans-serif",
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {PAGE_TITLES[active]}
                </div>
                {active === 'pricesheets' && priceSheetsCount !== null && (
                  <span style={{
                    padding: '2px 10px', borderRadius: 20, background: HC.orangeLight,
                    color: HC.brown, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{priceSheetsCount} bảng</span>
                )}
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              <div style={{ color: HC.muted, fontSize: 12, fontWeight: 600 }}>{fmtVNLongDate()}</div>
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
            padding: '32px 40px',
          }}>
            {renderSection()}
          </div>
        </div>
      </div>
    </>
  );
}
