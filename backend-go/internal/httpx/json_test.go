package httpx

import (
	"encoding/json"
	"testing"
	"time"
)

// Các ca dưới đây chốt đúng hai điểm Go serialize khác Laravel. Không có test
// nào trong bộ PHP/JS của dự án bắt được chúng, nên đây là nơi duy nhất.

func TestLaravelTimeCoDuSauChuSoMicroVaChuZ(t *testing.T) {
	cases := []struct {
		name string
		in   time.Time
		want string
	}{
		// Giây chẵn: phần thập phân vẫn phải có, đây là ca RFC3339Nano làm sai.
		{"giay chan", time.Date(2026, 9, 26, 10, 0, 0, 0, time.UTC), `"2026-09-26T10:00:00.000000Z"`},
		{"co micro", time.Date(2026, 9, 26, 10, 0, 0, 123456000, time.UTC), `"2026-09-26T10:00:00.123456Z"`},
		// Nano lẻ bị CẮT xuống micro, không làm tròn — giống ký tự u của PHP.
		{"nano bi cat", time.Date(2026, 9, 26, 10, 0, 0, 123456789, time.UTC), `"2026-09-26T10:00:00.123456Z"`},
	}

	for _, c := range cases {
		got, err := json.Marshal(LaravelTime(c.in))
		if err != nil {
			t.Fatalf("%s: marshal lỗi: %v", c.name, err)
		}
		if string(got) != c.want {
			t.Errorf("%s: = %s, muốn %s", c.name, got, c.want)
		}
	}
}

// App chạy timezone UTC (config/app.php), nên mọi mốc phải được quy về UTC
// trước khi in — không in offset của máy chủ.
func TestLaravelTimeQuyVeUtc(t *testing.T) {
	saigon := time.FixedZone("ICT", 7*3600)
	in := time.Date(2026, 9, 26, 17, 0, 0, 0, saigon)

	got, err := json.Marshal(LaravelTime(in))
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}
	if string(got) != `"2026-09-26T10:00:00.000000Z"` {
		t.Errorf("= %s, muốn mốc UTC 10:00:00", got)
	}
}

// Cột timestamp NULL của Laravel ra null, không ra mốc năm 1.
func TestLaravelTimeRongRaNull(t *testing.T) {
	got, err := json.Marshal(LaravelTime(time.Time{}))
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}
	if string(got) != "null" {
		t.Errorf("= %s, muốn null", got)
	}
}

// Endpoint đi qua query builder trả nguyên chuỗi MySQL, không phải ISO-8601.
func TestMySQLTimeGiuDinhDangCuaQueryBuilder(t *testing.T) {
	in := time.Date(2026, 9, 26, 10, 0, 0, 123456789, time.UTC)

	got, err := json.Marshal(MySQLTime(in))
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}
	if string(got) != `"2026-09-26 10:00:00"` {
		t.Errorf("= %s, muốn \"2026-09-26 10:00:00\"", got)
	}

	if null, _ := json.Marshal(MySQLTime(time.Time{})); string(null) != "null" {
		t.Errorf("mốc rỗng = %s, muốn null", null)
	}
}

func TestPHPFloatGiuPhanThapPhanChoSoNguyen(t *testing.T) {
	cases := []struct {
		in   PHPFloat
		want string
	}{
		{1, "1.0"},
		{0, "0.0"},
		{-2, "-2.0"},
		{6.5, "6.5"},
		{10.7, "10.7"},
		{4.2, "4.2"},
		{0.0001, "0.0001"},
		// Không dùng dạng số mũ cho khoảng giá trị của tiền.
		{1234567.89, "1234567.89"},
	}

	for _, c := range cases {
		got, err := json.Marshal(c.in)
		if err != nil {
			t.Fatalf("marshal lỗi: %v", err)
		}
		if string(got) != c.want {
			t.Errorf("PHPFloat(%v) = %s, muốn %s", float64(c.in), got, c.want)
		}
	}
}

// Ca thật: một dòng vendor có 12 cột giá. Kiểu mặc định của Go in 1 thay vì 1.0,
// nên struct nào ra JSON cũng phải khai PHPFloat, không phải float64.
func TestPHPFloatTrongStructResponse(t *testing.T) {
	row := struct {
		Size     string   `json:"size"`
		Pricing1 PHPFloat `json:"pricing1"`
		EcoTotal PHPFloat `json:"eco_total"`
	}{Size: "M", Pricing1: 6, EcoTotal: 10.7}

	got, err := json.Marshal(row)
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}
	want := `{"size":"M","pricing1":6.0,"eco_total":10.7}`
	if string(got) != want {
		t.Errorf("= %s\nmuốn %s", got, want)
	}
}

// String() dùng cho log và cho chỗ cần chuỗi trần (ví dụ dựng ETag từ mốc sửa),
// nên phải cho ra đúng cùng một dạng với MarshalJSON, chỉ khác là không có nháy.
func TestStringTraCungDangVoiMarshalJSON(t *testing.T) {
	in := time.Date(2026, 9, 26, 10, 0, 0, 123456789, time.UTC)

	if got := LaravelTime(in).String(); got != "2026-09-26T10:00:00.123456Z" {
		t.Errorf("LaravelTime.String() = %q", got)
	}
	if got := MySQLTime(in).String(); got != "2026-09-26 10:00:00" {
		t.Errorf("MySQLTime.String() = %q", got)
	}

	// Mốc rỗng ra chuỗi rỗng, không phải mốc năm 1 — chuỗi đó đi vào ETag.
	if got := LaravelTime(time.Time{}).String(); got != "" {
		t.Errorf("LaravelTime rỗng = %q, muốn chuỗi rỗng", got)
	}
	if got := MySQLTime(time.Time{}).String(); got != "" {
		t.Errorf("MySQLTime rỗng = %q, muốn chuỗi rỗng", got)
	}
}

func TestPHPFloatStringGiongMarshalJSON(t *testing.T) {
	for _, f := range []PHPFloat{1, 0, -2, 6.5, 0.0001} {
		encoded, _ := f.MarshalJSON()
		if f.String() != string(encoded) {
			t.Errorf("String() = %q nhưng MarshalJSON = %s", f.String(), encoded)
		}
	}
}
