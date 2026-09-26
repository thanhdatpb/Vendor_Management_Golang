// Package config đọc cấu hình tiến trình Go từ biến môi trường.
//
// Dịch vụ Go cố ý dùng cùng tên biến với Laravel để giai đoạn chạy song song
// không cần duy trì hai bộ secret production.
package config

import (
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment string
	HTTPAddr    string
	FrontendURL string
	// MediaRoot là thư mục media do backend-go sở hữu. Trước đây nó trỏ thẳng
	// vào backend/storage/app/public của Laravel; giờ tách ra để xoá backend/
	// không làm mất đường phục vụ ảnh.
	//
	// CHUYỂN DỮ LIỆU CŨ TRƯỚC KHI CHẠY: các file đã upload vẫn nằm ở
	// backend/storage/app/public/products. Di chuyển chúng sang MediaRoot mới
	// (hoặc đặt GO_MEDIA_ROOT trỏ về chỗ cũ) trước khi bỏ thư mục Laravel.
	MediaRoot           string
	MediaDisk           string
	AWSAccessKeyID      string
	AWSSecretAccessKey  string
	AWSRegion           string
	AWSBucket           string
	AWSURL              string
	AWSEndpoint         string
	AWSUsePathStyle     bool
	VendorExtractScript string
	GoogleClientID      string
	GoogleClientSecret  string
	GoogleRedirectURI   string
	PusherAppID         string
	PusherAppKey        string
	PusherAppSecret     string
	PusherCluster       string
	MailMailer          string
	MailScheme          string
	MailHost            string
	MailPort            int
	MailUsername        string
	MailPassword        string
	MailFromAddress     string
	MailFromName        string
	MailHourlyCap       int

	DBHost     string
	DBPort     int
	DBName     string
	DBUser     string
	DBPassword string

	AppKey []byte

	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration
}

func Load() (Config, error) {
	c := Config{
		Environment:        env("APP_ENV", "local"),
		HTTPAddr:           env("GO_HTTP_ADDR", ":8001"),
		FrontendURL:        strings.TrimRight(env("FRONTEND_URL", "http://localhost:5173"), "/"),
		MediaRoot:          env("GO_MEDIA_ROOT", "storage/media"),
		MediaDisk:          env("MEDIA_DISK", "public"),
		AWSAccessKeyID:     os.Getenv("AWS_ACCESS_KEY_ID"),
		AWSSecretAccessKey: os.Getenv("AWS_SECRET_ACCESS_KEY"),
		AWSRegion:          env("AWS_DEFAULT_REGION", "auto"),
		AWSBucket:          os.Getenv("AWS_BUCKET"),
		AWSURL:             os.Getenv("AWS_URL"),
		AWSEndpoint:        os.Getenv("AWS_ENDPOINT"),
		AWSUsePathStyle:    boolean("AWS_USE_PATH_STYLE_ENDPOINT", false),
		// Script trích xuất Excel giờ thuộc backend-go, không còn nằm trong thư
		// mục Laravel — xoá backend/ không làm hỏng chức năng import vendor.
		VendorExtractScript: env("GO_VENDOR_EXTRACT_SCRIPT", "scripts/extract_excel.cjs"),
		GoogleClientID:      os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:  os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURI:   os.Getenv("GOOGLE_REDIRECT_URI"),
		PusherAppID:         os.Getenv("PUSHER_APP_ID"),
		PusherAppKey:        os.Getenv("PUSHER_APP_KEY"),
		PusherAppSecret:     os.Getenv("PUSHER_APP_SECRET"),
		PusherCluster:       env("PUSHER_APP_CLUSTER", "mt1"),
		MailMailer:          env("MAIL_MAILER", "log"),
		MailScheme:          env("MAIL_SCHEME", "smtp"),
		MailHost:            env("MAIL_HOST", "127.0.0.1"),
		MailUsername:        os.Getenv("MAIL_USERNAME"),
		MailPassword:        os.Getenv("MAIL_PASSWORD"),
		MailFromAddress:     env("MAIL_FROM_ADDRESS", "hello@example.com"),
		MailFromName:        env("MAIL_FROM_NAME", "VendorHub"),
		DBHost:              env("DB_HOST", "127.0.0.1"),
		DBName:              env("DB_DATABASE", "hub_vendor_db"),
		DBUser:              env("DB_USERNAME", "root"),
		DBPassword:          os.Getenv("DB_PASSWORD"),
		ReadTimeout:         duration("GO_HTTP_READ_TIMEOUT", 15*time.Second),
		WriteTimeout:        duration("GO_HTTP_WRITE_TIMEOUT", 60*time.Second),
		IdleTimeout:         duration("GO_HTTP_IDLE_TIMEOUT", 120*time.Second),
		ShutdownTimeout:     duration("GO_SHUTDOWN_TIMEOUT", 15*time.Second),
	}

	port, err := strconv.Atoi(env("DB_PORT", "3306"))
	if err != nil || port < 1 || port > 65535 {
		return Config{}, fmt.Errorf("DB_PORT không hợp lệ")
	}
	c.DBPort = port
	mailPort, err := strconv.Atoi(env("MAIL_PORT", "2525"))
	if err != nil || mailPort < 1 || mailPort > 65535 {
		return Config{}, fmt.Errorf("MAIL_PORT không hợp lệ")
	}
	c.MailPort = mailPort
	mailCap, err := strconv.Atoi(env("MAIL_HOURLY_CAP", "300"))
	if err != nil {
		return Config{}, fmt.Errorf("MAIL_HOURLY_CAP không hợp lệ")
	}
	c.MailHourlyCap = mailCap

	if raw := os.Getenv("APP_KEY"); raw != "" {
		c.AppKey, err = decodeLaravelKey(raw)
		if err != nil {
			return Config{}, err
		}
	}

	if err := c.Validate(); err != nil {
		return Config{}, err
	}
	return c, nil
}

func (c Config) Validate() error {
	if c.HTTPAddr == "" {
		return errors.New("GO_HTTP_ADDR không được để trống")
	}
	if strings.TrimSpace(c.MediaRoot) == "" {
		return errors.New("GO_MEDIA_ROOT không được để trống")
	}
	if strings.TrimSpace(c.VendorExtractScript) == "" {
		return errors.New("GO_VENDOR_EXTRACT_SCRIPT không được để trống")
	}
	if c.DBHost == "" || c.DBName == "" || c.DBUser == "" {
		return errors.New("thiếu DB_HOST, DB_DATABASE hoặc DB_USERNAME")
	}
	if c.Environment == "production" && len(c.AppKey) != 32 {
		return errors.New("APP_KEY production phải là khóa AES-256 dài 32 byte")
	}
	if len(c.AppKey) != 0 && len(c.AppKey) != 32 {
		return errors.New("APP_KEY phải là khóa AES-256 dài 32 byte")
	}
	return nil
}

func decodeLaravelKey(raw string) ([]byte, error) {
	if strings.HasPrefix(raw, "base64:") {
		key, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(raw, "base64:"))
		if err != nil {
			return nil, errors.New("APP_KEY base64 không hợp lệ")
		}
		return key, nil
	}
	return []byte(raw), nil
}

func env(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok && value != "" {
		return value
	}
	return fallback
}

func duration(key string, fallback time.Duration) time.Duration {
	raw := os.Getenv(key)
	if raw == "" {
		return fallback
	}
	value, err := time.ParseDuration(raw)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func boolean(key string, fallback bool) bool {
	raw := os.Getenv(key)
	if strings.TrimSpace(raw) == "" {
		return fallback
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return value
}
