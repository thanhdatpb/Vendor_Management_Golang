import React from 'react';
import { HC } from '../constants';
import HCLogo from './HCLogo';

export default function Spinner() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: HC.muted, fontSize: 13, fontFamily: "'Nunito Sans',sans-serif" }}>
      <HCLogo size={36} color={HC.orange} /><div style={{ marginTop: 10 }}>Đang tải...</div>
    </div>
  );
}
