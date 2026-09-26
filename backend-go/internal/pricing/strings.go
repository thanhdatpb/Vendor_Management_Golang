package pricing

import "strings"

func trimSpace(s string) string { return strings.TrimSpace(s) }

func join(parts []string, sep string) string { return strings.Join(parts, sep) }
