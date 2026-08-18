import React from 'react';
import { HC } from '../constants';

export default function InfoRow({ label, value, valueColor, valueBold, idx, isLast }) {
  return (
    <div style={{ display: 'flex', gap: 8, padding: '7px 12px', borderBottom: isLast ? 'none' : `1px solid ${HC.border}`, background: idx % 2 === 0 ? HC.surface : HC.surface2, minHeight: 34 }}>
      <span style={{ minWidth: 108, flexShrink: 0, fontWeight: 800, color: HC.muted, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2, fontFamily: "'Inter',sans-serif", lineHeight: 1.4 }}>{label}</span>
      <span style={{ color: valueColor || HC.ink2, fontWeight: valueBold ? 700 : 400, flex: 1, wordBreak: 'break-word', fontFamily: "'Inter',sans-serif", fontSize: 12, lineHeight: 1.4 }}>{value || '—'}</span>
    </div>
  );
}
