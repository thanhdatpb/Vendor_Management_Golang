import React, { useState, useEffect } from 'react';
import { BellOutlined } from '@ant-design/icons';
import { HC } from '../utils/constants';

export default function StaffBNotificationCenter({
  requestNotifications,
  newsNotifications,
  markRequestAsRead,
  markNewsAsRead,
  onRequestClick,
  onNewsClick
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('requests');
  const [localRequests, setLocalRequests] = useState(requestNotifications || []);
  const [localNews, setLocalNews] = useState(newsNotifications || []);

  useEffect(() => {
    setLocalRequests(requestNotifications || []);
  }, [requestNotifications]);

  useEffect(() => {
    setLocalNews(newsNotifications || []);
  }, [newsNotifications]);

  const unreadRequests = localRequests.filter(n => !n.read).length;
  const unreadNews = localNews.filter(n => !n.read).length;
  const totalUnread = unreadRequests + unreadNews;

  const handleRequestClick = (notif) => {
    if (!notif.read && markRequestAsRead) {
      markRequestAsRead(notif.id);
      setLocalRequests(prev =>
        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
      );
    }
    if (onRequestClick) {
      onRequestClick(notif);
    }
    setIsOpen(false);
  };

  const handleNewsClick = (notif) => {
    if (!notif.read && markNewsAsRead) {
      markNewsAsRead(notif.id);
      setLocalNews(prev =>
        prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
      );
    }
    if (onNewsClick) {
      onNewsClick(notif);
    }
    setIsOpen(false);
  };

  const markAllRequestsAsRead = () => {
    localRequests.forEach(n => {
      if (!n.read && markRequestAsRead) markRequestAsRead(n.id);
    });
    setLocalRequests(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
  };

  const markAllNewsAsRead = () => {
    localNews.forEach(n => {
      if (!n.read && markNewsAsRead) markNewsAsRead(n.id);
    });
    setLocalNews(prev =>
      prev.map(n => ({ ...n, read: true }))
    );
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
            position: 'absolute', top: -5, right: -5,
            background: HC.danger, color: '#fff', fontSize: 10, fontWeight: 900,
            width: 20, height: 20, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${HC.surface}`,
          }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
          <div style={{
            position: 'absolute', top: 50, right: 0, width: 420, maxHeight: 550,
            background: HC.surface, borderRadius: 16, boxShadow: HC.shadowStrong,
            border: `1.5px solid ${HC.border}`, zIndex: 999, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ padding: '14px 18px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, color: '#fff' }}>
              <div style={{ fontWeight: 900, fontSize: 14, fontFamily: "'Nunito',sans-serif", marginBottom: 12 }}>
                🔔 Trung tâm thông báo
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setActiveTab('requests')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 10,
                    background: activeTab === 'requests' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: "'Nunito',sans-serif", transition: 'all 0.2s',
                  }}
                >
                  📋 Yêu cầu
                  {unreadRequests > 0 && (
                    <span style={{ background: '#fff', color: HC.orangeDark, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 900 }}>
                      {unreadRequests}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('news')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 10,
                    background: activeTab === 'news' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                    border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: "'Nunito',sans-serif", transition: 'all 0.2s',
                  }}
                >
                  📰 Tin tức
                  {unreadNews > 0 && (
                    <span style={{ background: '#fff', color: HC.orangeDark, borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 900 }}>
                      {unreadNews}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {activeTab === 'requests' && (
              <div style={{ overflowY: 'auto', maxHeight: 420 }}>
                <div style={{ padding: '10px 16px', background: HC.cream, borderBottom: `1px solid ${HC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>📋 Yêu cầu từ Admin & Staff A</span>
                  {unreadRequests > 0 && (
                    <button onClick={markAllRequestsAsRead} style={{ background: 'transparent', border: 'none', color: HC.orange, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
                {localRequests.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: HC.muted }}>
                    <span style={{ fontSize: 48, opacity: 0.5 }}>📭</span>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Không có yêu cầu mới</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Thông báo từ Admin và Staff A sẽ hiển thị tại đây</div>
                  </div>
                ) : (
                  localRequests.map((notif, idx) => {
                    let icon = '📋';
                    let bgColor = notif.read ? HC.surface : HC.orangeLight;
                    if (notif.type === 'approved' || notif.type === 'product_approved') { icon = ''; bgColor = notif.read ? HC.surface : '#ecfdf5'; }
                    else if (notif.type === 'sample_approved') { icon = ''; bgColor = notif.read ? HC.surface : '#ecfdf5'; }
                    else if (notif.type === 'sample_rejected') { icon = ''; bgColor = notif.read ? HC.surface : '#fef2f2'; }
                    else if (notif.type === 'seller_feedback') { icon = '💬'; bgColor = notif.read ? HC.surface : HC.orangeLight; }
                    else if (notif.type === 'staff_a_approved_vendor') { icon = ''; bgColor = notif.read ? HC.surface : '#ecfdf5'; }
                    return (
                      <div key={notif.id || idx} onClick={() => handleRequestClick(notif)} style={{ padding: '14px 16px', borderBottom: `1px solid ${HC.border}`, background: bgColor, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = HC.orangePale} onMouseLeave={e => e.currentTarget.style.background = bgColor}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ fontSize: 24 }}>{icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: 13, color: notif.read ? HC.muted : HC.ink, fontFamily: "'Nunito',sans-serif" }}>{notif.title}</div>
                            <div style={{ fontSize: 12, color: HC.brown, marginTop: 6, lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{notif.message}</div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: HC.muted2 }}>
                              <span>🕒 {notif.time || new Date(notif.timestamp || Date.now()).toLocaleString('vi-VN')}</span>
                              {notif.productType && <span>📦 {notif.productType}</span>}
                              {notif.vendorType && <span>🏪 {notif.vendorType}</span>}
                              {notif.sellerName && <span>👤 {notif.sellerName}</span>}
                            </div>
                          </div>
                          {!notif.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: notif.type === 'approved' || notif.type === 'sample_approved' ? HC.success : notif.type === 'sample_rejected' ? HC.danger : HC.orange, flexShrink: 0, marginTop: 8 }} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'news' && (
              <div style={{ overflowY: 'auto', maxHeight: 420 }}>
                <div style={{ padding: '10px 16px', background: HC.cream, borderBottom: `1px solid ${HC.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>📰 Tin tức & Cập nhật</span>
                  {unreadNews > 0 && (
                    <button onClick={markAllNewsAsRead} style={{ background: 'transparent', border: 'none', color: HC.orange, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
                {localNews.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: HC.muted }}>
                    <span style={{ fontSize: 48, opacity: 0.5 }}>📰</span>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Chưa có tin tức mới</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Thông báo chung sẽ hiển thị tại đây</div>
                  </div>
                ) : (
                  localNews.map((notif, idx) => (
                    <div key={notif.id || idx} onClick={() => handleNewsClick(notif)} style={{ padding: '14px 16px', borderBottom: `1px solid ${HC.border}`, background: notif.read ? HC.surface : HC.orangeLight, cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = HC.orangePale} onMouseLeave={e => e.currentTarget.style.background = notif.read ? HC.surface : HC.orangeLight}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>{notif.icon || '📰'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: notif.read ? HC.muted : HC.ink, fontFamily: "'Nunito',sans-serif" }}>{notif.title}</div>
                          <div style={{ fontSize: 12, color: HC.brown, marginTop: 6, lineHeight: 1.4 }}>{notif.message}</div>
                          <div style={{ fontSize: 10, color: HC.muted2, marginTop: 8 }}>🕒 {notif.time || new Date(notif.timestamp || Date.now()).toLocaleString('vi-VN')}</div>
                        </div>
                        {!notif.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: HC.orange, flexShrink: 0, marginTop: 8 }} />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            <div style={{ padding: '10px 16px', borderTop: `1px solid ${HC.border}`, background: HC.cream, textAlign: 'center' }}>
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: HC.orange, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>
                Đóng
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
