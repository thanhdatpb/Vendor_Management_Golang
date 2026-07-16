// ════════════════════════════════════════════════════════
//  PRODUCT TYPE CARD — spec §3.4
//  Card trắng viền nhạt: toolbar 1 hàng + PriceTable.
//  ⚠ flexShrink: 0 BẮT BUỘC — card là flex-item của body flex-column
//  có overflow:hidden; thiếu nó card bị co lại và body không cuộn được
//  (bug thật đã fix trước đây — xem ghi chú cũ).
// ════════════════════════════════════════════════════════
import { useState } from 'react';
import { PS } from './tokens';
import { Btn, IconBtn, Badge, Segmented, ConfirmDialog } from './primitives';
import PriceTable from './PriceTable';
import { SHIP_METHODS } from '../../../utils/vendorLibraryIndex';

export default function ProductTypeCard({
  pt, settings, libEntry,
  onPT, onRemovePT, onAddSize, onUpdateSize, onRemoveSize,
  onUpdateCustomize, onAddCustomize, onRenameCustomize, onRemoveCustomize,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <section aria-label={`Product type ${pt.name || 'chưa đặt tên'}`} style={{
      flexShrink: 0, /* BẮT BUỘC — xem ghi chú đầu file */
      background: PS.bgSurface, border: `2px solid ${PS.border}`, borderRadius: 14,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden',
    }}>
      {/* ── Toolbar header nổi bật ── */}
      <div style={{
        padding: '12px 16px',
        background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)`,
        borderBottom: `2px solid ${PS.border}`,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      }}>
        {/* Tên PT: từ thư viện = khoá; nhập tay = input nổi bật */}
        {libEntry ? (
          <span title="Tên Product Type lấy từ thư viện vendor — không chỉnh sửa" style={{
            fontWeight: 800, fontSize: 16, color: '#fff', padding: '6px 12px',
            background: 'rgba(255,255,255,0.12)', border: `1.5px solid rgba(255,255,255,0.2)`, borderRadius: 9,
            cursor: 'default', minWidth: 0,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>📦 {pt.name}</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18 }}>📦</span>
            <input value={pt.name} onChange={(e) => onPT(pt.id, { name: e.target.value })}
              placeholder="Tên Product Type (VD: T-shirt)" aria-label="Tên product type"
              style={{
                fontSize: 16, fontWeight: 800, color: '#fff', padding: '6px 12px', borderRadius: 9, outline: 'none',
                background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.25)',
                minWidth: 200,
              }} />
          </div>
        )}

        {/* Price (Phôi) */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(245,166,35,0.18)', border: `1px solid rgba(245,166,35,0.4)`,
          borderRadius: 8, padding: '4px 10px',
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#F5A623', whiteSpace: 'nowrap' }}>Price ($)</span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span aria-hidden style={{ position: 'absolute', left: 8, fontSize: 12, color: '#F5A623', pointerEvents: 'none', fontWeight: 700 }}>$</span>
            <input type="number" step="0.01" value={pt.phoi ?? ''} placeholder="0"
              onChange={(e) => onPT(pt.id, { phoi: e.target.value })} onWheel={(e) => e.target.blur()}
              style={{
                width: 88, padding: '5px 8px 5px 20px', fontSize: 13, fontWeight: 700,
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(245,166,35,0.35)',
                borderRadius: 6, color: '#fff', outline: 'none', textAlign: 'right',
              }} />
          </div>
        </label>

        {/* Ship Method */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>Ship Method</span>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 2, padding: 3,
            background: 'rgba(255,255,255,0.10)', border: `1px solid rgba(255,255,255,0.18)`, borderRadius: 9,
          }}>
            {SHIP_METHODS.map(m => {
              const on = pt.shipMethod === m.key;
              return (
                <button key={m.key} type="button" onClick={() => onPT(pt.id, { shipMethod: m.key })}
                  style={{
                    fontSize: 11.5, fontWeight: on ? 700 : 600,
                    padding: '4px 9px', borderRadius: 7, cursor: 'pointer',
                    border: `1px solid ${on ? 'rgba(245,166,35,0.6)' : 'transparent'}`,
                    background: on ? 'rgba(245,166,35,0.30)' : 'transparent',
                    color: on ? '#F5A623' : 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap',
                  }}>
                  {m.label}
                </button>
              );
            })}
          </div>
          {libEntry && !pt.shipMethod && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: 'rgba(180,83,9,0.25)', color: '#FCD34D', border: '1px solid rgba(252,211,77,0.3)',
              cursor: 'help',
            }} title="Chọn một phương thức ship để nạp giá vốn từ thư viện vendor.">⚠ Chưa chọn</span>
          )}
        </div>

        {/* Nguồn dữ liệu */}
        <span style={{
          fontSize: 11.5, fontWeight: 600, padding: '3px 10px', borderRadius: 999,
          background: libEntry ? 'rgba(5,150,105,0.25)' : 'rgba(255,255,255,0.10)',
          color: libEntry ? '#6EE7B7' : 'rgba(255,255,255,0.6)',
          border: `1px solid ${libEntry ? 'rgba(6,78,59,0.4)' : 'rgba(255,255,255,0.15)'}`,
        }}>
          {libEntry ? '📚 Từ thư viện vendor' : '✏️ Nhập thủ công'} · {pt.sizes?.length || 0} size
        </span>

        {/* Actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {!libEntry && (
            <button type="button" onClick={() => onAddSize(pt.id)}
              style={{
                fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff',
              }}>＋ Thêm Size</button>
          )}
          <button type="button" onClick={() => onAddCustomize(pt.id)}
            style={{
              fontSize: 12, fontWeight: 700, padding: '5px 11px', borderRadius: 7, cursor: 'pointer',
              background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(167,139,250,0.4)', color: '#C4B5FD',
            }}>＋ Add Customize Info</button>
          <button type="button" title="Xoá product type" onClick={() => setConfirmDelete(true)}
            style={{
              width: 30, height: 30, borderRadius: 7, cursor: 'pointer', fontSize: 14, fontWeight: 700,
              background: 'rgba(225,29,72,0.15)', border: '1px solid rgba(225,29,72,0.3)', color: '#FDA4AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>🗑</button>
        </div>
      </div>

      {/* ── Bảng size ── */}
      <PriceTable pt={pt} settings={settings} libEntry={libEntry}
        onUpdateSize={onUpdateSize} onRemoveSize={onRemoveSize}
        onUpdateCustomize={onUpdateCustomize}
        onRenameCustomize={onRenameCustomize} onRemoveCustomize={onRemoveCustomize} />

      {confirmDelete && (
        <ConfirmDialog title="Xoá Product Type" confirmLabel="Xoá khỏi bảng"
          message={`Xoá "${pt.name || 'product type chưa đặt tên'}" khỏi bảng tính giá? Dữ liệu giá size đã nhập của phần này sẽ mất.`}
          onConfirm={() => onRemovePT(pt.id)} onClose={() => setConfirmDelete(false)} />
      )}
    </section>
  );
}
