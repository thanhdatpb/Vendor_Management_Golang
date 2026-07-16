// ════════════════════════════════════════════════════════
//  SUMMARY FOOTER — spec §3.7
//  Sticky bottom: khoảng giá + badge avg margin theo ngưỡng;
//  nút Lưu có dirty-check + loading state.
// ════════════════════════════════════════════════════════
import { PS, marginTone } from './tokens';
import { Btn, Badge } from './primitives';
import { usd, pct } from '../../../utils/pricingEngine';

export default function SummaryFooter({ summary, dirty, saving, onCancel, onSave }) {
  return (
    <div style={{
      padding: '12px 20px', borderTop: `1px solid ${PS.border}`, background: PS.bgSurface,
      boxShadow: PS.shadowUp, flexShrink: 0,
      display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center',
    }}>
      {summary.avgMargin != null && (
        <div style={{
          marginRight: 'auto', display: 'flex', gap: 12, alignItems: 'center',
          fontSize: 13, color: PS.textSecondary, fontVariantNumeric: 'tabular-nums', flexWrap: 'wrap',
        }}>
          <span>Khoảng giá{' '}
            <b style={{ color: PS.text, fontWeight: 700 }}>{usd(summary.minPrice)} – {usd(summary.maxPrice)}</b>
          </span>
          <Badge tone={marginTone(summary.avgMargin)}>Avg margin {pct(summary.avgMargin, 1)}</Badge>
        </div>
      )}
      <Btn variant="ghost" onClick={onCancel}>Hủy</Btn>
      <Btn variant="primary" onClick={onSave} disabled={!dirty || saving}
        title={!dirty ? 'Chưa có thay đổi nào để lưu' : undefined}
        style={{ padding: '9px 22px' }}>
        {saving ? 'Đang lưu…' : 'Lưu bảng tính giá'}
      </Btn>
    </div>
  );
}
