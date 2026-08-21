// ════════════════════════════════════════════════════════
//  ADD PRODUCT TYPE MODAL — chọn Product Type từ thư viện vendor
//
//  PR-A3 (mục 03/04): liệt kê theo RECORD (mỗi vendor một dòng riêng), không
//  còn gộp theo tên. Bỏ chặn trùng tên — Seller thêm được nhiều block cùng
//  một phôi để so sánh chiến lược giá, hoặc để dùng đúng vendor mình muốn khi
//  một phôi có 2+ vendor cung cấp (trước đây bị gộp im lặng, vendor gặp trước
//  thắng, Item Cost sai). Chọn 1 record → block mới gắn `libRef` vào ĐÚNG
//  record đó, không còn tra lại theo tên.
// ════════════════════════════════════════════════════════
import { useState, useMemo } from 'react';
import { PS } from './tokens';
import { ModalShell, Btn, Badge } from './primitives';
import { listLibraryRecords } from '../../../utils/vendorLibraryIndex';

const chipStyle = (active) => ({
  fontSize: 12, fontWeight: active ? 700 : 600, padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
  border: `1px solid ${active ? PS.brandBorder : PS.border}`,
  background: active ? PS.brandSubtle : PS.bgSurface,
  color: active ? PS.brandDeep : PS.textSecondary, whiteSpace: 'nowrap',
});

export default function AddProductTypeModal({ libIndex, onPick, onManual, onClose }) {
  const [q, setQ] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const all = useMemo(() => listLibraryRecords(libIndex), [libIndex]);
  const vendors = useMemo(
    () => [...new Set(all.map((r) => r.vendorCode).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [all]
  );
  const list = useMemo(() => listLibraryRecords(libIndex, { q, vendor: vendorFilter }), [libIndex, q, vendorFilter]);
  const loading = libIndex == null;

  return (
    <ModalShell title="Chọn Product Type từ thư viện vendor" onClose={onClose} width={480}
      footer={<>
        <Btn variant="dashed" onClick={onManual} style={{ marginRight: 'auto' }}>✏️ Nhập thủ công</Btn>
        <Btn variant="ghost" onClick={onClose}>Huỷ</Btn>
      </>}>
      <div style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên product type hoặc vendor…" aria-label="Tìm product type"
          className="ps-input" />
        {/* Bộ lọc theo vendor — chỉ hiện khi thư viện có từ 2 vendor trở lên,
            đúng lúc người dùng cần phân biệt (mục 05). */}
        {vendors.length > 1 && (
          <div role="group" aria-label="Lọc theo vendor" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => setVendorFilter('')} aria-pressed={vendorFilter === ''}
              style={chipStyle(vendorFilter === '')}>Tất cả vendor</button>
            {vendors.map((v) => (
              <button key={v} type="button" onClick={() => setVendorFilter(v)} aria-pressed={vendorFilter === v}
                style={chipStyle(vendorFilter === v)}>{v}</button>
            ))}
          </div>
        )}
      </div>
      <div data-testid="ptm-list" style={{ padding: '0 10px 10px' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: PS.textMuted, fontSize: 13 }}>Đang tải thư viện…</div>
        )}
        {!loading && list.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: PS.textMuted, fontSize: 13, lineHeight: 1.6 }}>
            {all.length === 0
              ? 'Thư viện vendor của project này chưa có Product Type nào. Bạn có thể "Nhập thủ công" bên dưới.'
              : 'Không tìm thấy Product Type khớp.'}
          </div>
        )}
        {!loading && list.map((rec) => (
          <button key={rec.recordKey} type="button" onClick={() => onPick(rec)}
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
              }}>{rec.productType}</span>
              <span style={{
                display: 'block', fontSize: 11.5, color: PS.textMuted,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {rec.vendorCode && <>Vendor: <b style={{ color: PS.textSecondary }}>{rec.vendorCode}</b></>}
                {rec.filename && ` · ${rec.filename}`}
              </span>
            </span>
            <Badge>{(rec.sizes || []).length} size</Badge>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
