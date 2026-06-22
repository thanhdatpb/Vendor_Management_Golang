import { useState, useEffect, useMemo } from 'react';
import { BellOutlined } from '@ant-design/icons';
import { HC } from '../../constants/sellerTheme';

const NEWS_COLOR = '#0891b2';
const NEWS_BG   = '#f0f9ff';

function formatTime(timestamp) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    const diff = Date.now() - date;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Vừa xong';
    if (m < 60) return `${m} phút trước`;
    const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h} giờ trước`;
    const d = Math.floor(diff / 86400000);
    if (d < 7) return `${d} ngày trước`;
    return date.toLocaleDateString('vi-VN');
  } catch { return ''; }
}

export default function SellerNotificationCenter({
  requestNotifications,
  newsNotifications,
  markRequestAsRead,
  markNewsAsRead,
  onRequestClick,
  onNewsClick,
}) {
  const [isOpen, setIsOpen]               = useState(false);
  const [localRequests, setLocalRequests] = useState(requestNotifications || []);
  const [localNews, setLocalNews]         = useState(newsNotifications || []);
  const [selectedNotif, setSelectedNotif] = useState(null);

  useEffect(() => {
    setLocalRequests(prev => {
      const readIds = new Set(prev.filter(n => n.read).map(n => n.id));
      return (requestNotifications || []).map(n => ({ ...n, read: readIds.has(n.id) ? true : n.read }));
    });
  }, [requestNotifications]);

  useEffect(() => {
    setLocalNews(prev => {
      const readIds = new Set(prev.filter(n => n.read).map(n => n.id));
      return (newsNotifications || []).map(n => ({ ...n, read: readIds.has(n.id) ? true : n.read }));
    });
  }, [newsNotifications]);

  const totalUnread = useMemo(
    () => localRequests.filter(n => !n.read).length + localNews.filter(n => !n.read).length,
    [localRequests, localNews]
  );

  const allItems = useMemo(() => {
    const reqs = localRequests.map(n => ({ ...n, _category: 'request' }));
    const news = localNews.map(n => ({ ...n, _category: 'news' }));
    return [...reqs, ...news].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });
  }, [localRequests, localNews]);

  const markAllAsRead = () => {
    setLocalRequests(prev => prev.map(n => ({ ...n, read: true })));
    setLocalNews(prev => prev.map(n => ({ ...n, read: true })));
    setTimeout(() => {
      localRequests.forEach(n => { if (!n.read && markRequestAsRead) markRequestAsRead(n.id); });
      localNews.forEach(n => { if (!n.read && markNewsAsRead) markNewsAsRead(n.id); });
    }, 0);
  };

  const handleItemClick = (notif) => {
    if (notif._category === 'request') {
      setLocalRequests(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      setTimeout(() => { if (!notif.read && markRequestAsRead) markRequestAsRead(notif.id); }, 0);
    } else {
      setLocalNews(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
      setTimeout(() => { if (!notif.read && markNewsAsRead) markNewsAsRead(notif.id); }, 0);
    }
    setSelectedNotif({ ...notif, read: true });
  };

  const isReq = (notif) => notif._category === 'request';

  return (
    <div style={{ position: 'relative' }}>
      {/* Bell */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{ background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, borderRadius: 30, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', transition: 'all 0.2s' }}
        onMouseEnter={e => { e.currentTarget.style.background = HC.orangeMid; e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = HC.orangeLight; e.currentTarget.style.transform = 'scale(1)'; }}
      >
        <BellOutlined style={{ fontSize: 20, color: HC.orangeDark }} />
        {totalUnread > 0 && (
          <span style={{ position: 'absolute', top: -5, right: -5, background: HC.danger, color: '#fff', fontSize: 10, fontWeight: 900, width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2px solid ${HC.surface}` }}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
          <div style={{ position: 'absolute', top: 50, right: 0, width: 460, maxHeight: 858, background: HC.surface, borderRadius: 16, boxShadow: HC.shadowStrong, border: `1.5px solid ${HC.border}`, zIndex: 999, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* ── Header ── */}
            <div style={{ padding: '14px 18px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 900, fontSize: 15, color: '#fff', fontFamily: "'Nunito',sans-serif", display: 'flex', alignItems: 'center', gap: 8 }}>
                🔔 Thông báo
                {totalUnread > 0 && (
                  <span style={{ background: 'rgba(255,255,255,0.22)', color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 99, padding: '2px 10px' }}>
                    {totalUnread} chưa đọc
                  </span>
                )}
              </span>
              {totalUnread > 0 && (
                <button onClick={markAllAsRead}
                  style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 8, padding: '5px 12px', fontFamily: "'Nunito',sans-serif", transition: 'all 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.28)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
                >
                  Đọc tất cả ✓
                </button>
              )}
            </div>

            {/* ── Detail View ── */}
            {selectedNotif ? (
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 702 }}>
                <div style={{ padding: '10px 16px', background: HC.cream, borderBottom: `1px solid ${HC.border}`, display: 'flex', alignItems: 'center', gap: 8, position: 'sticky', top: 0, zIndex: 2 }}>
                  <button onClick={() => setSelectedNotif(null)} style={{ background: HC.orangeLight, border: `1px solid ${HC.orangeMid}`, borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: HC.orangeDark, cursor: 'pointer' }}>
                    ← Quay lại
                  </button>
                  <span style={{ fontSize: 11, color: HC.muted, fontWeight: 600 }}>Chi tiết thông báo</span>
                  <span style={{ marginLeft: 'auto', fontSize: 9, fontWeight: 700, color: HC.success, background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 99, padding: '2px 8px' }}>✓ Đã đọc</span>
                </div>
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 99, padding: '2px 9px', background: isReq(selectedNotif) ? HC.orangeLight : NEWS_BG, color: isReq(selectedNotif) ? HC.orangeDark : NEWS_COLOR, border: `1px solid ${isReq(selectedNotif) ? HC.orangeMid : '#bae6fd'}` }}>
                      {isReq(selectedNotif) ? 'Yêu cầu' : 'Tin tức'}
                    </span>
                  </div>
                  <div style={{ fontWeight: 900, fontSize: 14, color: HC.ink, fontFamily: "'Nunito',sans-serif", lineHeight: 1.4, marginTop: 10, marginBottom: 14 }}>{selectedNotif.title}</div>
                  <div style={{ background: HC.orangePale, border: `1px solid ${HC.border}`, borderRadius: 12, padding: '14px 16px', fontSize: 13, color: HC.ink2, lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 16 }}>
                    {selectedNotif.message || '(Không có nội dung)'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(selectedNotif.productType || selectedNotif.product_type) && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 11, color: HC.muted, width: 90 }}>🏷️ Loại SP</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: HC.brown }}>{selectedNotif.productType || selectedNotif.product_type}</span>
                      </div>
                    )}
                    {selectedNotif.vendorType && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span style={{ fontSize: 11, color: HC.muted, width: 90 }}>🏪 Vendor</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: HC.brown }}>{selectedNotif.vendorType}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 11, color: HC.muted, width: 90 }}>🕒 Thời gian</span>
                      <span style={{ fontSize: 12, color: HC.brown }}>{selectedNotif.time || (selectedNotif.timestamp ? new Date(selectedNotif.timestamp).toLocaleString('vi-VN') : '')}</span>
                    </div>
                    {selectedNotif.reason && (
                      <div style={{ marginTop: 8, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 12, color: HC.danger, lineHeight: 1.5 }}>
                        <b>Lý do từ chối:</b> {selectedNotif.reason}
                      </div>
                    )}
                  </div>
                  {selectedNotif.productId && onRequestClick && isReq(selectedNotif) && (
                    <button onClick={() => { onRequestClick(selectedNotif); setSelectedNotif(null); setIsOpen(false); }} style={{ marginTop: 20, width: '100%', padding: '10px', background: `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`, border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito',sans-serif" }}>
                      🔍 Xem sản phẩm liên quan
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ── Unified feed ── */
              <div style={{ overflowY: 'auto', flex: 1, maxHeight: 702, scrollbarWidth: 'thin', scrollbarColor: `${HC.orangeMid} transparent` }}>
                <div style={{ padding: '8px 16px', background: HC.cream, borderBottom: `1px solid ${HC.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 2 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: HC.muted }}>
                    {allItems.length > 0 ? `${allItems.length} thông báo` : 'Tất cả thông báo'}
                    {totalUnread > 0 && <span style={{ marginLeft: 6, color: HC.brown }}>· {totalUnread} chưa đọc</span>}
                  </span>
                </div>

                {allItems.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: HC.muted }}>
                    <div style={{ fontSize: 44, opacity: 0.4, marginBottom: 12 }}>🔔</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: HC.muted }}>Chưa có thông báo nào</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: HC.muted2 }}>Thông báo sẽ xuất hiện tại đây</div>
                  </div>
                ) : allItems.map((notif, idx) => {
                  const req = isReq(notif);
                  const accentColor = req ? HC.orange : NEWS_COLOR;
                  const unreadBg = req ? HC.orangeLight : NEWS_BG;
                  const bg = notif.read ? HC.surface : unreadBg;
                  return (
                    <div
                      key={notif.id || idx}
                      onClick={() => handleItemClick(notif)}
                      style={{ padding: '12px 16px 12px 14px', borderBottom: `1px solid ${HC.border}`, borderLeft: `3px solid ${notif.read ? HC.border : accentColor}`, background: bg, cursor: 'pointer', transition: 'all 0.15s', opacity: notif.read ? 0.78 : 1 }}
                      onMouseEnter={e => { e.currentTarget.style.background = HC.orangePale; e.currentTarget.style.borderLeftColor = accentColor; e.currentTarget.style.opacity = '1'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = bg; e.currentTarget.style.borderLeftColor = notif.read ? HC.border : accentColor; e.currentTarget.style.opacity = notif.read ? '0.78' : '1'; }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, borderRadius: 99, padding: '2px 7px', background: req ? HC.orangeLight : NEWS_BG, color: req ? HC.orangeDark : NEWS_COLOR, border: `1px solid ${req ? HC.orangeMid : '#bae6fd'}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {req ? 'Yêu cầu' : 'Tin tức'}
                          </span>
                          <span style={{ fontWeight: notif.read ? 600 : 800, fontSize: 12.5, color: notif.read ? HC.muted : HC.ink, fontFamily: "'Nunito',sans-serif", flex: 1, lineHeight: 1.3 }}>
                            {notif.title}
                          </span>
                          {!notif.read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: accentColor, flexShrink: 0, marginTop: 2 }} />}
                        </div>
                        {notif.message && (
                          <div style={{ fontSize: 11.5, color: HC.ink2, lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: 6 }}>
                            {notif.message}
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 10, color: HC.muted2 }}>
                          <span>🕒 {notif.timestamp ? formatTime(notif.timestamp) : (notif.time || '')}</span>
                          {(notif.productType || notif.product_type) && <span>📦 {notif.productType || notif.product_type}</span>}
                          {notif.vendorType && <span>🏪 {notif.vendorType}</span>}
                          {notif.source === 'admin' && <span style={{ color: HC.orangeDark }}>👑 Admin</span>}
                          {notif.source === 'staffb' && <span>📢 Vendor Approver</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Footer ── */}
            <div style={{ padding: '9px 16px', borderTop: `1px solid ${HC.border}`, background: HC.cream, textAlign: 'center' }}>
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
