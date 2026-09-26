package libraryapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

func bytesReader(raw []byte) *bytes.Reader { return bytes.NewReader(raw) }

func marshalNoEscape(value any) ([]byte, error) {
	var out bytes.Buffer
	enc := json.NewEncoder(&out)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(out.Bytes(), []byte("\n")), nil
}

func anyString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case json.Number:
		return v.String()
	case float64:
		return fmt.Sprintf("%g", v)
	case bool:
		if v {
			return "1"
		}
		return ""
	default:
		return fmt.Sprint(v)
	}
}

func projectKey(role string, project *string, requested string, allowRequest bool) string {
	normalized := normalizeRole(role)
	wide := map[string]bool{"admin": true, "marvel": true, "staffb": true, "vendor": true, "csf": true, "pd": true}
	if wide[normalized] {
		if allowRequest {
			return strings.ToLower(strings.TrimSpace(requested))
		}
		return ""
	}
	if project == nil {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(*project))
}

func normalizeRole(role string) string {
	role = strings.ToLower(role)
	return strings.NewReplacer("_", "", "-", "", " ", "").Replace(role)
}

func normalizeFilename(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	if strings.HasSuffix(name, ".xlsx") {
		return strings.TrimSuffix(name, ".xlsx")
	}
	if strings.HasSuffix(name, ".xls") {
		return strings.TrimSuffix(name, ".xls")
	}
	return name
}

func stamp(t interface{ Format(string) string }) string { return t.Format("2006-01-02 15:04:05") }
