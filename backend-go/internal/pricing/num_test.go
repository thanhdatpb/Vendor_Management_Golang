package pricing

import (
	"encoding/json"
	"math"
	"testing"
)

// Bộ ca này là bản port của test_num_khop_voi_ham_num_ben_javascript trong
// backend/tests/Unit/PriceSheetSummaryTest.php. Giữ nguyên từng ca: đây là nơi
// duy nhất chứng minh Num của Go hiểu đầu vào bẩn giống parseFloat của JS.
func TestNumKhopVoiBanJavaScript(t *testing.T) {
	cases := []struct {
		name string
		in   any
		want float64
	}{
		{"nil", nil, 0},
		{"chuoi rong", "", 0},
		{"chu thuan", "abc", 0},
		{"co ky hieu tien", "$12.50", 12.5},
		// Người dùng Việt gõ dấu phẩy thập phân — chỉ dấu phẩy ĐẦU TIÊN được đổi.
		{"dau phay thap phan", "13,2", 13.2},
		{"so am", "-5", -5},
		// parseFloat cắt phần đuôi không hợp lệ thay vì trả NaN.
		{"hai dau cham", "1.2.3", 1.2},
		{"so nguyen", 7, 7},
		{"float64", 7.25, 7.25},
		// bool và mảng đều về 0 ở bản gốc.
		{"bool", true, 0},
		{"mang", []any{1, 2}, 0},
		{"map", map[string]any{"a": 1}, 0},
	}

	for _, c := range cases {
		if got := Num(c.in); got != c.want {
			t.Errorf("%s: Num(%#v) = %v, muốn %v", c.name, c.in, got, c.want)
		}
	}
}

// Các ca chỉ xuất hiện khi dữ liệu đi qua JSON hoặc do người dùng gõ tay, không
// có trong bộ PHP nhưng cùng quy tắc: lấy tiền tố số hợp lệ, bỏ ký tự lạ.
func TestNumTienToSoHopLe(t *testing.T) {
	cases := map[string]float64{
		"1,234,5":  1.2345, // chỉ dấu phẩy đầu là dấu thập phân
		".5":       0.5,
		"-.5":      -0.5,
		"-":        0,
		".":        0,
		"12 USD":   12,
		"1-2":      1, // dấu trừ giữa chuỗi cắt tiền tố
		"  3.75  ": 3.75,
	}

	for in, want := range cases {
		if got := Num(in); got != want {
			t.Errorf("Num(%q) = %v, muốn %v", in, got, want)
		}
	}
}

// phpTruthy phải giống !empty() của PHP, kể cả ca chuỗi "0" là FALSE — cờ isLib
// và costMissing đọc từ JSON có thể về dạng chuỗi.
func TestPhpTruthyGiongEmptyCuaPhp(t *testing.T) {
	falsy := []any{nil, false, 0.0, 0, "", "0", []any{}, map[string]any{}}
	for _, v := range falsy {
		if phpTruthy(v) {
			t.Errorf("phpTruthy(%#v) = true, muốn false", v)
		}
	}

	truthy := []any{true, 1.0, -1.0, "false", "x", []any{1}, map[string]any{"a": 1}}
	for _, v := range truthy {
		if !phpTruthy(v) {
			t.Errorf("phpTruthy(%#v) = false, muốn true", v)
		}
	}

	// Kiểu lạ (struct, con trỏ) rơi vào nhánh mặc định và được coi là TRUE,
	// giống mọi object của PHP.
	if !phpTruthy(struct{}{}) {
		t.Error("kiểu lạ phải rơi vào nhánh mặc định và cho true")
	}
}

// Num phải xử được mọi kiểu số mà đường vào dữ liệu thực tế sinh ra: JSON
// decode cho float64, decode vào json.Number khi bật UseNumber, và giá trị do
// code Go tự dựng (int, int32, int64, float32).
func TestNumXuDuMoiKieuSo(t *testing.T) {
	cases := []struct {
		name string
		in   any
		want float64
	}{
		{"int32", int32(7), 7},
		{"int64", int64(-3), -3},
		{"float32", float32(2.5), 2.5},
		{"json.Number nguyen", json.Number("12"), 12},
		{"json.Number thap phan", json.Number("6.5"), 6.5},
		// json.Number rác rơi về nhánh parse chuỗi, không panic.
		{"json.Number rac", json.Number("abc"), 0},
		{"json.Number co ky hieu", json.Number("$12.50"), 12.5},
	}

	for _, c := range cases {
		if got := Num(c.in); got != c.want {
			t.Errorf("%s: Num(%#v) = %v, muốn %v", c.name, c.in, got, c.want)
		}
	}
}

// Inf và NaN phải về 0, không lan ra cả bảng tính giá. Chúng sinh ra từ phép
// chia trong dữ liệu cũ hoặc từ JSON của client bị lỗi.
func TestNumInfVaNaNVeKhong(t *testing.T) {
	cases := []any{
		math.Inf(1), math.Inf(-1), math.NaN(),
		float32(math.Inf(1)),
	}

	for _, in := range cases {
		if got := Num(in); got != 0 {
			t.Errorf("Num(%v) = %v, muốn 0", in, got)
		}
	}
}

// Đường thật của dữ liệu: blob JSON đi qua json.Unmarshal rồi mới tới Num.
func TestNumTrenDuLieuDiQuaJSON(t *testing.T) {
	var decoded map[string]any
	raw := `{"price":20,"sizeAdd":"3,5","itemCost":"","quantity":null,"phoi":1.25}`
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		t.Fatalf("unmarshal lỗi: %v", err)
	}

	want := map[string]float64{
		"price": 20, "sizeAdd": 3.5, "itemCost": 0, "quantity": 0, "phoi": 1.25,
	}
	for key, expected := range want {
		if got := Num(decoded[key]); got != expected {
			t.Errorf("Num(%s=%#v) = %v, muốn %v", key, decoded[key], got, expected)
		}
	}
}
