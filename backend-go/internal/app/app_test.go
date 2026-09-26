package app

import (
	"database/sql"
	"testing"

	"vendorhub/internal/config"
)

func TestRouteTableHasNoConflicts(t *testing.T) {
	// net/http phát hiện route wildcard xung đột bằng panic ngay lúc đăng ký.
	_ = App{DB: &sql.DB{}, Config: config.Config{FrontendURL: "http://localhost:5173"}}.Handler()
}
