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
 * @param {{force?: boolean, showToast?: Function}} [opts]
 * @returns {Promise<object>} bản đã lưu, kèm `version` mới nếu server trả về.
 */
export async function saveSheetToServer(sheet, { force = false, showToast } = {}) {
  try {
    const res = await priceSheetApi.save(sheet, { force });
    const version = res?.data?.version;
    return version ? { ...sheet, version } : sheet;
  } catch (err) {
    if (err?.response?.status === 409) throw err;

    console.warn('Lưu bảng tính giá lên server thất bại:', err?.message || err);
    showToast?.('error', 'Lưu thất bại', 'Đã lưu tạm ở máy này. Kiểm tra kết nối / đăng nhập rồi lưu lại.', 4500);
    return sheet;
  }
}
