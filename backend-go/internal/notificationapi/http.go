package notificationapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"vendorhub/internal/authn"
	"vendorhub/internal/httpx"
)

type Handler struct{ db *sql.DB }

func NewHandler(db *sql.DB) *Handler { return &Handler{db: db} }

type item struct {
	ID          int64             `json:"id"`
	UserID      int64             `json:"user_id"`
	Type        *string           `json:"type"`
	Title       *string           `json:"title"`
	Body        *string           `json:"body"`
	IsRead      bool              `json:"is_read"`
	Data        any               `json:"data"`
	EmailStatus *string           `json:"email_status"`
	EmailSentAt any               `json:"email_sent_at"`
	EmailError  *string           `json:"email_error"`
	CreatedAt   httpx.LaravelTime `json:"created_at"`
	UpdatedAt   httpx.LaravelTime `json:"updated_at"`
}

func (h *Handler) Index(w http.ResponseWriter, r *http.Request) {
	p, _ := authn.PrincipalFrom(r.Context())
	rows, err := h.db.QueryContext(r.Context(), `SELECT id,user_id,type,title,body,is_read,data,email_status,email_sent_at,email_error,created_at,updated_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50`, p.User.ID)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	items := []item{}
	for rows.Next() {
		var n item
		var kind, title, body, data, emailStatus, emailError sql.NullString
		var emailSent sql.NullTime
		var created, updated time.Time
		if rows.Scan(&n.ID, &n.UserID, &kind, &title, &body, &n.IsRead, &data, &emailStatus, &emailSent, &emailError, &created, &updated) != nil {
			serverError(w)
			return
		}
		n.Type = ptr(kind)
		n.Title = ptr(title)
		n.Body = ptr(body)
		n.EmailStatus = ptr(emailStatus)
		n.EmailError = ptr(emailError)
		if data.Valid {
			var parsed any
			if json.Unmarshal([]byte(data.String), &parsed) == nil {
				n.Data = parsed
			}
		}
		if emailSent.Valid {
			n.EmailSentAt = httpx.LaravelTime(emailSent.Time)
		}
		n.CreatedAt = httpx.LaravelTime(created)
		n.UpdatedAt = httpx.LaravelTime(updated)
		items = append(items, n)
	}
	var unread int
	if h.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM notifications WHERE user_id=? AND is_read=0`, p.User.ID).Scan(&unread) != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": items, "unread": unread})
}

func (h *Handler) ReadAll(w http.ResponseWriter, r *http.Request) {
	p, _ := authn.PrincipalFrom(r.Context())
	if _, err := h.db.ExecContext(r.Context(), `UPDATE notifications SET is_read=1, updated_at=? WHERE user_id=? AND is_read=0`, time.Now().UTC(), p.User.ID); err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"success": true})
}
func (h *Handler) ReadOne(w http.ResponseWriter, r *http.Request) {
	p, _ := authn.PrincipalFrom(r.Context())
	if _, err := h.db.ExecContext(r.Context(), `UPDATE notifications SET is_read=1, updated_at=? WHERE id=? AND user_id=?`, time.Now().UTC(), r.PathValue("id"), p.User.ID); err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"success": true})
}
func ptr(v sql.NullString) *string {
	if !v.Valid {
		return nil
	}
	x := v.String
	return &x
}
func serverError(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusInternalServerError, httpx.Message{Message: "Server Error"})
}
