// Package migrate nhúng thẳng file SQL migration vào binary Go bằng go:embed.
//
// Vì sao nhúng thay vì đọc từ đĩa: ảnh Docker của backend-go chỉ copy binary
// đã build (xem Dockerfile), không copy kèm thư mục migrations/. Nhúng vào
// binary thì lệnh migrate chạy được ở bất kỳ đâu — kể cả trong container —
// mà không phải nhớ mount thêm volume cho thư mục migration.
package migrate

import (
	"database/sql"

	"github.com/pressly/goose/v3"

	"vendorhub/migrations"
)

// dir là "." vì migrations.FS đã có gốc là chính thư mục migrations/ — không
// còn tiền tố đường dẫn nào phía trên nó trong hệ thống file nhúng.
const dir = "."

// New chuẩn bị goose để chạy trên MySQL, dùng FS đã nhúng thay vì đĩa.
func New() error {
	goose.SetBaseFS(migrations.FS)
	return goose.SetDialect("mysql")
}

func Up(db *sql.DB) error      { return goose.Up(db, dir) }
func UpByOne(db *sql.DB) error { return goose.UpByOne(db, dir) }
func Down(db *sql.DB) error    { return goose.Down(db, dir) }
func Status(db *sql.DB) error  { return goose.Status(db, dir) }
func Redo(db *sql.DB) error    { return goose.Redo(db, dir) }
func Reset(db *sql.DB) error   { return goose.Reset(db, dir) }

// Version trả phiên bản schema hiện tại — dùng cho /health/ready hoặc log lúc boot.
func Version(db *sql.DB) (int64, error) {
	return goose.GetDBVersion(db)
}
