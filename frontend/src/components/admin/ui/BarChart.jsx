import React from 'react';
import { HC } from '../constants';

export default function BarChart({ data, labels }) {
  const max = Math.max(...data.map(d => d.revenue || d || 0), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 90, padding: '0 2px' }}>
      {data.map((d, i) => {
        const val = d.revenue || d || 0; const pct = (val / max) * 100; return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', height: `${Math.max(pct, 4)}px`, background: `linear-gradient(to top,${HC.orange},${HC.orangeDark}cc)`, borderRadius: '5px 5px 0 0', minHeight: 4 }} />
            <span style={{ fontSize: 8, color: HC.muted, fontFamily: "'Nunito',sans-serif", fontWeight: 700 }}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}
