import React from 'react';
import { HC } from '../constants';

export default function CardHeader({ icon, title, subtitle, badge, dimmed = false }) {
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
