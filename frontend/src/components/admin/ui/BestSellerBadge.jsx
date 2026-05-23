import React from 'react';

export default function BestSellerBadge() {
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
