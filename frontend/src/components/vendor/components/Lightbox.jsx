import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Lightbox({ mediaUrls, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const isVideo = (url) => url && (url.match(/\.(mp4|webm|mov)$/i) || url.includes('video'));

  // Esc đóng ảnh phóng to (trước đây chỉ bấm được ✕ hoặc nền).
  // `data-esc-layer` ở dưới là tín hiệu cho cửa sổ file bên ngoài: đang có lớp
  // trên cùng tự xử lý Esc, đừng đóng theo — Esc phải đóng từng lớp một.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const next = () => setCurrentIndex((prev) => (prev + 1) % mediaUrls.length);
  const prev = () => setCurrentIndex((prev) => (prev - 1 + mediaUrls.length) % mediaUrls.length);

  if (!mediaUrls.length) return null;

  // Portal thẳng ra document.body: nếu render tại chỗ, một ancestor bất kỳ có
  // transform/filter/backdrop-filter/contain (rất nhiều overlay trong dự án
  // dùng backdropFilter cho hiệu ứng kính mờ) sẽ biến thành containing block
  // của position:fixed — khiến lightbox bị kẹt/lệch trong khung cha thay vì
  // phủ toàn màn hình, nhìn như trắng/vỡ dù <img> vẫn load đúng.
  return createPortal((
    <div
      onClick={onClose}
      data-esc-layer="lightbox"
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
  ), document.body);
}
