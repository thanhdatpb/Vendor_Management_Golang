// ════════════════════════════════════════════════════════
//  ADD PRODUCT TYPE MODAL — chọn Product Type từ thư viện vendor
//  (giữ nguyên hành vi cũ: search, ẩn PT đã thêm, fallback nhập thủ công)
// ════════════════════════════════════════════════════════
import { useState, useMemo } from 'react';
import { PS } from './tokens';
import { ModalShell, Btn, Badge } from './primitives';
import { listLibraryProductTypes, normalizeKey } from '../../../utils/vendorLibraryIndex';

export default function AddProductTypeModal({ libIndex, existingKeys, onPick, onManual, onClose }) {
  const [q, setQ] = useState('');
  const all = useMemo(() => listLibraryProductTypes(libIndex), [libIndex]);
  const list = useMemo(() => {
    const nq = normalizeKey(q);
    return all.filter((it) =>
      !existingKeys.has(normalizeKey(it.productType)) &&
      (!nq || normalizeKey(it.productType).includes(nq) || normalizeKey(it.vendor).includes(nq))
    );
  }, [all, q, existingKeys]);
  const loading = libIndex == null;

  return (
    <ModalShell title="Chọn Product Type từ thư viện vendor" onClose={onClose} width={480}
      footer={<>
        <Btn variant="dashed" onClick={onManual} style={{ marginRight: 'auto' }}>✏️ Nhập thủ công</Btn>
        <Btn variant="ghost" onClick={onClose}>Huỷ</Btn>
      </>}>
      <div style={{ padding: '12px 16px 8px' }}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên product type hoặc vendor…" aria-label="Tìm product type"
          className="ps-input" />
      </div>
      <div style={{ padding: '0 10px 10px' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: PS.textMuted, fontSize: 13 }}>Đang tải thư viện…</div>
        )}
        {!loading && list.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: PS.textMuted, fontSize: 13, lineHeight: 1.6 }}>
            {all.length === 0
              ? 'Thư viện vendor của project này chưa có Product Type nào. Bạn có thể "Nhập thủ công" bên dưới.'
              : 'Không tìm thấy Product Type khớp — hoặc tất cả đã được thêm vào bảng.'}
          </div>
        )}
        {!loading && list.map((it) => (
          <button key={normalizeKey(it.productType)} type="button" onClick={() => onPick(it.productType)}
            className="ps-listitem"
            style={{
              width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', margin: '4px 0', borderRadius: 10,
              border: `1px solid ${PS.border}`, background: PS.bgSurface, cursor: 'pointer',
            }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{
                display: 'block', fontWeight: 700, fontSize: 13.5, color: PS.text,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{it.productType}</span>
              {it.vendor && <span style={{ fontSize: 11.5, color: PS.textMuted }}>Vendor: {it.vendor}</span>}
            </span>
            <Badge>{it.sizeCount} size</Badge>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
