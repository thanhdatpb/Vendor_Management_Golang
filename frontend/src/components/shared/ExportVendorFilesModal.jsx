// ════════════════════════════════════════════════════════════════════════════
//  EXPORT VENDOR FILES MODAL — chọn file thư viện Vendor cần xuất Excel.
//  Dùng chung cho VendorLibraryViewer (Vendor/Admin/Seller) và
//  VendorLibraryView (CSF/PD/Marvel) — nhận theme HC của nơi gọi để đồng bộ màu.
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useMemo } from 'react';

export default function ExportVendorFilesModal({ HC, files, onConfirm, onClose, exporting }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) =>
      (f.filename || '').toLowerCase().includes(q) ||
      (f.title || '').toLowerCase().includes(q)
    );
  }, [files, query]);

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((f) => selected.has(f.id));
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((f) => next.delete(f.id));
      else filtered.forEach((f) => next.add(f.id));
      return next;
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(26,15,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: HC.surface, borderRadius: 16, width: 'min(560px, 92vw)',
          maxHeight: '82vh', display: 'flex', flexDirection: 'column',
          boxShadow: HC.shadowStrong, border: `1.5px solid ${HC.border}`,
        }}
      >
        <div style={{
          padding: '18px 22px', borderBottom: `1.5px solid ${HC.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: HC.ink, fontFamily: "'Inter',sans-serif" }}>
            Chọn file Vendor cần Export
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: HC.muted, lineHeight: 1 }}
          >✕</button>
        </div>

        <div style={{ padding: '14px 22px 0' }}>
          <input
            type="text"
            autoFocus
            placeholder="Tìm theo tên file hoặc loại sản phẩm..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 10,
              border: `1.5px solid ${HC.borderStrong}`, outline: 'none',
              fontSize: 13, boxSizing: 'border-box', fontFamily: "'Inter',sans-serif",
              color: HC.ink,
            }}
          />
        </div>

        <div style={{
          padding: '10px 22px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', fontSize: 12, color: HC.brown ?? HC.muted,
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: 700 }}>
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
            Chọn tất cả ({filtered.length})
          </label>
          <span>{selected.size} đã chọn</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: HC.muted }}>Không tìm thấy file nào.</div>
          ) : filtered.map((f) => (
            <label
              key={f.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 8px', borderRadius: 10, cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = HC.orangePale ?? HC.surface2; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <input type="checkbox" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700, fontSize: 12.5, color: HC.ink, fontFamily: "'Inter',sans-serif",
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {f.filename}
                </div>
                <div style={{ fontSize: 10.5, color: HC.muted }}>
                  {f.title ? `${f.title} · ` : ''}{(f.generalInfo || []).length} sản phẩm · {(f.pricing || []).length} dòng giá
                </div>
              </div>
            </label>
          ))}
        </div>

        <div style={{
          padding: '14px 22px', borderTop: `1.5px solid ${HC.border}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 16px', borderRadius: 10, border: `1.5px solid ${HC.borderStrong}`,
              background: HC.surface, color: HC.ink2 ?? HC.ink, fontWeight: 700, cursor: 'pointer',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            Huỷ
          </button>
          <button
            onClick={() => onConfirm([...selected])}
            disabled={selected.size === 0 || exporting}
            style={{
              padding: '9px 20px', borderRadius: 10, border: 'none',
              background: selected.size === 0
                ? (HC.muted2 ?? HC.border)
                : `linear-gradient(135deg, ${HC.orange}, ${HC.orangeDark})`,
              color: '#fff', fontWeight: 800,
              cursor: selected.size === 0 || exporting ? 'not-allowed' : 'pointer',
              fontFamily: "'Inter',sans-serif",
            }}
          >
            {exporting ? 'Đang xuất...' : `Export (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
