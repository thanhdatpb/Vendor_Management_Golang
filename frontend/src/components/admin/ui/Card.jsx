import React from 'react';
import { HC } from '../constants';

export default function Card({ label, value, color = HC.orange }) {
  return (
    <div style={{ background: HC.surface, border: `1.5px solid ${HC.border}`, boxShadow: HC.shadow, borderRadius: 16, padding: '18px 20px', position: 'relative', overflow: 'hidden', transition: 'transform 0.2s,box-shadow 0.2s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = HC.shadowStrong; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = HC.shadow; }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${color},${color}88)`, borderRadius: '16px 16px 0 0' }} />
      <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: color + '14', pointerEvents: 'none' }} />
      <div style={{ color: HC.muted, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10, fontFamily: "'Inter',sans-serif" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "'Inter',monospace", letterSpacing: '-0.02em' }}>{value}</div>
    </div>
  );
}
