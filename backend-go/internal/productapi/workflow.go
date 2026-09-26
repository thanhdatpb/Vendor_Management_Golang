package productapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"vendorhub/internal/authn"
	"vendorhub/internal/dbjson"
	"vendorhub/internal/httpx"
	"vendorhub/internal/notificationapi"
)

func (h *Handler) Submit(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	principal, _ := authn.PrincipalFrom(r.Context())
	meta, err := h.meta(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Product not found"})
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if !principal.User.IsAdmin() && !sameProjectOrOwner(principal.User, meta) {
		httpx.JSON(w, http.StatusForbidden, httpx.Message{Message: "Forbidden"})
		return
	}
	if meta.Status != "draft" && meta.Status != "rejected" {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Sản phẩm đã được gửi duyệt"})
		return
	}
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	now := time.Now().UTC()
	if _, err = tx.ExecContext(r.Context(), `UPDATE products SET status='pending',submitted_by=?,submitted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL`, principal.User.ID, now, now, id); err != nil {
		serverError(w)
		return
	}
	data := map[string]any{"product_id": id, "product_type": meta.Type, "project": meta.Project}
	if err = sendToRoles(r.Context(), tx, []string{"admin"}, "new_form", "Request mới cần duyệt", "Seller của project "+fallback(meta.Project, "Không xác định")+" vừa gửi form request mới.", data); err != nil || tx.Commit() != nil {
		serverError(w)
		return
	}
	h.announce(map[string]any{"id": id, "status": "pending", "project": meta.Project, "product_type": meta.Type, "created_by": meta.CreatedBy}, "submitted")
	httpx.JSON(w, http.StatusOK, httpx.Message{Message: "Gửi Form cho Admin thành công"})
}

func (h *Handler) Pending(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), productSelect+` FROM products p LEFT JOIN users u ON u.id=p.created_by WHERE p.deleted_at IS NULL AND p.status='pending'`)
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
	httpx.JSON(w, http.StatusOK, items)
}

func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `SELECT LOWER(TRIM(u.project)),p.status,COUNT(*) FROM products p JOIN users u ON u.id=p.created_by WHERE p.deleted_at IS NULL GROUP BY LOWER(TRIM(u.project)),p.status`)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	labels := map[string]string{
		"happy": "Happy Project", "happy project": "Happy Project",
		"creative": "Creative Project", "creative project": "Creative Project",
		"global": "Global Project", "global project": "Global Project",
		"hapify84": "Hapify84 Project", "hapify84 project": "Hapify84 Project",
	}
	empty := func() map[string]int64 {
		return map[string]int64{"pending": 0, "approved": 0, "rejected": 0, "total": 0}
	}
	overall := empty()
	projects := map[string]map[string]int64{}
	for _, label := range []string{"Happy Project", "Creative Project", "Global Project", "Hapify84 Project"} {
		projects[label] = empty()
	}
	for rows.Next() {
		var project sql.NullString
		var status string
		var count int64
		if rows.Scan(&project, &status, &count) != nil {
			serverError(w)
			return
		}
		if status == "reject" {
			status = "rejected"
		}
		if status != "pending" && status != "approved" && status != "rejected" {
			continue
		}
		overall[status] += count
		overall["total"] += count
		if label := labels[project.String]; label != "" {
			projects[label][status] += count
			projects[label]["total"] += count
		}
	}
	if rows.Err() != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"overall": overall, "projects": projects})
}

func (h *Handler) Approve(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	in, _, ok := decodeInput(w, r)
	if !ok {
		return
	}
	approved := true
	if value, exists := in["approved"]; exists {
		approved = value != false && !strings.EqualFold(fmt.Sprint(value), "false") && fmt.Sprint(value) != "0"
	}
	reason := strings.TrimSpace(fmt.Sprint(in["reason"]))
	h.review(w, r, id, approved, reason)
}

func (h *Handler) Reject(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	in, _, ok := decodeInput(w, r)
	if !ok {
		return
	}
	h.review(w, r, id, false, strings.TrimSpace(fmt.Sprint(in["reason"])))
}

func (h *Handler) review(w http.ResponseWriter, r *http.Request, id int64, approved bool, reason string) {
	principal, _ := authn.PrincipalFrom(r.Context())
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	var createdBy sql.NullInt64
	var productType, project sql.NullString
	err = tx.QueryRowContext(r.Context(), `SELECT p.created_by,p.product_type,u.project FROM products p LEFT JOIN users u ON u.id=p.created_by WHERE p.id=? AND p.deleted_at IS NULL FOR UPDATE`, id).Scan(&createdBy, &productType, &project)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	status := "rejected"
	if approved {
		status, reason = "approved", ""
	}
	now := time.Now().UTC()
	if _, err = tx.ExecContext(r.Context(), `UPDATE products SET status=?,reviewed_by=?,reviewed_at=?,rejection_reason=?,updated_at=? WHERE id=?`, status, principal.User.ID, now, nullableString(reason), now, id); err != nil {
		serverError(w)
		return
	}
	data := map[string]any{"product_id": id, "product_type": productType.String, "project": project.String}
	if createdBy.Valid {
		title, body := "❌ Request bị từ chối", `Request "`+productType.String+`" bị Admin từ chối.`
		if approved {
			title, body = "✅ Request đã được duyệt", `Request "`+productType.String+`" đã được Admin phê duyệt.`
		} else if reason != "" {
			body += " Lý do: " + reason
		}
		if _, err = notificationapi.Send(r.Context(), tx, createdBy.Int64, status, title, body, data); err != nil {
			serverError(w)
			return
		}
	}
	if approved {
		err = sendToRoles(r.Context(), tx, []string{"staff_b", "vendor"}, "needs_vendor", "🔧 Request cần cung cấp vendor", `Request "`+productType.String+`" đã được Admin duyệt, cần cung cấp vendor.`, data)
	}
	if err != nil || tx.Commit() != nil {
		serverError(w)
		return
	}
	h.announce(map[string]any{"id": id, "status": status, "project": project.String, "product_type": productType.String, "created_by": createdBy.Int64}, status)
	message := "Product rejected"
	if approved {
		message = "Product approved"
	}
	httpx.JSON(w, http.StatusOK, httpx.Message{Message: message})
}

func (h *Handler) Feedback(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	in, _, ok := decodeInput(w, r)
	if !ok {
		return
	}
	feedback := strings.TrimSpace(fmt.Sprint(in["feedback"]))
	validation := httpx.NewValidation()
	if feedback == "" {
		validation.Add("feedback", "The feedback field is required.")
	} else if len([]rune(feedback)) > 1000 {
		validation.Add("feedback", "The feedback field must not be greater than 1000 characters.")
	}
	if validation.Failed() {
		httpx.WriteValidationFailed(w, validation)
		return
	}
	meta, err := h.meta(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if meta.CreatedBy != 0 {
		_, err = notificationapi.Send(r.Context(), h.db, meta.CreatedBy, "feedback", "💬 Có phản hồi mới từ Staff B", `Request "`+meta.Type+`": `+feedback, map[string]any{"product_id": id, "product_type": meta.Type})
	}
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "message": "Đã gửi phản hồi thành công!"})
}

func (h *Handler) Deadline(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	principal, _ := authn.PrincipalFrom(r.Context())
	if !principal.User.IsAdmin() && !isStaff(principal.User) {
		httpx.JSON(w, http.StatusForbidden, httpx.Message{Message: "Forbidden - Bạn không có quyền cập nhật deadline"})
		return
	}
	in, _, ok := decodeInput(w, r)
	if !ok {
		return
	}
	deadline := strings.TrimSpace(fmt.Sprint(in["deadline_date"]))
	date, err := time.Parse("2006-01-02", deadline)
	validation := httpx.NewValidation()
	today := time.Now().In(time.Local).Truncate(24 * time.Hour)
	if err != nil || date.Before(today) {
		validation.Add("deadline_date", "The deadline date must be a date after or equal to today.")
		httpx.WriteValidationFailed(w, validation)
		return
	}
	meta, err := h.meta(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(r.Context(), `UPDATE products SET deadline_date=?,updated_at=? WHERE id=? AND deleted_at IS NULL`, deadline, time.Now().UTC(), id); err != nil {
		serverError(w)
		return
	}
	if meta.CreatedBy != 0 && meta.CreatedBy != principal.User.ID {
		_, err = notificationapi.Send(r.Context(), tx, meta.CreatedBy, "deadline_updated", "📅 Deadline đã được cập nhật", `Request "`+meta.Type+`" có deadline mới: `+date.Format("02/01/2006"), map[string]any{"product_id": id, "product_type": meta.Type, "deadline_date": date.Format("02/01/2006")})
	}
	if err != nil || tx.Commit() != nil {
		serverError(w)
		return
	}
	item, err := h.one(r.Context(), id)
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"message": "Đã cập nhật deadline thành công", "product": item})
}

func (h *Handler) AssignVendors(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	in, _, ok := decodeInput(w, r)
	if !ok {
		return
	}
	meta, err := h.meta(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if meta.Status != "approved" {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Chỉ được gán vendor cho sản phẩm đã được Admin duyệt"})
		return
	}
	vendors, ok := in["vendors"].([]any)
	if !ok {
		vendors = []any{}
	}
	raw, _ := json.Marshal(vendors)
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(r.Context(), `UPDATE products SET assigned_vendors=?,updated_at=? WHERE id=? AND deleted_at IS NULL`, raw, time.Now().UTC(), id); err != nil {
		serverError(w)
		return
	}
	if meta.CreatedBy != 0 && len(vendors) > 0 {
		names, fileIDs := vendorSummary(vendors)
		body := fmt.Sprintf("Request %q đã được cung cấp %d vendor để tham khảo.", meta.Type, len(vendors))
		if len(names) == 1 {
			body = fmt.Sprintf("Vendor %q đã được cung cấp cho request %q.", names[0], meta.Type)
		} else if len(names) > 1 {
			body = fmt.Sprintf("%d vendor (%s) đã được cung cấp cho request %q.", len(names), strings.Join(first(names, 5), ", "), meta.Type)
		}
		_, err = notificationapi.Send(r.Context(), tx, meta.CreatedBy, "vendor_assigned", "🏪 Vendor đã được cung cấp", body, map[string]any{"product_id": id, "product_type": meta.Type, "project": meta.Project, "vendor_names": names, "file_ids": fileIDs})
	}
	if err != nil || tx.Commit() != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "assigned_vendors": vendors})
}

func (h *Handler) VendorComparison(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	meta, err := h.meta(r.Context(), id)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	rows, err := h.db.QueryContext(r.Context(), `SELECT * FROM vendors WHERE category=? AND deleted_at IS NULL`, meta.Type)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	items, err := dbjson.Rows(rows, nil)
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"product_type": meta.Type, "vendors": items})
}

func vendorSummary(vendors []any) ([]string, []string) {
	nameSet, fileSet := map[string]bool{}, map[string]bool{}
	for _, value := range vendors {
		vendor, ok := value.(map[string]any)
		if !ok {
			continue
		}
		name := strings.TrimSpace(fmt.Sprint(vendor["vendorName"]))
		if name == "" || name == "<nil>" {
			name = strings.TrimSpace(fmt.Sprint(vendor["name"]))
		}
		if name != "" && name != "<nil>" {
			nameSet[name] = true
		}
		fileID := strings.TrimSpace(fmt.Sprint(vendor["source_file_id"]))
		if fileID != "" && fileID != "<nil>" {
			fileSet[fileID] = true
		}
	}
	names, fileIDs := keys(nameSet), keys(fileSet)
	return names, fileIDs
}

func keys(set map[string]bool) []string {
	out := make([]string, 0, len(set))
	for key := range set {
		out = append(out, key)
	}
	sort.Strings(out)
	return out
}

func first(values []string, limit int) []string {
	if len(values) <= limit {
		return values
	}
	return values[:limit]
}

func fallback(value, other string) string {
	if strings.TrimSpace(value) == "" {
		return other
	}
	return value
}
