import React from 'react';
import { HC } from '../constants';
import HCLogo from './HCLogo';

export default function EmptyState({ msg = 'Không có dữ liệu' }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: HC.muted, fontSize: 13, fontFamily: "'Nunito Sans',sans-serif" }}>
      <div style={{ marginTop: 12 }}>{msg}</div>
    </div>
  );
}
