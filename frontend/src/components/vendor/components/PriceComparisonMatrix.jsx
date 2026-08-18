import React from 'react';
import { HC } from '../utils/constants';

export default function PriceComparisonMatrix({ vendors, productType }) {
  if (!vendors || vendors.length === 0) return null;

  const fmt = (v) => (v != null && v !== '') ? `$${Number(v).toFixed(2)}` : '—';

  const criteria = [
    { key: 'base_price', label: 'Giá Phôi', format: fmt, best: 'min' },
    { key: 'printing_price', label: 'Giá In', format: fmt, best: 'min' },
    { key: 'total_price', label: 'Tổng Cộng', format: (v, item) => fmt(Number(item.base_price || 0) + Number(item.printing_price || 0)), best: 'min' },
    { key: 'lead_time', label: 'Sản xuất', format: (v) => v ? `${v} ngày` : '—', best: 'min' },
    { key: 'min_order_qty', label: 'MOQ', format: (v) => v || '—', best: 'min' },
    { key: 'rating', label: 'Đánh giá', format: (v) => v ? `⭐ ${v}/5` : '—', best: 'max' },
  ];

  return (
    <div style={{ width: '100%', overflowX: 'auto', background: '#fff', borderRadius: 12, border: `1.5px solid ${HC.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: "'Inter',sans-serif" }}>
        <thead>
          <tr style={{ background: HC.ink, color: '#fff' }}>
            <th style={{ padding: '15px 20px', textAlign: 'left', borderBottom: `2px solid ${HC.orange}`, width: 150 }}>Tiêu chí</th>
            {vendors.map((v, i) => (
              <th key={i} style={{ padding: '15px 20px', textAlign: 'center', borderBottom: `2px solid ${HC.orange}`, minWidth: 160 }}>
                <div style={{ color: HC.orange, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Vendor #{i + 1}</div>
                <div style={{ fontWeight: 800 }}>{v.name || v.vendor_type}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, idx) => {
            let bestVal = null;
            if (c.best) {
              const values = vendors.map(v => {
                if (c.key === 'total_price') return Number(v.base_price || 0) + Number(v.printing_price || 0);
                return Number(v[c.key] || 0);
              }).filter(v => v > 0);
              if (values.length > 0) {
                bestVal = c.best === 'min' ? Math.min(...values) : Math.max(...values);
              }
            }

            return (
              <tr key={c.key} style={{ background: idx % 2 === 0 ? '#fff' : HC.surface }}>
                <td style={{ padding: '12px 20px', fontWeight: 700, color: HC.muted, borderBottom: `1px solid ${HC.border}` }}>{c.label}</td>
                {vendors.map((v, i) => {
                  const rawVal = c.key === 'total_price' ? (Number(v.base_price || 0) + Number(v.printing_price || 0)) : Number(v[c.key] || 0);
                  const isBest = bestVal !== null && rawVal === bestVal && rawVal > 0;

                  return (
                    <td key={i} style={{ padding: '12px 20px', textAlign: 'center', borderBottom: `1px solid ${HC.border}`, color: isBest ? HC.success : HC.ink, fontWeight: isBest ? 800 : 400, background: isBest ? 'rgba(34,197,94,0.08)' : 'transparent' }}>
                      {c.format(v[c.key], v)}
                      {isBest && <div style={{ fontSize: 9, marginTop: 2, color: HC.success }}>Tối ưu nhất</div>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
