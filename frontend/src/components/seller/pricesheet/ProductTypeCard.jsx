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
import ProductTypeInfoStrip from './ProductTypeInfoStrip';
import { SHIP_METHODS, shipMethodLabel } from '../../../utils/vendorLibraryIndex';
import { usd } from '../../../utils/pricingEngine';

const labelStyle = { fontSize: 11.5, fontWeight: 650, color: PS.textSecondary, whiteSpace: 'nowrap' };
const warnBadgeStyle = { cursor: 'help', border: `1px solid ${PS.accentBorder}` };

/** "$13.70" hoặc "$13.70–15.20" — khoảng Total (Fulfill) của một phương thức. */
const priceRange = (o) => (o.min === o.max ? usd(o.min) : `${usd(o.min)}–${Number(o.max).toFixed(2)}`);

/**
 * Bộ chọn Ship Method — vẽ theo `pt.shipMethodState` do resolveSheet gắn:
 *   single / switched → chip khoá, Seller không phải bấm (phôi chỉ có giá ở 1 phương thức);
 *   chosen / needs-choice → chỉ các phương thức CÓ Total, kèm khoảng giá trên nút;
 *   none → không có Total ở đâu cả, Item Cost đang tạm dùng P1.
 * PT nhập tay / mất record nguồn (không có `shipMethodOptions`) giữ bộ chọn cũ đủ 5 phương thức.
 */
function ShipMethodControl({ pt, libEntry, onChange }) {
  const options = pt.shipMethodOptions;
  const state = pt.shipMethodState;
  const wrap = (children) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={labelStyle}>Ship Method</span>
      {children}
    </div>
  );

  if (!Array.isArray(options)) {
    return wrap(<>
      <Segmented label="Ship Method" options={SHIP_METHODS} value={pt.shipMethod} onChange={onChange} />
      {libEntry && !pt.shipMethod && (
        <Badge tone="warning" style={warnBadgeStyle}
          title="Chọn một phương thức ship để nạp giá vốn (Item Cost) từ thư viện vendor.">Chưa chọn</Badge>
      )}
    </>);
  }

  if (state === 'none') {
    return wrap(
      <Badge tone="warning" style={warnBadgeStyle}
        title="Thư viện Vendor chưa có Total (fulfill) ở phương thức ship nào cho phôi này. Item Cost đang tạm lấy cột P1 — CHƯA gồm ship.">
        Chưa có Total (fulfill) · tạm dùng P1
      </Badge>
    );
  }

  if (options.length === 1) {
    const only = options[0];
    return wrap(<>
      <span title={`Thư viện chỉ có Total (fulfill) ở ${only.label} — tự áp dụng, không cần chọn.`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 9,
          fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'help',
          background: PS.brandSubtle, border: `1px solid ${PS.brandBorder}`, color: PS.brandDeep,
        }}>
        ✓ {only.label}
      </span>
      {state === 'switched' && (
        <Badge tone="warning" style={warnBadgeStyle}
          title={`Thư viện không còn Total (fulfill) ở ${shipMethodLabel(pt.shipMethodPrevious) || pt.shipMethodPrevious} cho phôi này — đã chuyển sang ${only.label}.`}>
          Đã chuyển {shipMethodLabel(pt.shipMethodPrevious) || pt.shipMethodPrevious} → {only.label}
        </Badge>
      )}
    </>);
  }

  const previous = state === 'needs-choice' ? shipMethodLabel(pt.shipMethodPrevious) : '';
  return wrap(<>
    <Segmented label="Ship Method" value={pt.shipMethod} onChange={onChange}
      options={options.map((o) => ({ key: o.key, label: o.label, hint: priceRange(o) }))} />
    {state === 'needs-choice' && (
      <Badge tone="warning" style={warnBadgeStyle}
        title={previous
          ? `Thư viện không còn Total (fulfill) ở ${previous} — chọn lại một phương thức để nạp Item Cost.`
          : `Phôi có Total (fulfill) ở ${options.length} phương thức — chọn một để nạp Item Cost.`}>
        {previous ? `Không còn giá ${previous} · chọn lại` : `Chọn 1 trong ${options.length}`}
      </Badge>
    )}
  </>);
}

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
  // Size thiếu Total ở Ship Method đang áp dụng. Lúc CHƯA chọn phương thức thì
  // mọi size đều "thiếu" — khi đó badge "Chọn 1 trong N" đã nói đủ, không đếm.
  const missingCount = pt.shipMethodState && pt.shipMethodState !== 'needs-choice'
    ? (pt.sizes || []).filter((sz) => sz.isLib && sz.costMissing).length
    : 0;

  return (
    <section aria-label={`Product type ${pt.name || 'chưa đặt tên'}`} style={{
      flexShrink: 0, /* BẮT BUỘC — xem ghi chú đầu file */
      background: PS.bgSurface, border: `1px solid ${PS.border}`, borderRadius: 12,
      boxShadow: PS.shadowCard, overflow: 'hidden',
    }}>
      {/* ── Dải thông tin phôi — đúng một dòng của bảng Thư viện Vendor ──
          Chỉ có với PT lấy từ thư viện; PT nhập thủ công không có gì để tra. */}
      <ProductTypeInfoStrip vendorName={vendorLabel} productType={pt.name} info={libEntry} />

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

        {/* Ship Method — tự nhận diện theo cột Total (Fulfill) có dữ liệu (xem
            resolveShipMethod trong utils/resolveSheet.js). */}
        <ShipMethodControl pt={pt} libEntry={libEntry}
          onChange={(key) => onPT(pt.id, { shipMethod: key })} />

        {missingCount > 0 && (
          <Badge tone="negative" style={{ cursor: 'help' }}
            title={`${missingCount} size không có Total (fulfill) ở ${shipMethodLabel(pt.shipMethod)} trong thư viện Vendor — Item Cost trống, Profit/Margin của các size này chưa tính được và không tính vào Avg margin.`}>
            {missingCount} size thiếu giá {shipMethodLabel(pt.shipMethod)}
          </Badge>
        )}

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
