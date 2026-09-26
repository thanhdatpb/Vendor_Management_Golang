package library

import (
	"bytes"
	"encoding/json"
)

// OrderedMap là một object JSON giữ nguyên THỨ TỰ khoá được thêm vào.
//
// Vì sao cần: mảng kết hợp của PHP giữ thứ tự chèn, nên json_encode sinh ra
// {"size":"M","optional":"Basic","pricing1":6.5,…}. map[string]any của Go thì
// json.Marshal SẮP XẾP khoá theo bảng chữ cái, ra
// {"eco_price":…,"optional":…,"pricing1":…,"size":"M"} — khác body hiện tại.
//
// Frontend đọc theo tên khoá nên không vỡ, nhưng diff harness ở phase 7 so từng
// byte sẽ báo lệch ở MỌI dòng size của MỌI bảng. Giữ thứ tự ngay từ đầu rẻ hơn
// là đi giải thích hàng nghìn dòng khác biệt giả.
type OrderedMap struct {
	keys   []string
	values map[string]any
}

func NewOrderedMap() *OrderedMap {
	return &OrderedMap{values: map[string]any{}}
}

// Set thêm hoặc ghi đè một khoá. Ghi đè KHÔNG đổi vị trí của khoá đó, đúng như
// mảng kết hợp của PHP.
func (m *OrderedMap) Set(key string, value any) {
	if _, seen := m.values[key]; !seen {
		m.keys = append(m.keys, key)
	}
	m.values[key] = value
}

func (m *OrderedMap) Get(key string) (any, bool) {
	v, ok := m.values[key]
	return v, ok
}

// Keys trả bản sao danh sách khoá theo đúng thứ tự chèn.
func (m *OrderedMap) Keys() []string {
	return append([]string(nil), m.keys...)
}

func (m *OrderedMap) Len() int { return len(m.keys) }

func (m *OrderedMap) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')

	for i, key := range m.keys {
		if i > 0 {
			buf.WriteByte(',')
		}
		// Marshal cả khoá để ký tự đặc biệt và Unicode được escape đúng chuẩn.
		encodedKey, err := json.Marshal(key)
		if err != nil {
			return nil, err
		}
		buf.Write(encodedKey)
		buf.WriteByte(':')

		encodedValue, err := json.Marshal(m.values[key])
		if err != nil {
			return nil, err
		}
		buf.Write(encodedValue)
	}

	buf.WriteByte('}')
	return buf.Bytes(), nil
}
