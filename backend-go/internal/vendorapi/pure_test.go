package vendorapi

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

// validate() là hàng rào ghi của vendors — cột không nằm trong writable phải
// bị BỎ ÂM THẦM (không lỗi), vì client có thể gửi cả các cột chỉ-đọc như id,
// deleted_at, created_at lẫn trong payload.
func TestValidateBoQuaCotKhongTrongWritable(t *testing.T) {
	in := map[string]any{"id": 999.0, "deleted_at": "2026-01-01", "name": "Vendor A"}
	out, v := validate(in, true)

	if v.Failed() {
		t.Fatalf("không được lỗi: %v", v.Fields())
	}
	if _, ok := out["id"]; ok {
		t.Error("id không phải cột ghi được, phải bị loại")
	}
	if out["name"] != "Vendor A" {
		t.Errorf("name = %v", out["name"])
	}
}

func TestValidateTaoMoiThieuProductTypeVendorTypeBiLoi(t *testing.T) {
	_, v := validate(map[string]any{}, false)

	if !v.Failed() {
		t.Fatal("tạo mới thiếu product_type/vendor_type phải lỗi")
	}
	if len(v.Fields()["product_type"]) == 0 || len(v.Fields()["vendor_type"]) == 0 {
		t.Errorf("fields = %v", v.Fields())
	}
}

// Update là PARTIAL: không gửi product_type/vendor_type thì KHÔNG lỗi, khác
// hẳn Store.
func TestValidateCapNhatKhongBatBuocProductType(t *testing.T) {
	_, v := validate(map[string]any{"name": "A"}, true)
	if v.Failed() {
		t.Fatalf("update một phần không được lỗi: %v", v.Fields())
	}
}

func TestValidateVendorTypeChiNhanBaGiaTri(t *testing.T) {
	for _, ok := range []string{"Old", "New", "Best Seller"} {
		if _, v := validate(map[string]any{"vendor_type": ok}, true); v.Failed() {
			t.Errorf("vendor_type=%q phải hợp lệ: %v", ok, v.Fields())
		}
	}
	if _, v := validate(map[string]any{"vendor_type": "Loại lạ"}, true); !v.Failed() {
		t.Error("vendor_type lạ phải bị từ chối")
	}
}

func TestValidateGiaAmBiTuChoi(t *testing.T) {
	_, v := validate(map[string]any{"pricing1": -5.0}, true)
	if !v.Failed() {
		t.Fatal("giá âm phải bị từ chối")
	}
}

func TestValidateGiaKhongPhaiSoBiTuChoi(t *testing.T) {
	_, v := validate(map[string]any{"eco_total": "không phải số"}, true)
	if !v.Failed() {
		t.Fatal("giá không phải số phải bị từ chối")
	}
}

// Chuỗi quá 255 ký tự bị từ chối, NHƯNG chỉ ở các cột có giới hạn — cột notes
// (TEXT) không giới hạn 255.
func TestValidateChuoiQuaDaiBiTuChoiChiOCacCotCoGioiHan(t *testing.T) {
	long := strings.Repeat("a", 256)

	if _, v := validate(map[string]any{"name": long}, true); !v.Failed() {
		t.Error("name quá dài phải bị từ chối")
	}
	if _, v := validate(map[string]any{"notes": long}, true); v.Failed() {
		t.Error("notes không giới hạn 255, không được từ chối")
	}
}

func TestValidateMediaUrlsDuocMaHoaThanhJson(t *testing.T) {
	out, v := validate(map[string]any{"media_urls": []any{"a.jpg", "b.jpg"}}, true)
	if v.Failed() {
		t.Fatalf("không được lỗi: %v", v.Fields())
	}
	raw, ok := out["media_urls"].([]byte)
	if !ok || string(raw) != `["a.jpg","b.jpg"]` {
		t.Errorf("media_urls = %v", out["media_urls"])
	}
}

// ── insert / update ──────────────────────────────────────────────────────

func TestInsertSapXepCotDeXacDinh(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Cột phải theo thứ tự bảng chữ cái (sort.Strings) để câu SQL sinh ra ổn
	// định — không phụ thuộc thứ tự duyệt map, vốn ngẫu nhiên trong Go.
	mock.ExpectExec("INSERT INTO vendors \\(name,vendor_type\\) VALUES \\(\\?,\\?\\)").
		WithArgs("A", "Old").
		WillReturnResult(sqlmock.NewResult(7, 1))

	id, err := insert(context.Background(), db, "vendors", map[string]any{"vendor_type": "Old", "name": "A"})
	if err != nil {
		t.Fatalf("insert lỗi: %v", err)
	}
	if id != 7 {
		t.Errorf("id = %d, muốn 7", id)
	}
}

func TestUpdateSapXepCotVaThemIdCuoiCung(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectExec("UPDATE vendors SET name=\\?,vendor_type=\\? WHERE id=\\?").
		WithArgs("A", "Old", int64(5)).
		WillReturnResult(sqlmock.NewResult(0, 1))

	if err := update(context.Background(), db, "vendors", 5, map[string]any{"vendor_type": "Old", "name": "A"}); err != nil {
		t.Fatalf("update lỗi: %v", err)
	}
}

// ── number / positiveInt ─────────────────────────────────────────────────

func TestNumberXuDuCacDangGuiLenTuJson(t *testing.T) {
	if n, ok := number(6.5); !ok || n != 6.5 {
		t.Errorf("float64: %v %v", n, ok)
	}
	if n, ok := number("6.5"); !ok || n != 6.5 {
		t.Errorf("string: %v %v", n, ok)
	}
	if _, ok := number("không phải số"); ok {
		t.Error("chuỗi rác phải trả ok=false")
	}
	if _, ok := number(nil); ok {
		t.Error("nil phải trả ok=false")
	}
}

func TestPositiveIntChiNhanSoDuong(t *testing.T) {
	if n, ok := positiveInt(5.0); !ok || n != 5 {
		t.Errorf("5.0: %v %v", n, ok)
	}
	if _, ok := positiveInt(0.0); ok {
		t.Error("0 không phải số dương")
	}
	if _, ok := positiveInt(-1.0); ok {
		t.Error("số âm phải bị từ chối")
	}
	if _, ok := positiveInt(5.5); ok {
		t.Error("số thập phân không phải id hợp lệ")
	}
}

// đảm bảo insert/update thoả mãn interface execer qua *sql.DB thật (compile-time).
var _ execer = (*sql.DB)(nil)
