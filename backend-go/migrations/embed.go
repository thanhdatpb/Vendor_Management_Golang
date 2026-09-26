// Package migrations nhúng các file SQL trong chính thư mục này vào binary
// bằng go:embed.
//
// go:embed không cho phép pattern chứa ".." (giới hạn cứng của Go, không escape
// ra ngoài thư mục chứa file), nên file nhúng phải đặt NGAY TRONG migrations/,
// không thể đặt ở internal/migrate/ rồi trỏ ngược lại đây.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
