package pricing

import "testing"

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
}
