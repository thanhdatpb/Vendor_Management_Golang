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
  pt, settings, libEntry, compareCount = 0,
  onPT, onRemovePT, onAddSize, onUpdateSize, onRemoveSize,
  onUpdateCustomize, onAddCustomize, onRenameCustomize, onRemoveCustomize,
  onMoveSize, onReorderSizes, onMoveCustomize, onReorderCustomize, onRestoreFromLibrary,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  // PT có nguồn thư viện (theo record hoặc theo tên) → mới có gì để khôi phục.
  const fromLibrary = Boolean(libEntry || pt.libRef?.recordKey);
  // Mã vendor hiển thị — ưu tiên `pt.vendorCode` (PT gắn `libRef`, mục 03/04),
  // rơi về `libEntry.vendor` cho bảng cũ resolve theo tên (đường lùi).
  const vendorLabel = pt.vendorCode || libEntry?.vendor || '';
  const recordMissing = pt.warning === 'record-missing';
  // "Info phôi" (mục 02) — chỉ có khi PT lấy từ thư viện VÀ thư viện thật sự
  // có ít nhất 1 trong 5 field này (file cũ import trước khi có Section 1
  // đầy đủ thì rỗng hết — không hiện dòng trống vô nghĩa).
  const hasGeneralInfo = Boolean(libEntry && (
    libEntry.image || libEntry.chatLieu || libEntry.chiTietSize || libEntry.avgTimeVendor || libEntry.avgTimeActual
  ));

  return (
    <section aria-label={`Product type ${pt.name || 'chưa đặt tên'}`} style={{
      flexShrink: 0, /* BẮT BUỘC — xem ghi chú đầu file */
      background: PS.bgSurface, border: `1px solid ${PS.border}`, borderRadius: 12,
      boxShadow: PS.shadowCard, overflow: 'hidden',
    }}>
      {/* ── Toolbar — nền amber-50, tên PT có thanh accent dọc (spec §5) ── */}
      <div style={{
        padding: '10px 16px', background: PS.accentBg, borderBottom: `1px solid ${PS.accentSoft}`,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      }}>
        {/* Tên PT: thanh dọc amber-400 + chữ đậm; từ thư viện = khoá, nhập tay = input tàng hình */}
        <div style={{
          borderLeft: `4px solid ${PS.accentBar}`, paddingLeft: 10,
          display: 'flex', alignItems: 'center', minWidth: 0,
        }}>
          {libEntry ? (
            <span title="Tên Product Type lấy từ thư viện vendor — không chỉnh sửa" style={{
              fontWeight: 650, fontSize: 15.5, color: PS.text,
              cursor: 'default', minWidth: 0, maxWidth: 320, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{pt.name}</span>
          ) : (
            <input value={pt.name} onChange={(e) => onPT(pt.id, { name: e.target.value })}
              placeholder="Tên Product Type (VD: T-shirt)" aria-label="Tên product type"
              className="ps-input ps-input-ghost"
              style={{ fontSize: 15.5, fontWeight: 650, color: PS.text, width: 220, padding: '4px 8px', marginLeft: -8 }} />
          )}
        </div>

        {/* Price (Phôi) — giữ nguyên nhãn nghiệp vụ "Price ($)" */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 650, color: PS.textSecondary, whiteSpace: 'nowrap' }}>Price ($)</span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span aria-hidden style={{ position: 'absolute', left: 8, fontSize: 12, color: PS.textMuted, pointerEvents: 'none' }}>$</span>
            <input type="number" step="0.01" value={pt.phoi ?? ''} placeholder="0"
              onChange={(e) => onPT(pt.id, { phoi: e.target.value })} onWheel={(e) => e.target.blur()}
              className="ps-input ps-input--num" style={{ width: 88, padding: '5px 8px 5px 20px', fontSize: 12.5, fontWeight: 650 }} />
          </div>
        </label>

        {/* Ship Method — segmented control thật (spec §3.4). Không auto-chọn
            để không đổi số liệu; chưa chọn → badge nhắc rõ ràng. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 650, color: PS.textSecondary, whiteSpace: 'nowrap' }}>Ship Method</span>
          <Segmented label="Ship Method" options={SHIP_METHODS} value={pt.shipMethod}
            onChange={(key) => onPT(pt.id, { shipMethod: key })} />
          {libEntry && !pt.shipMethod && (
            <Badge tone="warning" style={{ cursor: 'help', border: `1px solid ${PS.accentBorder}` }}
              title="Chọn một phương thức ship để nạp giá vốn (Item Cost) từ thư viện vendor.">Chưa chọn</Badge>
          )}
        </div>

        {/* Nguồn dữ liệu — kèm mã vendor để phân biệt các block trùng tên phôi
            (mục 03/04): "Football Jersey · VN3" khác "Football Jersey · VN7". */}
        <Badge>
          {libEntry ? 'Từ thư viện vendor' : 'Nhập thủ công'}
          {vendorLabel ? ` · ${vendorLabel}` : ''} · {pt.sizes?.length || 0} size
        </Badge>
        {recordMissing && (
          <Badge tone="negative" style={{ cursor: 'help' }}
            title="Record nguồn (vendor + file) không còn trong thư viện — có thể file đã bị xoá hoặc import lại. Giá đang hiện là bản chốt gần nhất (costSnapshot), không tự đổi số. Kiểm tra lại thư viện Vendor.">
            ⚠ Record nguồn không còn
          </Badge>
        )}
        {compareCount > 1 && (
          <Badge style={{ cursor: 'help' }}
            title={`${compareCount} block cùng tên "${pt.name}" trong bảng này — so sánh giá giữa các vendor/chiến lược giá khác nhau.`}>
            🔍 So sánh · {compareCount}
          </Badge>
        )}
        {hasGeneralInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {libEntry.image && (
              <img src={libEntry.image} alt="Ảnh phôi" loading="lazy"
                style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'cover', border: `1px solid ${PS.border}`, flexShrink: 0 }} />
            )}
            {libEntry.chatLieu && (
              <span title={libEntry.chatLieu} style={{
                fontSize: 11.5, color: PS.textSecondary, maxWidth: 140, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>🧵 {libEntry.chatLieu}</span>
            )}
            {libEntry.chiTietSize && (
              <span title={libEntry.chiTietSize} style={{
                fontSize: 11.5, color: PS.textSecondary, maxWidth: 140, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>📏 {libEntry.chiTietSize}</span>
            )}
            {(libEntry.avgTimeVendor || libEntry.avgTimeActual) && (
              <span
                title={`AVG TG (Vendor): ${libEntry.avgTimeVendor || '—'}\nAVG TG (Thực tế): ${libEntry.avgTimeActual || '—'}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help',
                  width: 18, height: 18, borderRadius: '50%', fontSize: 10.5, fontWeight: 700,
                  border: `1px solid ${PS.borderStrong}`, color: PS.textMuted, flexShrink: 0,
                }}>⏱</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* PR-A4: thêm size mở cho CẢ Product Type lấy từ thư viện — bảng giá
              là bản làm việc của Seller, không phải bản sao khoá cứng của thư viện. */}
          <Btn size="sm" onClick={() => onAddSize(pt.id)}>＋ Thêm Size</Btn>
          <Btn size="sm" onClick={() => onAddCustomize(pt.id)}>＋ Add Customize Info</Btn>
          {fromLibrary && (
            <Btn size="sm" variant="outline" onClick={() => setConfirmRestore(true)}
              title="Lấy lại đúng danh sách size và tên size của thư viện Vendor cho product type này">
              ↺ Khôi phục theo thư viện
            </Btn>
          )}
          <IconBtn variant="dangerghost" title="Xoá product type" onClick={() => setConfirmDelete(true)}>🗑</IconBtn>
        </div>
      </div>

      {/* ── Bảng size ── */}
      <PriceTable pt={pt} settings={settings}
        onUpdateSize={onUpdateSize} onRemoveSize={onRemoveSize}
        onUpdateCustomize={onUpdateCustomize}
        onRenameCustomize={onRenameCustomize} onRemoveCustomize={onRemoveCustomize}
        onMoveSize={onMoveSize} onReorderSizes={onReorderSizes}
        onMoveCustomize={onMoveCustomize} onReorderCustomize={onReorderCustomize} />

      {confirmDelete && (
        <ConfirmDialog title="Xoá Product Type" confirmLabel="Xoá khỏi bảng"
          message={`Xoá "${pt.name || 'product type chưa đặt tên'}" khỏi bảng tính giá? Dữ liệu giá size đã nhập của phần này sẽ mất.`}
          onConfirm={() => onRemovePT(pt.id)} onClose={() => setConfirmDelete(false)} />
      )}

      {confirmRestore && (
        <ConfirmDialog title="Khôi phục theo thư viện" confirmLabel="Khôi phục"
          message="Lấy lại đúng danh sách size, tên size và thứ tự của thư viện Vendor. Size bạn tự thêm sẽ bị bỏ; giá size và giá customize đã nhập cho các dòng của thư viện vẫn được giữ."
          onConfirm={() => { onRestoreFromLibrary(pt.id); setConfirmRestore(false); }}
          onClose={() => setConfirmRestore(false)} />
      )}
    </section>
  );
}
