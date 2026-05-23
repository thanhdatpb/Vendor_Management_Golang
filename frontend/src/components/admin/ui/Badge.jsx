import React from 'react';
import { HC, STATUS_CFG } from '../constants';

export default function Badge({ status }) {
  const c = STATUS_CFG[status] || { bg: HC.orangeLight, text: HC.brown, dot: HC.muted, label: status };
  return (
    <span style={{ background: c.bg, color: c.text, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${HC.border}` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />{c.label}
    </span>
  );
}
