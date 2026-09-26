package pricing

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
)

// Num là bản port của num() trong frontend/src/utils/pricingEngine.js và
// PriceSheetSummary::num() bên PHP.
//
// Quy tắc, theo đúng thứ tự của bản gốc:
//  1. null / "" / bool / mảng  -> 0
//  2. số  -> chính nó, trừ Inf/NaN -> 0
//  3. chuỗi -> đổi dấu phẩy thập phân ĐẦU TIÊN thành dấu chấm, bỏ mọi ký tự
//     không phải chữ số / dấu chấm / dấu trừ, rồi lấy tiền tố số hợp lệ
//     (parseFloat của JS và ép (float) của PHP đều cắt phần đuôi thay vì
//     trả về NaN).
func Num(value any) float64 {
	switch v := value.(type) {
	case nil:
		return 0
	case bool:
		return 0
	case float64:
		return finite(v)
	case float32:
		return finite(float64(v))
	case int:
		return float64(v)
	case int32:
		return float64(v)
	case int64:
		return float64(v)
	case json.Number:
		f, err := v.Float64()
		if err != nil {
			return numFromString(v.String())
		}
		return finite(f)
	case string:
		return numFromString(v)
	default:
		// map, slice và mọi thứ khác: bản gốc trả 0.
		return 0
	}
}

func finite(f float64) float64 {
	if math.IsInf(f, 0) || math.IsNaN(f) {
		return 0
	}
	return f
}

func numFromString(s string) float64 {
	if s == "" {
		return 0
	}

	// Chỉ dấu phẩy ĐẦU TIÊN được coi là dấu thập phân — giống preg_replace với
	// limit 1 của bản PHP. "1,234,5" -> "1.2345" ở cả hai bên.
	if i := strings.IndexByte(s, ','); i >= 0 {
		s = s[:i] + "." + s[i+1:]
	}

	var kept strings.Builder
	for _, r := range s {
		if (r >= '0' && r <= '9') || r == '.' || r == '-' {
			kept.WriteRune(r)
		}
	}
	t := kept.String()

	// Tiền tố số hợp lệ: dấu trừ chỉ ở vị trí đầu, nhiều nhất một dấu chấm.
	end, seenDot, seenDigit := 0, false, false
scan:
	for i := 0; i < len(t); i++ {
		switch c := t[i]; {
		case c == '-' && i == 0:
		case c == '.' && !seenDot:
			seenDot = true
		case c >= '0' && c <= '9':
			seenDigit = true
		default:
			break scan
		}
		end = i + 1
	}
	if !seenDigit {
		return 0
	}

	f, err := strconv.ParseFloat(t[:end], 64)
	if err != nil {
		return 0
	}
	return finite(f)
}

// phpTruthy mô phỏng !empty() của PHP: chuỗi "0" là FALSE, đây là chỗ dễ sai
// nhất khi port (cờ isLib / costMissing đọc từ JSON có thể là chuỗi).
func phpTruthy(value any) bool {
	switch v := value.(type) {
	case nil:
		return false
	case bool:
		return v
	case float64:
		return v != 0
	case int:
		return v != 0
	case string:
		return v != "" && v != "0"
	case []any:
		return len(v) > 0
	case map[string]any:
		return len(v) > 0
	default:
		return true
	}
}

func asString(value any) string {
	s, _ := value.(string)
	return s
}

func asMap(value any) (map[string]any, bool) {
	m, ok := value.(map[string]any)
	return m, ok
}

func asSlice(value any) []any {
	s, _ := value.([]any)
	return s
}
