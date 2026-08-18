import React from 'react';
import { HC } from '../constants';

export default function Table({ cols, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, background: HC.surface, border: `1.5px solid ${HC.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: HC.shadow }}>
        <thead>
          <tr>
            {cols.map(c => (
              <th
                key={c}
                style={{
                  textAlign: 'left',
                  padding: '12px 14px',
                  color: HC.brown,
                  fontWeight: 900,
                  fontFamily: "'Inter',sans-serif",
                  borderBottom: `1.5px solid ${HC.border}`,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  background: HC.cream
                }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{ borderBottom: `1px solid ${HC.border}` }}
              onMouseEnter={e => (e.currentTarget.style.background = HC.orangePale)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  style={{
                    padding: '12px 14px',
                    color: HC.ink2,
                    verticalAlign: 'middle',
                    fontFamily: "'Inter',sans-serif"
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
