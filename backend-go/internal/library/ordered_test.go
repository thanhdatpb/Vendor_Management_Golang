package library

import (
	"encoding/json"
	"testing"
)

// OrderedMap tồn tại chỉ vì một lý do: json.Marshal của map[string]any SẮP XẾP
// khoá theo bảng chữ cái, còn mảng kết hợp của PHP giữ thứ tự chèn. Test này
// chốt cả hai mặt của điều đó.
func TestOrderedMapGiuThuTuChen(t *testing.T) {
	m := NewOrderedMap()
	m.Set("size", "M")
	m.Set("optional", "Basic")
	m.Set("pricing1", 6.5)
	m.Set("eco_price", 4.2)

	encoded, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}

	want := `{"size":"M","optional":"Basic","pricing1":6.5,"eco_price":4.2}`
	if string(encoded) != want {
		t.Errorf("\n got %s\nmuốn %s", encoded, want)
	}

	// Đối chứng: map thường sẽ ra thứ tự bảng chữ cái, tức KHÁC bản PHP.
	plain, _ := json.Marshal(map[string]any{
		"size": "M", "optional": "Basic", "pricing1": 6.5, "eco_price": 4.2,
	})
	if string(plain) == want {
		t.Error("map thường bỗng giữ thứ tự chèn — test này mất ý nghĩa, xem lại")
	}
}

// Ghi đè một khoá KHÔNG được đẩy nó xuống cuối, đúng như mảng kết hợp của PHP.
func TestOrderedMapGhiDeKhongDoiViTri(t *testing.T) {
	m := NewOrderedMap()
	m.Set("a", 1)
	m.Set("b", 2)
	m.Set("a", 99)

	encoded, _ := json.Marshal(m)
	if string(encoded) != `{"a":99,"b":2}` {
		t.Errorf("= %s, muốn {\"a\":99,\"b\":2}", encoded)
	}
	if m.Len() != 2 {
		t.Errorf("Len = %d, muốn 2", m.Len())
	}
}

func TestOrderedMapGetVaKeys(t *testing.T) {
	m := NewOrderedMap()
	m.Set("size", "M")

	if v, ok := m.Get("size"); !ok || v != "M" {
		t.Errorf("Get(size) = %v, %v", v, ok)
	}
	if _, ok := m.Get("khong_co"); ok {
		t.Error("Get khoá không tồn tại phải trả ok = false")
	}

	// Keys trả BẢN SAO: người gọi sửa nó không được làm hỏng map.
	keys := m.Keys()
	keys[0] = "bi_sua"
	if m.Keys()[0] != "size" {
		t.Error("Keys phải trả bản sao, không phải slice gốc")
	}
}

func TestOrderedMapRongRaObjectRong(t *testing.T) {
	encoded, err := json.Marshal(NewOrderedMap())
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}
	if string(encoded) != "{}" {
		t.Errorf("= %s, muốn {}", encoded)
	}
}

// Khoá và giá trị có ký tự đặc biệt hoặc tiếng Việt phải được escape đúng chuẩn.
func TestOrderedMapEscapeDungChuan(t *testing.T) {
	m := NewOrderedMap()
	m.Set("chất liệu", `Cotton "100%"`)
	m.Set("ghi\tchú", nil)

	encoded, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}

	// Kết quả phải parse ngược lại được — đó mới là phép thử thật.
	var back map[string]any
	if err := json.Unmarshal(encoded, &back); err != nil {
		t.Fatalf("JSON sinh ra không parse lại được: %v\n%s", err, encoded)
	}
	if back["chất liệu"] != `Cotton "100%"` {
		t.Errorf("giá trị sau khi parse lại = %v", back["chất liệu"])
	}
	if v, ok := back["ghi\tchú"]; !ok || v != nil {
		t.Errorf("khoá có ký tự tab không round-trip được: %v", back)
	}
}
