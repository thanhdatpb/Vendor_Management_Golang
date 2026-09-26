package pricesheetapi

import (
	"bytes"
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"vendorhub/internal/authn"
	"vendorhub/internal/httpx"
	"vendorhub/internal/pricing"
	"vendorhub/internal/realtime"
)

const maxVersions = 20

type Handler struct {
	db     *sql.DB
	stream realtime.Publisher
}

func NewHandler(db *sql.DB) *Handler { return &Handler{db: db} }

func (h *Handler) WithPublisher(stream realtime.Publisher) *Handler {
	h.stream = stream
	return h
}

type sheetRow struct {
	ID                                                                           string
	Project, Name, VendorRef, SourceFile, ProductTypeNames, UpdatedBy, CreatedBy sql.NullString
	Version, SizeCount                                                           int
	MinPrice, MaxPrice, AvgMargin                                                sql.NullFloat64
	Data                                                                         []byte
	CreatedAt, UpdatedAt                                                         time.Time
}

func canUse(u authn.User) bool  { return u.HasRole("admin", "seller", "staff_a", "staff") }
func seesAll(u authn.User) bool { return u.IsAdmin() }
func ownProject(u authn.User) string {
	if u.Project == nil {
		return ""
	}
	return strings.ToLower(strings.TrimSpace(*u.Project))
}
func canAccess(u authn.User, project sql.NullString) bool {
	return seesAll(u) || !project.Valid || project.String == "" || project.String == ownProject(u)
}

func (h *Handler) Index(w http.ResponseWriter, r *http.Request) {
	u := principal(r)
	if !canUse(u) {
		httpx.Forbidden(w, "Bạn không có quyền xem bảng tính giá.")
		return
	}
	if !queryBool(r.URL.Query().Get("summary")) {
		h.legacyIndex(w, r, u)
		return
	}
	query := `SELECT id, project, name, version, vendor_ref, source_file, product_type_names,
 size_count, min_price, max_price, avg_margin, updated_by, created_by, created_at, updated_at
 FROM price_sheets`
	args := []any{}
	if !seesAll(u) {
		query += ` WHERE project IS NULL OR project = ?`
		args = append(args, ownProject(u))
	}
	query += ` ORDER BY updated_at DESC`
	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		var s sheetRow
		if err := rows.Scan(&s.ID, &s.Project, &s.Name, &s.Version, &s.VendorRef, &s.SourceFile, &s.ProductTypeNames, &s.SizeCount, &s.MinPrice, &s.MaxPrice, &s.AvgMargin, &s.UpdatedBy, &s.CreatedBy, &s.CreatedAt, &s.UpdatedAt); err != nil {
			serverError(w)
			return
		}
		// product_type_names NULL đánh dấu dòng legacy cần bù một lần.
		if !s.ProductTypeNames.Valid {
			if err := h.hydrateSummary(r.Context(), &s); err != nil {
				serverError(w)
				return
			}
		}
		out = append(out, summary(s))
	}
	if rows.Err() != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) legacyIndex(w http.ResponseWriter, r *http.Request, u authn.User) {
	query := `SELECT data, version FROM price_sheets`
	args := []any{}
	if !seesAll(u) {
		query += ` WHERE project IS NULL OR project = ?`
		args = append(args, ownProject(u))
	}
	query += ` ORDER BY updated_at DESC`
	rows, err := h.db.QueryContext(r.Context(), query, args...)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	out := []any{}
	for rows.Next() {
		var raw []byte
		var version int
		if rows.Scan(&raw, &version) != nil {
			serverError(w)
			return
		}
		sheet, err := decodeObject(raw)
		if err != nil {
			continue
		}
		sheet["version"] = version
		out = append(out, sheet)
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (h *Handler) Show(w http.ResponseWriter, r *http.Request) {
	u := principal(r)
	if !canUse(u) {
		httpx.Forbidden(w, "Bạn không có quyền xem bảng tính giá.")
		return
	}
	s, err := h.find(r.Context(), r.PathValue("id"), false)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if !canAccess(u, s.Project) {
		httpx.Forbidden(w, "Bạn không có quyền xem bảng này.")
		return
	}
	sheet, err := decodeObject(s.Data)
	if err != nil {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Dữ liệu bảng tính giá không hợp lệ."})
		return
	}
	historyCount := 0
	if history, ok := sheet["history"].([]any); ok {
		historyCount = len(history)
	}
	delete(sheet, "history")
	var stored int
	if h.db.QueryRowContext(r.Context(), `SELECT COUNT(*) FROM price_sheet_versions WHERE sheet_id = ?`, s.ID).Scan(&stored) != nil {
		serverError(w)
		return
	}
	if stored > 0 {
		historyCount = stored
	}
	sheet["version"] = s.Version
	sheet["historyCount"] = historyCount
	sheet["updatedBy"] = nullAny(s.UpdatedBy)
	sheet["createdBy"] = nullAny(s.CreatedBy)
	httpx.JSON(w, http.StatusOK, sheet)
}

func (h *Handler) Versions(w http.ResponseWriter, r *http.Request) {
	u := principal(r)
	if !canUse(u) {
		httpx.Forbidden(w, "Bạn không có quyền xem bảng tính giá.")
		return
	}
	s, err := h.find(r.Context(), r.PathValue("id"), false)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if !canAccess(u, s.Project) {
		httpx.Forbidden(w, "Bạn không có quyền xem bảng này.")
		return
	}
	rows, err := h.db.QueryContext(r.Context(), `SELECT version, saved_at, saved_by, data FROM price_sheet_versions WHERE sheet_id = ? ORDER BY version DESC`, s.ID)
	if err != nil {
		serverError(w)
		return
	}
	defer rows.Close()
	versions := []any{}
	for rows.Next() {
		var version int
		var savedAt sql.NullTime
		var savedBy sql.NullString
		var raw []byte
		if rows.Scan(&version, &savedAt, &savedBy, &raw) != nil {
			serverError(w)
			return
		}
		snap, err := decodeObject(raw)
		if err != nil {
			snap = map[string]any{}
		}
		snap["version"] = version
		if savedAt.Valid {
			snap["savedAt"] = httpx.MySQLTime(savedAt.Time)
		} else {
			snap["savedAt"] = nil
		}
		snap["savedBy"] = nullAny(savedBy)
		versions = append(versions, snap)
	}
	if len(versions) == 0 {
		sheet, err := decodeObject(s.Data)
		if err == nil {
			if history, ok := sheet["history"].([]any); ok {
				versions = history
			}
		}
	}
	httpx.JSON(w, http.StatusOK, versions)
}

func (h *Handler) Upsert(w http.ResponseWriter, r *http.Request) {
	u := principal(r)
	if !canUse(u) {
		httpx.Forbidden(w, "Bạn không có quyền sửa bảng tính giá.")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 32<<20)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		serverError(w)
		return
	}
	sheet, err := decodeObject(raw)
	if err != nil {
		httpx.JSON(w, http.StatusBadRequest, httpx.Message{Message: "Dữ liệu JSON không hợp lệ"})
		return
	}
	id := strings.TrimSpace(asString(sheet["id"]))
	if id == "" {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Thiếu id bảng tính giá."})
		return
	}
	project := nullableString(sheet["project"])
	if !seesAll(u) {
		value := ownProject(u)
		project = sql.NullString{String: value, Valid: value != ""}
		sheet["project"] = value
	}

	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	existing, err := findTx(r.Context(), tx, id, true)
	exists := err == nil
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		serverError(w)
		return
	}
	if exists && !canAccess(u, existing.Project) {
		httpx.Forbidden(w, "Bạn không có quyền sửa bảng này.")
		return
	}
	force := asBool(sheet["force"])
	autosave := asBool(sheet["autosave"])
	if exists && !force {
		if expected, ok := asInt(sheet["expectedVersion"]); ok && expected != existing.Version {
			h.writeConflict(w, r.Context(), tx, existing)
			return
		}
	}

	history, _ := sheet["history"].([]any)
	delete(sheet, "history")
	delete(sheet, "expectedVersion")
	delete(sheet, "force")
	delete(sheet, "autosave")
	if exists {
		if old, err := decodeObject(existing.Data); err == nil {
			if legacy, ok := old["history"].([]any); ok && len(legacy) > 0 {
				sheet["history"] = legacy
			}
		}
	}
	next := 1
	if exists {
		next = existing.Version + 1
	}
	sheet["version"] = next
	encoded, err := encodeJSON(sheet)
	if err != nil {
		serverError(w)
		return
	}
	cols := pricing.SummaryColumns(sheet)
	names, _ := encodeJSON(cols.ProductTypeNames)
	now := time.Now().UTC()
	actor := nullableText(u.Name)
	if exists {
		_, err = tx.ExecContext(r.Context(), `UPDATE price_sheets SET project=?, name=?, version=?, vendor_ref=?, source_file=?, product_type_names=?, size_count=?, min_price=?, max_price=?, avg_margin=?, updated_by=?, data=?, updated_at=? WHERE id=?`,
			nullDB(project), nullableValue(sheet["name"]), next, ptrDB(cols.VendorRef), ptrDB(cols.SourceFile), names, cols.SizeCount, ptrDB(cols.MinPrice), ptrDB(cols.MaxPrice), ptrDB(cols.AvgMargin), actor, encoded, now, id)
	} else {
		_, err = tx.ExecContext(r.Context(), `INSERT INTO price_sheets (id,project,name,version,vendor_ref,source_file,product_type_names,size_count,min_price,max_price,avg_margin,updated_by,created_by,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
			id, nullDB(project), nullableValue(sheet["name"]), next, ptrDB(cols.VendorRef), ptrDB(cols.SourceFile), names, cols.SizeCount, ptrDB(cols.MinPrice), ptrDB(cols.MaxPrice), ptrDB(cols.AvgMargin), actor, actor, encoded, now, now)
	}
	if err != nil {
		serverError(w)
		return
	}
	if err = h.storeVersions(r.Context(), tx, id, history); err != nil {
		serverError(w)
		return
	}
	if err = tx.Commit(); err != nil {
		serverError(w)
		return
	}
	if !autosave && h.stream != nil {
		scope := project.String
		if scope == "" {
			scope = "all"
		}
		h.stream.Trigger("price-sheets."+scope, "PriceSheetChanged", map[string]any{"id": id, "action": "saved", "version": next, "updatedBy": u.Name})
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"message": "Đã lưu bảng tính giá", "id": id, "version": next})
}

func (h *Handler) writeConflict(w http.ResponseWriter, ctx context.Context, tx *sql.Tx, s sheetRow) {
	current, _ := decodeObject(s.Data)
	current["version"] = s.Version
	var editor sql.NullString
	_ = tx.QueryRowContext(ctx, `SELECT saved_by FROM price_sheet_versions WHERE sheet_id=? ORDER BY version DESC LIMIT 1`, s.ID).Scan(&editor)
	name := "người khác"
	if editor.Valid && editor.String != "" {
		name = editor.String
	} else if hist, ok := current["history"].([]any); ok && len(hist) > 0 {
		if first, ok := hist[0].(map[string]any); ok && asString(first["savedBy"]) != "" {
			name = asString(first["savedBy"])
		}
	}
	httpx.WriteVersionConflict(w, httpx.VersionConflict{CurrentVersion: s.Version, UpdatedBy: name, UpdatedAt: httpx.MySQLTime(s.UpdatedAt), Current: current})
}

func (h *Handler) Destroy(w http.ResponseWriter, r *http.Request) {
	u := principal(r)
	if !canUse(u) {
		httpx.Forbidden(w, "Bạn không có quyền xoá bảng tính giá.")
		return
	}
	id := r.PathValue("id")
	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	s, err := findTx(r.Context(), tx, id, true)
	if errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	}
	if err != nil {
		serverError(w)
		return
	}
	if !canAccess(u, s.Project) {
		httpx.Forbidden(w, "Bạn không có quyền xoá bảng này.")
		return
	}
	if _, err = tx.ExecContext(r.Context(), `DELETE FROM price_sheet_versions WHERE sheet_id=?`, id); err == nil {
		_, err = tx.ExecContext(r.Context(), `DELETE FROM price_sheets WHERE id=?`, id)
	}
	if err != nil || tx.Commit() != nil {
		serverError(w)
		return
	}
	if h.stream != nil {
		scope := s.Project.String
		if scope == "" {
			scope = "all"
		}
		h.stream.Trigger("price-sheets."+scope, "PriceSheetChanged", map[string]any{"id": id, "action": "deleted", "version": s.Version, "updatedBy": u.Name})
	}
	httpx.JSON(w, http.StatusOK, httpx.Message{Message: "Đã xoá bảng tính giá"})
}

func (h *Handler) find(ctx context.Context, id string, lock bool) (sheetRow, error) {
	return findQuery(ctx, h.db, id, lock)
}

type queryRower interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func findQuery(ctx context.Context, q queryRower, id string, lock bool) (sheetRow, error) {
	query := `SELECT id,project,name,version,vendor_ref,source_file,product_type_names,size_count,min_price,max_price,avg_margin,updated_by,created_by,data,created_at,updated_at FROM price_sheets WHERE id=?`
	if lock {
		query += ` FOR UPDATE`
	}
	return scanSheet(q.QueryRowContext(ctx, query, id))
}
func findTx(ctx context.Context, tx *sql.Tx, id string, lock bool) (sheetRow, error) {
	return findQuery(ctx, tx, id, lock)
}
func scanSheet(row *sql.Row) (sheetRow, error) {
	var s sheetRow
	err := row.Scan(&s.ID, &s.Project, &s.Name, &s.Version, &s.VendorRef, &s.SourceFile, &s.ProductTypeNames, &s.SizeCount, &s.MinPrice, &s.MaxPrice, &s.AvgMargin, &s.UpdatedBy, &s.CreatedBy, &s.Data, &s.CreatedAt, &s.UpdatedAt)
	return s, err
}

func (h *Handler) hydrateSummary(ctx context.Context, s *sheetRow) error {
	var raw []byte
	if err := h.db.QueryRowContext(ctx, `SELECT data FROM price_sheets WHERE id=?`, s.ID).Scan(&raw); err != nil {
		return err
	}
	sheet, err := decodeObject(raw)
	if err != nil {
		sheet = map[string]any{}
	}
	cols := pricing.SummaryColumns(sheet)
	names, _ := encodeJSON(cols.ProductTypeNames)
	_, err = h.db.ExecContext(ctx, `UPDATE price_sheets SET vendor_ref=?,source_file=?,product_type_names=?,size_count=?,min_price=?,max_price=?,avg_margin=? WHERE id=?`, ptrDB(cols.VendorRef), ptrDB(cols.SourceFile), names, cols.SizeCount, ptrDB(cols.MinPrice), ptrDB(cols.MaxPrice), ptrDB(cols.AvgMargin), s.ID)
	if err != nil {
		return err
	}
	s.VendorRef = toNull(cols.VendorRef)
	s.SourceFile = toNull(cols.SourceFile)
	s.ProductTypeNames = sql.NullString{String: string(names), Valid: true}
	s.SizeCount = cols.SizeCount
	s.MinPrice = toNullFloat(cols.MinPrice)
	s.MaxPrice = toNullFloat(cols.MaxPrice)
	s.AvgMargin = toNullFloat(cols.AvgMargin)
	return nil
}

func summary(s sheetRow) map[string]any {
	names := []string{}
	if s.ProductTypeNames.Valid {
		_ = json.Unmarshal([]byte(s.ProductTypeNames.String), &names)
	}
	return map[string]any{"id": s.ID, "name": nullAny(s.Name), "project": nullAny(s.Project), "version": s.Version, "vendorRef": nullAny(s.VendorRef), "_sourceFile": nullAny(s.SourceFile), "productTypeNames": names, "sizeCount": s.SizeCount, "minPrice": nullFloat(s.MinPrice), "maxPrice": nullFloat(s.MaxPrice), "avgMargin": nullFloat(s.AvgMargin), "updatedBy": nullAny(s.UpdatedBy), "createdBy": nullAny(s.CreatedBy), "createdAt": httpx.MySQLTime(s.CreatedAt), "updatedAt": httpx.MySQLTime(s.UpdatedAt), "_summary": true}
}

func (h *Handler) storeVersions(ctx context.Context, tx *sql.Tx, id string, snapshots []any) error {
	if len(snapshots) == 0 {
		return nil
	}
	rows, err := tx.QueryContext(ctx, `SELECT saved_at FROM price_sheet_versions WHERE sheet_id=? AND saved_at IS NOT NULL`, id)
	if err != nil {
		return err
	}
	keys := map[string]bool{}
	latestKey := ""
	for rows.Next() {
		var t time.Time
		if scanErr := rows.Scan(&t); scanErr != nil {
			rows.Close()
			return scanErr
		}
		key := pricing.SnapshotKey(t.UTC().Format("2006-01-02 15:04:05"))
		keys[key] = true
		if key > latestKey {
			latestKey = key
		}
	}
	rows.Close()
	var next int
	if err := tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(version),0) FROM price_sheet_versions WHERE sheet_id=?`, id).Scan(&next); err != nil {
		return err
	}
	lastFingerprint := ""
	var latestRaw []byte
	if err := tx.QueryRowContext(ctx, `SELECT data FROM price_sheet_versions WHERE sheet_id=? ORDER BY version DESC LIMIT 1`, id).Scan(&latestRaw); err == nil {
		if latest, err := decodeObject(latestRaw); err == nil {
			lastFingerprint = fingerprint(latest)
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	for i := len(snapshots) - 1; i >= 0; i-- {
		snap, ok := snapshots[i].(map[string]any)
		if !ok {
			continue
		}
		savedAt := asString(snap["savedAt"])
		key := pricing.SnapshotKey(savedAt)
		if savedAt != "" && keys[key] {
			continue
		}
		if savedAt != "" && latestKey != "" && key < latestKey {
			continue
		}
		fp := fingerprint(snap)
		if lastFingerprint != "" && fp == lastFingerprint {
			continue
		}
		next++
		raw, err := encodeJSON(snap)
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO price_sheet_versions (sheet_id,version,saved_at,saved_by,data,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`, id, next, pricing.SnapshotColumn(savedAt), nullableValue(snap["savedBy"]), raw, time.Now().UTC(), time.Now().UTC()); err != nil {
			return err
		}
		lastFingerprint = fp
		if savedAt != "" {
			keys[key] = true
		}
	}
	oldRows, err := tx.QueryContext(ctx, `SELECT id FROM price_sheet_versions WHERE sheet_id=? ORDER BY version DESC LIMIT 18446744073709551615 OFFSET ?`, id, maxVersions)
	if err != nil {
		return err
	}
	old := []int64{}
	for oldRows.Next() {
		var v int64
		if scanErr := oldRows.Scan(&v); scanErr != nil {
			oldRows.Close()
			return scanErr
		}
		old = append(old, v)
	}
	oldRows.Close()
	for _, v := range old {
		if _, err = tx.ExecContext(ctx, `DELETE FROM price_sheet_versions WHERE id=?`, v); err != nil {
			return err
		}
	}
	return nil
}

func fingerprint(s map[string]any) string {
	raw, _ := encodeJSON(struct {
		Settings     any `json:"settings"`
		ProductTypes any `json:"productTypes"`
	}{s["settings"], s["productTypes"]})
	sum := md5.Sum(raw)
	return hex.EncodeToString(sum[:])
}
func decodeObject(raw []byte) (map[string]any, error) {
	var value map[string]any
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	if err := d.Decode(&value); err != nil || value == nil {
		if err == nil {
			err = errors.New("not object")
		}
		return nil, err
	}
	return value, nil
}
func encodeJSON(value any) ([]byte, error) {
	var b bytes.Buffer
	e := json.NewEncoder(&b)
	e.SetEscapeHTML(false)
	if err := e.Encode(value); err != nil {
		return nil, err
	}
	return bytes.TrimSuffix(b.Bytes(), []byte("\n")), nil
}
func principal(r *http.Request) authn.User { p, _ := authn.PrincipalFrom(r.Context()); return p.User }
func asString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case json.Number:
		return x.String()
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	case nil:
		return ""
	default:
		return fmt.Sprint(x)
	}
}
func asInt(v any) (int, bool) {
	switch x := v.(type) {
	case json.Number:
		n, e := strconv.Atoi(x.String())
		return n, e == nil
	case float64:
		return int(x), x == float64(int(x))
	case int:
		return x, true
	case string:
		n, e := strconv.Atoi(x)
		return n, e == nil
	default:
		return 0, false
	}
}
func asBool(v any) bool {
	switch x := v.(type) {
	case bool:
		return x
	case string:
		b, _ := strconv.ParseBool(x)
		return b
	case json.Number:
		return x.String() != "0"
	default:
		return false
	}
}
func queryBool(v string) bool { b, _ := strconv.ParseBool(v); return b || v == "1" }
func nullableString(v any) sql.NullString {
	s := strings.TrimSpace(asString(v))
	return sql.NullString{String: s, Valid: s != ""}
}
func nullableValue(v any) any {
	s := asString(v)
	if s == "" {
		return nil
	}
	return s
}
func nullableText(v string) any {
	if strings.TrimSpace(v) == "" {
		return nil
	}
	return v
}
func nullDB(v sql.NullString) any {
	if !v.Valid {
		return nil
	}
	return v.String
}
func ptrDB[T ~string | ~float64](p *T) any {
	if p == nil {
		return nil
	}
	return *p
}
func nullAny(v sql.NullString) any {
	if !v.Valid {
		return nil
	}
	return v.String
}
func nullFloat(v sql.NullFloat64) any {
	if !v.Valid {
		return nil
	}
	return v.Float64
}
func toNull(v *string) sql.NullString {
	if v == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *v, Valid: true}
}
func toNullFloat(v *float64) sql.NullFloat64 {
	if v == nil {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Float64: *v, Valid: true}
}
func notFound(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Không tìm thấy bảng tính giá."})
}
func serverError(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusInternalServerError, httpx.Message{Message: "Server Error"})
}
