// ════════════════════════════════════════════════════════
//  ADMIN DASHBOARD — Happy Creative Branding (FIXED WITH NOTIFICATIONS & MULTI-IMAGE SUPPORT)
// ════════════════════════════════════════════════════════
import {
  DashboardOutlined, AppstoreOutlined, ShopOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  UserOutlined, CalendarOutlined, CrownOutlined, BellOutlined,
  LeftOutlined, RightOutlined, SearchOutlined, FilterOutlined
} from '@ant-design/icons';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  dashboardApi, productApi, vendorApi, notificationApi,
} from '../services/api';
import axios from 'axios';

// ─── UTILS ────────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n || 0);
const fmtDate = iso => { try { return iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'; } catch { return '—'; } };
const LS_SELLER_PRODUCTS = 'SELLER_PRODUCTS_V1';

const normalizeList = resp => {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.data)) return resp.data;
  if (Array.isArray(resp.data?.data?.data)) return resp.data.data.data;
  if (Array.isArray(resp.data?.data)) return resp.data.data;
  if (Array.isArray(resp.data?.products)) return resp.data.products;
  return [];
};

// ─── AUDIO UTILITY ─────────────────────────────────────────
let audioContext = null;
let notificationSound = null;

const initAudio = () => {
  if (typeof window !== 'undefined' && !audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  }
};

const playNotificationBeep = () => {
  try {
    initAudio();
    if (audioContext) {
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.3;

      oscillator.start();
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.5);
      oscillator.stop(audioContext.currentTime + 0.5);
    } else {
      const audio = new Audio();
      const beepUrl = 'data:audio/wav;base64,U3RlYW0gRW5jb2RlciB2ZXJzaW9uIDENCkZpbGUgc291cmNlOiBodHRwOi8vY29tbWVudC5zc28ub3JnL3BsYXlzb3VuZC8NCkJpdHJhdGU6IDExMDI1DQpDaGFubmVsczogMQ0KU2FtcGxlcyA6IDEwMDAwDQpEYXRhIA0A';
      audio.src = beepUrl;
      audio.volume = 0.4;
      audio.play().catch(e => console.log('Audio play failed:', e));
    }
  } catch (e) {
    console.log('Cannot play sound:', e);
  }
};
function BestSellerBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 9px', borderRadius: 999,
      background: 'linear-gradient(135deg,#FFF8DC,#FFE97A)',
      border: '1.5px solid #D4A017',
      color: '#B8860B', fontSize: 10, fontWeight: 900,
      fontFamily: "'Nunito',sans-serif", letterSpacing: '0.04em',
    }}>
      ⭐ Best Seller
    </span>
  );
}
const HC = {
  orange: '#F5A623', orangeDark: '#E09415', orangeDeep: '#C47F10',
  orangeLight: '#FEF3DC', orangeMid: '#FDE8B8', orangePale: '#FFFBF4',
  orangeGlow: 'rgba(245,166,35,0.15)', cream: '#FFF8EE', brown: '#7A5C32',
  brownLight: '#9C7A50', ink: '#1A0F00', ink2: '#3D2B0F', muted: '#B8956A',
  muted2: '#D4B896', surface: '#FFFFFF', surface2: '#FFFDF9', border: '#F0E4CC',
  borderStrong: '#E8D4A8', success: '#16a34a', danger: '#dc2626', warning: '#f59e0b',
  accent: '#E09415', shadow: '0 10px 30px rgba(245,166,35,0.08)', shadowStrong: '0 20px 50px rgba(245,166,35,0.14)',
};

const STATUS_CFG = {
  pending: { bg: '#fffbeb', text: '#92400e', dot: '#f59e0b', label: 'Chờ duyệt' },
  approved: { bg: '#ecfdf5', text: '#065f46', dot: '#16a34a', label: 'Đã duyệt' },
  rejected: { bg: '#fef2f2', text: '#991b1b', dot: '#dc2626', label: 'Từ chối' },
};

const MENU = [
  { id: 'overview', icon: <DashboardOutlined />, label: 'Tổng Quan', desc: 'Overview' },
  { id: 'products', icon: <AppstoreOutlined />, label: 'Duyệt Form Sản Phẩm', desc: 'Form Approval Management' },
  { id: 'vendors', icon: <ShopOutlined />, label: 'Thư Viện Vendor', desc: 'Vendor Library' },
];
const PAGE_TITLES = {
  overview: 'Overview — Tổng Quan',
  products: 'Products — Duyệt Form Sản Phẩm',
  vendors: 'Vendors — Thư Viện Vendor',
};

function HCLogo({ size = 32, color = '#F5A623' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <path d="M168 44 A88 88 0 1 0 168 156" stroke={color} strokeWidth="20" strokeLinecap="round" fill="none" />
      <path d="M118 128 Q130 142 145 132" stroke={color} strokeWidth="18" strokeLinecap="round" fill="none" />
    </svg>
  );
}
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ITEMS_PER_PAGE = 20;
const getMediaUrls = (product) => {
  if (!product) return [];

  if (product.media_urls && Array.isArray(product.media_urls) && product.media_urls.length) {
    return product.media_urls.map(url => {
      if (url.startsWith('http')) return url;
      if (url.startsWith('/storage')) return `${API_BASE_URL}${url}`;
      return `${API_BASE_URL}/storage/${url}`;
    });
  }

  if (product.media_url) {
    const url = product.media_url;
    if (url.startsWith('http')) return [url];
    if (url.startsWith('/storage')) return [`${API_BASE_URL}${url}`];
    return [`${API_BASE_URL}/storage/${url}`];
  }

  if (product.media_path) {
    let path = product.media_path;
    if (path.startsWith('storage/')) {
      path = path.replace('storage/', '');
    }
    if (path.startsWith('/storage/')) {
      path = path.replace('/storage/', '');
    }
    if (path.startsWith('http')) return [path];
    return [`${API_BASE_URL}/storage/${path}`];
  }

  return [];
};

function MediaGallery({ mediaUrls = [] }) {
  if (!mediaUrls.length) return <span style={{ color: HC.muted2, fontSize: 11 }}>—</span>;

  const firstUrl = mediaUrls[0];
  const isVideo = firstUrl && (firstUrl.match(/\.(mp4|webm|mov)$/i) || firstUrl.includes('video'));

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{
        width: 60,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#2a1a00',
        border: `1.5px solid ${HC.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {isVideo ? (
          <video src={firstUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <img src={firstUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      {mediaUrls.length > 1 && (
        <span style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          fontSize: 9,
          padding: '1px 5px',
          borderRadius: 10,
          pointerEvents: 'none'
        }}>
          +{mediaUrls.length - 1}
        </span>
      )}
    </div>
  );
}

// ─── NOTIFICATION CENTER COMPONENT (CHỈ HIỂN THỊ FORM MỚI) ─────────────────────────
// ════════════════════════════════════════════════════════
//  NOTIFICATION CENTER COMPONENT (2 TABS: YÊU CẦU & TIN TỨC)
// ════════════════════════════════════════════════════════
function NotificationCenter({ onClose, notifications, newsNotifications, markAsRead, markNewsAsRead, onNotificationClick, onNewsClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' or 'news'
  const [localRequests, setLocalRequests] = useState(notifications || []);
  const [localNews, setLocalNews] = useState(newsNotifications || []);
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Vừa xong';
      if (diffMins < 60) return `${diffMins} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 7) return `${diffDays} ngày trước`;
      return date.toLocaleDateString('vi-VN');
    } catch {
      return '';
    }
  };
  useEffect(() => {
    setLocalRequests(notifications || []);
  }, [notifications]);

  useEffect(() => {
    setLocalNews(newsNotifications || []);
  }, [newsNotifications]);

  const unreadRequests = localRequests.filter(n => !n.read).length;
  const unreadNews = localNews.filter(n => !n.read).length;
  const totalUnread = unreadRequests + unreadNews;

  const handleMarkAsRead = (id) => {
    markAsRead(id);
    setLocalRequests(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleMarkNewsAsRead = (id) => {
    if (markNewsAsRead) {
      markNewsAsRead(id);
    }
    setLocalNews(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleMarkAllRequestsAsRead = () => {
    localRequests.forEach(n => {
      if (!n.read) markAsRead(n.id);
    });
    setLocalRequests(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const handleMarkAllNewsAsRead = () => {
    localNews.forEach(n => {
      if (!n.read && markNewsAsRead) markNewsAsRead(n.id);
    });
    setLocalNews(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const handleRequestClick = (notif) => {
    if (!notif.read) {
      handleMarkAsRead(notif.id);
    }
    if (onNotificationClick) {
      onNotificationClick(notif);
    }
    setIsOpen(false);
  };

  const handleNewsClick = (notif) => {
    if (!notif.read) {
      handleMarkNewsAsRead(notif.id);
    }
    if (onNewsClick) {
      onNewsClick(notif);
    }
    setIsOpen(false);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: HC.orangeLight,
          border: `1px solid ${HC.orangeMid}`,
          borderRadius: 30,
          width: 40,
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = HC.orangeMid;
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = HC.orangeLight;
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        <BellOutlined style={{ fontSize: 20, color: HC.orangeDark }} />
        {totalUnread > 0 && (
          <span style={{
            position: 'absolute',
            top: -5,
            right: -5,
            background: HC.danger,
            color: '#fff',
            fontSize: 10,
            fontWeight: 900,
            width: 20,
            height: 20,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${HC.surface}`,
          }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998,
            }}
          />
          <div style={{
            position: 'absolute',
            top: 50,
            right: 0,
            width: 420,
            maxHeight: 550,
            background: HC.surface,
            borderRadius: 16,
            boxShadow: HC.shadowStrong,
            border: `1.5px solid ${HC.border}`,
            zIndex: 999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Header với 2 tabs */}
            <div style={{
              padding: '14px 18px',
              background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              color: '#fff',
            }}>
              <div style={{ fontWeight: 900, fontSize: 14, fontFamily: "'Nunito',sans-serif", marginBottom: 12 }}>
                🔔 Trung tâm thông báo
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setActiveTab('requests')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: activeTab === 'requests' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: "'Nunito',sans-serif",
                    transition: 'all 0.2s',
                  }}
                >
                  📋 Yêu cầu
                  {unreadRequests > 0 && (
                    <span style={{
                      background: '#fff',
                      color: HC.orangeDark,
                      borderRadius: 20,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 900,
                    }}>
                      {unreadRequests}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('news')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: activeTab === 'news' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    fontFamily: "'Nunito',sans-serif",
                    transition: 'all 0.2s',
                  }}
                >
                  📰 Tin tức
                  {unreadNews > 0 && (
                    <span style={{
                      background: '#fff',
                      color: HC.orangeDark,
                      borderRadius: 20,
                      padding: '2px 8px',
                      fontSize: 10,
                      fontWeight: 900,
                    }}>
                      {unreadNews}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Nội dung theo tab */}
            <div style={{ overflowY: 'auto', maxHeight: 420 }}>
              {activeTab === 'requests' && (
                <>
                  <div style={{
                    padding: '10px 16px',
                    background: HC.cream,
                    borderBottom: `1px solid ${HC.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>
                      📋 Form request từ Seller
                    </span>
                    {unreadRequests > 0 && (
                      <button
                        onClick={handleMarkAllRequestsAsRead}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: HC.orange,
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>

                  {localRequests.length === 0 ? (
                    <div style={{
                      padding: '60px 20px',
                      textAlign: 'center',
                      color: HC.muted,
                    }}>
                      <span style={{ fontSize: 48, opacity: 0.5 }}>📭</span>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Không có yêu cầu mới</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>Các form request từ Seller sẽ hiển thị tại đây</div>
                    </div>
                  ) : (
                    localRequests.map(notif => (
                      <div
                        key={notif.id}
                        onClick={() => handleRequestClick(notif)}
                        style={{
                          padding: '14px 16px',
                          borderBottom: `1px solid ${HC.border}`,
                          background: notif.read ? HC.surface : HC.orangeLight,
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = HC.orangePale}
                        onMouseLeave={e => e.currentTarget.style.background = notif.read ? HC.surface : HC.orangeLight}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ fontSize: 24 }}>{notif.icon || '📋'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: 800,
                              fontSize: 13,
                              color: notif.read ? HC.muted : HC.ink,
                              fontFamily: "'Nunito',sans-serif",
                            }}>
                              {notif.title}
                            </div>
                            <div style={{
                              fontSize: 12,
                              color: HC.brown,
                              marginTop: 6,
                              lineHeight: 1.4,
                            }}>
                              {notif.message}
                            </div>
                            <div style={{
                              display: 'flex',
                              gap: 12,
                              marginTop: 8,
                              fontSize: 10,
                              color: HC.muted2,
                            }}>
                              <span>🏷️ {notif.product_type || 'Sản phẩm'}</span>
                              <span>🕒 {formatTime(notif.timestamp)}</span>
                            </div>
                          </div>
                          {!notif.read && (
                            <div style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: HC.orange,
                              flexShrink: 0,
                              marginTop: 8,
                            }} />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeTab === 'news' && (
                <>
                  <div style={{
                    padding: '10px 16px',
                    background: HC.cream,
                    borderBottom: `1px solid ${HC.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>
                      📰 Tin tức & Cập nhật từ Staff B
                    </span>
                    {unreadNews > 0 && (
                      <button
                        onClick={handleMarkAllNewsAsRead}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: HC.orange,
                          fontSize: 10,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Đánh dấu đã đọc
                      </button>
                    )}
                  </div>

                  {localNews.length === 0 ? (
                    <div style={{
                      padding: '60px 20px',
                      textAlign: 'center',
                      color: HC.muted,
                    }}>
                      <span style={{ fontSize: 48, opacity: 0.5 }}>📰</span>
                      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Chưa có tin tức mới</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>Thông báo từ Staff B sẽ hiển thị tại đây</div>
                    </div>
                  ) : (
                    localNews.map(notif => (
                      <div
                        key={notif.id}
                        onClick={() => handleNewsClick(notif)}
                        style={{
                          padding: '14px 16px',
                          borderBottom: `1px solid ${HC.border}`,
                          background: notif.read ? HC.surface : HC.orangeLight,
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = HC.orangePale}
                        onMouseLeave={e => e.currentTarget.style.background = notif.read ? HC.surface : HC.orangeLight}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ fontSize: 24 }}>{notif.icon || '📰'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontWeight: 800,
                              fontSize: 13,
                              color: notif.read ? HC.muted : HC.ink,
                              fontFamily: "'Nunito',sans-serif",
                            }}>
                              {notif.title}
                            </div>
                            <div style={{
                              fontSize: 12,
                              color: HC.brown,
                              marginTop: 6,
                              lineHeight: 1.4,
                            }}>
                              {notif.message}
                            </div>
                            <div style={{
                              fontSize: 10,
                              color: HC.muted2,
                              marginTop: 8,
                            }}>
                              🕒 {notif.time || new Date(notif.timestamp).toLocaleString('vi-VN')}
                            </div>
                            {notif.product_type && (
                              <div style={{
                                marginTop: 6,
                                padding: '3px 8px',
                                background: HC.cream,
                                borderRadius: 6,
                                fontSize: 10,
                                color: HC.brown,
                                display: 'inline-block',
                              }}>
                                📦 {notif.product_type}
                              </div>
                            )}
                          </div>
                          {!notif.read && (
                            <div style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: HC.orange,
                              flexShrink: 0,
                              marginTop: 8,
                            }} />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>

            <div style={{
              padding: '10px 16px',
              borderTop: `1px solid ${HC.border}`,
              background: HC.cream,
              textAlign: 'center',
            }}>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: HC.orange,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: "'Nunito',sans-serif",
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── NOTIFICATION TOAST COMPONENT ─────────────────────────
function NotificationToast({ message, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      right: 20,
      background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
      color: '#fff',
      padding: '12px 20px',
      borderRadius: 12,
      boxShadow: HC.shadowStrong,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      zIndex: 2000,
      animation: 'slideIn 0.3s ease-out',
      fontFamily: "'Nunito Sans',sans-serif",
      border: `1px solid ${HC.orangeLight}`,
    }}>
      <span style={{ fontSize: 20 }}>📋</span>
      <div>
        <div style={{ fontWeight: 800, fontSize: 12 }}>Form mới từ Seller!</div>
        <div style={{ fontSize: 11, opacity: 0.9 }}>{message}</div>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 14,
          padding: 4,
        }}
      >
        ✕
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────
function Badge({ status }) {
  const c = STATUS_CFG[status] || { bg: HC.orangeLight, text: HC.brown, dot: HC.muted, label: status };
  return (
    <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${HC.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />{c.label}
    </span>
  );
}
function Card({ label, value, color = HC.orange }) {
  return (
    <div style={{ background: HC.surface, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow, borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden', transition: 'transform 0.2s,box-shadow 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = HC.shadowStrong; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = HC.shadow; }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${color},${color}88)`, borderRadius: '16px 16px 0 0' }} />
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: color + '14', pointerEvents: 'none' }} />
      <div style={{ color: HC.muted, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, fontFamily: "'Nunito',sans-serif" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "'Nunito',monospace", letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}
function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: HC.muted, fontSize: 13, fontFamily: "'Nunito Sans',sans-serif" }}>
      <HCLogo size={36} color={HC.orange} /><div style={{ marginTop: 10 }}>Đang tải...</div>
    </div>
  );
}
function Pagination({ currentPage, totalPages, totalItems, onPageChange }) {
  if (totalPages <= 1) return null;

  const from = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const to = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 14,
      padding: '10px 16px',
      background: HC.surface,
      borderRadius: 12,
      border: `1.5px solid ${HC.border}`,
      boxShadow: HC.shadow
    }}>
      <div style={{ fontSize: 12, color: HC.muted, fontWeight: 600 }}>
        Hiển thị <b style={{ color: HC.ink }}>{from}–{to}</b> / <b style={{ color: HC.ink }}>{totalItems}</b>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            minWidth: 32,
            height: 32,
            borderRadius: 8,
            border: `1.5px solid ${HC.border}`,
            background: HC.cream,
            fontSize: 12,
            fontWeight: 700,
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 1 ? 0.4 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ‹
        </button>

        {getPageNumbers().map((p, i) => (
          p === '...' ? (
            <span key={`dot-${i}`} style={{ fontSize: 12, color: HC.muted2, padding: '0 4px' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                minWidth: 32,
                height: 32,
                borderRadius: 8,
                border: `1.5px solid ${currentPage === p ? HC.orange : HC.border}`,
                background: currentPage === p ? HC.orange : HC.surface,
                color: currentPage === p ? '#fff' : HC.ink2,
                fontSize: 12,
                fontWeight: currentPage === p ? 900 : 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {p}
            </button>
          )
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            minWidth: 32,
            height: 32,
            borderRadius: 8,
            border: `1.5px solid ${HC.border}`,
            background: HC.cream,
            fontSize: 12,
            fontWeight: 700,
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage === totalPages ? 0.4 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
function EmptyState({ msg = 'Không có dữ liệu' }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: HC.muted, fontSize: 13, fontFamily: "'Nunito Sans',sans-serif" }}>
      <HCLogo size={40} color={HC.orangeMid} /><div style={{ marginTop: 12 }}>{msg}</div>
    </div>
  );
}
function Table({ cols, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, background: HC.surface, border: `1.5px solid ${HC.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: HC.shadow }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th
                key={c}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  color: HC.brown,
                  fontWeight: 900,
                  fontFamily: "'Nunito',sans-serif",
                  borderBottom: `1.5px solid ${HC.border}`,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  background: HC.cream
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: `1px solid ${HC.border}` }}
              onMouseEnter={e => (e.currentTarget.style.background = HC.orangePale)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: '12px 14px',
                    color: HC.ink2,
                    verticalAlign: 'middle',
                    fontFamily: "'Nunito Sans',sans-serif"
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function BarChart({ data, labels }) {
  const max = Math.max(...data.map(d => d.revenue || d || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 90, padding: '0 2px' }}>
      {data.map((d, i) => {
        const val = d.revenue || d || 0; const pct = (val / max) * 100; return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', height: `${Math.max(pct, 4)}px`, background: `linear-gradient(to top,${HC.orange},${HC.orangeDark}cc)`, borderRadius: '5px 5px 0 0', minHeight: 4 }} />
            <span style={{ fontSize: 8, color: HC.muted, fontFamily: "'Nunito',sans-serif", fontWeight: 700 }}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

function CardHeader({ icon, title, subtitle, badge, dimmed = false }) {
  const bg = dimmed
    ? `linear-gradient(135deg,${HC.muted},${HC.brownLight})`
    : `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`;
  return (
    <div style={{ padding: '12px 14px', background: bg, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 10, color: '#fff', fontFamily: "'Nunito',sans-serif", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontFamily: "'Nunito Sans',sans-serif", marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
      </div>
      {badge && <span style={{ flexShrink: 0, padding: '2px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 10, fontWeight: 900, fontFamily: "'Nunito',sans-serif", border: '1px solid rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{badge}</span>}
    </div>
  );
}
function InfoRow({ label, value, valueColor, valueBold, idx, isLast }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 12px', borderBottom: isLast ? 'none' : `1px solid ${HC.border}`, background: idx % 2 === 0 ? HC.surface : HC.surface2, minHeight: 34 }}>
      <span style={{ minWidth: 108, flexShrink: 0, fontWeight: 800, color: HC.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2, fontFamily: "'Nunito',sans-serif", lineHeight: 1.4 }}>{label}</span>
      <span style={{ color: valueColor || HC.ink2, fontWeight: valueBold ? 700 : 400, flex: 1, wordBreak: 'break-word', fontFamily: "'Nunito Sans',sans-serif", fontSize: 12, lineHeight: 1.4 }}>{value || '—'}</span>
    </div>
  );
}

function Lightbox({ mediaUrls, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

  const next = () => setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);

  if (!mediaUrls.length) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)', cursor: 'pointer'
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
        {isVideo(mediaUrls[currentIndex]) ? (
          <video src={mediaUrls[currentIndex]} controls autoPlay style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12 }} />
        ) : (
          <img src={mediaUrls[currentIndex]} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} />
        )}
        {mediaUrls.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              style={{
                position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
                width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff', fontSize: 28, transition: '0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
            >
              ‹
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              style={{
                position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
                width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#fff', fontSize: 28, transition: '0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.8)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
            >
              ›
            </button>
            <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', padding: '5px 12px', borderRadius: 20, color: '#fff', fontSize: 14 }}>
              {currentIndex + 1} / {mediaUrls.length}
            </div>
          </>
        )}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 20, right: 20,
            background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 40,
            width: 40, height: 40, cursor: 'pointer', color: '#fff', fontSize: 20
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function ProductViewerModal({ product, onClose }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const mediaUrls = getMediaUrls(product);

  if (!product) return null;

  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

  const productRows = [
    { label: 'Seller Name', value: product.seller_name || product.sellerName || product.user_name || product.userName || '—', color: HC.orange, bold: true },
    { label: 'Project', value: product.project || '—', color: HC.orangeDark, bold: true },
    { label: 'Date Request', value: fmtDate(product.created_at), color: HC.ink2, bold: false },
    { label: 'Deadline', value: fmtDate(product.deadline_date), color: HC.danger, bold: true },
    { label: 'Product Type', value: product.product_type, color: HC.orangeDark, bold: true },
    { label: 'Đặc tính KT', value: product.other_specs, color: HC.ink2, bold: false },
    { label: 'Chất liệu', value: product.material, color: HC.ink2, bold: false },
    { label: 'Vùng In', value: product.print_area, color: HC.ink2, bold: false },
    { label: 'Good Review', value: product.good_review, color: HC.success, bold: false },
    { label: 'Bad Review', value: product.bad_review, color: HC.danger, bold: false },
    { label: 'Packing', value: product.packaging_links, color: HC.ink2, bold: false },
    { label: 'Other Packing', value: product.other_packaging, color: HC.ink2, bold: false },
    {
      label: 'Link',
      value: (() => {
        let links = [];
        if (product.product_type_links) {
          if (Array.isArray(product.product_type_links)) {
            links = product.product_type_links;
          } else if (typeof product.product_type_links === 'string') {
            try {
              links = JSON.parse(product.product_type_links);
            } catch {
              links = [product.product_type_links];
            }
          }
        } else if (product.product_type_link) {
          links = [product.product_type_link];
        }

        if (links.length === 0) return '—';

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {links.map((link, idx) => (
              <a
                key={idx}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: HC.orange,
                  textDecoration: 'none',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  wordBreak: 'break-all'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = HC.orangeDark;
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = HC.orange;
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                🔗 {link.length > 60 ? link.substring(0, 60) + '...' : link}
              </a>
            ))}
          </div>
        );
      })(),
      color: HC.orange,
      bold: false
    },
    { label: 'Status', value: product.status || 'draft', color: HC.brown, bold: true },
  ];

  const statusKey = product.status === 'reject' ? 'rejected' : product.status;

  const handleMediaClick = (idx) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)', padding: 16 }}>
        <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 800, background: HC.orangePale, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>

          <div style={{ padding: '13px 20px', background: HC.ink, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ width: 4, height: 22, borderRadius: 99, background: `linear-gradient(to bottom,${HC.orange},${HC.orangeDark})`, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>Chi tiết sản phẩm</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontFamily: "'Nunito Sans',sans-serif", marginTop: 1 }}>{product.product_type || `#${product.id}`}</div>
            </div>
            <Badge status={statusKey} />
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.08)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,166,35,0.2)'; e.currentTarget.style.color = HC.orange; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>✕</button>
          </div>

          <div style={{ height: 220, flexShrink: 0, background: '#2a1a00', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', cursor: mediaUrls.length ? 'pointer' : 'default' }}
            onClick={() => { if (mediaUrls.length) handleMediaClick(0); }}>
            {mediaUrls.length > 0 ? (
              isVideo(mediaUrls[0]) ? (
                <video src={mediaUrls[0]} style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
              ) : (
                <img src={mediaUrls[0]} alt="" style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
              )
            ) : (
              <div style={{ color: HC.muted2, textAlign: 'center' }}><div style={{ fontSize: 48, marginBottom: 8 }}>📷</div><div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'Nunito',sans-serif", marginTop: 6 }}>Không có ảnh</div></div>
            )}
            {mediaUrls.length > 1 && (
              <div style={{ position: 'absolute', bottom: 12, right: 12, background: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: '4px 12px', fontSize: 11, color: '#fff' }}>
                {mediaUrls.length} media
              </div>
            )}
          </div>

          {mediaUrls.length > 1 && (
            <div style={{ display: 'flex', gap: 6, padding: '10px', overflowX: 'auto', background: '#1f1400', borderTop: `1px solid ${HC.border}` }}>
              {mediaUrls.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => handleMediaClick(idx)}
                  style={{ width: 60, height: 60, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${idx === lightboxIndex ? HC.orange : 'transparent'}`, flexShrink: 0 }}
                >
                  {isVideo(url) ? (
                    <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <div style={{
              background: HC.surface,
              borderRadius: 16,
              overflow: 'hidden',
              border: `1.5px solid ${HC.border}`,
              boxShadow: `0 4px 18px ${HC.orangeGlow}`
            }}>
              <CardHeader icon="📦" title="Thông tin sản phẩm" subtitle="Product details" badge={fmtDate(product.deadline_date) || 'No deadline'} />
              <div style={{ background: HC.surface }}>
                {productRows.map((r, idx) => <InfoRow key={r.label} label={r.label} value={r.value} valueColor={r.color} valueBold={r.bold} idx={idx} isLast={idx === productRows.length - 1} />)}
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 20px', background: HC.surface, borderTop: `1.5px solid ${HC.border}`, display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: '10px 28px', borderRadius: 10, background: `linear-gradient(135deg,${HC.orange},${HC.orangeDark})`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: "'Nunito',sans-serif", boxShadow: `0 4px 16px ${HC.orangeGlow}` }}>Đóng</button>
          </div>
        </div>
      </div>

      {lightboxOpen && <Lightbox mediaUrls={mediaUrls} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />}
    </>
  );
}
// ─── FORM HISTORY MODAL ─────────────────────────────────────
function FormHistoryModal({ open, onClose, title, filterType, filterValue, allProducts, allSellers = [] }) {
  console.log('🔍 FormHistoryModal - allSellers:', allSellers);
  console.log('🔍 FormHistoryModal - filterType:', filterType, 'filterValue:', filterValue);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeller, setFilterSeller] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterSeller]);

  if (!open) return null;

  // Lọc dữ liệu theo filterType
  let filteredProducts = [...allProducts];

  if (filterType === 'status') {
    if (filterValue === 'pending') {
      filteredProducts = filteredProducts.filter(p => p.status === 'pending');
    } else if (filterValue === 'approved') {
      filteredProducts = filteredProducts.filter(p => p.status === 'approved');
    } else if (filterValue === 'rejected') {
      filteredProducts = filteredProducts.filter(p => p.status === 'rejected' || p.status === 'reject');
    }
  } else if (filterType === 'project') {
    filteredProducts = filteredProducts.filter(p => p.project === filterValue);
  }

  // ✅ Lấy danh sách seller thuộc project hiện tại
  const getSellersByProject = () => {
    const currentProject = filterType === 'project' ? filterValue : null;
    console.log('🎯 Current project:', currentProject);
    console.log('📋 All sellers count:', allSellers.length);
    if (!currentProject || !allSellers.length) {
      console.log('⚠️ No project or no sellers');
      return ['all'];
    }

    const sellersInProject = allSellers
      .filter(seller => seller.project === currentProject)
      .map(seller => seller.seller_name || seller.name || seller.email);
    console.log('✅ Sellers in project:', sellersInProject);
    return ['all', ...sellersInProject];
  };

  const sellerList = getSellersByProject();

  // Áp dụng bộ lọc phụ
  let finalFilteredProducts = [...filteredProducts];

  if (filterStatus !== 'all') {
    if (filterStatus === 'pending') {
      finalFilteredProducts = finalFilteredProducts.filter(p => p.status === 'pending');
    } else if (filterStatus === 'approved') {
      finalFilteredProducts = finalFilteredProducts.filter(p => p.status === 'approved');
    } else if (filterStatus === 'rejected') {
      finalFilteredProducts = finalFilteredProducts.filter(p => p.status === 'rejected' || p.status === 'reject');
    }
  }

  if (filterSeller !== 'all') {
    finalFilteredProducts = finalFilteredProducts.filter(p =>
      (p.seller_name || p.sellerName || p.user_name || p.userName || '—') === filterSeller
    );
  }

  // Phân trang
  const totalPages = Math.ceil(finalFilteredProducts.length / itemsPerPage);
  const paginatedProducts = finalFilteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const getStatusBadge = (status) => {
    const realStatus = status === 'reject' ? 'rejected' : status;
    const colors = {
      pending: { bg: '#fffbeb', text: '#92400e', label: 'Chờ duyệt' },
      approved: { bg: '#ecfdf5', text: '#065f46', label: 'Đã duyệt' },
      rejected: { bg: '#fef2f2', text: '#991b1b', label: 'Từ chối' },
    };
    const c = colors[realStatus] || colors.pending;
    return (
      <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800 }}>
        {c.label}
      </span>
    );
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 1000, background: HC.surface, borderRadius: 20, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16, color: '#fff', fontFamily: "'Nunito',sans-serif" }}>
              📋 {title}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
              Tổng số: {finalFilteredProducts.length} form requests
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Bộ lọc */}
        <div style={{ padding: '16px 20px', background: HC.cream, borderBottom: `1px solid ${HC.border}`, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: HC.muted, marginBottom: 5, display: 'block' }}>Trạng thái</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${HC.border}`, background: HC.surface, fontSize: 12, outline: 'none' }}
            >
              <option value="all">Tất cả</option>
              <option value="pending">Chờ duyệt</option>
              <option value="approved">Đã duyệt</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: HC.muted, marginBottom: 5, display: 'block' }}>Seller Name</label>
            <select
              value={filterSeller}
              onChange={(e) => { setFilterSeller(e.target.value); }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${HC.border}`, background: HC.surface, fontSize: 12, outline: 'none' }}
            >
              {sellerList.map(seller => (
                <option key={seller} value={seller}>{seller === 'all' ? `Tất cả Seller (${sellerList.length - 1} seller)` : seller}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => { setFilterStatus('all'); setFilterSeller('all'); }}
              style={{ padding: '8px 20px', borderRadius: 10, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: HC.orangeDark }}
            >
              Xóa lọc
            </button>
          </div>
        </div>

        {/* Bảng danh sách */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {paginatedProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: HC.muted }}>
              <span style={{ fontSize: 48, opacity: 0.5 }}>📭</span>
              <div style={{ marginTop: 12, fontSize: 13 }}>Không có dữ liệu form request</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: HC.cream, borderBottom: `2px solid ${HC.border}` }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: HC.muted }}>STT</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: HC.muted }}>Seller Name</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: HC.muted }}>Project</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: HC.muted }}>Product Type</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: HC.muted }}>Ngày gửi</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: HC.muted }}>Deadline</th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: HC.muted }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product, idx) => (
                  <tr key={product.id} style={{ borderBottom: `1px solid ${HC.border}` }} onMouseEnter={e => e.currentTarget.style.background = HC.orangePale} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '12px', fontSize: 12 }}>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                    <td style={{ padding: '12px', fontSize: 12, fontWeight: 700, color: HC.orangeDark }}>{product.seller_name || product.sellerName || product.user_name || product.userName || '—'}</td>
                    <td style={{ padding: '12px', fontSize: 12 }}>{product.project || '—'}</td>
                    <td style={{ padding: '12px', fontSize: 12 }}>{product.product_type || '—'}</td>
                    <td style={{ padding: '12px', fontSize: 12 }}>{fmtDate(product.created_at)}</td>
                    <td style={{ padding: '12px', fontSize: 12 }}>{fmtDate(product.deadline_date)}</td>
                    <td style={{ padding: '12px', fontSize: 12 }}>{getStatusBadge(product.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Phân trang */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, background: HC.surface, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}>‹ Trước</button>
              <span style={{ padding: '6px 12px', fontSize: 12, color: HC.muted }}>Trang {currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} style={{ padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${HC.border}`, background: HC.surface, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}>Sau ›</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', background: HC.cream, borderTop: `1px solid ${HC.border}`, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: 10, background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
function RejectModal({ open, onConfirm, onCancel, reason, setReason }) {
  if (!open) return null;
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.55)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(2px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, background: HC.surface, borderRadius: 20, padding: 30, boxShadow: '0 32px 80px rgba(26,15,0,0.25)', border: `1.5px solid ${HC.border}` }}>
        <div style={{ fontWeight: 900, fontSize: 16, color: HC.danger, marginBottom: 6, fontFamily: "'Nunito',sans-serif" }}>🚫 Từ chối sản phẩm</div>
        <div style={{ fontSize: 12, color: HC.muted, marginBottom: 18, fontFamily: "'Nunito Sans',sans-serif" }}>Vui lòng nhập lý do để Seller biết cách chỉnh sửa.</div>
        <textarea autoFocus placeholder="Nhập lý do từ chối..." value={reason} onChange={e => setReason(e.target.value)} style={{ width: '100%', minHeight: 100, padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${HC.border}`, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: "'Nunito Sans',sans-serif", color: HC.ink2, background: HC.surface2 }} onFocus={e => e.target.style.borderColor = HC.orange} onBlur={e => e.target.style.borderColor = HC.border} />
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: HC.danger, color: '#fff', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>Xác nhận từ chối</button>
          <button onClick={onCancel} style={{ padding: '10px 18px', borderRadius: 10, background: HC.cream, color: HC.brown, border: `1.5px solid ${HC.border}`, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>Hủy</button>
        </div>
      </div>
    </div>
  );
}

// ─── OVERVIEW SECTION ─────────────────────────────────────
// ─── OVERVIEW SECTION (FIXED) ─────────────────────────────────────
function OverviewSection() {
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allSellers, setAllSellers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalFilterType, setModalFilterType] = useState('');
  const [modalFilterValue, setModalFilterValue] = useState('');
  const [formStats, setFormStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [projectStats, setProjectStats] = useState({
    'Creative Project': { approved: 0, rejected: 0, total: 0 },
    'Happy Project': { approved: 0, rejected: 0, total: 0 },
    'Global Project': { approved: 0, rejected: 0, total: 0 },
    'Pilot Project': { approved: 0, rejected: 0, total: 0 },
  });

  // ✅ Hàm tính toán stats từ dữ liệu
  const computeStats = useCallback((products) => {
    // Form stats
    const pending = products.filter(p => p.status === 'pending').length;
    const approved = products.filter(p => p.status === 'approved').length;
    const rejected = products.filter(p => p.status === 'rejected' || p.status === 'reject').length;

    setFormStats({
      pending,
      approved,
      rejected,
      total: products.length
    });

    // Project stats
    const projects = ['Creative Project', 'Happy Project', 'Global Project', 'Pilot Project'];
    const newProjectStats = {};

    projects.forEach(project => {
      const projectProducts = products.filter(p => p.project === project);
      newProjectStats[project] = {
        approved: projectProducts.filter(p => p.status === 'approved').length,
        rejected: projectProducts.filter(p => p.status === 'rejected' || p.status === 'reject').length,
        total: projectProducts.length
      };
    });

    setProjectStats(newProjectStats);
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      const allRes = await productApi.list();
      const all = normalizeList(allRes);
      setAllProducts(all);

      // ✅ Tính toán stats ngay sau khi có dữ liệu
      computeStats(all);

      // Load sellers (optional, không ảnh hưởng hiển thị chính)
      const token = localStorage.getItem('auth_token');
      try {
        const usersRes = await axios.get(`${API_BASE_URL}/api/users/sellers`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        let sellers = [];
        if (usersRes.data && usersRes.data.data) {
          sellers = usersRes.data.data;
        }
        setAllSellers(sellers);
      } catch (sellerErr) {
        console.warn('Không thể tải danh sách seller:', sellerErr);
        setAllSellers([]);
      }

    } catch (err) {
      console.error('❌ Lỗi tải dữ liệu:', err);
      setFormStats({ pending: 0, approved: 0, rejected: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [computeStats]);

  // ✅ Chỉ cần load pending count riêng nếu cần, nhưng có thể bỏ vì đã có trong allProducts
  // Hoặc giữ lại để có realtime pending count
  const loadPendingCount = useCallback(async () => {
    try {
      const pendingRes = await productApi.pendingApprovals();
      const pending = normalizeList(pendingRes);
      // Chỉ cập nhật pending, giữ nguyên approved/rejected/total
      setFormStats(prev => ({ ...prev, pending: pending.length }));
    } catch (err) {
      console.error('Lỗi tải pending:', err);
    }
  }, []);

  const handleCardClick = (type, value, label) => {
    setModalTitle(label);
    setModalFilterType(type);
    setModalFilterValue(value);
    setModalOpen(true);
  };

  useEffect(() => {
    Promise.all([loadAllData(), loadPendingCount()]);
    const interval = setInterval(() => {
      loadAllData();
      loadPendingCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadAllData, loadPendingCount]);

  if (loading) return <Spinner />;

  // Debug log để kiểm tra
  console.log('🔍 OverviewSection - formStats:', formStats);
  console.log('🔍 OverviewSection - projectStats:', projectStats);
  console.log('🔍 OverviewSection - allProducts count:', allProducts.length);

  const displayProjects = ['Creative Project', 'Happy Project', 'Global Project', 'Pilot Project'];
  const projectColors = {
    'Creative Project': { bg: '#FEF3DC', border: '#F59E0B', text: '#92400E', light: '#FFFBEB' },
    'Happy Project': { bg: '#ECFDF5', border: '#10B981', text: '#065F46', light: '#F0FDF4' },
    'Global Project': { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF', light: '#F8FAFC' },
    'Pilot Project': { bg: '#F3E8FF', border: '#A855F7', text: '#6B21A5', light: '#FAF5FF' },
  };

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: HC.ink,
          marginBottom: 12,
          fontFamily: "'Nunito',sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{ fontSize: 18 }}>📋</span>
          Thống Kê Form Từ Staff
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          <div onClick={() => handleCardClick('status', 'all', 'Tất cả Form Request')} style={{ cursor: 'pointer' }}>
            <Card label="Tổng Form Request" value={formStats.total.toLocaleString()} color={HC.orange} />
          </div>
          <div onClick={() => handleCardClick('status', 'pending', 'Form Chờ Duyệt')} style={{ cursor: 'pointer' }}>
            <Card label="Form Chờ Duyệt" value={formStats.pending.toLocaleString()} color={HC.warning} />
          </div>
          <div onClick={() => handleCardClick('status', 'approved', 'Form Đã Duyệt')} style={{ cursor: 'pointer' }}>
            <Card label="Form Đã Duyệt" value={formStats.approved.toLocaleString()} color={HC.success} />
          </div>
          <div onClick={() => handleCardClick('status', 'rejected', 'Form Từ Chối')} style={{ cursor: 'pointer' }}>
            <Card label="Form Từ Chối" value={formStats.rejected.toLocaleString()} color={HC.danger} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 14,
          fontWeight: 800,
          color: HC.ink,
          marginBottom: 12,
          fontFamily: "'Nunito',sans-serif",
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <span style={{ fontSize: 18 }}>🎯</span>
          Thống Kê Theo Project
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {displayProjects.map(project => {
            const stats = projectStats[project] || { approved: 0, rejected: 0, total: 0 };
            const colors = projectColors[project];
            const approvalRate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;

            return (
              <div
                key={project}
                onClick={() => handleCardClick('project', project, `Lịch sử Form - ${project}`)}
                style={{
                  background: HC.surface,
                  borderRadius: 16,
                  border: `1.5px solid ${colors.border}`,
                  overflow: 'hidden',
                  boxShadow: HC.shadow,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = HC.shadowStrong;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = HC.shadow;
                }}
              >
                <div style={{
                  padding: '14px 18px',
                  background: colors.bg,
                  borderBottom: `1.5px solid ${colors.border}`,
                }}>
                  <div style={{
                    fontWeight: 900,
                    fontSize: 16,
                    color: colors.text,
                    fontFamily: "'Nunito',sans-serif",
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    {project}
                    <span style={{
                      fontSize: 11,
                      background: colors.border + '20',
                      padding: '2px 10px',
                      borderRadius: 20,
                      color: colors.text,
                    }}>
                      {stats.total} form
                    </span>
                  </div>
                </div>

                <div style={{ padding: '16px 18px' }}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: HC.success }}>
                        <span>✅</span> Đã duyệt
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 18, color: HC.success, fontFamily: "'Nunito',monospace" }}>
                        {stats.approved}
                      </span>
                    </div>
                    <div style={{ height: 6, background: HC.border, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${stats.total > 0 ? (stats.approved / stats.total) * 100 : 0}%`,
                        height: '100%',
                        background: HC.success,
                        borderRadius: 3,
                      }} />
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: HC.danger }}>
                        <span>❌</span> Từ chối
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 18, color: HC.danger, fontFamily: "'Nunito',monospace" }}>
                        {stats.rejected}
                      </span>
                    </div>
                    <div style={{ height: 6, background: HC.border, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        width: `${stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0}%`,
                        height: '100%',
                        background: HC.danger,
                        borderRadius: 3,
                      }} />
                    </div>
                  </div>

                  <div style={{
                    marginTop: 12,
                    paddingTop: 10,
                    borderTop: `1px dashed ${HC.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 11, color: HC.muted, fontWeight: 600 }}>Tỷ lệ duyệt</span>
                    <span style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: approvalRate >= 70 ? HC.success : approvalRate >= 40 ? HC.warning : HC.danger,
                      fontFamily: "'Nunito',monospace",
                    }}>
                      {approvalRate}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <FormHistoryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTitle}
        filterType={modalFilterType}
        filterValue={modalFilterValue}
        allProducts={allProducts}
        allSellers={allSellers}
      />
    </div>
  );
}

// ─── PRODUCTS SECTION (ADMIN) ────────────────────────────
function ProductsSection({ externalViewProduct, setExternalViewProduct }) {
  const [allProducts, setAllProducts] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewProduct, setViewProduct] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, productId: null, reason: '' });
  const pendingCountRef = useRef(0);
  const [toast, setToast] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [sellerNamesMap, setSellerNamesMap] = useState({});
  const [loadingProductId, setLoadingProductId] = useState(null);
  const [pendingPage, setPendingPage] = useState(1);
  const [allProductsPage, setAllProductsPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const LS_REJECTED_CACHE = 'ADMIN_REJECTED_CACHE_V1';
  const notifiedProductIds = useRef(new Set());

  const normalizeProduct = (p) => {
    let links = [];
    if (p.product_type_links) {
      if (Array.isArray(p.product_type_links)) {
        links = p.product_type_links;
      } else if (typeof p.product_type_links === 'string') {
        try { links = JSON.parse(p.product_type_links); }
        catch { links = [p.product_type_links]; }
      }
    } else if (p.product_type_link) {
      links = [p.product_type_link];
    }
    let project = p.project;
    if (project === 'Global Deputy Project') {
      project = 'Pilot Project';
    }
    return {
      ...p,
      project: project,
      product_type_links: links,
      media_urls: p.media_urls || (p.media_url ? [p.media_url] : [])
    };
  };

  useEffect(() => {
    const loadSellerNames = () => {
      try {
        const saved = localStorage.getItem(LS_SELLER_PRODUCTS);
        if (saved) {
          setSellerNamesMap(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Lỗi load seller names:', e);
      }
    };
    loadSellerNames();
    window.addEventListener('storage', loadSellerNames);
    return () => window.removeEventListener('storage', loadSellerNames);
  }, []);

  const getSellerName = useCallback((product) => {
    if (product.seller_name) return product.seller_name;
    if (product.sellerName) return product.sellerName;
    if (product.user_name) return product.user_name;
    if (product.userName) return product.userName;
    const fromLocal = sellerNamesMap[product.id];
    if (fromLocal) {
      return fromLocal.seller_name || fromLocal.sellerName || '—';
    }
    return '—';
  }, [sellerNamesMap]);

  useEffect(() => {
    if (externalViewProduct) {
      setViewProduct(externalViewProduct);
      if (setExternalViewProduct) {
        setExternalViewProduct(null);
      }
    }
  }, [externalViewProduct, setExternalViewProduct]);

  const loadAllProducts = useCallback(async () => {
    try {
      const res = await productApi.list();
      const all = normalizeList(res).map(normalizeProduct);
      setAllProducts(all);
    } catch (err) {
      console.error('Lỗi tải danh sách:', err);
      setAllProducts([]);
    }
  }, []);

  const handleViewProduct = useCallback(async (product) => {
    if (loadingProductId === product.id) return;
    setLoadingProductId(product.id);
    try {
      const response = await productApi.getById(product.id);
      const fullProduct = response.data?.data || response.data;
      setViewProduct(normalizeProduct(fullProduct));
    } catch (err) {
      console.error('❌ Lỗi tải chi tiết sản phẩm:', err);
      setViewProduct(normalizeProduct(product));
    } finally {
      setLoadingProductId(null);
    }
  }, [loadingProductId]);

  // 🔔 CHỈ TẠO THÔNG BÁO CHO FORM MỚI (KHÔNG BAO GỒM DUYỆT/TỪ CHỐI)
  const createNewFormNotification = useCallback((product) => {
    const projectName = product.project || 'Không xác định';
    const sellerName = getSellerName(product);

    return {
      id: `form_${product.id}_${Date.now()}`,
      type: 'new_form',
      icon: '📋',
      title: `📋 Yêu cầu duyệt sản phẩm mới`,
      message: `Seller "${sellerName}" thuộc Project "${projectName}" vừa gửi form request mới.`,  // ✅ Đã sửa
      product_id: product.id,
      product_type: product.product_type,
      project: projectName,
      seller_name: sellerName,
      timestamp: product.created_at || new Date().toISOString(),
      read: false,
    };
  }, [getSellerName]);

  const loadPending = useCallback(() => {
    productApi.pendingApprovals()
      .then(r => {
        const newPending = normalizeList(r).map(normalizeProduct);
        const oldCount = pendingCountRef.current;

        setPendingProducts(newPending);

        // 🔔 CHỈ TẠO THÔNG BÁO CHO FORM MỚI (type: 'new_form')
        const existingNotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');

        // Lọc để chỉ giữ lại thông báo type 'new_form' (xóa các loại khác)
        const filteredNotifs = existingNotifs.filter(n => n.type === 'new_form');
        let hasNew = false;

        newPending.forEach(product => {
          const alreadyNotified = filteredNotifs.some(
            n => String(n.product_id) === String(product.id) && n.type === 'new_form'
          );
          if (!alreadyNotified && !notifiedProductIds.current.has(product.id)) {
            notifiedProductIds.current.add(product.id);
            const newNotification = createNewFormNotification(product);
            filteredNotifs.unshift(newNotification);
            hasNew = true;
          }
        });

        if (hasNew) {
          // Chỉ lưu các thông báo type 'new_form'
          localStorage.setItem('STAFF_A_NOTIFICATIONS', JSON.stringify(filteredNotifs.slice(0, 100)));
          window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_A_NOTIFICATIONS' }));
          window.dispatchEvent(new CustomEvent('pendingProductsUpdated', { detail: newPending }));

          // Phát âm thanh khi có form mới
          if (oldCount > 0 && newPending.length > oldCount) {
            playNotificationBeep();
          }

          // Hiển thị toast cho form mới
          if (newPending.length > oldCount) {
            const newCount = newPending.length - oldCount;
            const newestProducts = newPending.slice(0, newCount);
            const projectNames = [...new Set(newestProducts.map(p => p.project || 'Không xác định'))];
            setToast({
              type: 'new_form',
              title: '📋 Form mới từ Seller!',
              message: `${newCount} form mới từ Project: ${projectNames.join(', ')}`,
              duration: 5000
            });
          }
        }

        pendingCountRef.current = newPending.length;
      })
      .catch(err => {
        console.error('Lỗi load pending:', err);
        setPendingProducts([]);
      });
  }, [createNewFormNotification]);

  // 🗑️ XÓA HÀM sendNotificationToStaffB (Admin không cần gửi thông báo duyệt/từ chối nữa)
  // Chỉ giữ lại chức năng approve/reject API

  const handleApprove = async (product) => {
    if (processingId === product.id) return;
    setProcessingId(product.id);

    try {
      await productApi.approve(product.id, { approved: true });

      // Lưu vào localStorage approved products
      try {
        const approvedProducts = JSON.parse(localStorage.getItem('STAFF_A_APPROVED_PRODUCTS_V1') || '[]');
        const existingIndex = approvedProducts.findIndex(p => p.id === product.id);
        const updatedProduct = { ...product, status: 'approved', approved_at: new Date().toISOString() };
        if (existingIndex >= 0) {
          approvedProducts[existingIndex] = updatedProduct;
        } else {
          approvedProducts.unshift(updatedProduct);
        }
        localStorage.setItem('STAFF_A_APPROVED_PRODUCTS_V1', JSON.stringify(approvedProducts.slice(0, 100)));
      } catch (e) { }

      // Xóa khỏi cache rejected nếu có
      const cache = JSON.parse(localStorage.getItem(LS_REJECTED_CACHE) || '{}');
      if (cache[product.id]) {
        delete cache[product.id];
        localStorage.setItem(LS_REJECTED_CACHE, JSON.stringify(cache));
      }

      // 🆕 Gửi thông báo cho Staff B
      try {
        const staffBNotifications = JSON.parse(localStorage.getItem('STAFF_B_NOTIFICATIONS') || '[]');
        const newNotif = {
          id: Date.now(),
          type: 'product_approved',
          title: '✅ Sản phẩm đã được duyệt',
          message: `Sản phẩm "${product.product_type}" của Seller "${getSellerName(product)}" đã được Admin duyệt. Hãy vào "Products" để gán Vendor.`,
          productId: product.id,
          productType: product.product_type,
          sellerName: getSellerName(product),
          timestamp: new Date().toISOString(),
          read: false,
        };
        staffBNotifications.unshift(newNotif);
        localStorage.setItem('STAFF_B_NOTIFICATIONS', JSON.stringify(staffBNotifications.slice(0, 100)));
        window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS' }));
      } catch (e) {
        console.warn('Không thể gửi thông báo cho Staff B', e);
      }

      // Cập nhật UI
      setPendingProducts(prev => prev.filter(p => p.id !== product.id));
      setAllProducts(prev => {
        const exists = prev.find(p => p.id === product.id);
        if (exists) {
          return prev.map(p => p.id === product.id ? { ...p, status: 'approved' } : p);
        } else {
          return [...prev, { ...product, status: 'approved' }];
        }
      });

      setToast({
        type: 'success',
        title: '✅ Duyệt thành công!',
        message: `Sản phẩm "${product.product_type}" đã được duyệt`,
        duration: 3000
      });
    } catch (err) {
      console.error('Lỗi duyệt:', err);
      setToast({
        type: 'error',
        title: '❌ Lỗi duyệt!',
        message: err.response?.data?.message || 'Không thể duyệt sản phẩm',
        duration: 4000
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal.reason.trim()) {
      setToast({
        type: 'warning',
        title: '⚠️ Thiếu lý do!',
        message: 'Vui lòng nhập lý do từ chối',
        duration: 3000
      });
      return;
    }

    const product = pendingProducts.find(p => p.id === rejectModal.productId);
    if (!product) return;

    setProcessingId(rejectModal.productId);

    try {
      await productApi.approve(rejectModal.productId, {
        approved: false,
        reason: rejectModal.reason
      });

      try {
        const rejectedProducts = JSON.parse(localStorage.getItem('STAFF_A_REJECTED_PRODUCTS_V1') || '[]');
        rejectedProducts.unshift({ ...product, status: 'rejected', rejected_at: new Date().toISOString(), reason: rejectModal.reason });
        localStorage.setItem('STAFF_A_REJECTED_PRODUCTS_V1', JSON.stringify(rejectedProducts.slice(0, 100)));
      } catch (e) { }

      const cache = JSON.parse(localStorage.getItem(LS_REJECTED_CACHE) || '{}');
      cache[product.id] = { timestamp: Date.now() };
      localStorage.setItem(LS_REJECTED_CACHE, JSON.stringify(cache));

      setPendingProducts(prev => prev.filter(p => p.id !== product.id));
      setAllProducts(prev => {
        const exists = prev.find(p => p.id === product.id);
        if (exists) {
          return prev.map(p => p.id === product.id ? { ...p, status: 'rejected' } : p);
        } else {
          return [...prev, { ...product, status: 'rejected' }];
        }
      });

      setToast({
        type: 'warning',
        title: '⚠️ Đã từ chối!',
        message: `Sản phẩm "${product.product_type}" đã bị từ chối`,
        duration: 5000
      });

      setRejectModal({ open: false, productId: null, reason: '' });
    } catch (err) {
      console.error('Lỗi từ chối:', err);
      setToast({
        type: 'error',
        title: '❌ Lỗi từ chối!',
        message: err.response?.data?.message || 'Không thể từ chối sản phẩm',
        duration: 4000
      });
    } finally {
      setProcessingId(null);
    }
  };

  useEffect(() => {
    Promise.all([loadPending(), loadAllProducts()]).finally(() => setLoading(false));
  }, [loadPending, loadAllProducts]);

  useEffect(() => {
    const id = setInterval(() => {
      loadPending();
      loadAllProducts();
    }, 15000);
    return () => clearInterval(id);
  }, [loadPending, loadAllProducts]);

  const TABLE_COLS = ['STT', 'Project', 'Seller Name', 'Product Type', 'Hình ảnh', 'Date Request', 'Deadline', 'Trạng thái', 'Thao tác'];

  const viewBtn = (p) => (
    <button
      onClick={() => handleViewProduct(p)}
      disabled={loadingProductId === p.id}
      style={{
        padding: '5px 12px',
        borderRadius: 7,
        border: `1.5px solid ${HC.border}`,
        background: HC.cream,
        cursor: loadingProductId === p.id ? 'wait' : 'pointer',
        fontSize: 11,
        fontWeight: 800,
        color: HC.brown,
        fontFamily: "'Nunito',sans-serif",
        transition: 'all 0.15s',
        opacity: loadingProductId === p.id ? 0.6 : 1
      }}
    >
      {loadingProductId === p.id ? '⏳ Đang tải...' : '👁 Xem'}
    </button>
  );

  const sHdr = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' };
  const h3S = { fontSize: 15, fontWeight: 900, color: HC.ink, margin: 0, fontFamily: "'Nunito',sans-serif" };
  const refreshBtn = fn => (
    <button
      onClick={fn}
      style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 8, border: `1.5px solid ${HC.border}`, background: HC.cream, color: HC.brown, fontSize: 11, fontWeight: 800, cursor: 'pointer', fontFamily: "'Nunito',sans-serif", transition: 'all 0.15s' }}
    >
      ↻ Làm mới
    </button>
  );

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={sHdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>⏳</span>
            <h3 style={h3S}>Form Chờ Duyệt Từ Seller</h3>
          </div>
          {pendingProducts.length > 0 && (
            <span style={{
              padding: '4px 14px',
              borderRadius: 999,
              background: HC.orangeLight,
              border: `1.5px solid ${HC.orangeMid}`,
              color: HC.orangeDark,
              fontSize: 12,
              fontWeight: 800,
              fontFamily: "'Nunito',sans-serif"
            }}>
              {pendingProducts.length} form chờ xử lý
            </span>
          )}
          {refreshBtn(() => { loadPending(); loadAllProducts(); })}
        </div>

        {pendingProducts.length === 0 ? (
          <EmptyState msg="Không có form chờ duyệt nào từ Seller" />
        ) : (
          <>
            <Table
              cols={TABLE_COLS}
              rows={pendingProducts
                .slice((pendingPage - 1) * ITEMS_PER_PAGE, pendingPage * ITEMS_PER_PAGE)
                .map((p, i) => [
                  (pendingPage - 1) * ITEMS_PER_PAGE + i + 1,
                  p.project || '—',
                  getSellerName(p),
                  p.product_type || p.category || p.name || '—',
                  <MediaGallery mediaUrls={getMediaUrls(p)} />,
                  fmtDate(p.created_at),
                  fmtDate(p.deadline_date),
                  <Badge status="pending" />,
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {viewBtn(p)}
                    <button
                      onClick={() => handleApprove(p)}
                      disabled={processingId === p.id}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 7,
                        border: '1.5px solid #bbf7d0',
                        background: processingId === p.id ? '#d1fae5' : '#ecfdf5',
                        cursor: processingId === p.id ? 'wait' : 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#065f46',
                        fontFamily: "'Nunito',sans-serif",
                        opacity: processingId === p.id ? 0.7 : 1,
                      }}
                    >
                      {processingId === p.id ? '⟳ Đang xử lý...' : '✓ Duyệt'}
                    </button>
                    <button
                      onClick={() => setRejectModal({ open: true, productId: p.id, reason: '' })}
                      disabled={processingId === p.id}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 7,
                        border: '1.5px solid #fecaca',
                        background: processingId === p.id ? '#fee2e2' : '#fef2f2',
                        cursor: processingId === p.id ? 'wait' : 'pointer',
                        fontSize: 11,
                        fontWeight: 800,
                        color: '#991b1b',
                        fontFamily: "'Nunito',sans-serif",
                        opacity: processingId === p.id ? 0.7 : 1,
                      }}
                    >
                      ✕ Từ chối
                    </button>
                  </div>,
                ])}
            />
            <Pagination
              currentPage={pendingPage}
              totalPages={Math.ceil(pendingProducts.length / ITEMS_PER_PAGE)}
              totalItems={pendingProducts.length}
              onPageChange={setPendingPage}
            />
          </>
        )}
      </div>

      <div>
        <div style={sHdr}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <h3 style={h3S}>Danh Sách Sản Phẩm</h3>
            <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
              <span style={{ padding: '2px 10px', borderRadius: 999, background: '#ecfdf5', border: '1.5px solid #bbf7d0', color: '#065f46', fontSize: 11, fontWeight: 800 }}>
                ✅ Đã duyệt: {allProducts.filter(p => p.status === 'approved').length}
              </span>
              <span style={{ padding: '2px 10px', borderRadius: 999, background: '#fef2f2', border: '1.5px solid #fecaca', color: '#991b1b', fontSize: 11, fontWeight: 800 }}>
                ❌ Từ chối: {allProducts.filter(p => p.status === 'rejected' || p.status === 'reject').length}
              </span>
            </div>
          </div>
          {refreshBtn(() => loadAllProducts())}
        </div>

        {(() => {
          const filteredProducts = allProducts.filter(p => p.status !== 'pending');
          const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
          const pagedProducts = filteredProducts.slice(
            (allProductsPage - 1) * ITEMS_PER_PAGE,
            allProductsPage * ITEMS_PER_PAGE
          );

          return filteredProducts.length === 0 ? (
            <EmptyState msg="Chưa có sản phẩm nào được xử lý" />
          ) : (
            <>
              <Table
                cols={TABLE_COLS}
                rows={pagedProducts.map((p, i) => {
                  const normalizedStatus = p.status === 'reject' ? 'rejected' : p.status;
                  return [
                    (allProductsPage - 1) * ITEMS_PER_PAGE + i + 1,
                    p.project || '—',
                    getSellerName(p),
                    p.product_type || p.category || p.name || '—',
                    <MediaGallery mediaUrls={getMediaUrls(p)} />,
                    fmtDate(p.created_at),
                    fmtDate(p.deadline_date),
                    <Badge status={normalizedStatus} />,
                    viewBtn(p),
                  ];
                })}
              />
              <Pagination
                currentPage={allProductsPage}
                totalPages={totalPages}
                totalItems={filteredProducts.length}
                onPageChange={setAllProductsPage}
              />
            </>
          );
        })()}
      </div>

      <ProductViewerModal product={viewProduct} onClose={() => setViewProduct(null)} />

      <RejectModal
        open={rejectModal.open}
        reason={rejectModal.reason}
        setReason={r => setRejectModal(prev => ({ ...prev, reason: r }))}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectModal({ open: false, productId: null, reason: '' })}
      />

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 2000,
          animation: 'slideIn 0.3s ease-out, fadeOut 0.3s ease-out 4.7s forwards',
          maxWidth: 380,
        }}>
          <div style={{
            background: toast.type === 'success'
              ? `linear-gradient(135deg, ${HC.success}, #15803d)`
              : toast.type === 'error'
                ? `linear-gradient(135deg, ${HC.danger}, #b91c1c)`
                : toast.type === 'warning'
                  ? `linear-gradient(135deg, ${HC.warning}, #d97706)`
                  : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
            color: '#fff',
            borderRadius: 12,
            boxShadow: HC.shadowStrong,
            overflow: 'hidden',
          }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>
                {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : toast.type === 'warning' ? '⚠️' : '📋'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, fontSize: 13, fontFamily: "'Nunito',sans-serif", marginBottom: 2 }}>
                  {toast.title}
                </div>
                <div style={{ fontSize: 11, opacity: 0.9, fontFamily: "'Nunito Sans',sans-serif", lineHeight: 1.4 }}>
                  {toast.message}
                </div>
              </div>
              <button
                onClick={() => setToast(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: 16,
                  padding: 4,
                  opacity: 0.7,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{
              height: 3,
              background: 'rgba(255,255,255,0.5)',
              animation: `progressBar ${(toast.duration || 5000) / 1000}s linear forwards`,
              transformOrigin: 'left'
            }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          to { opacity: 0; transform: translateX(100%); }
        }
        @keyframes progressBar {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// ─── VENDORS SECTION ─────────────────────────────────────
// ─── VENDORS SECTION (ADMIN - READ ONLY, GỌI API) ─────────────────────────────────────
function VendorsSection() {
  const [vendorList, setVendorList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [filters, setFilters] = useState({
    product_type: '',
    vendor_type: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const uniqueProductTypes = useRef([]);
  const uniqueVendorTypes = useRef([]);

  // Load vendors từ API (giống Staff B)
  const loadVendors = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const res = await vendorApi.list({ per_page: 10000 });

      let list = [];
      if (res.data?.data?.data && Array.isArray(res.data.data.data)) {
        list = res.data.data.data;
      } else if (res.data?.data && Array.isArray(res.data.data)) {
        list = res.data.data;
      } else if (Array.isArray(res.data)) {
        list = res.data;
      }

      console.log('📦 Admin - Vendor list loaded:', list.length);
      setVendorList(list);

      // Cập nhật unique values cho filter
      uniqueProductTypes.current = [...new Set(list.map(v => v.product_type).filter(Boolean))];
      uniqueVendorTypes.current = [...new Set(list.map(v => v.vendor_type).filter(Boolean))];
    } catch (err) {
      console.error('Lỗi tải vendor:', err);
      setApiError(err.response?.data?.message || err.message || 'Lỗi tải dữ liệu');
      setVendorList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh mỗi 30 giây
  useEffect(() => {
    loadVendors();
    const interval = setInterval(loadVendors, 30000);
    return () => clearInterval(interval);
  }, [loadVendors]);

  const applyFilters = useCallback(() => {
    let result = [...vendorList];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(v =>
        (v.name && v.name.toLowerCase().includes(term)) ||
        (v.product_type && v.product_type.toLowerCase().includes(term)) ||
        (v.vendor_type && v.vendor_type.toLowerCase().includes(term))
      );
    }
    if (filters.product_type) {
      result = result.filter(v => v.product_type === filters.product_type);
    }
    if (filters.vendor_type) {
      result = result.filter(v => v.vendor_type === filters.vendor_type);
    }
    setFilteredList(result);
  }, [vendorList, searchTerm, filters]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const resetFilters = () => {
    setSearchTerm('');
    setFilters({ product_type: '', vendor_type: '' });
    setShowFilters(false);
  };

  const TH = (extra = {}) => ({
    padding: '8px 10px',
    fontWeight: 900,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    textAlign: 'center',
    color: '#fff',
    background: HC.orangeDark,
    border: `1px solid ${HC.orange}`,
    fontFamily: "'Nunito',sans-serif",
    ...extra
  });
  const TD = (extra = {}) => ({
    padding: '9px 10px',
    fontSize: 12,
    color: HC.ink2,
    border: `1px solid ${HC.border}`,
    textAlign: 'center',
    verticalAlign: 'middle',
    background: HC.surface2,
    fontFamily: "'Nunito Sans',sans-serif",
    ...extra
  });
  const TDalt = (extra = {}) => ({ ...TD(extra), background: HC.orangePale });

  if (loading) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>
            Danh sách Vendor
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, fontSize: 11, fontWeight: 700, color: HC.brown, fontFamily: "'Nunito',sans-serif" }}>
            👁 Chế độ chỉ xem
          </div>
        </div>
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink, fontFamily: "'Nunito',sans-serif" }}>
          Danh sách Vendor
          <span style={{ marginLeft: 10, padding: '2px 10px', borderRadius: 999, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, color: HC.orangeDark, fontSize: 11, fontWeight: 800 }}>
            {filteredList.length} / {vendorList.length} vendor
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <SearchOutlined style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: HC.muted, fontSize: 14 }} />
            <input
              type="text"
              placeholder="Tìm theo Vendor Name, Product Type hoặc Vendor Type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '8px 12px 8px 36px',
                borderRadius: 10,
                border: `1.5px solid ${HC.border}`,
                background: HC.surface,
                fontSize: 12,
                width: 320,
                outline: 'none',
                fontFamily: "'Nunito Sans',sans-serif",
                transition: 'all 0.2s'
              }}
              onFocus={e => e.target.style.borderColor = HC.orange}
              onBlur={e => e.target.style.borderColor = HC.border}
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              background: showFilters ? HC.orangeLight : HC.surface,
              border: `1.5px solid ${showFilters ? HC.orange : HC.border}`,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: showFilters ? HC.orangeDark : HC.brown,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: "'Nunito',sans-serif",
            }}
          >
            <FilterOutlined /> Lọc
          </button>

          <button
            onClick={loadVendors}
            style={{
              padding: '8px 14px',
              borderRadius: 10,
              background: HC.cream,
              border: `1.5px solid ${HC.border}`,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              color: HC.brown,
              fontFamily: "'Nunito',sans-serif",
            }}
          >
            ↻ Làm mới
          </button>

          {(searchTerm || filters.product_type || filters.vendor_type) && (
            <button
              onClick={resetFilters}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                background: HC.cream,
                border: `1.5px solid ${HC.border}`,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                color: HC.muted,
                fontFamily: "'Nunito',sans-serif",
              }}
            >
              Xóa lọc
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, fontSize: 11, fontWeight: 700, color: HC.brown, fontFamily: "'Nunito',sans-serif" }}>
            👁 Chế độ chỉ xem
          </div>
        </div>
      </div>

      {apiError && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 11, background: '#fef2f2', border: '1.5px solid #fecaca', color: HC.danger, fontSize: 12, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {apiError}</span>
          <button onClick={loadVendors} style={{ padding: '4px 12px', borderRadius: 7, border: '1.5px solid #fecaca', background: '#fff', color: HC.danger, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Thử lại</button>
        </div>
      )}

      {showFilters && (
        <div style={{
          marginBottom: 20,
          padding: '16px 20px',
          borderRadius: 14,
          background: HC.surface,
          border: `1.5px solid ${HC.border}`,
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-end'
        }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: HC.muted, marginBottom: 5, display: 'block', fontFamily: "'Nunito',sans-serif" }}>Product Type</label>
            <select
              value={filters.product_type}
              onChange={(e) => setFilters(prev => ({ ...prev, product_type: e.target.value }))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                border: `1.5px solid ${HC.border}`,
                background: HC.surface2,
                fontSize: 12,
                outline: 'none',
                fontFamily: "'Nunito Sans',sans-serif"
              }}
            >
              <option value="">Tất cả</option>
              {uniqueProductTypes.current.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 180 }}>
            <label style={{ fontSize: 11, fontWeight: 800, color: HC.muted, marginBottom: 5, display: 'block', fontFamily: "'Nunito',sans-serif" }}>Vendor Type</label>
            <select
              value={filters.vendor_type}
              onChange={(e) => setFilters(prev => ({ ...prev, vendor_type: e.target.value }))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                border: `1.5px solid ${HC.border}`,
                background: HC.surface2,
                fontSize: 12,
                outline: 'none',
                fontFamily: "'Nunito Sans',sans-serif"
              }}
            >
              <option value="">Tất cả</option>
              {uniqueVendorTypes.current.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <button
              onClick={() => setShowFilters(false)}
              style={{
                padding: '9px 20px',
                borderRadius: 10,
                background: HC.orange,
                border: 'none',
                color: '#fff',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: "'Nunito',sans-serif"
              }}
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 12, background: HC.orangeLight, border: `1.5px solid ${HC.orangeMid}`, fontSize: 11, color: HC.brown, fontFamily: "'Nunito Sans',sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span>Danh sách vendor được quản lý bởi <b>Staff Dashboard B</b>. Trang này chỉ hiển thị để tham khảo.</span>
      </div>

      {filteredList.length === 0 ? (
        <EmptyState msg={vendorList.length === 0 ? "Chưa có vendor nào được thêm vào hệ thống" : "Không tìm thấy vendor phù hợp với điều kiện lọc"} />
      ) : (
        <div style={{ overflowX: 'auto', boxShadow: HC.shadow, borderRadius: 14, border: `1.5px solid ${HC.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...TH(), borderRadius: '14px 0 0 0', minWidth: 160 }}>Vendor Name</th>
                <th rowSpan={2} style={{ ...TH(), minWidth: 130 }}>Product Type</th>
                <th rowSpan={2} style={TH({ minWidth: 120 })}>Vendor Type</th>
                {/* 🆕 Cột Pricing gộp - đặt trước Detail */}
                <th rowSpan={2} style={{ ...TH({ minWidth: 100, background: HC.orange }), color: '#fff' }}>💰 Pricing</th>
                <th colSpan={2} style={TH()}>Detail</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orange, borderLeft: `2px solid ${HC.orangeDark}` }}>Economy</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orangeDark }}>Fast</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orange }}>Express</th>
                <th colSpan={2} style={{ ...TH(), background: HC.orangeDark, borderRadius: '0 14px 0 0' }}>Overnight</th>
              </tr>
              <tr>
                <th style={TH({ minWidth: 80 })}>Size</th>
                <th style={TH({ minWidth: 90 })}>Optional</th>
                {['Economy', 'Fast', 'Express', 'Overnight'].map(s => [
                  <th key={`${s}-p`} style={{ ...TH({ minWidth: 80, background: s === 'Fast' || s === 'Overnight' ? HC.orangeDark : HC.orange }), borderLeft: s === 'Economy' ? `2px solid ${HC.orangeDark}` : undefined }}>Ship</th>,
                  <th key={`${s}-t`} style={TH({ minWidth: 100, background: s === 'Fast' || s === 'Overnight' ? HC.orangeDark : HC.orange })}>Total</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {filteredList.map((v, i) => {
                const C = i % 2 === 0 ? TD : TDalt;
                const fmt2 = n => n ? Number(n).toFixed(2) : '—';
                const totalPricing = (v.pricing1 || 0) + (v.pricing2 || 0);

                return (
                  <tr key={v.id || i}>
                    <td style={{ ...C(), fontWeight: 800, color: HC.ink2 }}>{v.name || v.vendor_type || '—'}</td>
                    <td style={{ ...C(), fontWeight: 800, color: HC.orange }}>{v.product_type || '—'}</td>
                    <td style={{ ...C(), fontWeight: 800 }}>
                      {v.vendor_type === 'Best Seller' ? (
                        <BestSellerBadge />
                      ) : (
                        v.vendor_type || '—'
                      )}
                    </td>                    {/* 🆕 Cột Pricing gộp */}
                    <td style={{ ...C(), fontWeight: 800, color: HC.success, fontSize: 13, background: i % 2 === 0 ? '#ecfdf5' : '#d1fae5' }}>
                      ${totalPricing.toFixed(2)}
                    </td>
                    <td style={C()}>{v.size || '—'}</td>
                    <td style={C()}>{v.optional || '—'}</td>
                    <td style={{ ...C(), borderLeft: `2px solid ${HC.border}`, color: HC.ink2 }}>{fmt2(v.eco_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt2(v.eco_total)}</td>
                    <td style={C()}>{fmt2(v.fast_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt2(v.fast_total)}</td>
                    <td style={C()}>{fmt2(v.express_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt2(v.express_total)}</td>
                    <td style={C()}>{fmt2(v.overnight_price)}</td>
                    <td style={{ ...C(), color: HC.success, fontWeight: 700 }}>{fmt2(v.overnight_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── SIDEBAR COMPONENT ────────────────────────────────────
function Sidebar({ active, setActive, sidebarOpen, setSidebarOpen, user, logout }) {
  const [hoveredItem, setHoveredItem] = useState(null);

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
              Happy Creative
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
            color: HC.muted,
            paddingTop: 8,
            borderTop: `1px solid ${HC.orangeMid}`,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <CalendarOutlined style={{ fontSize: 10 }} />
            <span>Last login: {new Date().toLocaleDateString('vi-VN')}</span>
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
    // Giữ tối đa 200 thông báo
    const trimmedNews = existingNews.slice(0, 200);
    localStorage.setItem('STAFF_B_NOTIFICATIONS_TO_ADMIN', JSON.stringify(trimmedNews));

    // Trigger storage event để Admin nhận ngay lập tức
    window.dispatchEvent(new StorageEvent('storage', { key: 'STAFF_B_NOTIFICATIONS_TO_ADMIN' }));
    window.dispatchEvent(new CustomEvent('newStaffNews', { detail: newNotification }));

    console.log('✅ Đã gửi thông báo đến Admin:', newNotification);
    return true;
  } catch (err) {
    console.error('❌ Lỗi gửi thông báo:', err);
    return false;
  }
};
// ─── MAIN ADMIN DASHBOARD ─────────────────────────────────
// ─── MAIN ADMIN DASHBOARD (VỚI 2 LOẠI THÔNG BÁO) ─────────────────────────────────
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [active, setActive] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [requestNotifications, setRequestNotifications] = useState([]); // Yêu cầu từ Seller
  const [newsNotifications, setNewsNotifications] = useState([]); // Tin tức từ Staff B
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

  // Load yêu cầu (form mới từ Seller) - type 'new_form'
  const loadRequestNotifications = useCallback(() => {
    try {
      const staffANotifs = JSON.parse(localStorage.getItem('STAFF_A_NOTIFICATIONS') || '[]');
      const requests = staffANotifs
        .filter(n => n.type === 'new_form')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setRequestNotifications(requests.slice(0, 50));
    } catch (err) {
      console.error('Error loading request notifications:', err);
    }
  }, []);

  // Load tin tức (thông báo từ Staff B) - các type khác
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
        read: notif.read || false,  // giữ nguyên read từ localStorage
      }));
      formattedNews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setNewsNotifications(formattedNews.slice(0, 50));
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
      // Tin tức từ Staff B nằm trong STAFF_B_NOTIFICATIONS_TO_ADMIN
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

    setActive('products');

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
    // Xử lý khi click vào tin tức (có thể mở chi tiết hoặc chuyển hướng)
    console.log('Click vào tin tức:', notification);
    // Có thể mở modal hiển thị chi tiết tin tức
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

    // ✅ THÊM CUSTOM EVENT LISTENER
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
        return <OverviewSection />;
      case 'products':
        return <ProductsSection
          externalViewProduct={viewProduct}
          setExternalViewProduct={setViewProduct}
        />;
      case 'vendors':
        return <VendorsSection />;
      default:
        return <OverviewSection />;
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