import React from 'react';
import { HC } from '../constants';

export default function MediaGallery({ mediaUrls = [] }) {
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
