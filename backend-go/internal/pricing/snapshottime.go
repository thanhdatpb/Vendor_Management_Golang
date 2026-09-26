package pricing

import (
	"strings"
	"time"
)

// SnapshotTime xử lý mốc thời gian savedAt của một snapshot bảng tính giá.
// Port của backend/app/Support/SnapshotTime.php.
//
// Client gửi ISO-8601 do new Date().toISOString() sinh ra, dạng
// 2026-08-18T07:52:00.123Z. Ghi thẳng chuỗi đó vào cột saved_at kiểu timestamp:
//
//   - SQLite: nhận, vì cột chỉ có type affinity, không kiểm gì. Test xanh.
//   - MySQL:  hậu tố Z không phải định dạng offset hợp lệ. Với strict (bật sẵn
//     trong config/database.php) sẽ ném 1292 Incorrect datetime value,
//     nên lần Lưu đầu tiên sau deploy trả 500 và command backfill chết
//     ngay bảng đầu tiên có lịch sử.
//
// Nên MỌI giá trị đi vào cột đều phải qua SnapshotColumn. Gom vào một chỗ vì cả
// handler upsert lẫn command backfill đều ghi bảng này — sửa hai nơi là cách để
// một nơi bị bỏ sót.

// dbLayout là định dạng cột saved_at của MySQL.
const dbLayout = "2006-01-02 15:04:05"

// now tách ra để test chốt được nhánh "chuỗi rác thì lấy thời điểm hiện tại".
var now = time.Now

// snapshotLayouts là các dạng thực tế gặp trong dữ liệu: client gửi ISO-8601
// (có hoặc không mili giây, có hoặc không offset) và DB trả về dạng MySQL.
var snapshotLayouts = []string{
	time.RFC3339Nano,
	time.RFC3339,
	"2006-01-02T15:04:05.999999999",
	"2006-01-02T15:04:05",
	dbLayout,
	"2006-01-02",
}

// parseSnapshot quy mọi dạng về UTC. App chạy timezone UTC (config/app.php) nên
// quy về UTC là khớp với mọi mốc thời gian khác mà hệ thống tự ghi.
func parseSnapshot(raw string) (time.Time, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, false
	}

	for _, layout := range snapshotLayouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return t.UTC(), true
		}
	}
	return time.Time{}, false
}

// SnapshotKey là khoá so trùng giữa các snapshot.
//
// saved_at đọc từ DB ra dạng "2006-01-02 15:04:05" còn client gửi ISO-8601 —
// quy cả hai về một dạng để nhận ra CÙNG một lần lưu. Không có bước này thì
// client cũ (gửi lại cả 20 snapshot mỗi lần lưu) sẽ tạo ra bản trùng.
//
// Chuỗi không parse được thì giữ nguyên: nó vẫn là khoá so sánh hợp lệ, chỉ là
// không gộp được với dạng khác của cùng mốc thời gian.
func SnapshotKey(raw string) string {
	if t, ok := parseSnapshot(raw); ok {
		return t.Format(dbLayout)
	}
	return raw
}

// SnapshotColumn là giá trị ghi vào cột saved_at.
//
// Luôn là datetime hợp lệ: chuỗi rác hoặc rỗng thì lấy thời điểm hiện tại, vì
// mất một mốc thời gian chính xác vẫn hơn là làm hỏng cả lần lưu.
func SnapshotColumn(raw string) string {
	if t, ok := parseSnapshot(raw); ok {
		return t.Format(dbLayout)
	}
	return now().UTC().Format(dbLayout)
}
