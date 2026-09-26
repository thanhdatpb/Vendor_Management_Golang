package productapi

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"vendorhub/internal/authn"
)

func TestIndexScopesStaffToOwnProject(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	mock.ExpectQuery(`SELECT COUNT\(\*\).*u\.project=\?`).
		WithArgs("Happy Project").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	now := time.Date(2026, 9, 26, 8, 30, 0, 0, time.UTC)
	mock.ExpectQuery(`SELECT p\.\*,u\.project AS project.*ORDER BY p\.created_at DESC LIMIT \? OFFSET \?`).
		WithArgs("Happy Project", 20, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "status", "created_at", "project", "seller_name", "seller_email", "media_urls"}).
			AddRow(9, "draft", now, "Happy Project", "Seller A", "a@example.com", `[]`))

	project := "Happy Project"
	request := httptest.NewRequest("GET", "/api/products", nil)
	request = request.WithContext(authn.ContextWithPrincipal(request.Context(), authn.Principal{User: authn.User{ID: 3, Role: "seller", Project: &project}}))
	response := httptest.NewRecorder()
	NewHandler(db, t.TempDir()).Index(response, request)

	if response.Code != 200 {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var body struct {
		Data struct {
			Total int              `json:"total"`
			Data  []map[string]any `json:"data"`
		} `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Data.Total != 1 || len(body.Data.Data) != 1 || body.Data.Data[0]["project"] != "Happy Project" {
		t.Fatalf("unexpected body: %#v", body)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateRejectsDifferentProjectBeforeWriting(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectQuery(`SELECT p\.created_by,p\.status,u\.project`).WithArgs(int64(12)).
		WillReturnRows(sqlmock.NewRows([]string{"created_by", "status", "project", "product_type", "media_path", "media_urls"}).
			AddRow(7, "draft", "Global Project", "Mug", nil, `[]`))

	project := "Happy Project"
	request := httptest.NewRequest("PUT", "/api/products/12", strings.NewReader(`{"product_type":"Cup"}`))
	request.Header.Set("Content-Type", "application/json")
	request.SetPathValue("id", "12")
	request = request.WithContext(authn.ContextWithPrincipal(context.Background(), authn.Principal{User: authn.User{ID: 3, Role: "seller", Project: &project}}))
	response := httptest.NewRecorder()
	NewHandler(db, t.TempDir()).Update(response, request)
	if response.Code != 403 {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestAssignVendorsRequiresApprovedProduct(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectQuery(`SELECT p\.created_by,p\.status,u\.project`).WithArgs(int64(12)).
		WillReturnRows(sqlmock.NewRows([]string{"created_by", "status", "project", "product_type", "media_path", "media_urls"}).
			AddRow(7, "pending", "Global Project", "Mug", nil, `[]`))
	request := httptest.NewRequest("POST", "/api/products/12/assign-vendors", strings.NewReader(`{"vendors":[]}`))
	request.Header.Set("Content-Type", "application/json")
	request.SetPathValue("id", "12")
	response := httptest.NewRecorder()
	NewHandler(db, t.TempDir()).AssignVendors(response, request)
	if response.Code != 422 {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestStatsNormalizesRejectAndExcludesDraft(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	mock.ExpectQuery(`SELECT LOWER\(TRIM\(u\.project\)\),p\.status,COUNT\(\*\)`).
		WillReturnRows(sqlmock.NewRows([]string{"project", "status", "count"}).
			AddRow("happy project", "approved", 2).
			AddRow("happy project", "reject", 1).
			AddRow("happy project", "draft", 8))
	request := httptest.NewRequest("GET", "/api/admin/products/stats", nil)
	response := httptest.NewRecorder()
	NewHandler(db, t.TempDir()).Stats(response, request)
	if response.Code != 200 {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	var body struct {
		Overall  map[string]int64            `json:"overall"`
		Projects map[string]map[string]int64 `json:"projects"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Overall["total"] != 3 || body.Overall["rejected"] != 1 || body.Projects["Happy Project"]["approved"] != 2 {
		t.Fatalf("unexpected stats: %#v", body)
	}
}

func TestCleanInputAcceptsLegacyJSONArrayString(t *testing.T) {
	clean, validation := cleanInput(map[string]any{"product_type_links": `["https://a.example"]`, "total_cost": 12.5}, false)
	if validation.Failed() {
		t.Fatalf("unexpected validation failure: %#v", validation)
	}
	if string(clean["product_type_links"].([]byte)) != `["https://a.example"]` || clean["total_cost"] != "12.5" {
		t.Fatalf("unexpected clean input: %#v", clean)
	}
}
