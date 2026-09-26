package userapi

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"vendorhub/internal/authn"
	"vendorhub/internal/httpx"
)

var validRoles = map[string]bool{"admin": true, "vendor": true, "seller": true, "pd": true, "csf": true, "marvel": true}
var validProjects = map[string]bool{"Happy Project": true, "Creative Project": true, "Global Project": true, "Hapify84 Project": true}

type Handler struct {
	db     *sql.DB
	logger *slog.Logger
}

func NewHandler(db *sql.DB, logger *slog.Logger) *Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return &Handler{db: db, logger: logger}
}

type row struct {
	ID                                                             int64
	Email                                                          string
	FullName, Name, Role, Project, PDProjects, AvatarURL, GoogleID sql.NullString
	IsActive                                                       bool
	LastSeen                                                       sql.NullTime
	CreatedAt                                                      time.Time
}
type scanRow interface{ Scan(...any) error }

func scan(s scanRow) (row, error) {
	var u row
	err := s.Scan(&u.ID, &u.Email, &u.FullName, &u.Name, &u.Role, &u.Project, &u.PDProjects, &u.IsActive, &u.AvatarURL, &u.GoogleID, &u.LastSeen, &u.CreatedAt)
	return u, err
}

const cols = `id,email,full_name,name,role,project,pd_projects,is_active,avatar_url,google_id,last_seen_at,created_at`

func (h *Handler) Users(w http.ResponseWriter, r *http.Request) {
	query := `SELECT id,name,email,role,project,seller_name,full_name,is_active FROM users`
	args := []any{}
	where := []string{}
	if role, ok := r.URL.Query()["role"]; ok {
		where = append(where, "role=?")
		args = append(args, role[0])
	}
	if project, ok := r.URL.Query()["project"]; ok {
		where = append(where, "project=?")
		args = append(args, project[0])
	}
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}
	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id int64
		var name, email, role string
		var project, seller, full sql.NullString
		var active bool
		if rows.Scan(&id, &name, &email, &role, &project, &seller, &full, &active) != nil {
			serverError(w)
			return
		}
		out = append(out, map[string]any{"id": id, "name": name, "email": email, "role": role, "project": null(project), "seller_name": null(seller), "full_name": null(full), "is_active": active})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "data": out})
}

func (h *Handler) Sellers(w http.ResponseWriter, r *http.Request) {
	query := `SELECT id,name,email,project,seller_name,full_name,is_active FROM users WHERE role IN ('staff_a','seller')`
	args := []any{}
	if project, ok := r.URL.Query()["project"]; ok {
		query += " AND project=?"
		args = append(args, project[0])
	}
	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id int64
		var name, email string
		var project, seller, full sql.NullString
		var active bool
		if rows.Scan(&id, &name, &email, &project, &seller, &full, &active) != nil {
			serverError(w)
			return
		}
		out = append(out, map[string]any{"id": id, "name": name, "email": email, "project": null(project), "seller_name": null(seller), "full_name": null(full), "is_active": active})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "data": out})
}

func (h *Handler) Show(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	u, err := h.find(r, id, false)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "data": fullOutput(u)})
}

func (h *Handler) AdminIndex(w http.ResponseWriter, r *http.Request) {
	rows, err := h.db.QueryContext(r.Context(), `SELECT `+cols+` FROM users ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'vendor' THEN 2 WHEN 'csf' THEN 3 WHEN 'marvel' THEN 4 WHEN 'seller' THEN 5 WHEN 'pd' THEN 6 ELSE 0 END, project, full_name`)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		u, err := scan(rows)
		if err != nil {
			serverError(w)
			return
		}
		out = append(out, adminOutput(u))
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"users": out})
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	raw, in, ok := decodeMap(w, r)
	if !ok {
		return
	}
	email := strings.ToLower(strings.TrimSpace(text(in["email"])))
	name := strings.TrimSpace(text(in["full_name"]))
	role := text(in["role"])
	project := optionalText(in["project"])
	pdProjects, projectsOK := stringList(in["pd_projects"])
	v := httpx.NewValidation()
	if email == "" {
		v.Add("email", "The email field is required.")
	} else if a, err := mail.ParseAddress(email); err != nil || a.Address != email {
		v.Add("email", "The email field must be a valid email address.")
	}
	if name == "" {
		v.Add("full_name", "The full name field is required.")
	} else if len([]rune(name)) > 255 {
		v.Add("full_name", "The full name field must not be greater than 255 characters.")
	}
	if !validRoles[role] {
		v.Add("role", "The selected role is invalid.")
	}
	if role == "seller" && project == nil {
		v.Add("project", "Project là bắt buộc khi role là seller")
	}
	if project != nil && !validProjects[*project] {
		v.Add("project", "Project không hợp lệ")
	}
	if !projectsOK {
		v.Add("pd_projects", "The pd projects field must be an array.")
	}
	for _, p := range pdProjects {
		if !validProjects[p] {
			v.Add("pd_projects.0", "Project không hợp lệ")
			break
		}
	}
	if v.Failed() {
		httpx.WriteValidationFailed(w, v)
		return
	}
	_ = raw
	if role != "seller" && role != "pd" {
		project = nil
	}
	if role != "pd" {
		pdProjects = nil
	}
	pdRaw, _ := json.Marshal(pdProjects)
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	dupQuery := `SELECT COUNT(*) FROM users WHERE email=? AND role=?`
	args := []any{email, role}
	if role != "pd" {
		if project == nil {
			dupQuery += ` AND project IS NULL`
		} else {
			dupQuery += ` AND project=?`
			args = append(args, *project)
		}
	}
	var count int
	if tx.QueryRowContext(r.Context(), dupQuery, args...).Scan(&count) != nil {
		serverError(w)
		return
	}
	if count > 0 {
		msg := `Email này đã có ở role "` + role + `" rồi`
		if role == "pd" {
			msg = "Email này đã có tài khoản PD rồi — PD không cần tạo riêng theo project."
		} else if project != nil {
			msg = `Email này đã có ở role "` + role + `" cho project này rồi`
		}
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: msg})
		return
	}
	var googleID, avatar sql.NullString
	err = tx.QueryRowContext(r.Context(), `SELECT google_id,avatar_url FROM users WHERE email=? AND google_id IS NOT NULL LIMIT 1`, email).Scan(&googleID, &avatar)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		serverError(w)
		return
	}
	now := time.Now().UTC()
	result, err := tx.ExecContext(r.Context(), `INSERT INTO users (email,full_name,name,role,project,pd_projects,is_active,password,google_id,avatar_url,created_at,updated_at) VALUES (?,?,?,?,?,?,1,NULL,?,?,?,?)`, email, name, name, role, ptrVal(project), nullableJSON(pdRaw, pdProjects != nil), null(googleID), null(avatar), now, now)
	if err != nil {
		serverError(w)
		return
	}
	id, _ := result.LastInsertId()
	if tx.Commit() != nil {
		serverError(w)
		return
	}
	p, _ := authn.PrincipalFrom(r.Context())
	h.audit("CREATE_USER", p.User, id, email, nil, map[string]any{"full_name": name, "role": role, "project": ptrVal(project), "pd_projects": pdProjects, "is_active": true})
	httpx.JSON(w, http.StatusCreated, map[string]any{"message": "Thêm nhân sự thành công", "user": map[string]any{"id": id, "email": email, "full_name": name, "role": role, "project": ptrVal(project), "pd_projects": emptyList(pdProjects), "is_active": true}})
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	_, in, ok := decodeMap(w, r)
	if !ok {
		return
	}
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	u, err := findTx(r, tx, id, true)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	newRole := valOr(in, "role", str(u.Role))
	newName := valOr(in, "full_name", display(u))
	if !validRoles[newRole] || newName == "" || len([]rune(newName)) > 255 {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Dữ liệu nhân sự không hợp lệ"})
		return
	}
	newProject := u.Project
	if newRole != "seller" && newRole != "pd" {
		newProject = sql.NullString{}
	} else if value, exists := in["project"]; exists {
		p := optionalText(value)
		newProject = toNull(p)
		if p != nil && !validProjects[*p] {
			httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Project không hợp lệ"})
			return
		}
	}
	if u.Role.Valid && u.Role.String == "admin" && newRole != "admin" {
		var admins int
		if tx.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM users WHERE role='admin' AND is_active=1 AND id<>?`, id).Scan(&admins) != nil {
			serverError(w)
			return
		}
		if admins < 1 {
			lastAdmin(w)
			return
		}
	}
	var dup int
	q := `SELECT COUNT(*) FROM users WHERE email=? AND role=? AND id<>?`
	args := []any{u.Email, newRole, id}
	if newProject.Valid {
		q += ` AND project=?`
		args = append(args, newProject.String)
	} else {
		q += ` AND project IS NULL`
	}
	if tx.QueryRowContext(r.Context(), q, args...).Scan(&dup) != nil {
		serverError(w)
		return
	}
	if dup > 0 {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Đã có tài khoản khác cùng email ở role/project này"})
		return
	}
	pdRaw := u.PDProjects
	if newRole == "pd" {
		if value, exists := in["pd_projects"]; exists {
			list, ok := stringList(value)
			if !ok {
				httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Dữ liệu pd_projects không hợp lệ"})
				return
			}
			for _, p := range list {
				if !validProjects[p] {
					httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Project không hợp lệ"})
					return
				}
			}
			raw, _ := json.Marshal(list)
			pdRaw = sql.NullString{String: string(raw), Valid: true}
		}
	}
	before := adminOutput(u)
	if _, err = tx.ExecContext(r.Context(), `UPDATE users SET full_name=?,name=?,role=?,project=?,pd_projects=?,updated_at=? WHERE id=?`, newName, newName, newRole, null(newProject), null(pdRaw), time.Now().UTC(), id); err != nil || tx.Commit() != nil {
		serverError(w)
		return
	}
	updated, err := h.find(r, id, false)
	if err != nil {
		serverError(w)
		return
	}
	p, _ := authn.PrincipalFrom(r.Context())
	h.audit("UPDATE_USER", p.User, id, u.Email, before, adminOutput(updated))
	httpx.JSON(w, http.StatusOK, map[string]any{"message": "Cập nhật thành công", "user": fullOutput(updated)})
}

func (h *Handler) ToggleStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	p, _ := authn.PrincipalFrom(r.Context())
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	u, err := findTx(r, tx, id, true)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if p.User.ID == id && u.IsActive {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Không thể tự khoá tài khoản của chính mình"})
		return
	}
	if u.Role.Valid && u.Role.String == "admin" && u.IsActive {
		var admins int
		if tx.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM users WHERE role='admin' AND is_active=1 AND id<>?`, id).Scan(&admins) != nil {
			serverError(w)
			return
		}
		if admins < 1 {
			lastAdmin(w)
			return
		}
	}
	active := !u.IsActive
	if _, err = tx.ExecContext(r.Context(), `UPDATE users SET is_active=?,updated_at=? WHERE id=?`, active, time.Now().UTC(), id); err == nil && !active {
		_, err = tx.ExecContext(r.Context(), `DELETE FROM personal_access_tokens WHERE tokenable_id=? AND tokenable_type=?`, id, `App\Models\User`)
	}
	if err != nil || tx.Commit() != nil {
		serverError(w)
		return
	}
	action := "LOCK_USER"
	msg := "Đã khoá tài khoản"
	if active {
		action = "UNLOCK_USER"
		msg = "Đã mở khoá tài khoản"
	}
	h.audit(action, p.User, id, u.Email, nil, map[string]any{"is_active": active})
	httpx.JSON(w, http.StatusOK, map[string]any{"message": msg, "is_active": active})
}

func (h *Handler) find(r *http.Request, id int64, lock bool) (row, error) {
	q := `SELECT ` + cols + ` FROM users WHERE id=?`
	if lock {
		q += ` FOR UPDATE`
	}
	return scan(h.db.QueryRowContext(r.Context(), q, id))
}
func findTx(r *http.Request, tx *sql.Tx, id int64, lock bool) (row, error) {
	q := `SELECT ` + cols + ` FROM users WHERE id=?`
	if lock {
		q += ` FOR UPDATE`
	}
	return scan(tx.QueryRowContext(r.Context(), q, id))
}
func adminOutput(u row) map[string]any {
	projects := []string{}
	if u.PDProjects.Valid {
		_ = json.Unmarshal([]byte(u.PDProjects.String), &projects)
	}
	var seen any
	if u.LastSeen.Valid {
		seen = u.LastSeen.Time.UTC().Format(time.RFC3339)
	}
	return map[string]any{"id": u.ID, "email": u.Email, "full_name": display(u), "role": str(u.Role), "project": null(u.Project), "pd_projects": projects, "is_active": u.IsActive, "avatar_url": null(u.AvatarURL), "last_seen_at": seen}
}
func fullOutput(u row) map[string]any {
	out := adminOutput(u)
	out["name"] = str(u.Name)
	out["google_id"] = null(u.GoogleID)
	out["created_at"] = httpx.LaravelTime(u.CreatedAt)
	return out
}
func display(u row) string {
	if u.FullName.Valid && u.FullName.String != "" {
		return u.FullName.String
	}
	return str(u.Name)
}
func str(v sql.NullString) string {
	if v.Valid {
		return v.String
	}
	return ""
}
func null(v sql.NullString) any {
	if v.Valid {
		return v.String
	}
	return nil
}
func toNull(v *string) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *v, Valid: true}
}
func ptrVal(v *string) any {
	if v == nil {
		return nil
	}
	return *v
}
func nullableJSON(raw []byte, valid bool) any {
	if !valid {
		return nil
	}
	return raw
}
func text(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}
func optionalText(v any) *string {
	s := strings.TrimSpace(text(v))
	if s == "" {
		return nil
	}
	return &s
}
func valOr(m map[string]any, key, fallback string) string {
	if v, ok := m[key]; ok {
		return strings.TrimSpace(text(v))
	}
	return fallback
}
func stringList(v any) ([]string, bool) {
	if v == nil {
		return nil, true
	}
	raw, ok := v.([]any)
	if !ok {
		return nil, false
	}
	out := []string{}
	for _, item := range raw {
		s, ok := item.(string)
		if !ok {
			return nil, false
		}
		out = append(out, s)
	}
	return out, true
}
func emptyList(v []string) []string {
	if v == nil {
		return []string{}
	}
	return v
}
func decodeMap(w http.ResponseWriter, r *http.Request) ([]byte, map[string]any, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		serverError(w)
		return nil, nil, false
	}
	var in map[string]any
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	if d.Decode(&in) != nil {
		httpx.JSON(w, http.StatusBadRequest, httpx.Message{Message: "Dữ liệu JSON không hợp lệ"})
		return nil, nil, false
	}
	return raw, in, true
}
func pathID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	return id, err == nil && id > 0
}
func notFound(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Not Found"})
}
func lastAdmin(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Phải còn ít nhất 1 admin hoạt động trong hệ thống"})
}
func serverError(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusInternalServerError, httpx.Message{Message: "Server Error"})
}
func (h *Handler) audit(action string, actor authn.User, targetID int64, targetEmail string, before, after any) {
	h.logger.Info("ADMIN_AUDIT", "action", action, "actor_id", actor.ID, "actor_email", actor.Email, "target_id", targetID, "target_email", targetEmail, "before", before, "after", after)
}
