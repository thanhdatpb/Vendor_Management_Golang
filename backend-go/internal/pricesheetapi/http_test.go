package pricesheetapi

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"vendorhub/internal/authn"
)

func withUser(r *http.Request, role, project string) *http.Request {
	u := authn.User{ID: 1, Name: "Alice", Role: role}
	if project != "" {
		u.Project = &project
	}
	return r.WithContext(authn.ContextWithPrincipal(r.Context(), authn.Principal{User: u}))
}

func TestIndexRejectsRoleWithoutPricePermission(t *testing.T) {
	r := withUser(httptest.NewRequest(http.MethodGet, "/api/price-sheets?summary=1", nil), "csf", "")
	w := httptest.NewRecorder()
	NewHandler(nil).Index(w, r)
	if w.Code != http.StatusForbidden {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestSummaryIndexIsProjectScopedAndContainsNoBlob(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	now := time.Date(2026, 9, 26, 5, 0, 0, 0, time.UTC)
	query := regexp.QuoteMeta(`SELECT id, project, name, version, vendor_ref, source_file, product_type_names,
 size_count, min_price, max_price, avg_margin, updated_by, created_by, created_at, updated_at
 FROM price_sheets WHERE project IS NULL OR project = ? ORDER BY updated_at DESC`)
	mock.ExpectQuery(query).WithArgs("happy").WillReturnRows(sqlmock.NewRows([]string{"id", "project", "name", "version", "vendor_ref", "source_file", "product_type_names", "size_count", "min_price", "max_price", "avg_margin", "updated_by", "created_by", "created_at", "updated_at"}).AddRow("s1", "happy", "Sheet", 3, "VN3", "file.xlsx", `["Tee"]`, 2, 10.5, 20.0, 30.0, "Bob", "Alice", now, now))
	r := withUser(httptest.NewRequest(http.MethodGet, "/api/price-sheets?summary=1", nil), "seller", "happy")
	w := httptest.NewRecorder()
	NewHandler(db).Index(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if !strings.Contains(body, `"_summary":true`) || strings.Contains(body, `"settings"`) {
		t.Fatalf("payload sai: %s", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpsertReturnsVersionConflictInsideLockedTransaction(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	now := time.Date(2026, 9, 26, 5, 0, 0, 0, time.UTC)
	mock.ExpectBegin()
	find := regexp.QuoteMeta(`SELECT id,project,name,version,vendor_ref,source_file,product_type_names,size_count,min_price,max_price,avg_margin,updated_by,created_by,data,created_at,updated_at FROM price_sheets WHERE id=? FOR UPDATE`)
	mock.ExpectQuery(find).WithArgs("s1").WillReturnRows(sqlmock.NewRows([]string{"id", "project", "name", "version", "vendor_ref", "source_file", "product_type_names", "size_count", "min_price", "max_price", "avg_margin", "updated_by", "created_by", "data", "created_at", "updated_at"}).AddRow("s1", "happy", "Sheet", 2, nil, nil, `[]`, 0, nil, nil, nil, "Bob", "Alice", []byte(`{"id":"s1","name":"Server"}`), now, now))
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT saved_by FROM price_sheet_versions WHERE sheet_id=? ORDER BY version DESC LIMIT 1`)).WithArgs("s1").WillReturnRows(sqlmock.NewRows([]string{"saved_by"}).AddRow("Bob"))
	mock.ExpectRollback()
	r := withUser(httptest.NewRequest(http.MethodPost, "/api/price-sheets", strings.NewReader(`{"id":"s1","expectedVersion":1,"name":"Client"}`)), "seller", "happy")
	w := httptest.NewRecorder()
	NewHandler(db).Upsert(w, r)
	if w.Code != http.StatusConflict {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"code":"version_conflict"`) || !strings.Contains(w.Body.String(), `"currentVersion":2`) {
		t.Fatalf("body=%s", w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestFingerprintIgnoresSaveMetadata(t *testing.T) {
	a := map[string]any{"settings": map[string]any{"tax": 1}, "productTypes": []any{"Tee"}, "savedAt": "a"}
	b := map[string]any{"settings": map[string]any{"tax": 1}, "productTypes": []any{"Tee"}, "savedAt": "b", "savedBy": "Bob"}
	if fingerprint(a) != fingerprint(b) {
		t.Fatal("metadata không được làm đổi fingerprint")
	}
}
