// Package httpx giữ các nguyên liệu HTTP dùng chung: kiểu serialize hợp với
// Laravel, envelope lỗi, helper ETag, middleware.
//
// json.go tồn tại vì frontend đã chạy production nhiều tháng trên đúng định dạng
// JSON mà Laravel sinh ra. Go serialize khác ở hai chỗ, và cả hai chỗ đó đều
// không có test nào của dự án bắt được — chúng chỉ lộ ra khi UI hiển thị sai.
package httpx

import (
	"strconv"
	"strings"
	"time"
)

// LaravelTime serialize giống một cột $casts => 'datetime' của Eloquent:
// 2026-09-26T10:00:00.000000Z — 6 chữ số micro, luôn UTC, chữ Z là VĂN BẢN.
//
// time.RFC3339Nano của Go KHÔNG dùng được: nó cắt các số 0 ở cuối phần thập phân
// (10:00:00Z thay vì 10:00:00.000000Z) và in offset thật thay vì Z.
//
// Dùng cho MỌI endpoint đi qua Eloquent. Endpoint đi qua query builder thì dùng
// MySQLTime — xem chú thích ở đó.
type LaravelTime time.Time

// laravelLayout không chứa Z: Z trong layout của Go là ký hiệu offset, không phải
// chữ Z. Chữ Z được nối tay sau khi format.
const laravelLayout = "2006-01-02T15:04:05.000000"

func (t LaravelTime) MarshalJSON() ([]byte, error) {
	if time.Time(t).IsZero() {
		// Cột timestamp NULL trong Laravel ra null, không ra mốc năm 1.
		return []byte("null"), nil
	}
	return []byte(`"` + time.Time(t).UTC().Format(laravelLayout) + `Z"`), nil
}

func (t LaravelTime) String() string {
	if time.Time(t).IsZero() {
		return ""
	}
	return time.Time(t).UTC().Format(laravelLayout) + "Z"
}

// MySQLTime serialize giống giá trị timestamp lấy qua query builder (DB::table):
// 2026-09-26 10:00:00 — nguyên chuỗi MySQL trả về, KHÔNG phải ISO-8601.
//
// Đây không phải lỗi cần sửa: API hiện tại có thật hai định dạng, vì price_sheets
// và vendor_library đọc bằng query builder chứ không qua Eloquent. Frontend đang
// đọc đúng từng dạng, nên "chuẩn hoá" về một dạng là đổi contract.
type MySQLTime time.Time

const mysqlLayout = "2006-01-02 15:04:05"

func (t MySQLTime) MarshalJSON() ([]byte, error) {
	if time.Time(t).IsZero() {
		return []byte("null"), nil
	}
	return []byte(`"` + time.Time(t).UTC().Format(mysqlLayout) + `"`), nil
}

func (t MySQLTime) String() string {
	if time.Time(t).IsZero() {
		return ""
	}
	return time.Time(t).UTC().Format(mysqlLayout)
}

// PHPFloat in số thực giống json_encode của PHP với serialize_precision = -1:
// giá trị nguyên vẫn mang phần thập phân (1.0, không phải 1).
//
// Ảnh hưởng 12 cột giá cast float của bảng vendors. encoding/json của Go in 1,
// nên nếu frontend so chuỗi hoặc đếm ký tự ở đâu đó thì hành vi đổi mà không ai
// báo lỗi.
//
// Giới hạn đã biết: với độ lớn cực đoan (từ 1e15 trở lên) PHP chuyển sang dạng số
// mũ (1.0e+20) còn hàm này in đủ chữ số. Các cột dùng kiểu này đều là tiền nên
// không tới ngưỡng đó; nếu có ngày cần, xử lý ở đây chứ không ở nơi gọi.
type PHPFloat float64

func (f PHPFloat) MarshalJSON() ([]byte, error) {
	return []byte(f.String()), nil
}

func (f PHPFloat) String() string {
	s := strconv.FormatFloat(float64(f), 'f', -1, 64)
	if !strings.ContainsAny(s, ".eE") {
		s += ".0"
	}
	return s
}
