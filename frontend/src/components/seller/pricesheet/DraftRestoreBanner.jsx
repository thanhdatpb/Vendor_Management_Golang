// ════════════════════════════════════════════════════════
//  BANNER KHÔI PHỤC BẢN NHÁP
//
//  Hiện khi máy này còn nháp chưa lên được server (mất mạng / đóng tab giữa
//  chừng) và nội dung nháp KHÁC bản vừa tải về. Không bao giờ tự nạp đè:
//  nháp có thể cũ hơn bản người khác đã lưu — im lặng nạp đè chính là kiểu
//  mất dữ liệu mà mục 16 đã chặn ở tầng server.
// ════════════════════════════════════════════════════════
import { PS } from './tokens';
import { Btn } from './primitives';
import { fmtVNDateTime } from '../../../utils/vnTime';

export default function DraftRestoreBanner({ draft, stale, onRestore, onDiscard }) {
  if (!draft) return null;

  return (
    <div role="alert" style={{
      margin: '8px 20px 0', padding: '10px 14px', borderRadius: 10,
      background: stale ? PS.negativeBg : PS.warningBg,
      border: `1px solid ${stale ? PS.negative : PS.warning}`,
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0,
    }}>
      <div style={{ flex: 1, minWidth: 220, fontSize: 13, lineHeight: 1.6, color: PS.text }}>
        <b>Có bản nháp chưa lưu ở máy này</b>
        {draft.savedAt ? ` — lúc ${fmtVNDateTime(draft.savedAt)}` : ''}.
        {stale
          ? ' Bản trên server đã mới hơn bản nháp này, khôi phục sẽ ghi đè bằng nội dung cũ hơn.'
          : ' Khôi phục để tiếp tục đúng chỗ đang làm dở.'}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn variant="ghost" size="sm" onClick={onDiscard}>Bỏ nháp</Btn>
        <Btn variant="primary" size="sm" onClick={onRestore}>Khôi phục bản nháp</Btn>
      </div>
    </div>
  );
}
