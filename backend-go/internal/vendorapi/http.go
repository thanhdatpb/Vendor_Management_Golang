package vendorapi

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"vendorhub/internal/dbjson"
	"vendorhub/internal/httpx"
	"vendorhub/internal/media"
	"vendorhub/internal/notificationapi"
)

type Handler struct {
	db            *sql.DB
	media         media.Storage
	mediaRoot     string
	extractScript string
}

func (h *Handler) WithExtractScript(path string) *Handler {
	h.extractScript = path
	return h
}

func NewHandler(db *sql.DB) *Handler { return &Handler{db: db} }

func (h *Handler) WithMediaRoot(root string) *Handler {
	h.media = media.Local{Root: root}
	h.mediaRoot = root
	return h
}

func (h *Handler) WithStorage(storage media.Storage) *Handler {
	h.media = storage
	return h
}

var casts = map[string]dbjson.Cast{"id": dbjson.Integer, "pricing1": dbjson.Float, "pricing2": dbjson.Float, "eco_price": dbjson.Float, "eco_total": dbjson.Float, "fast_price": dbjson.Float, "fast_total": dbjson.Float, "express_price": dbjson.Float, "express_total": dbjson.Float, "overnight_price": dbjson.Float, "overnight_total": dbjson.Float, "production_price": dbjson.Float, "shipping_price": dbjson.Float, "product_price": dbjson.Float, "total_cost": dbjson.Float, "media_urls": dbjson.JSON, "created_at": dbjson.LaravelTime, "updated_at": dbjson.LaravelTime, "deleted_at": dbjson.LaravelTime}
var writable = map[string]bool{"name": true, "vendor_type": true, "product_type": true, "size": true, "optional": true, "overview": true, "avg_time_vendor": true, "avg_time_actual": true, "notes": true, "media_url": true, "media_urls": true, "pricing1": true, "pricing2": true, "eco_price": true, "eco_total": true, "fast_price": true, "fast_total": true, "express_price": true, "express_total": true, "overnight_price": true, "overnight_total": true, "phone": true, "email": true, "category": true, "product_price": true, "production_price": true, "shipping_price": true, "total_cost": true}
var prices = map[string]bool{"pricing1": true, "pricing2": true, "eco_price": true, "eco_total": true, "fast_price": true, "fast_total": true, "express_price": true, "express_total": true, "overnight_price": true, "overnight_total": true, "product_price": true, "production_price": true, "shipping_price": true, "total_cost": true}

func (h *Handler) Index(w http.ResponseWriter, r *http.Request) {
	per := queryInt(r, "per_page", 20)
	if per < 1 {
		per = 20
	}
	if per > 5000 {
		per = 5000
	}
	page := queryInt(r, "page", 1)
	if page < 1 {
		page = 1
	}
	where := []string{"deleted_at IS NULL"}
	args := []any{}
	if value := strings.TrimSpace(r.URL.Query().Get("product_type")); value != "" {
		where = append(where, "product_type=?")
		args = append(args, value)
	}
	base := " FROM vendors WHERE " + strings.Join(where, " AND ")
	var total int
	if h.db.QueryRowContext(r.Context(), "SELECT COUNT(*)"+base, args...).Scan(&total) != nil {
		serverError(w)
		return
	}
	query := "SELECT *" + base + " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	listArgs := append(append([]any{}, args...), per, (page-1)*per)
	rows, err := h.db.QueryContext(r.Context(), query, listArgs...)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	items, err := dbjson.Rows(rows, casts)
	if err != nil {
		serverError(w)
		return
	}
	last := (total + per - 1) / per
	if last < 1 {
		last = 1
	}
	from := 0
	to := 0
	if total > 0 {
		from = (page-1)*per + 1
		to = from + len(items) - 1
	}
	paginator := map[string]any{"current_page": page, "data": items, "from": from, "last_page": last, "per_page": per, "to": to, "total": total, "first_page_url": nil, "last_page_url": nil, "next_page_url": nil, "prev_page_url": nil, "path": r.URL.Path, "links": []any{}}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": paginator})
}

func (h *Handler) Show(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	item, err := h.one(r, id)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) Store(w http.ResponseWriter, r *http.Request) {
	in, ok := decode(w, r)
	if !ok {
		return
	}
	clean, v := validate(in, false)
	if v.Failed() {
		httpx.WriteValidationFailed(w, v)
		return
	}
	if blank(clean["name"]) {
		clean["name"] = clean["vendor_type"]
	}
	now := time.Now().UTC()
	clean["created_at"] = now
	clean["updated_at"] = now
	id, err := insert(r.Context(), h.db, "vendors", clean)
	if err != nil {
		serverError(w)
		return
	}
	item, err := h.oneID(r.Context(), id)
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]any{"success": true, "message": "Tạo vendor thành công!", "data": item})
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	if _, err := h.one(r, id); errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	} else if err != nil {
		serverError(w)
		return
	}
	in, ok := decode(w, r)
	if !ok {
		return
	}
	clean, v := validate(in, true)
	if v.Failed() {
		httpx.WriteValidationFailed(w, v)
		return
	}
	if _, hasName := clean["name"]; !hasName {
		if vendorType, changed := clean["vendor_type"]; changed {
			clean["name"] = vendorType
		}
	}
	if len(clean) > 0 {
		clean["updated_at"] = time.Now().UTC()
		if err := update(r.Context(), h.db, "vendors", id, clean); err != nil {
			serverError(w)
			return
		}
	}
	item, err := h.oneID(r.Context(), id)
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "message": "Cập nhật vendor thành công!", "data": item})
}

func (h *Handler) Destroy(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	result, err := h.db.ExecContext(r.Context(), `UPDATE vendors SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL`, time.Now().UTC(), time.Now().UTC(), id)
	if err != nil {
		serverError(w)
		return
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		notFound(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "message": "Đã xóa vendor thành công!"})
}

func (h *Handler) Truncate(w http.ResponseWriter, r *http.Request) {
	if _, err := h.db.ExecContext(r.Context(), `TRUNCATE TABLE vendors`); err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "message": "Đã xóa toàn bộ dữ liệu vendor thành công!"})
}

func (h *Handler) Compare(w http.ResponseWriter, r *http.Request) {
	productID := r.URL.Query().Get("product_id")
	var productType string
	if h.db.QueryRowContext(r.Context(), `SELECT product_type FROM products WHERE id=? AND deleted_at IS NULL`, productID).Scan(&productType) != nil {
		notFound(w)
		return
	}
	rows, err := h.db.QueryContext(r.Context(), `SELECT * FROM vendors WHERE product_type=? AND deleted_at IS NULL`, productType)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	vendors, err := dbjson.Rows(rows, casts)
	if err != nil {
		serverError(w)
		return
	}
	if len(vendors) == 0 {
		httpx.JSON(w, http.StatusOK, httpx.Message{Message: "No vendors found"})
		return
	}
	for _, v := range vendors {
		v["score"] = num(v["pricing1"]) + num(v["eco_total"])
	}
	field := "eco_total"
	if r.URL.Query().Get("strategy") == "cost" {
		field = "pricing1"
	}
	sort.SliceStable(vendors, func(i, j int) bool { return num(vendors[i][field]) < num(vendors[j][field]) })
	top := vendors
	if len(top) > 2 {
		top = top[:2]
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"product_type": productType, "top2": top, "vendors": vendors})
}

func (h *Handler) Select(w http.ResponseWriter, r *http.Request) {
	productID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		notFound(w)
		return
	}
	in, ok := decode(w, r)
	if !ok {
		return
	}
	vendorID, ok := positiveInt(in["vendor_id"])
	if !ok {
		v := httpx.NewValidation()
		v.Add("vendor_id", "The vendor id field is required.")
		httpx.WriteValidationFailed(w, v)
		return
	}
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	var vendorType, productType sql.NullString
	if tx.QueryRowContext(r.Context(), `SELECT vendor_type,product_type FROM vendors WHERE id=? AND deleted_at IS NULL`, vendorID).Scan(&vendorType, &productType) != nil {
		v := httpx.NewValidation()
		v.Add("vendor_id", "The selected vendor id is invalid.")
		httpx.WriteValidationFailed(w, v)
		return
	}
	var createdBy sql.NullInt64
	var requestType sql.NullString
	if tx.QueryRowContext(r.Context(), `SELECT created_by,product_type FROM products WHERE id=? AND deleted_at IS NULL FOR UPDATE`, productID).Scan(&createdBy, &requestType) != nil {
		notFound(w)
		return
	}
	if _, err = tx.ExecContext(r.Context(), `UPDATE products SET vendor_id=?,updated_at=? WHERE id=?`, vendorID, time.Now().UTC(), productID); err != nil {
		serverError(w)
		return
	}
	if createdBy.Valid {
		body := `Request "` + requestType.String + `" đã được cung cấp vendor: ` + vendorType.String + ` - ` + productType.String + `.`
		_, err = notificationapi.Send(r.Context(), tx, createdBy.Int64, "vendor_assigned", "🏪 Vendor đã được cung cấp", body, map[string]any{"product_id": productID, "product_type": requestType.String})
	}
	if err != nil || tx.Commit() != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "message": "Vendor selected successfully", "product": map[string]any{"id": productID, "vendor_id": vendorID}})
}

func (h *Handler) one(r *http.Request, id int64) (map[string]any, error) {
	return h.oneID(r.Context(), id)
}
func (h *Handler) oneID(ctx context.Context, id int64) (map[string]any, error) {
	rows, err := h.db.QueryContext(ctx, `SELECT * FROM vendors WHERE id=? AND deleted_at IS NULL LIMIT 1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items, err := dbjson.Rows(rows, casts)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, sql.ErrNoRows
	}
	return items[0], nil
}
func validate(in map[string]any, partial bool) (map[string]any, *httpx.Validation) {
	out := map[string]any{}
	v := httpx.NewValidation()
	for key, value := range in {
		if !writable[key] {
			continue
		}
		if key == "media_urls" {
			raw, err := json.Marshal(value)
			if err == nil {
				out[key] = raw
			}
			continue
		}
		if prices[key] && value != nil {
			n, ok := number(value)
			if !ok || n < 0 {
				v.Add(key, "The "+strings.ReplaceAll(key, "_", " ")+" field must be a number.")
				continue
			}
			out[key] = n
			continue
		}
		if s, ok := value.(string); ok {
			if len([]rune(s)) > 255 && (key == "name" || key == "product_type" || key == "vendor_type" || key == "size" || key == "optional") {
				v.Add(key, "The "+strings.ReplaceAll(key, "_", " ")+" field must not be greater than 255 characters.")
				continue
			}
			out[key] = s
		} else if value == nil {
			out[key] = nil
		}
	}
	if !partial {
		if blank(out["product_type"]) {
			v.Add("product_type", "The product type field is required.")
		}
		if blank(out["vendor_type"]) {
			v.Add("vendor_type", "The vendor type field is required.")
		}
	}
	if kind, exists := out["vendor_type"]; exists && !blank(kind) {
		s := fmt.Sprint(kind)
		if s != "Old" && s != "New" && s != "Best Seller" {
			v.Add("vendor_type", "The selected vendor type is invalid.")
		}
	}
	return out, v
}
func decode(w http.ResponseWriter, r *http.Request) (map[string]any, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, 4<<20)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		serverError(w)
		return nil, false
	}
	var in map[string]any
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	if d.Decode(&in) != nil {
		httpx.JSON(w, http.StatusBadRequest, httpx.Message{Message: "Dữ liệu JSON không hợp lệ"})
		return nil, false
	}
	return in, true
}

type execer interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func insert(ctx context.Context, db execer, table string, values map[string]any) (int64, error) {
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	marks := make([]string, len(keys))
	args := make([]any, len(keys))
	for i, k := range keys {
		marks[i] = "?"
		args[i] = values[k]
	}
	result, err := db.ExecContext(ctx, `INSERT INTO `+table+` (`+strings.Join(keys, ",")+`) VALUES (`+strings.Join(marks, ",")+`)`, args...)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}
func update(ctx context.Context, db execer, table string, id int64, values map[string]any) error {
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	sets := make([]string, len(keys))
	args := make([]any, 0, len(keys)+1)
	for i, k := range keys {
		sets[i] = k + "=?"
		args = append(args, values[k])
	}
	args = append(args, id)
	_, err := db.ExecContext(ctx, `UPDATE `+table+` SET `+strings.Join(sets, ",")+` WHERE id=?`, args...)
	return err
}
func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}
func queryInt(r *http.Request, key string, fallback int) int {
	n, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil {
		return fallback
	}
	return n
}
func positiveInt(v any) (int64, bool) {
	switch x := v.(type) {
	case json.Number:
		n, e := strconv.ParseInt(x.String(), 10, 64)
		return n, e == nil && n > 0
	case float64:
		return int64(x), x > 0 && x == float64(int64(x))
	case string:
		n, e := strconv.ParseInt(x, 10, 64)
		return n, e == nil && n > 0
	}
	return 0, false
}
func number(v any) (float64, bool) {
	switch x := v.(type) {
	case json.Number:
		n, e := x.Float64()
		return n, e == nil
	case float64:
		return x, true
	case string:
		n, e := strconv.ParseFloat(x, 64)
		return n, e == nil
	}
	return 0, false
}
func num(v any) float64 {
	switch x := v.(type) {
	case httpx.PHPFloat:
		return float64(x)
	case float64:
		return x
	case int64:
		return float64(x)
	}
	return 0
}
func blank(v any) bool { return v == nil || strings.TrimSpace(fmt.Sprint(v)) == "" }
func notFound(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Not Found"})
}
func serverError(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusInternalServerError, httpx.Message{Message: "Server Error"})
}
