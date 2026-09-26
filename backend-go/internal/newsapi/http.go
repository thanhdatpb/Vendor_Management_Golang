package newsapi

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"vendorhub/internal/authn"
	"vendorhub/internal/httpx"
	"vendorhub/internal/notificationapi"
)

var errAlreadySent = errors.New("already sent")

type Handler struct{ db *sql.DB }

func NewHandler(db *sql.DB) *Handler { return &Handler{db: db} }

type row struct {
	ID                   int64
	Title, Message       string
	Target               []byte
	SentAt               sql.NullTime
	CreatedBy            sql.NullInt64
	CreatedAt, UpdatedAt time.Time
}
type response struct {
	ID        int64             `json:"id"`
	Title     string            `json:"title"`
	Message   string            `json:"message"`
	Target    any               `json:"target"`
	SentAt    any               `json:"sent_at"`
	CreatedBy any               `json:"created_by"`
	CreatedAt httpx.LaravelTime `json:"created_at"`
	UpdatedAt httpx.LaravelTime `json:"updated_at"`
}

func output(n row) response {
	var target any
	if len(n.Target) > 0 {
		_ = json.Unmarshal(n.Target, &target)
	}
	var sent any
	if n.SentAt.Valid {
		sent = httpx.LaravelTime(n.SentAt.Time)
	}
	var creator any
	if n.CreatedBy.Valid {
		creator = n.CreatedBy.Int64
	}
	return response{n.ID, n.Title, n.Message, target, sent, creator, httpx.LaravelTime(n.CreatedAt), httpx.LaravelTime(n.UpdatedAt)}
}

func (h *Handler) Index(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `SELECT id,title,message,target,sent_at,created_by,created_at,updated_at FROM news ORDER BY created_at DESC`)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	out := []response{}
	for rows.Next() {
		n, err := scan(rows)
		if err != nil {
			serverError(w)
			return
		}
		out = append(out, output(n))
	}
	httpx.JSON(w, http.StatusOK, out)
}

type input struct {
	Title   string `json:"title"`
	Message string `json:"message"`
	Target  any    `json:"target"`
}

func validate(w http.ResponseWriter, r *http.Request) (input, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	var in input
	d := json.NewDecoder(r.Body)
	d.UseNumber()
	if d.Decode(&in) != nil {
		httpx.JSON(w, http.StatusBadRequest, httpx.Message{Message: "Dữ liệu JSON không hợp lệ"})
		return in, false
	}
	v := httpx.NewValidation()
	if strings.TrimSpace(in.Title) == "" {
		v.Add("title", "The title field is required.")
	} else if len([]rune(in.Title)) > 255 {
		v.Add("title", "The title field must not be greater than 255 characters.")
	}
	if strings.TrimSpace(in.Message) == "" {
		v.Add("message", "The message field is required.")
	}
	if v.Failed() {
		httpx.WriteValidationFailed(w, v)
		return in, false
	}
	return in, true
}

func (h *Handler) Store(w http.ResponseWriter, r *http.Request) {
	in, ok := validate(w, r)
	if !ok {
		return
	}
	p, _ := authn.PrincipalFrom(r.Context())
	target := in.Target
	if target == nil {
		target = "both"
	}
	raw, err := encode(target)
	if err != nil {
		serverError(w)
		return
	}
	now := time.Now().UTC()
	result, err := h.db.ExecContext(r.Context(), `INSERT INTO news (title,message,target,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?)`, in.Title, in.Message, raw, p.User.ID, now, now)
	if err != nil {
		serverError(w)
		return
	}
	id, _ := result.LastInsertId()
	n, err := h.find(r.Context(), id, false)
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusCreated, output(n))
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	in, ok := validate(w, r)
	if !ok {
		return
	}
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	n, err := findTx(r, tx, id, true)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if n.SentAt.Valid {
		already(w, "sửa")
		return
	}
	target := n.Target
	if in.Target != nil {
		target, err = encode(in.Target)
		if err != nil {
			serverError(w)
			return
		}
	}
	now := time.Now().UTC()
	if _, err = tx.ExecContext(r.Context(), `UPDATE news SET title=?,message=?,target=?,updated_at=? WHERE id=?`, in.Title, in.Message, target, now, id); err != nil || tx.Commit() != nil {
		serverError(w)
		return
	}
	n.Title = in.Title
	n.Message = in.Message
	n.Target = target
	n.UpdatedAt = now
	httpx.JSON(w, http.StatusOK, output(n))
}

func (h *Handler) Destroy(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	n, err := findTx(r, tx, id, true)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if n.SentAt.Valid {
		already(w, "xoá")
		return
	}
	if _, err = tx.ExecContext(r.Context(), `DELETE FROM news WHERE id=?`, id); err != nil || tx.Commit() != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, httpx.Message{Message: "Đã xoá thông báo"})
}

func (h *Handler) Send(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	n, err := findTx(r, tx, id, true)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if n.SentAt.Valid {
		already(w, "gửi lại")
		return
	}
	now := time.Now().UTC()
	if _, err = tx.ExecContext(r.Context(), `UPDATE news SET sent_at=?,updated_at=? WHERE id=?`, now, now, id); err != nil {
		serverError(w)
		return
	}
	rows, err := tx.QueryContext(r.Context(), `SELECT id FROM users WHERE role IN ('admin','seller','staff_a','pd','csf','marvel')`)
	if err != nil {
		serverError(w)
		return
	}
	ids := []int64{}
	for rows.Next() {
		var uid int64
		if rows.Scan(&uid) != nil {
			rows.Close()
			serverError(w)
			return
		}
		ids = append(ids, uid)
	}
	rows.Close()
	data := map[string]any{"news_id": id, "icon": "📰", "source": "staff_b"}
	for _, uid := range ids {
		if _, err = notificationapi.Send(r.Context(), tx, uid, "news", n.Title, n.Message, data); err != nil {
			serverError(w)
			return
		}
	}
	if err = tx.Commit(); err != nil {
		serverError(w)
		return
	}
	n.SentAt = sql.NullTime{Time: now, Valid: true}
	n.UpdatedAt = now
	httpx.JSON(w, http.StatusOK, output(n))
}

type scanRow interface{ Scan(...any) error }

func scan(s scanRow) (row, error) {
	var n row
	err := s.Scan(&n.ID, &n.Title, &n.Message, &n.Target, &n.SentAt, &n.CreatedBy, &n.CreatedAt, &n.UpdatedAt)
	return n, err
}
func (h *Handler) find(ctx context.Context, id int64, lock bool) (row, error) {
	query := `SELECT id,title,message,target,sent_at,created_by,created_at,updated_at FROM news WHERE id=?`
	if lock {
		query += ` FOR UPDATE`
	}
	return scan(h.db.QueryRowContext(ctx, query, id))
}
func findTx(r *http.Request, tx *sql.Tx, id int64, lock bool) (row, error) {
	q := `SELECT id,title,message,target,sent_at,created_by,created_at,updated_at FROM news WHERE id=?`
	if lock {
		q += ` FOR UPDATE`
	}
	return scan(tx.QueryRowContext(r.Context(), q, id))
}
func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}
func encode(v any) ([]byte, error) {
	var b bytes.Buffer
	e := json.NewEncoder(&b)
	e.SetEscapeHTML(false)
	if err := e.Encode(v); err != nil {
		return nil, err
	}
	return bytes.TrimSpace(b.Bytes()), nil
}
func already(w http.ResponseWriter, action string) {
	httpx.JSON(w, http.StatusConflict, httpx.Message{Message: "Thông báo đã được gửi tới Admin & Seller nên không thể " + action + "."})
}
func notFound(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Not Found"})
}
func serverError(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusInternalServerError, httpx.Message{Message: "Server Error"})
}
