package pricing

import (
	"strings"
	"testing"
	"time"
)

// Điểm quan trọng nhất của file này: chuỗi ghi vào cột saved_at KHÔNG được còn
// hậu tố Z. MySQL strict ném 1292 Incorrect datetime value, còn SQLite thì nhận
// — nên nếu bộ test chạy SQLite thì lỗi này không bao giờ lộ ra.
func TestSnapshotColumnKhongConHauToZ(t *testing.T) {
	got := SnapshotColumn("2026-08-18T07:52:00.123Z")

	if got != "2026-08-18 07:52:00" {
		t.Errorf("= %q, muốn \"2026-08-18 07:52:00\"", got)
	}
	if strings.ContainsAny(got, "TZ") {
		t.Errorf("%q còn ký tự T hoặc Z — MySQL strict sẽ ném 1292", got)
	}
}

func TestSnapshotColumnNhanMoiDangThucTe(t *testing.T) {
	cases := map[string]string{
		"2026-08-18T07:52:00.123Z": "2026-08-18 07:52:00",
		"2026-08-18T07:52:00Z":     "2026-08-18 07:52:00",
		"2026-08-18 07:52:00":      "2026-08-18 07:52:00",
		"2026-08-18T07:52:00":      "2026-08-18 07:52:00",
		"  2026-08-18T07:52:00Z  ": "2026-08-18 07:52:00",
		// Offset thật được quy về UTC, không giữ nguyên giờ địa phương.
		"2026-08-18T14:52:00+07:00": "2026-08-18 07:52:00",
	}

	for in, want := range cases {
		if got := SnapshotColumn(in); got != want {
			t.Errorf("SnapshotColumn(%q) = %q, muốn %q", in, got, want)
		}
	}
}

// Chuỗi rác hoặc rỗng lấy thời điểm hiện tại: mất một mốc chính xác vẫn hơn là
// làm hỏng cả lần lưu của Seller.
func TestSnapshotColumnRacThiLayHienTai(t *testing.T) {
	fixed := time.Date(2026, 9, 26, 10, 30, 0, 0, time.UTC)
	original := now
	now = func() time.Time { return fixed }
	defer func() { now = original }()

	for _, in := range []string{"", "   ", "abc", "không phải ngày"} {
		if got := SnapshotColumn(in); got != "2026-09-26 10:30:00" {
			t.Errorf("SnapshotColumn(%q) = %q, muốn mốc hiện tại", in, got)
		}
	}
}

// Khoá so trùng phải quy ISO-8601 và dạng MySQL của CÙNG một mốc về một chuỗi.
// Không có tính chất này thì client cũ gửi lại cả 20 snapshot sẽ tạo bản trùng.
func TestSnapshotKeyGopDuocHaiDangCuaCungMotMoc(t *testing.T) {
	fromClient := SnapshotKey("2026-08-18T07:52:00.123Z")
	fromDB := SnapshotKey("2026-08-18 07:52:00")

	if fromClient != fromDB {
		t.Errorf("khoá lệch nhau: client %q, DB %q", fromClient, fromDB)
	}
}

// Khác SnapshotColumn: chuỗi không parse được thì GIỮ NGUYÊN, không thay bằng
// thời điểm hiện tại — nếu thay, mọi snapshot rác sẽ mang khoá khác nhau ở mỗi
// lần chạy và không bao giờ khử trùng được.
func TestSnapshotKeyGiuNguyenChuoiKhongParseDuoc(t *testing.T) {
	for _, in := range []string{"", "abc", "rác"} {
		if got := SnapshotKey(in); got != in {
			t.Errorf("SnapshotKey(%q) = %q, muốn giữ nguyên", in, got)
		}
	}
}

// Khoá phải so sánh được theo thứ tự chuỗi: handler upsert dùng phép so < để bỏ
// qua snapshot cũ hơn bản mới nhất đang lưu.
func TestSnapshotKeySoSanhDuocTheoThuTuChuoi(t *testing.T) {
	older := SnapshotKey("2026-08-18T07:52:00Z")
	newer := SnapshotKey("2026-08-18T09:15:00Z")

	if !(older < newer) {
		t.Errorf("%q phải nhỏ hơn %q khi so chuỗi", older, newer)
	}
}
