// ════════════════════════════════════════════════════════
//  PRICE SHEET VIEWER — Admin xem bảng tính giá của Seller (chỉ đọc).
//
//  Cố ý KHÔNG tái dùng PriceSheetWorkspace (bảng biên tập của Seller): mọi ô ở
//  đó là input có onChange nối thẳng vào state Seller, biến nó thành readonly
//  cần luồn prop qua PriceSettingPanel/ProductTypeCard/PriceTable — rủi ro
//  Admin lỡ tay đổi bảng Seller trong lúc chỉ đứng xem. Modal này dựng bằng
//  <table> + <span> thuần, không có input nào — không có gì để sửa nhầm.
//
//  Dùng chung tokens/primitives của pricesheet (PS.*) để nhìn đồng bộ với
//  giao diện bảng giá của Seller, dù là 2 component khác nhau.
// ════════════════════════════════════════════════════════
import { useMemo } from 'react';
import { PS, marginTone } from '../../seller/pricesheet/tokens';
import { PsStyles, Btn, IconBtn, Badge } from '../../seller/pricesheet/primitives';
import { computeSizeRow, summarizeSheet, usd, pct, SETTING_FIELDS } from '../../../utils/pricingEngine';
import { exportSheetToExcel } from '../../../utils/sheetExport';
import { PROJECTS } from '../../../constants/projects';

const projectLabel = (key) => PROJECTS.find((p) => p.id === key)?.label || key || '—';

/** Ô số 1 dòng, dùng lại cho cả header Price Setting lẫn từng cột trong bảng size. */
function Num({ label, value, tone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 92 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: PS.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 650, color: tone || PS.text, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function SettingsBar({ settings }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 18, padding: '12px 16px',
      background: PS.bgSubtle, borderBottom: `1px solid ${PS.border}`,
    }}>
      {SETTING_FIELDS.map((f) => (
        <Num key={f.key} label={`${f.icon} ${f.label}`}
          value={f.unit === '$' ? usd(settings?.[f.key] || 0) : f.unit === '%' ? pct(settings?.[f.key] || 0) : `${settings?.[f.key] || 0} ${f.unit}`} />
      ))}
    </div>
  );
}

function ProductTypeTable({ pt, settings }) {
  const customizeInfos = pt.customizeInfos || [];
  const sizes = pt.sizes || [];

  return (
    <section style={{
      flexShrink: 0, background: PS.bgSurface, border: `1px solid ${PS.border}`,
      borderRadius: 12, boxShadow: PS.shadowCard, overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        padding: '10px 16px', background: PS.accentBg, borderBottom: `1px solid ${PS.accentSoft}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ borderLeft: `4px solid ${PS.accentBar}`, paddingLeft: 10, fontWeight: 650, fontSize: 15, color: PS.text }}>
          {pt.name || 'Chưa đặt tên'}
        </div>
        {pt.phoi !== undefined && pt.phoi !== '' && (
          <Badge>Phôi {usd(pt.phoi)}</Badge>
        )}
        <Badge>{sizes.length} size</Badge>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="ps-table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              {['Size', 'Size Add', 'Item Cost', ...customizeInfos.map((c) => c.name), 'Unit Price', 'Total Price', 'Total Cost', 'Profit', 'Margin'].map((h) => (
                <th key={h} style={{
                  padding: '8px 10px', fontSize: 11, fontWeight: 700, color: PS.textSecondary,
                  textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right', whiteSpace: 'nowrap',
                  borderBottom: `1px solid ${PS.border}`, background: PS.bgSubtle,
                }}>{h === 'Size' ? <span style={{ textAlign: 'left', display: 'block' }}>{h}</span> : h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizes.map((sz, i) => {
              const r = computeSizeRow(settings, pt, sz);
              const tone = marginTone(r.margin);
              return (
                <tr key={sz.id || i} className="ps-tr">
                  <td style={{ padding: '8px 10px', fontWeight: 650, fontSize: 13, color: PS.text, textAlign: 'left' }}>{sz.label || '—'}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{usd(sz.sizeAdd || 0)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{usd(sz.itemCost || 0)}</td>
                  {customizeInfos.map((c) => (
                    <td key={c.id} style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                      {usd(sz.customize?.[c.id] || 0)}
                    </td>
                  ))}
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: PS.textSecondary }}>{usd(r.unitPrice)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 650 }}>{usd(r.totalPrice)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: PS.textSecondary }}>{usd(r.totalCost)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, color: r.profit >= 0 ? PS.positive : PS.negative }}>{usd(r.profit)}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 700, color: toneColorOf(tone) }}>{pct(r.margin, 1)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function toneColorOf(tone) {
  return tone === 'positive' ? PS.positive : tone === 'warning' ? PS.warning : tone === 'negative' ? PS.negative : PS.textMuted;
}

/**
 * @param {object} sheet — bảng ĐẦY ĐỦ (từ priceSheetApi.get(id)), không phải
 *   dòng tổng hợp trong danh sách.
 */
export default function PriceSheetViewerModal({ sheet, onClose, onOpenHistory, showToast }) {
  const summary = useMemo(() => summarizeSheet(sheet), [sheet]);
  const mTone = marginTone(summary.avgMargin);

  return (
    <div className="ps-overlay" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="ps-scope" style={{
        width: 'min(1100px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        background: PS.bgApp, borderRadius: 16, overflow: 'hidden', boxShadow: PS.shadowModal, color: PS.text,
      }}>
        <PsStyles />

        <div style={{
          padding: '14px 20px', background: PS.bgSurface, borderBottom: `1px solid ${PS.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: 1, borderLeft: `4px solid ${PS.accentBar}`, paddingLeft: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: PS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {sheet.name || 'Bảng tính giá'}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <Badge>{projectLabel(sheet.project)}</Badge>
              {sheet.vendorRef && <Badge>{sheet.vendorRef}</Badge>}
              <Badge>{summary.count} size</Badge>
              {summary.avgMargin != null && <Badge tone={mTone}>avg margin {pct(summary.avgMargin, 1)}</Badge>}
              {sheet.createdBy && <Badge>tạo bởi {sheet.createdBy}</Badge>}
              {sheet.updatedBy && <Badge>cập nhật bởi {sheet.updatedBy}</Badge>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <Btn variant="outline" onClick={() => onOpenHistory(sheet)}>Lịch sử phiên bản</Btn>
            <Btn variant="outline" onClick={() => exportSheetToExcel(sheet, showToast)}>⬇ Export Excel</Btn>
            <IconBtn title="Đóng" onClick={onClose}>✕</IconBtn>
          </div>
        </div>

        <SettingsBar settings={sheet.settings} />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
          {(sheet.productTypes || []).filter((pt) => pt.shown !== false).map((pt) => (
            <ProductTypeTable key={pt.id} pt={pt} settings={sheet.settings} />
          ))}
          {(!sheet.productTypes || sheet.productTypes.length === 0) && (
            <div style={{ textAlign: 'center', color: PS.textMuted, padding: 40 }}>Bảng chưa có Product Type nào.</div>
          )}
        </div>

        <div style={{
          padding: '10px 20px', borderTop: `1px solid ${PS.border}`, background: PS.bgSurface,
          fontSize: 12, color: PS.textMuted, textAlign: 'center',
        }}>
          Chỉ xem — Admin không sửa hay xoá bảng tính giá của Seller ở đây.
        </div>
      </div>
    </div>
  );
}
