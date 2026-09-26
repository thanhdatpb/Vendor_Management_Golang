// Package productapi ports the Laravel ProductController contract to Go.
package productapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"vendorhub/internal/authn"
	"vendorhub/internal/dbjson"
	"vendorhub/internal/httpx"
	"vendorhub/internal/media"
	"vendorhub/internal/notificationapi"
	"vendorhub/internal/realtime"
)

type Handler struct {
	db     *sql.DB
	media  media.Storage
	stream realtime.Publisher
}

func (h *Handler) WithPublisher(stream realtime.Publisher) *Handler {
	h.stream = stream
	return h
}

func NewHandler(db *sql.DB, mediaRoot string) *Handler {
	return &Handler{db: db, media: media.Local{Root: mediaRoot}}
}

func (h *Handler) WithStorage(storage media.Storage) *Handler {
	h.media = storage
	return h
}

func (h *Handler) Index(w http.ResponseWriter, r *http.Request) {
	principal, _ := authn.PrincipalFrom(r.Context())
	perPage := queryInt(r, "per_page", 20)
	if perPage < 1 {
		perPage = 20
	}
	if perPage > 200 {
		perPage = 200
	}
	page := queryInt(r, "page", 1)
	if page < 1 {
		page = 1
	}

	where := []string{"p.deleted_at IS NULL"}
	args := []any{}
	if isStaff(principal.User) {
		if principal.User.Project != nil && strings.TrimSpace(*principal.User.Project) != "" {
			where = append(where, "u.project=?")
			args = append(args, *principal.User.Project)
		} else {
			where = append(where, "p.created_by=?")
			args = append(args, principal.User.ID)
		}
	}
	if search := strings.TrimSpace(r.URL.Query().Get("search")); search != "" {
		where = append(where, "p.product_type LIKE ?")
		args = append(args, "%"+search+"%")
	}
	if status := strings.TrimSpace(r.URL.Query().Get("status")); status != "" {
		if status == "rejected" {
			where = append(where, "p.status IN ('rejected','reject')")
		} else {
			where = append(where, "p.status=?")
			args = append(args, status)
		}
	}
	if project := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("project"))); project != "" {
		short := strings.TrimSuffix(project, " project")
		where = append(where, "LOWER(TRIM(u.project)) IN (?,?)")
		args = append(args, project, short)
	}
	base := " FROM products p LEFT JOIN users u ON u.id=p.created_by WHERE " + strings.Join(where, " AND ")
	var total int
	if err := h.db.QueryRowContext(r.Context(), "SELECT COUNT(*)"+base, args...).Scan(&total); err != nil {
		serverError(w)
		return
	}
	listArgs := append(append([]any{}, args...), perPage, (page-1)*perPage)
	rows, err := h.db.QueryContext(r.Context(), productSelect+base+" ORDER BY p.created_at DESC LIMIT ? OFFSET ?", listArgs...)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	items, err := dbjson.Rows(rows, productCasts)
	if err != nil {
		serverError(w)
		return
	}
	lastPage := (total + perPage - 1) / perPage
	if lastPage < 1 {
		lastPage = 1
	}
	from, to := 0, 0
	if total > 0 {
		from = (page-1)*perPage + 1
		to = from + len(items) - 1
	}
	paginator := map[string]any{
		"current_page": page, "data": items, "from": from, "last_page": lastPage,
		"per_page": perPage, "to": to, "total": total, "path": r.URL.Path,
		"first_page_url": nil, "last_page_url": nil, "next_page_url": nil,
		"prev_page_url": nil, "links": []any{},
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": paginator})
}

func (h *Handler) Show(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	item, err := h.one(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "data": item})
}

func (h *Handler) Approved(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), productSelect+` FROM products p LEFT JOIN users u ON u.id=p.created_by WHERE p.deleted_at IS NULL AND p.status='approved' ORDER BY p.created_at DESC`)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	items, err := dbjson.Rows(rows, productCasts)
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"data": items})
}

func (h *Handler) Store(w http.ResponseWriter, r *http.Request) {
	principal, _ := authn.PrincipalFrom(r.Context())
	in, files, ok := decodeInput(w, r)
	if !ok {
		return
	}
	clean, validation := cleanInput(in, false)
	if validation.Failed() {
		httpx.WriteValidationFailed(w, validation)
		return
	}
	if !h.vendorExists(r.Context(), clean["vendor_id"]) {
		validation.Add("vendor_id", "The selected vendor id is invalid.")
		httpx.WriteValidationFailed(w, validation)
		return
	}
	urls, mediaPath, mediaKind, err := saveUploads(r.Context(), files, h.media)
	if err != nil {
		validation.Add("media", err.Error())
		httpx.WriteValidationFailed(w, validation)
		return
	}
	now := time.Now().UTC()
	clean["created_by"] = principal.User.ID
	clean["created_at"] = now
	clean["updated_at"] = now
	clean["media_urls"] = mustJSON(urls)
	clean["media_path"] = nullableString(mediaPath)
	clean["media_kind"] = nullableString(mediaKind)
	if principal.User.IsAdmin() {
		clean["status"] = "approved"
		clean["submitted_by"], clean["reviewed_by"] = principal.User.ID, principal.User.ID
		clean["submitted_at"], clean["reviewed_at"] = now, now
	} else {
		clean["status"] = "draft"
	}
	id, err := insertMap(r.Context(), h.db, "products", clean)
	if err != nil {
		serverError(w)
		return
	}
	item, err := h.one(r.Context(), id)
	if err != nil {
		serverError(w)
		return
	}
	h.announce(item, "created")
	httpx.JSON(w, http.StatusCreated, item)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	principal, _ := authn.PrincipalFrom(r.Context())
	meta, err := h.meta(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if isStaff(principal.User) {
		if !sameProjectOrOwner(principal.User, meta) {
			httpx.JSON(w, http.StatusForbidden, httpx.Message{Message: "Forbidden - Không cùng project"})
			return
		}
		if meta.Status != "draft" && meta.Status != "rejected" {
			httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Sản phẩm đang chờ duyệt hoặc đã duyệt"})
			return
		}
	}
	in, files, ok := decodeInput(w, r)
	if !ok {
		return
	}
	clean, validation := cleanInput(in, true)
	if validation.Failed() {
		httpx.WriteValidationFailed(w, validation)
		return
	}
	if vendorID, changed := clean["vendor_id"]; changed && !h.vendorExists(r.Context(), vendorID) {
		validation.Add("vendor_id", "The selected vendor id is invalid.")
		httpx.WriteValidationFailed(w, validation)
		return
	}
	newURLs, newPath, newKind, err := saveUploads(r.Context(), files, h.media)
	if err != nil {
		validation.Add("media", err.Error())
		httpx.WriteValidationFailed(w, validation)
		return
	}
	currentURLs := meta.MediaURLs
	if raw, exists := in["delete_media_indices"]; exists {
		currentURLs = withoutIndices(currentURLs, fmt.Sprint(raw))
	}
	currentURLs = append(currentURLs, newURLs...)
	if len(newURLs) > 0 || in["delete_media_indices"] != nil {
		clean["media_urls"] = mustJSON(currentURLs)
		if len(currentURLs) == 0 {
			clean["media_path"], clean["media_kind"] = nil, nil
		} else if newPath != "" && meta.MediaPath == "" {
			clean["media_path"], clean["media_kind"] = newPath, newKind
		}
	}
	if isStaff(principal.User) {
		clean["status"] = "draft"
		clean["reviewed_by"], clean["reviewed_at"], clean["rejection_reason"] = nil, nil, nil
	}
	clean["updated_at"] = time.Now().UTC()
	if err := updateMap(r.Context(), h.db, id, clean); err != nil {
		serverError(w)
		return
	}
	item, err := h.one(r.Context(), id)
	if err != nil {
		serverError(w)
		return
	}
	h.announce(item, "updated")
	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) Destroy(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	principal, _ := authn.PrincipalFrom(r.Context())
	meta, err := h.meta(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Product không tồn tại hoặc đã bị xóa"})
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if !principal.User.IsAdmin() && !isStaff(principal.User) {
		httpx.JSON(w, http.StatusForbidden, httpx.Message{Message: "Forbidden"})
		return
	}
	if !principal.User.IsAdmin() && !principal.User.HasRole("vendor", "staff_b") {
		if !sameProjectOrOwner(principal.User, meta) {
			httpx.JSON(w, http.StatusForbidden, httpx.Message{Message: "Bạn không có quyền xóa sản phẩm của project khác"})
			return
		}
		if meta.Status != "draft" && meta.Status != "rejected" {
			httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Không thể xóa sản phẩm đã gửi duyệt"})
			return
		}
	}
	result, err := h.db.ExecContext(r.Context(), `UPDATE products SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL`, time.Now().UTC(), time.Now().UTC(), id)
	if err != nil {
		serverError(w)
		return
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		notFound(w)
		return
	}
	h.announce(map[string]any{"id": id, "status": meta.Status, "project": meta.Project, "product_type": meta.Type, "created_by": meta.CreatedBy}, "deleted")
	httpx.JSON(w, http.StatusOK, httpx.Message{Message: "Product deleted successfully"})
}

const productSelect = `SELECT p.*,u.project AS project,COALESCE(u.seller_name,u.name) AS seller_name,u.email AS seller_email`

func (h *Handler) one(ctx context.Context, id int64) (map[string]any, error) {
	rows, err := h.db.QueryContext(ctx, productSelect+` FROM products p LEFT JOIN users u ON u.id=p.created_by WHERE p.id=? AND p.deleted_at IS NULL LIMIT 1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items, err := dbjson.Rows(rows, productCasts)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, sql.ErrNoRows
	}
	return items[0], nil
}

type productMeta struct {
	CreatedBy int64
	Status    string
	Project   string
	Type      string
	MediaPath string
	MediaURLs []string
}

func (h *Handler) meta(ctx context.Context, id int64) (productMeta, error) {
	var m productMeta
	var project, productType, mediaPath sql.NullString
	var createdBy sql.NullInt64
	var raw []byte
	err := h.db.QueryRowContext(ctx, `SELECT p.created_by,p.status,u.project,p.product_type,p.media_path,p.media_urls FROM products p LEFT JOIN users u ON u.id=p.created_by WHERE p.id=? AND p.deleted_at IS NULL`, id).
		Scan(&createdBy, &m.Status, &project, &productType, &mediaPath, &raw)
	if err != nil {
		return m, err
	}
	if createdBy.Valid {
		m.CreatedBy = createdBy.Int64
	}
	m.Project, m.Type, m.MediaPath = project.String, productType.String, mediaPath.String
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &m.MediaURLs)
	}
	return m, nil
}

func (h *Handler) vendorExists(ctx context.Context, value any) bool {
	if value == nil {
		return true
	}
	var exists int
	return h.db.QueryRowContext(ctx, `SELECT 1 FROM vendors WHERE id=? AND deleted_at IS NULL`, value).Scan(&exists) == nil
}

func isStaff(user authn.User) bool {
	return user.HasRole("staff", "seller", "staff_a", "vendor", "staff_b")
}

func sameProjectOrOwner(user authn.User, product productMeta) bool {
	if product.CreatedBy == user.ID {
		return true
	}
	return user.Project != nil && *user.Project != "" && product.Project != "" && *user.Project == product.Project
}

func mustJSON(value any) []byte {
	raw, _ := json.Marshal(value)
	return raw
}

func withoutIndices(values []string, raw string) []string {
	remove := map[int]bool{}
	for _, item := range strings.Split(raw, ",") {
		if index, err := strconv.Atoi(strings.TrimSpace(item)); err == nil {
			remove[index] = true
		}
	}
	out := make([]string, 0, len(values))
	for index, value := range values {
		if !remove[index] {
			out = append(out, value)
		}
	}
	return out
}

func (h *Handler) announce(product map[string]any, action string) {
	if h.stream == nil {
		return
	}
	payload := map[string]any{"action": action, "product": map[string]any{
		"id": product["id"], "status": product["status"], "project": product["project"],
		"product_type": product["product_type"], "created_by": product["created_by"],
		"deadline_date": product["deadline_date"],
	}}
	h.stream.Trigger("products", "ProductChanged", payload)
}

func sendToRoles(ctx context.Context, db *sql.Tx, roles []string, kind, title, body string, data any) error {
	marks := make([]string, len(roles))
	args := make([]any, len(roles))
	for i, role := range roles {
		marks[i], args[i] = "?", role
	}
	rows, err := db.QueryContext(ctx, `SELECT id FROM users WHERE role IN (`+strings.Join(marks, ",")+`) AND is_active=1`, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, id := range ids {
		if _, err := notificationapi.Send(ctx, db, id, kind, title, body, data); err != nil {
			return err
		}
	}
	return nil
}
