// Package database mở kết nối MySQL dùng chung với schema Laravel hiện hữu.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
	_ "github.com/go-sql-driver/mysql"

	"vendorhub/internal/config"
)

func Open(ctx context.Context, c config.Config) (*sql.DB, error) {
	dsnConfig := mysql.Config{
		User:                 c.DBUser,
		Passwd:               c.DBPassword,
		Net:                  "tcp",
		Addr:                 fmt.Sprintf("%s:%d", c.DBHost, c.DBPort),
		DBName:               c.DBName,
		ParseTime:            true,
		Loc:                  time.UTC,
		AllowNativePasswords: true,
		Collation:            "utf8mb4_unicode_ci",
	}
	dsn := dsnConfig.FormatDSN()

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("mở MySQL: %w", err)
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("kết nối MySQL: %w", err)
	}
	return db, nil
}
