import React from 'react';
import { HC, ITEMS_PER_PAGE } from '../constants';

export default function Pagination({ currentPage, totalPages, totalItems, onPageChange }) {
  if (totalPages <= 1) return null;

  const from = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const to = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 14,
      padding: '10px 16px',
      background: HC.surface,
      borderRadius: 12,
      border: `1.5px solid ${HC.border}`,
      boxShadow: HC.shadow
    }}>
      <div style={{ fontSize: 12, color: HC.muted, fontWeight: 600 }}>
        Hiển thị <b style={{ color: HC.ink }}>{from}–{to}</b> / <b style={{ color: HC.ink }}>{totalItems}</b>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            minWidth: 32,
            height: 32,
            borderRadius: 8,
            border: `1.5px solid ${HC.border}`,
            background: HC.cream,
            fontSize: 12,
            fontWeight: 700,
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 1 ? 0.4 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ‹
        </button>

        {getPageNumbers().map((p, i) => (
          p === '...' ? (
            <span key={`dot-${i}`} style={{ fontSize: 12, color: HC.muted2, padding: '0 4px' }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{
                minWidth: 32,
                height: 32,
                borderRadius: 8,
                border: `1.5px solid ${currentPage === p ? HC.orange : HC.border}`,
                background: currentPage === p ? HC.orange : HC.surface,
                color: currentPage === p ? '#fff' : HC.ink2,
                fontSize: 12,
                fontWeight: currentPage === p ? 900 : 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {p}
            </button>
          )
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            minWidth: 32,
            height: 32,
            borderRadius: 8,
            border: `1.5px solid ${HC.border}`,
            background: HC.cream,
            fontSize: 12,
            fontWeight: 700,
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage === totalPages ? 0.4 : 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
