import React, { useState } from 'react';
import { HC } from '../constants';

export default function MediaGallery({ mediaUrls = [] }) {
  const [broken, setBroken] = useState(false);

  if (!mediaUrls.length) return <span style={{ color: HC.muted2, fontSize: 11 }}>—</span>;

  const firstUrl = mediaUrls[0];
  const isVideo = firstUrl && (firstUrl.match(/\.(mp4|webm|mov)$/i) || firstUrl.includes('video'));

  const placeholder = (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    </div>
  );

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{
        width: 60,
        height: 60,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#f1f5f9',
        border: `1.5px solid ${HC.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {broken ? placeholder : isVideo ? (
          <video src={firstUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} />
        ) : (
          <img src={firstUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setBroken(true)} />
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
