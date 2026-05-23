import React, { useState, useEffect } from 'react';
import { BellOutlined } from '@ant-design/icons';
import { HC } from '../constants';

export default function NotificationCenter({ onClose, notifications, newsNotifications, markAsRead, markNewsAsRead, onNotificationClick, onNewsClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('requests');
  const [localRequests, setLocalRequests] = useState(notifications || []);
  const [localNews, setLocalNews] = useState(newsNotifications || []);
  const [selectedNotif, setSelectedNotif] = useState(null); // Chi tiết thông báo đang xem
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
  // Sync từ props nhưng GIỮ NGUYÊN read=true đã đánh dấu trong local state
  useEffect(() => {
    setLocalRequests(prev => {
      const readIds = new Set(prev.filter(n => n.read).map(n => n.id));
      return (notifications || []).map(n => ({
        ...n,
        read: readIds.has(n.id) ? true : n.read,
      }));
    });
  }, [notifications]);

  useEffect(() => {
    setLocalNews(prev => {
      const readIds = new Set(prev.filter(n => n.read).map(n => n.id));
      return (newsNotifications || []).map(n => ({
        ...n,
        read: readIds.has(n.id) ? true : n.read,
      }));
    });
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
    // Cập nhật local state trước
    setLocalRequests(prev => prev.map(n => ({ ...n, read: true })));
    // Rồi mới gọi parent (không để parent re-render gây race condition)
    setTimeout(() => {
      localRequests.forEach(n => {
        if (!n.read) markAsRead(n.id);
      });
    }, 0);
  };

  const handleMarkAllNewsAsRead = () => {
    setLocalNews(prev => prev.map(n => ({ ...n, read: true })));
    setTimeout(() => {
      localNews.forEach(n => {
        if (!n.read && markNewsAsRead) markNewsAsRead(n.id);
      });
    }, 0);
  };

  const handleRequestClick = (notif) => {
    // Đánh dấu đã đọc local trước
    setLocalRequests(prev =>
      prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
    );
    setTimeout(() => {
      if (!notif.read) markAsRead(notif.id);
    }, 0);
    // Hiển thị chi tiết trong panel thay vì đóng
    setSelectedNotif({ ...notif, read: true, _type: 'request' });
  };

  const handleNewsClick = (notif) => {
    setLocalNews(prev =>
      prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
    );
    setTimeout(() => {
      if (!notif.read && markNewsAsRead) markNewsAsRead(notif.id);
    }, 0);
    setSelectedNotif({ ...notif, read: true, _type: 'news' });
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
            width: 520,
            maxHeight: 680,
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

            {/* Chi tiết thông báo (khi đã chọn) */}
            {selectedNotif ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', maxHeight: 530 }}>
                {/* Thanh back */}
                <div style={{
                  padding: '10px 16px',
                  background: HC.cream,
                  borderBottom: `1px solid ${HC.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                }}>
                  <button
                    onClick={() => setSelectedNotif(null)}
                    style={{
                      background: HC.orangeLight,
                      border: `1px solid ${HC.orangeMid}`,
                      borderRadius: 8,
                      padding: '4px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      color: HC.orangeDark,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    ← Quay lại
                  </button>
                  <span style={{ fontSize: 11, color: HC.muted, fontWeight: 600 }}>Chi tiết thông báo</span>
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 9, fontWeight: 700, color: HC.success,
                    background: '#ecfdf5', border: '1px solid #bbf7d0',
                    borderRadius: 99, padding: '2px 8px',
                  }}>✓ Đã đọc</span>
                </div>

                {/* Nội dung chi tiết */}
                <div style={{ padding: '20px 20px', flex: 1 }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{
                      fontWeight: 900, fontSize: 14,
                      color: HC.ink, fontFamily: "'Nunito',sans-serif",
                      lineHeight: 1.4,
                    }}>
                      {selectedNotif.title}
                    </div>
                  </div>

                  <div style={{
                    background: HC.orangePale,
                    border: `1px solid ${HC.border}`,
                    borderRadius: 12,
                    padding: '14px 16px',
                    fontSize: 13,
                    color: HC.ink2,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    marginBottom: 16,
                  }}>
                    {selectedNotif.message || '(Không có nội dung)'}
                  </div>

                  {/* Meta info */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(selectedNotif.product_type || selectedNotif.productType) && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: HC.muted, width: 90 }}>🏷️ Loại SP</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: HC.brown }}>
                          {selectedNotif.product_type || selectedNotif.productType}
                        </span>
                      </div>
                    )}
                    {selectedNotif.sender && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: HC.muted, width: 90 }}>👤 Người gửi</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: HC.brown }}>{selectedNotif.sender}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: HC.muted, width: 90 }}>🕒 Thời gian</span>
                      <span style={{ fontSize: 12, color: HC.brown }}>
                        {selectedNotif.time || (selectedNotif.timestamp ? new Date(selectedNotif.timestamp).toLocaleString('vi-VN') : '')}
                      </span>
                    </div>
                    {selectedNotif.reason && (
                      <div style={{
                        marginTop: 8,
                        padding: '10px 14px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 10,
                        fontSize: 12,
                        color: HC.danger,
                        lineHeight: 1.5,
                      }}>
                        <b>Lý do từ chối:</b> {selectedNotif.reason}
                      </div>
                    )}
                  </div>

                  {/* Nút điều hướng nếu có productId */}
                  {(selectedNotif.productId || selectedNotif.product_id) && onNotificationClick && (
                    <button
                      onClick={() => {
                        onNotificationClick(selectedNotif);
                        setSelectedNotif(null);
                        setIsOpen(false);
                      }}
                      style={{
                        marginTop: 20,
                        width: '100%',
                        padding: '10px',
                        background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
                        border: 'none',
                        borderRadius: 10,
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontFamily: "'Nunito',sans-serif",
                      }}
                    >
                      🔍 Xem sản phẩm liên quan
                    </button>
                  )}
                </div>
              </div>
            ) : (

            /* Danh sách theo tab */
            <div style={{ overflowY: 'auto', maxHeight: 530, scrollbarWidth: 'thin', scrollbarColor: `${HC.orangeMid} transparent` }}>
              {activeTab === 'requests' && (
                <>
                  <div style={{
                    padding: '10px 16px',
                    background: HC.cream,
                    borderBottom: `1px solid ${HC.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>
                      📋 Form request từ Seller
                      {localRequests.length > 0 && (
                        <span style={{ marginLeft: 6, color: HC.muted2 }}>
                          ({localRequests.filter(n => n.read).length}/{localRequests.length} đã đọc)
                        </span>
                      )}
                    </span>
                    <button
                      onClick={handleMarkAllRequestsAsRead}
                      style={{
                        background: unreadRequests > 0 ? HC.orangeLight : 'transparent',
                        border: unreadRequests > 0 ? `1px solid ${HC.orangeMid}` : 'none',
                        color: unreadRequests > 0 ? HC.orangeDark : HC.muted2,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: unreadRequests > 0 ? 'pointer' : 'default',
                        borderRadius: 6,
                        padding: '3px 8px',
                      }}
                    >
                      {unreadRequests > 0 ? `Đánh dấu tất cả đã đọc (${unreadRequests})` : '✓ Tất cả đã đọc'}
                    </button>
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
                          opacity: notif.read ? 0.75 : 1,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = HC.orangePale}
                        onMouseLeave={e => e.currentTarget.style.background = notif.read ? HC.surface : HC.orangeLight}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ fontSize: 24 }}>{notif.icon || '📋'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                fontWeight: notif.read ? 600 : 800,
                                fontSize: 13,
                                color: notif.read ? HC.muted : HC.ink,
                                fontFamily: "'Nunito',sans-serif",
                                flex: 1,
                              }}>
                                {notif.title}
                              </div>
                              {notif.read && (
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: HC.success,
                                  background: '#ecfdf5',
                                  border: '1px solid #bbf7d0',
                                  borderRadius: 99,
                                  padding: '2px 7px',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}>✓ Đã đọc</span>
                              )}
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
                              {notif.sender && <span>👤 {notif.sender}</span>}
                            </div>
                          </div>
                          {!notif.read ? (
                            <div style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: HC.orange,
                              flexShrink: 0,
                              marginTop: 8,
                            }} />
                          ) : null}
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
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>
                      📰 Tin tức & Cập nhật từ Staff B
                      {localNews.length > 0 && (
                        <span style={{ marginLeft: 6, color: HC.muted2 }}>
                          ({localNews.filter(n => n.read).length}/{localNews.length} đã đọc)
                        </span>
                      )}
                    </span>
                    <button
                      onClick={handleMarkAllNewsAsRead}
                      style={{
                        background: unreadNews > 0 ? HC.orangeLight : 'transparent',
                        border: unreadNews > 0 ? `1px solid ${HC.orangeMid}` : 'none',
                        color: unreadNews > 0 ? HC.orangeDark : HC.muted2,
                        fontSize: 10,
                        fontWeight: 700,
                        cursor: unreadNews > 0 ? 'pointer' : 'default',
                        borderRadius: 6,
                        padding: '3px 8px',
                      }}
                    >
                      {unreadNews > 0 ? `Đánh dấu tất cả đã đọc (${unreadNews})` : '✓ Tất cả đã đọc'}
                    </button>
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
                          opacity: notif.read ? 0.75 : 1,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = HC.orangePale}
                        onMouseLeave={e => e.currentTarget.style.background = notif.read ? HC.surface : HC.orangeLight}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ fontSize: 24 }}>{notif.icon || '📰'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                fontWeight: notif.read ? 600 : 800,
                                fontSize: 13,
                                color: notif.read ? HC.muted : HC.ink,
                                fontFamily: "'Nunito',sans-serif",
                                flex: 1,
                              }}>
                                {notif.title}
                              </div>
                              {notif.read && (
                                <span style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: HC.success,
                                  background: '#ecfdf5',
                                  border: '1px solid #bbf7d0',
                                  borderRadius: 99,
                                  padding: '2px 7px',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}>✓ Đã đọc</span>
                              )}
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
                              flexWrap: 'wrap',
                            }}>
                              <span>🕒 {notif.time || new Date(notif.timestamp || Date.now()).toLocaleString('vi-VN')}</span>
                              {notif.sender && <span>👤 {notif.sender}</span>}
                              {notif.product_type && <span>📦 {notif.product_type}</span>}
                            </div>
                          </div>
                          {!notif.read ? (
                            <div style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: HC.orange,
                              flexShrink: 0,
                              marginTop: 8,
                            }} />
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </div>
            )} {/* end selectedNotif ternary */}

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
