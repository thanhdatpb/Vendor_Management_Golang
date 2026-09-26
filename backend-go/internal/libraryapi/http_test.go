package libraryapi

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

func requestAs(t *testing.T, role string) (*http.Request, sqlmock.Sqlmock, *Handler, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodGet, "/api/vendor-library", nil)
	r = r.WithContext(authn.ContextWithPrincipal(r.Context(), authn.Principal{User: authn.User{ID: 1, Role: role}}))
	return r, mock, NewHandler(NewStore(db)), func() { db.Close() }
}

func expectMeta(mock sqlmock.Sqlmock, at time.Time) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, updated_at FROM vendor_library ORDER BY id LIMIT 1`)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "updated_at"}).AddRow(1, at))
}

func expectLibrary(mock sqlmock.Sqlmock, raw string, at time.Time) {
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT id, data, updated_at FROM vendor_library ORDER BY id LIMIT 1`)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "data", "updated_at"}).AddRow(1, []byte(raw), at))
}

func TestGetStripsPricesButKeepsCSFLeadTime(t *testing.T) {
	r, mock, h, done := requestAs(t, "csf")
	defer done()
	at := time.Date(2026, 9, 26, 4, 0, 0, 0, time.UTC)
	raw := `[{"generalInfo":[{"avgTimeVendor":"7 days","pricing1":9}],"pricing":[{"size":"S","pricing1":8.2,"eco_total":10}]}]`
	expectMeta(mock, at)
	expectLibrary(mock, raw, at)
	w := httptest.NewRecorder()
	h.Get(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if strings.Contains(body, "pricing1") || strings.Contains(body, "eco_total") {
		t.Fatalf("rò giá: %s", body)
	}
	if !strings.Contains(body, "avgTimeVendor") {
		t.Fatalf("CSF mất AVG TG: %s", body)
	}
	if w.Header().Get("ETag") == "" || !strings.Contains(w.Header().Get("Cache-Control"), "private") {
		t.Fatal("thiếu cache headers")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestGetPricedRoleReturnsRawBlob(t *testing.T) {
	r, mock, h, done := requestAs(t, "seller")
	defer done()
	at := time.Now().UTC()
	raw := `[{"z":1,"pricing":[{"pricing1":8.2}]}]`
	expectMeta(mock, at)
	expectLibrary(mock, raw, at)
	w := httptest.NewRecorder()
	h.Get(w, r)
	if w.Body.String() != raw {
		t.Fatalf("raw blob bị đổi: %q", w.Body.String())
	}
}

func TestGetMatchingETagDoesNotReadBlob(t *testing.T) {
	r, mock, h, done := requestAs(t, "seller")
	defer done()
	at := time.Date(2026, 9, 26, 4, 0, 0, 0, time.UTC)
	expectMeta(mock, at)
	r.Header.Set("If-None-Match", `"57d27722307c7833107b8c691f199daffc43d180"`)
	// Lấy ETag thực bằng request đầu giả lập từ cùng công thức để test không phụ thuộc hằng hash.
	r.Header.Set("If-None-Match", libraryETagForTest("vendor-library", at, "seller"))
	w := httptest.NewRecorder()
	h.Get(w, r)
	if w.Code != http.StatusNotModified {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func libraryETagForTest(scope string, at time.Time, parts ...string) string {
	// Gọi qua helper production giúp chốt đúng stamp MySQL mà không nhân đôi SHA-1 ở test.
	return etag(scope, stamp(at), parts...)
}
