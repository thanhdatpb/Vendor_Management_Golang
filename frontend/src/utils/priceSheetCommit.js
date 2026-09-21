// ════════════════════════════════════════════════════════
//  LƯU BẢNG TÍNH GIÁ LÊN SERVER — phần thuần, không đụng state danh sách.
//
//  Rút ra từ SetupPriceSection.commitSheet() để PriceSheetPage (mở qua link
//  riêng, không có state danh sách allSheets) dùng lại ĐÚNG logic version-
//  conflict thay vì chép lại. SetupPriceSection giờ gọi hàm này rồi tự lo
//  phần cache/list của nó (persistAllSheets, setAllSheets).
// ════════════════════════════════════════════════════════
import { priceSheetApi } from '../services/api';

/**
 * Lưu một bảng tính giá lên server.
 *
 * `expectedVersion` (nằm sẵn trong `sheet.version`) do priceSheetApi.save tự
 * gắn — lệch với version hiện hành trên server thì ném lỗi 409 kèm bản mới,
 * KHÔNG bị nuốt ở đây: nơi gọi (PriceSheetWorkspace) cần biết để hỏi người
 * dùng ghi đè hay tải lại, thay vì âm thầm mất công của người khác.
 *
 * @param {object} sheet
 * @param {{force?: boolean, autosave?: boolean, showToast?: Function}} [opts]
 * @returns {Promise<object>} bản đã lưu, kèm `version` mới nếu server trả về.
 */
export async function saveSheetToServer(sheet, { force = false, autosave = false, showToast } = {}) {
  try {
    const res = await priceSheetApi.save(sheet, { force, autosave });
    const version = res?.data?.version;
    return version ? { ...sheet, version } : sheet;
  } catch (err) {
    if (err?.response?.status === 409) throw err;

    // Autosave: KHÔNG nuốt lỗi và KHÔNG toast. Scheduler cần biết để thử lại
    // với backoff, còn footer tự hiện "Chưa lưu được — bản nháp giữ ở máy này".
    // Bắn toast đỏ theo từng nhịp gõ lúc rớt mạng thì không ai làm việc nổi.
    if (autosave) throw err;

    console.warn('Lưu bảng tính giá lên server thất bại:', err?.message || err);
    showToast?.('error', 'Lưu thất bại', 'Đã lưu tạm ở máy này. Kiểm tra kết nối / đăng nhập rồi lưu lại.', 4500);
    return sheet;
  }
}
