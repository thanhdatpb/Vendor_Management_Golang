// ════════════════════════════════════════════════════════
//  SUMMARY FOOTER — spec §3.7
//  Sticky bottom: khoảng giá + badge avg margin theo ngưỡng;
//  trạng thái tự lưu + nút chốt mốc phiên bản.
//
//  `dirty` ở đây = khác MỐC PHIÊN BẢN gần nhất, không phải "chưa lưu": nội
//  dung đã được autosave đẩy lên server liên tục, nên nút Lưu chỉ còn một
//  việc là chốt một mốc trong Lịch sử tính giá. Nhờ tách hai khái niệm này
//  mà bấm Lưu hai lần liên tiếp không đẻ ra hai phiên bản giống hệt nhau.
// ════════════════════════════════════════════════════════
import { PS, marginTone } from './tokens';
import { Btn, Badge } from './primitives';
import { usd, pct } from '../../../utils/pricingEngine';
import AutosaveStatus from './AutosaveStatus';

export default function SummaryFooter({
  summary, dirty, saving, onCancel, onSave,
  autosaveStatus, unsynced = false,
}) {
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
      <AutosaveStatus status={autosaveStatus} unsynced={unsynced} />
      <Btn variant="ghost" onClick={onCancel}>Đóng bảng</Btn>
      <Btn variant="primary" onClick={onSave} disabled={!dirty || saving}
        title={dirty
          ? 'Chốt nội dung hiện tại thành một mốc trong Lịch sử tính giá'
          : 'Nội dung chưa đổi so với mốc phiên bản gần nhất'}
        style={{ padding: '9px 22px' }}>
        {saving ? 'Đang lưu…' : 'Lưu bảng tính giá'}
      </Btn>
    </div>
  );
}
