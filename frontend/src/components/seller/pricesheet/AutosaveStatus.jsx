// ════════════════════════════════════════════════════════
//  TRẠNG THÁI TỰ LƯU — dòng chữ nhỏ kiểu Google Docs ở footer.
//
//  Vì sao phải hiện: autosave chạy ngầm, người dùng không có cách nào biết
//  nội dung đã lên server hay chưa. Im lặng thì Seller vẫn phải đoán — đúng
//  nỗi bất an khiến họ bấm "Lưu" 17 lần cho một bảng.
// ════════════════════════════════════════════════════════
import { PS } from './tokens';

const fmtClock = (d) => {
  try {
    return new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

/**
 * @param {{state: 'idle'|'saving'|'saved'|'error'|'conflict', savedAt?: Date}} status
 * @param {boolean} unsynced có thay đổi chưa lên server không
 */
export default function AutosaveStatus({ status, unsynced }) {
  const { state, savedAt } = status || {};

  let text = '';
  let color = PS.textMuted;

  if (state === 'saving') {
    text = 'Đang lưu…';
  } else if (state === 'error') {
    text = '⚠ Chưa lưu được — bản nháp đang giữ ở máy này';
    color = PS.warning;
  } else if (state === 'conflict') {
    text = '⚠ Tạm dừng tự lưu — cần xử lý xung đột phiên bản';
    color = PS.negative;
  } else if (unsynced) {
    text = 'Đang chờ lưu…';
  } else if (state === 'saved' && savedAt) {
    text = `Đã tự lưu lúc ${fmtClock(savedAt)}`;
    color = PS.positive;
  } else {
    text = 'Tự lưu đang bật';
  }

  return (
    <span data-testid="autosave-status" role="status" aria-live="polite"
      style={{ fontSize: 12, fontWeight: 600, color, whiteSpace: 'nowrap' }}>
      {text}
    </span>
  );
}
