// ════════════════════════════════════════════════════════
//  PAYLOAD GỬI LÊN POST /price-sheets — phần thuần, test được không cần mạng.
//
//  Ba cờ đi kèm một lượt ghi, mỗi cờ một hệ quả rõ ràng ở server:
//    • expectedVersion — version đọc được lúc mở bảng; lệch → 409 (mục 16).
//    • force           — người dùng đã xem cảnh báo và cố ý ghi đè.
//    • autosave        — lượt ghi ngầm khi Seller đang gõ. Payload KHÔNG kèm
//      `history`, nên PriceSheetController::storeVersions() thoát sớm và
//      KHÔNG tạo phiên bản mới. Đây là lý do autosave chạy mỗi vài giây mà
//      lịch sử không phình: trần 20 bản, ghi rác vào đó là đẩy mốc thật ra.
// ════════════════════════════════════════════════════════

export function buildPriceSheetPayload(sheet, { force = false, autosave = false } = {}) {
  const source = sheet || {};
  // eslint: `_history` chỉ để LOẠI trường này khỏi payload autosave.
  const { history: _history, ...content } = source;

  return {
    ...(autosave ? content : source),
    ...(source.version ? { expectedVersion: source.version } : {}),
    ...(force ? { force: true } : {}),
    ...(autosave ? { autosave: true } : {}),
  };
}
