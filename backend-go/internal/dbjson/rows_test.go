package dbjson

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"vendorhub/internal/httpx"
)

// dbjson là chỗ các cast của Eloquent được tái hiện. Sai ở đây nghĩa là JSON
// trả về khác bản PHP ở đúng những cột mà frontend đọc nhiều nhất: 12 cột giá
// float của vendors và các cột JSON của products.

func queryRows(t *testing.T, columns []string, values [][]any, casts map[string]Cast) []map[string]any {
	t.Helper()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("tạo sqlmock lỗi: %v", err)
	}
	defer db.Close()

	result := sqlmock.NewRows(columns)
	for _, row := range values {
		cells := make([]driver.Value, len(row))
		for i, cell := range row {
			cells[i] = cell
		}
		result = result.AddRow(cells...)
	}
	mock.ExpectQuery("SELECT").WillReturnRows(result)

	rows, err := db.Query("SELECT 1")
	if err != nil {
		t.Fatalf("query lỗi: %v", err)
	}
	defer rows.Close()

	out, err := Rows(rows, casts)
	if err != nil {
		t.Fatalf("Rows lỗi: %v", err)
	}
	return out
}

// Cột float của vendors phải ra 1.0 chứ không phải 1 — đây là điểm json_encode
// của PHP khác encoding/json của Go.
func TestCastFloatGiuPhanThapPhanGiongPhp(t *testing.T) {
	rows := queryRows(t,
		[]string{"pricing1", "eco_total", "fast_price"},
		[][]any{{"6", "10.70", nil}},
		map[string]Cast{"pricing1": Float, "eco_total": Float, "fast_price": Float},
	)

	encoded, err := json.Marshal(rows[0])
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}

	var back map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &back); err != nil {
		t.Fatalf("unmarshal lỗi: %v", err)
	}
	if string(back["pricing1"]) != "6.0" {
		t.Errorf("pricing1 = %s, muốn 6.0", back["pricing1"])
	}
	if string(back["eco_total"]) != "10.7" {
		t.Errorf("eco_total = %s, muốn 10.7", back["eco_total"])
	}
	// NULL vẫn là null, không phải 0.0.
	if string(back["fast_price"]) != "null" {
		t.Errorf("fast_price = %s, muốn null", back["fast_price"])
	}
}

func TestCastIntegerVaBoolean(t *testing.T) {
	rows := queryRows(t,
		[]string{"id", "is_active", "is_read", "khac"},
		[][]any{{"42", "1", "0", "true"}},
		map[string]Cast{"id": Integer, "is_active": Boolean, "is_read": Boolean, "khac": Boolean},
	)

	if rows[0]["id"] != int64(42) {
		t.Errorf("id = %#v, muốn int64(42)", rows[0]["id"])
	}
	if rows[0]["is_active"] != true {
		t.Errorf("is_active = %#v, muốn true", rows[0]["is_active"])
	}
	if rows[0]["is_read"] != false {
		t.Errorf("is_read = %#v, muốn false", rows[0]["is_read"])
	}
	// MySQL trả "1"/"0", nhưng driver khác có thể trả "true".
	if rows[0]["khac"] != true {
		t.Errorf("khac = %#v, muốn true", rows[0]["khac"])
	}
}

// Cột JSON (media_urls, assigned_vendors, pd_projects) phải được decode thành
// cấu trúc thật, không trả về chuỗi JSON.
func TestCastJsonDecodeThanhCauTrucThat(t *testing.T) {
	rows := queryRows(t,
		[]string{"media_urls", "pd_projects", "hong"},
		[][]any{{`["a.jpg","b.jpg"]`, `{"happy":true}`, `khong phai json`}},
		map[string]Cast{"media_urls": JSON, "pd_projects": JSON, "hong": JSON},
	)

	list, ok := rows[0]["media_urls"].([]any)
	if !ok || len(list) != 2 || list[0] != "a.jpg" {
		t.Errorf("media_urls = %#v", rows[0]["media_urls"])
	}
	object, ok := rows[0]["pd_projects"].(map[string]any)
	if !ok || object["happy"] != true {
		t.Errorf("pd_projects = %#v", rows[0]["pd_projects"])
	}
	// JSON hỏng thì về nil, không làm vỡ cả response.
	if rows[0]["hong"] != nil {
		t.Errorf("cột JSON hỏng = %#v, muốn nil", rows[0]["hong"])
	}
}

// Cột thời gian phải serialize theo đúng dạng Eloquent: 6 chữ số micro + chữ Z.
func TestCastLaravelTimeRaDungDangEloquent(t *testing.T) {
	rows := queryRows(t,
		[]string{"created_at", "deleted_at"},
		[][]any{{"2026-09-26 10:00:00", nil}},
		map[string]Cast{"created_at": LaravelTime, "deleted_at": LaravelTime},
	)

	encoded, err := json.Marshal(rows[0])
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}

	var back map[string]json.RawMessage
	_ = json.Unmarshal(encoded, &back)
	if string(back["created_at"]) != `"2026-09-26T10:00:00.000000Z"` {
		t.Errorf("created_at = %s", back["created_at"])
	}
	if string(back["deleted_at"]) != "null" {
		t.Errorf("deleted_at = %s, muốn null", back["deleted_at"])
	}
}

// Driver trả thẳng time.Time (không phải chuỗi) cũng phải ra cùng định dạng.
func TestGiaTriTimeTuDriverCungRaLaravelTime(t *testing.T) {
	moment := time.Date(2026, 9, 26, 10, 0, 0, 0, time.UTC)

	rows := queryRows(t,
		[]string{"updated_at"},
		[][]any{{moment}},
		map[string]Cast{"updated_at": String}, // cast nào cũng vậy
	)

	if _, ok := rows[0]["updated_at"].(httpx.LaravelTime); !ok {
		t.Fatalf("updated_at = %#v, muốn httpx.LaravelTime", rows[0]["updated_at"])
	}
	encoded, _ := json.Marshal(rows[0]["updated_at"])
	if string(encoded) != `"2026-09-26T10:00:00.000000Z"` {
		t.Errorf("= %s", encoded)
	}
}

// Giá trị không parse được theo cast thì GIỮ NGUYÊN dạng chuỗi thay vì về 0 —
// mất dữ liệu tệ hơn là trả một chuỗi lạ mà người dùng nhìn thấy được.
func TestGiaTriKhongParseDuocThiGiuNguyenChuoi(t *testing.T) {
	rows := queryRows(t,
		[]string{"so_hong", "float_hong"},
		[][]any{{"khong-phai-so", "cung-khong-phai"}},
		map[string]Cast{"so_hong": Integer, "float_hong": Float},
	)

	if rows[0]["so_hong"] != "khong-phai-so" {
		t.Errorf("so_hong = %#v, muốn giữ nguyên chuỗi", rows[0]["so_hong"])
	}
	if rows[0]["float_hong"] != "cung-khong-phai" {
		t.Errorf("float_hong = %#v, muốn giữ nguyên chuỗi", rows[0]["float_hong"])
	}
}

// Cột không khai cast rơi về String, và []byte của driver MySQL phải thành chuỗi.
func TestCotKhongKhaiCastVeChuoi(t *testing.T) {
	rows := queryRows(t,
		[]string{"name", "note"},
		[][]any{{[]byte("Hong Wei"), nil}},
		map[string]Cast{},
	)

	if rows[0]["name"] != "Hong Wei" {
		t.Errorf("name = %#v, muốn chuỗi", rows[0]["name"])
	}
	if rows[0]["note"] != nil {
		t.Errorf("note = %#v, muốn nil", rows[0]["note"])
	}
}

// Không có dòng nào thì ra mảng rỗng, KHÔNG phải nil — frontend duyệt thẳng.
func TestKhongCoDongNaoRaMangRong(t *testing.T) {
	rows := queryRows(t, []string{"id"}, nil, map[string]Cast{"id": Integer})

	if rows == nil {
		t.Fatal("Rows trả nil, muốn mảng rỗng")
	}
	encoded, _ := json.Marshal(rows)
	if string(encoded) != "[]" {
		t.Errorf("= %s, muốn []", encoded)
	}
}

// Lỗi khi duyệt kết quả phải được trả ra, không nuốt im lặng.
func TestLoiKhiDuyetKetQuaDuocTraRa(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("tạo sqlmock lỗi: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery("SELECT").WillReturnRows(
		sqlmock.NewRows([]string{"id"}).AddRow("1").RowError(0, sql.ErrConnDone),
	)

	rows, err := db.Query("SELECT 1")
	if err != nil {
		t.Fatalf("query lỗi: %v", err)
	}
	defer rows.Close()

	if _, err := Rows(rows, nil); err == nil {
		t.Error("Rows phải trả lỗi khi duyệt kết quả thất bại")
	}
}
