// Package notificationmail mirrors persisted web notifications to email. The
// poller is deliberately decoupled from request transactions: failures never
// roll back the business operation that created a notification.
package notificationmail

import (
	"context"
	"crypto/tls"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"strings"
	"time"
)

type Config struct {
	Enabled               bool
	Scheme, Host          string
	Port                  int
	Username, Password    string
	FromAddress, FromName string
	FrontendURL           string
	HourlyCap             int
	PollInterval          time.Duration
}

type Worker struct {
	db     *sql.DB
	config Config
	logger *slog.Logger
}

func New(db *sql.DB, config Config, logger *slog.Logger) *Worker {
	if config.PollInterval <= 0 {
		config.PollInterval = 5 * time.Second
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Worker{db: db, config: config, logger: logger}
}

func (w *Worker) Run(ctx context.Context) {
	if !w.config.Enabled {
		return
	}
	w.process(ctx)
	ticker := time.NewTicker(w.config.PollInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.process(ctx)
		}
	}
}

type item struct {
	ID, UserID               int64
	Type, Title, Body, Email string
	Data                     []byte
	CreatedAt                time.Time
	Role                     string
	Active                   bool
}

func (w *Worker) process(ctx context.Context) {
	rows, err := w.db.QueryContext(ctx, `SELECT n.id,n.user_id,n.type,n.title,COALESCE(n.body,''),n.data,n.created_at,COALESCE(u.email,''),COALESCE(u.role,''),COALESCE(u.is_active,0) FROM notifications n LEFT JOIN users u ON u.id=n.user_id WHERE n.email_status IS NULL ORDER BY n.id LIMIT 20`)
	if err != nil {
		w.logger.Warn("không đọc được hàng đợi email notification", "error", err)
		return
	}
	items := []item{}
	for rows.Next() {
		var current item
		if err := rows.Scan(&current.ID, &current.UserID, &current.Type, &current.Title, &current.Body, &current.Data, &current.CreatedAt, &current.Email, &current.Role, &current.Active); err != nil {
			rows.Close()
			return
		}
		items = append(items, current)
	}
	rows.Close()
	for _, current := range items {
		if ctx.Err() != nil {
			return
		}
		if reason := w.skipReason(ctx, current); reason != "" {
			_, _ = w.db.ExecContext(ctx, `UPDATE notifications SET email_status='skipped',email_error=?,updated_at=? WHERE id=? AND email_status IS NULL`, reason, time.Now().UTC(), current.ID)
			continue
		}
		if _, err := w.db.ExecContext(ctx, `UPDATE notifications SET email_status='sending',email_error=NULL,updated_at=? WHERE id=? AND email_status IS NULL`, time.Now().UTC(), current.ID); err != nil {
			continue
		}
		err := w.send(current)
		if err == nil {
			_, _ = w.db.ExecContext(ctx, `UPDATE notifications SET email_status='sent',email_sent_at=?,email_error=NULL,updated_at=? WHERE id=?`, time.Now().UTC(), time.Now().UTC(), current.ID)
			continue
		}
		message := err.Error()
		if len(message) > 500 {
			message = message[:500]
		}
		_, _ = w.db.ExecContext(ctx, `UPDATE notifications SET email_status='failed',email_error=?,updated_at=? WHERE id=?`, message, time.Now().UTC(), current.ID)
		w.logger.Warn("gửi email notification thất bại", "notification_id", current.ID, "error", err)
	}
}

var allowedRoles = map[string]map[string]bool{
	"new_form": {"admin": true}, "approved": {"seller": true}, "rejected": {"seller": true},
	"needs_vendor": {"vendor": true}, "deadline_updated": {"seller": true},
	"vendor_assigned": {"seller": true},
	"library_updated": {"admin": true, "vendor": true, "seller": true, "pd": true, "csf": true, "marvel": true},
}

func (w *Worker) skipReason(ctx context.Context, current item) string {
	roles, emailable := allowedRoles[current.Type]
	if !emailable {
		return "type_not_emailable"
	}
	if current.Email == "" {
		return "user_missing"
	}
	if !current.Active {
		return "user_inactive"
	}
	address, err := mail.ParseAddress(current.Email)
	if err != nil || !strings.EqualFold(address.Address, current.Email) {
		return "invalid_email"
	}
	role := canonicalRole(current.Role)
	if !roles[role] {
		return "role_not_allowed"
	}
	var enabled bool
	err = w.db.QueryRowContext(ctx, `SELECT enabled FROM notification_email_settings WHERE role=? AND type=? LIMIT 1`, role, current.Type).Scan(&enabled)
	if err == nil && !enabled {
		return "disabled_by_admin"
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return "settings_unavailable"
	}
	if w.duplicate(ctx, current) {
		return "duplicate"
	}
	if w.config.HourlyCap > 0 {
		var count int
		if w.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM notifications WHERE email_status='sent' AND email_sent_at>=?`, time.Now().UTC().Add(-time.Hour)).Scan(&count) == nil && count >= w.config.HourlyCap {
			return "hourly_cap"
		}
	}
	return ""
}

func (w *Worker) duplicate(ctx context.Context, current item) bool {
	key := dedupeKey(current.Type, current.Data)
	if key == "" {
		return false
	}
	window := 5 * time.Minute
	if current.Type == "library_updated" {
		window = 15 * time.Minute
	}
	rows, err := w.db.QueryContext(ctx, `SELECT n.data FROM notifications n JOIN users u ON u.id=n.user_id WHERE n.id<>? AND n.type=? AND n.email_status='sent' AND n.created_at>=? AND LOWER(u.email)=LOWER(?)`, current.ID, current.Type, time.Now().UTC().Add(-window), current.Email)
	if err != nil {
		return false
	}
	defer rows.Close()
	for rows.Next() {
		var data []byte
		if rows.Scan(&data) == nil && dedupeKey(current.Type, data) == key {
			return true
		}
	}
	return false
}

func dedupeKey(kind string, raw []byte) string {
	var data map[string]any
	if json.Unmarshal(raw, &data) != nil {
		return ""
	}
	field := "product_id"
	if kind == "library_updated" {
		field = "filename"
	}
	if value := data[field]; value != nil {
		return fmt.Sprint(value)
	}
	return ""
}

func canonicalRole(role string) string {
	role = strings.ToLower(strings.TrimSpace(role))
	if role == "staff_a" || role == "staffa" {
		return "seller"
	}
	if role == "staff_b" || role == "staffb" {
		return "vendor"
	}
	return role
}

func (w *Worker) send(current item) error {
	address := net.JoinHostPort(w.config.Host, fmt.Sprint(w.config.Port))
	var client *smtp.Client
	if strings.EqualFold(w.config.Scheme, "smtps") || w.config.Port == 465 {
		connection, err := tls.Dial("tcp", address, &tls.Config{ServerName: w.config.Host, MinVersion: tls.VersionTLS12})
		if err != nil {
			return err
		}
		client, err = smtp.NewClient(connection, w.config.Host)
		if err != nil {
			connection.Close()
			return err
		}
	} else {
		connection, err := net.DialTimeout("tcp", address, 10*time.Second)
		if err != nil {
			return err
		}
		client, err = smtp.NewClient(connection, w.config.Host)
		if err != nil {
			connection.Close()
			return err
		}
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err := client.StartTLS(&tls.Config{ServerName: w.config.Host, MinVersion: tls.VersionTLS12}); err != nil {
				client.Close()
				return err
			}
		}
	}
	defer client.Close()
	if w.config.Username != "" {
		if err := client.Auth(smtp.PlainAuth("", w.config.Username, w.config.Password, w.config.Host)); err != nil {
			return err
		}
	}
	if err := client.Mail(w.config.FromAddress); err != nil {
		return err
	}
	if err := client.Rcpt(current.Email); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	from := mail.Address{Name: w.config.FromName, Address: w.config.FromAddress}
	subject := mime.QEncoding.Encode("utf-8", "[VendorHub] "+strings.TrimSpace(current.Title))
	body := strings.TrimSpace(current.Body) + "\r\n\r\nMở VendorHub: " + strings.TrimRight(w.config.FrontendURL, "/") + "\r\n"
	message := "From: " + from.String() + "\r\nTo: " + current.Email + "\r\nSubject: " + subject + "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n" + body
	if _, err := io.WriteString(writer, message); err != nil {
		writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}
