package libraryapi

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"vendorhub/internal/authn"
)

func requestPathAs(role, project, path string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, path, nil)
	var projectPtr *string
	if project != "" {
		projectPtr = &project
	}
	return r.WithContext(authn.ContextWithPrincipal(r.Context(),
		authn.Principal{User: authn.User{ID: 1, Role: role, Project: projectPtr}}))
}

// Index nuôi trực tiếp bảng tính giá — đây là đường thứ hai (ngoài Get) mà giá
// có thể rò ra cho CSF/PD nếu ai đó quên áp seesPrices khi build index.
func TestIndexKhongRoGiaChoRoleChiDoc(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(NewStore(db))

	at := time.Now().UTC()
	raw := `[{"filename":"a.xlsx","pricing":[{"kyHieu":"HW1","productType":"T-Shirt","size":"M","optional":"Basic","pricing1":6.5,"eco_total":10.7}]}]`
	mock.ExpectQuery("SELECT id, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "updated_at"}).AddRow(1, at))
	mock.ExpectQuery("SELECT id, data, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "data", "updated_at"}).AddRow(1, []byte(raw), at))

	r := requestPathAs("pd", "", "/api/vendor-library/index")
	w := httptest.NewRecorder()
	h.Index(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if strings.Contains(body, "pricing1") || strings.Contains(body, "eco_total") {
		t.Fatalf("Index rò giá cho PD: %s", body)
	}
	if !strings.Contains(body, `"size":"M"`) {
		t.Fatalf("mất luôn dữ liệu phi giá: %s", body)
	}
}

// Role có quyền giá thì Index vẫn phải trả đủ giá — không lọc nhầm chiều.
func TestIndexGiuGiaChoRoleCoQuyen(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(NewStore(db))

	at := time.Now().UTC()
	raw := `[{"filename":"a.xlsx","pricing":[{"kyHieu":"HW1","productType":"T-Shirt","size":"M","pricing1":6.5}]}]`
	mock.ExpectQuery("SELECT id, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "updated_at"}).AddRow(1, at))
	mock.ExpectQuery("SELECT id, data, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "data", "updated_at"}).AddRow(1, []byte(raw), at))

	r := requestPathAs("seller", "happy", "/api/vendor-library/index")
	w := httptest.NewRecorder()
	h.Index(w, r)

	if !strings.Contains(w.Body.String(), "pricing1") {
		t.Fatalf("seller phải nhận được pricing1: %s", w.Body.String())
	}
}

// Index của bảng thư viện rỗng phải ra [] chứ không lỗi 500.
func TestIndexBangRongTraMangRong(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(NewStore(db))

	mock.ExpectQuery("SELECT id, updated_at").WillReturnError(sql.ErrNoRows)
	mock.ExpectQuery("SELECT id, data, updated_at").WillReturnError(sql.ErrNoRows)

	r := requestPathAs("admin", "", "/api/vendor-library/index")
	w := httptest.NewRecorder()
	h.Index(w, r)

	if w.Code != http.StatusOK || strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatalf("status=%d body=%q, muốn 200 []", w.Code, w.Body.String())
	}
}

// respondFile (qua ShowFile): file thuộc project KHÁC với tài khoản -> 403,
// không được để lộ dù chỉ là tồn tại của file đó.
func TestShowFileProjectKhacBiTuChoi403(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(NewStore(db))

	at := time.Now().UTC()
	raw := `[{"id":"f1","filename":"a P.global.xlsx","pricing":[{"pricing1":5}]}]`
	mock.ExpectQuery("SELECT id, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "updated_at"}).AddRow(1, at))
	mock.ExpectQuery("SELECT id, data, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "data", "updated_at"}).AddRow(1, []byte(raw), at))

	r := requestPathAs("seller", "happy", "/api/vendor-library/files/f1")
	r.SetPathValue("id", "f1")
	w := httptest.NewRecorder()
	h.ShowFile(w, r)

	if w.Code != http.StatusForbidden {
		t.Fatalf("status=%d body=%s, muốn 403", w.Code, w.Body.String())
	}
}

// respondFile: role chỉ-đọc mở đúng file của project mình vẫn phải bị lọc giá
// — đường vào NÀY (file lẻ) không được là lỗ thủng thứ hai bên cạnh Get/Index.
func TestShowFileLocGiaChoRoleChiDoc(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(NewStore(db))

	at := time.Now().UTC()
	raw := `[{"id":"f1","filename":"a P.happy.xlsx","pricing":[{"kyHieu":"HW1","size":"M","pricing1":5}],"generalInfo":[{"avgTimeVendor":"5-7"}]}]`
	mock.ExpectQuery("SELECT id, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "updated_at"}).AddRow(1, at))
	mock.ExpectQuery("SELECT id, data, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "data", "updated_at"}).AddRow(1, []byte(raw), at))

	r := requestPathAs("pd", "happy", "/api/vendor-library/files/f1")
	r.SetPathValue("id", "f1")
	w := httptest.NewRecorder()
	h.ShowFile(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "pricing1") {
		t.Fatalf("ShowFile rò giá cho PD: %s", w.Body.String())
	}
}

func TestShowFileKhongTonTaiTra404(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(NewStore(db))

	at := time.Now().UTC()
	mock.ExpectQuery("SELECT id, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "updated_at"}).AddRow(1, at))
	mock.ExpectQuery("SELECT id, data, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "data", "updated_at"}).AddRow(1, []byte(`[]`), at))

	r := requestPathAs("admin", "", "/api/vendor-library/files/khong-ton-tai")
	r.SetPathValue("id", "khong-ton-tai")
	w := httptest.NewRecorder()
	h.ShowFile(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status=%d, muốn 404", w.Code)
	}
}

// ListFiles không được lộ giá dù chỉ là danh sách tóm tắt — field trả về chỉ
// gồm tên/vendor/product type, nhưng vẫn kiểm để chắc không ai thêm field giá sau này.
func TestListFilesLocDungProjectVaKhongCoGia(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(NewStore(db))

	at := time.Now().UTC()
	raw := `[{"id":"f1","filename":"a P.happy.xlsx","pricing":[{"pricing1":5}]},{"id":"f2","filename":"b P.global.xlsx","pricing":[]}]`
	mock.ExpectQuery("SELECT id, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "updated_at"}).AddRow(1, at))
	mock.ExpectQuery("SELECT id, data, updated_at").WillReturnRows(sqlmock.NewRows([]string{"id", "data", "updated_at"}).AddRow(1, []byte(raw), at))

	r := requestPathAs("seller", "happy", "/api/vendor-library/files")
	w := httptest.NewRecorder()
	h.ListFiles(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	body := w.Body.String()
	if strings.Contains(body, "pricing1") {
		t.Fatalf("ListFiles rò giá: %s", body)
	}
	if !strings.Contains(body, `"id":"f1"`) || strings.Contains(body, `"id":"f2"`) {
		t.Fatalf("lọc project sai — phải chỉ còn f1 (happy): %s", body)
	}
}

func TestSaveJsonHongTra422(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(NewStore(db))

	for _, body := range []string{"khong phai json", "null", ""} {
		r := httptest.NewRequest(http.MethodPost, "/api/vendor-library", strings.NewReader(body))
		w := httptest.NewRecorder()
		h.Save(w, r)
		if w.Code != http.StatusUnprocessableEntity {
			t.Errorf("body=%q: status=%d, muốn 422", body, w.Code)
		}
	}
}

func TestUpdateSampleStatusThieuTruongTra422(t *testing.T) {
	db, _, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	h := NewHandler(NewStore(db))

	r := httptest.NewRequest(http.MethodPost, "/api/vendor-library/sample-status", strings.NewReader(`{"rowId":"","sampleStatus":"invalid"}`))
	w := httptest.NewRecorder()
	h.UpdateSampleStatus(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d, muốn 422, body=%s", w.Code, w.Body.String())
	}
}
