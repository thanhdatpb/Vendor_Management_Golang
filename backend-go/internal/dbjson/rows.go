// Package dbjson chuyển kết quả database/sql thành JSON theo các cast Eloquent
// của từng model. Dùng cho bảng có nhiều cột legacy như vendors/products.
package dbjson

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"vendorhub/internal/httpx"
)

type Cast uint8

const (
	String Cast = iota
	Integer
	Float
	Boolean
	JSON
	LaravelTime
)

func Rows(rows *sql.Rows, casts map[string]Cast) ([]map[string]any, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	out := []map[string]any{}
	for rows.Next() {
		values := make([]any, len(columns))
		targets := make([]any, len(columns))
		for i := range values {
			targets[i] = &values[i]
		}
		if err := rows.Scan(targets...); err != nil {
			return nil, err
		}
		item := make(map[string]any, len(columns))
		for i, name := range columns {
			item[name] = value(values[i], casts[name])
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func value(raw any, cast Cast) any {
	if raw == nil {
		return nil
	}
	if t, ok := raw.(time.Time); ok {
		return httpx.LaravelTime(t)
	}
	text := stringValue(raw)
	switch cast {
	case Integer:
		n, err := strconv.ParseInt(text, 10, 64)
		if err == nil {
			return n
		}
	case Float:
		n, err := strconv.ParseFloat(text, 64)
		if err == nil {
			return httpx.PHPFloat(n)
		}
	case Boolean:
		return text == "1" || strings.EqualFold(text, "true")
	case JSON:
		var parsed any
		if json.Unmarshal([]byte(text), &parsed) == nil {
			return parsed
		}
		return nil
	case LaravelTime:
		for _, layout := range []string{"2006-01-02 15:04:05", time.RFC3339Nano} {
			if t, err := time.Parse(layout, text); err == nil {
				return httpx.LaravelTime(t)
			}
		}
	}
	return text
}
func stringValue(v any) string {
	switch x := v.(type) {
	case []byte:
		return string(x)
	case string:
		return x
	default:
		return fmt.Sprint(x)
	}
}
