// Lệnh migrate chạy migration goose trên MySQL của backend-go.
//
// Dùng thay cho `php artisan migrate`. Đọc cùng biến môi trường DB_* với
// cmd/server, nên chạy được với cùng .env đang cấu hình cho dịch vụ chính.
//
//	go run ./cmd/migrate up      # áp hết migration chưa chạy
//	go run ./cmd/migrate down    # lùi một migration
//	go run ./cmd/migrate status  # xem migration nào đã/chưa chạy
//	go run ./cmd/migrate version # phiên bản schema hiện tại
package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"

	"vendorhub/internal/config"
	"vendorhub/internal/database"
	"vendorhub/internal/migrate"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "cách dùng: migrate <up|down|status|version|redo|reset>")
		os.Exit(2)
	}
	command := os.Args[1]

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "đọc cấu hình lỗi: %v\n", err)
		os.Exit(1)
	}

	ctx := context.Background()
	db, err := database.Open(ctx, cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "kết nối DB lỗi: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := migrate.New(); err != nil {
		fmt.Fprintf(os.Stderr, "khởi tạo goose lỗi: %v\n", err)
		os.Exit(1)
	}

	if err := run(command, db); err != nil {
		fmt.Fprintf(os.Stderr, "migrate %s lỗi: %v\n", command, err)
		os.Exit(1)
	}
}

func run(command string, db *sql.DB) error {
	switch command {
	case "up":
		return migrate.Up(db)
	case "down":
		return migrate.Down(db)
	case "status":
		return migrate.Status(db)
	case "redo":
		return migrate.Redo(db)
	case "reset":
		// Lùi hết về schema rỗng. Chỉ dùng cho môi trường dev/test — không có
		// guard nào chặn chạy nhầm trên production, người vận hành tự chịu
		// trách nhiệm không gọi lệnh này ở đó.
		return migrate.Reset(db)
	case "version":
		v, err := migrate.Version(db)
		if err != nil {
			return err
		}
		fmt.Printf("phiên bản schema hiện tại: %d\n", v)
		return nil
	default:
		return fmt.Errorf("lệnh không hợp lệ %q — dùng up|down|status|version|redo|reset", command)
	}
}
