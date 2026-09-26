package userapi

import (
	"database/sql"
	"database/sql/driver"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"vendorhub/internal/authn"
)

func quietLogger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func newHandlerMock(t *testing.T) (*Handler, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	return NewHandler(db, quietLogger()), mock, func() { db.Close() }
}

func adminRequest(method, path, body string) *http.Request {
	var r *http.Request
	if body != "" {
		r = httptest.NewRequest(method, path, strings.NewReader(body))
	} else {
		r = httptest.NewRequest(method, path, nil)
	}
	return r.WithContext(authn.ContextWithPrincipal(r.Context(), authn.Principal{User: authn.User{ID: 1, Role: "admin", Email: "admin@test.com"}}))
}

var userCols = []string{"id", "email", "full_name", "name", "role", "project", "pd_projects", "is_active", "avatar_url", "google_id", "last_seen_at", "created_at"}

func userRow(id int64, email, role string, active bool) []driver.Value {
	return []driver.Value{id, email, "Tên", "Tên", role, nil, nil, active, nil, nil, nil, time.Now().UTC()}
}

const colsRegex = `id,email,full_name,name,role,project,pd_projects,is_active,avatar_url,google_id,last_seen_at,created_at`

// ── Create ───────────────────────────────────────────────────────────────

func TestCreateEmailKhongHopLeTra422(t *testing.T) {
	h, _, done := newHandlerMock(t)
	defer done()

	r := adminRequest(http.MethodPost, "/api/admin/users", `{"email":"khong-hop-le","full_name":"A","role":"seller","project":"Happy Project"}`)
	w := httptest.NewRecorder()
	h.Create(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestCreateSellerThieuProjectTra422(t *testing.T) {
	h, _, done := newHandlerMock(t)
	defer done()

	r := adminRequest(http.MethodPost, "/api/admin/users", `{"email":"a@test.com","full_name":"A","role":"seller"}`)
	w := httptest.NewRecorder()
	h.Create(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d body=%s, muốn 422 (seller thiếu project)", w.Code, w.Body.String())
	}
}

func TestCreateRoleKhongHopLeTra422(t *testing.T) {
	h, _, done := newHandlerMock(t)
	defer done()

	r := adminRequest(http.MethodPost, "/api/admin/users", `{"email":"a@test.com","full_name":"A","role":"khong-ton-tai"}`)
	w := httptest.NewRecorder()
	h.Create(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d, muốn 422", w.Code)
	}
}

func TestCreatePdProjectsKhongHopLeTra422(t *testing.T) {
	h, _, done := newHandlerMock(t)
	defer done()

	r := adminRequest(http.MethodPost, "/api/admin/users", `{"email":"a@test.com","full_name":"A","role":"pd","pd_projects":["Project Không Có Thật"]}`)
	w := httptest.NewRecorder()
	h.Create(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d body=%s, muốn 422", w.Code, w.Body.String())
	}
}

func TestCreateEmailTrungRoleProjectTra422(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE email=\\? AND role=\\?").
		WithArgs("a@test.com", "seller", "Happy Project").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectRollback()

	r := adminRequest(http.MethodPost, "/api/admin/users", `{"email":"a@test.com","full_name":"A","role":"seller","project":"Happy Project"}`)
	w := httptest.NewRecorder()
	h.Create(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d body=%s, muốn 422 (trùng email/role/project)", w.Code, w.Body.String())
	}
}

// PD không cần tạo riêng theo project — chỉ 1 tài khoản PD cho mỗi email,
// khác câu thông báo với role khác (seller/vendor theo từng project).
func TestCreatePdTrungEmailThongBaoRieng(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE email=\\? AND role=\\?").
		WithArgs("a@test.com", "pd").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectRollback()

	r := adminRequest(http.MethodPost, "/api/admin/users", `{"email":"a@test.com","full_name":"A","role":"pd"}`)
	w := httptest.NewRecorder()
	h.Create(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "PD không cần tạo riêng theo project") {
		t.Errorf("message = %s", w.Body.String())
	}
}

// Đã từng đăng nhập Google ở role/project khác -> gắn sẵn google_id/avatar
// cho tài khoản mới, không bắt đăng nhập Google lại lần nữa cho cùng người.
func TestCreateKeThuaGoogleIdTuTaiKhoanCungEmail(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE email=\\? AND role=\\?").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT google_id,avatar_url FROM users WHERE email=\\? AND google_id IS NOT NULL").
		WithArgs("a@test.com").
		WillReturnRows(sqlmock.NewRows([]string{"google_id", "avatar_url"}).AddRow("g-123", "https://pic"))
	mock.ExpectExec("INSERT INTO users").
		WithArgs("a@test.com", "A", "A", "seller", "Happy Project", sqlmock.AnyArg(), "g-123", "https://pic", sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(9, 1))
	mock.ExpectCommit()

	r := adminRequest(http.MethodPost, "/api/admin/users", `{"email":"a@test.com","full_name":"A","role":"seller","project":"Happy Project"}`)
	w := httptest.NewRecorder()
	h.Create(w, r)

	if w.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

// Role không phải seller/pd thì project luôn bị null hoá — vendor/admin/csf/
// marvel không gắn theo project.
func TestCreateRoleKhongPhaiSellerPdThiProjectBiBoQua(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE email=\\? AND role=\\? AND project IS NULL").
		WithArgs("a@test.com", "vendor").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectQuery("SELECT google_id,avatar_url").WillReturnError(sql.ErrNoRows)
	mock.ExpectExec("INSERT INTO users").
		WithArgs("a@test.com", "A", "A", "vendor", nil, sqlmock.AnyArg(), nil, nil, sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(9, 1))
	mock.ExpectCommit()

	// project gửi lên nhưng role=vendor -> phải bị bỏ qua, không lỗi validate.
	r := adminRequest(http.MethodPost, "/api/admin/users", `{"email":"a@test.com","full_name":"A","role":"vendor","project":"Happy Project"}`)
	w := httptest.NewRecorder()
	h.Create(w, r)

	if w.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

// ── Update: bảo vệ admin cuối cùng ──────────────────────────────────────────

func TestUpdateHaAdminCuoiCungXuongRoleKhacBiChan(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT " + colsRegex + " FROM users WHERE id=\\? FOR UPDATE").
		WithArgs(int64(1)).
		WillReturnRows(sqlmock.NewRows(userCols).AddRow(userRow(1, "admin@test.com", "admin", true)...))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE role='admin' AND is_active=1 AND id<>\\?").
		WithArgs(int64(1)).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectRollback()

	r := adminRequest(http.MethodPatch, "/api/admin/users/1", `{"role":"seller","full_name":"Admin","project":"Happy Project"}`)
	r.SetPathValue("id", "1")
	w := httptest.NewRecorder()
	h.Update(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d body=%s, muốn 422", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "ít nhất 1 admin") {
		t.Errorf("message = %s", w.Body.String())
	}
}

// Còn admin khác đang hoạt động thì hạ role admin này vẫn được.
func TestUpdateHaAdminKhiConAdminKhacVanDuocPhep(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("SELECT " + colsRegex + " FROM users WHERE id=\\? FOR UPDATE").
		WithArgs(int64(1)).
		WillReturnRows(sqlmock.NewRows(userCols).AddRow(userRow(1, "admin@test.com", "admin", true)...))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE role='admin' AND is_active=1 AND id<>\\?").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE email=\\? AND role=\\? AND id<>\\?").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectExec("UPDATE users SET").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()
	mock.ExpectQuery("SELECT " + colsRegex + " FROM users WHERE id=\\?$").
		WithArgs(int64(1)).
		WillReturnRows(sqlmock.NewRows(userCols).AddRow(userRow(1, "admin@test.com", "seller", true)...))

	r := adminRequest(http.MethodPatch, "/api/admin/users/1", `{"role":"seller","full_name":"Admin","project":"Happy Project"}`)
	r.SetPathValue("id", "1")
	w := httptest.NewRecorder()
	h.Update(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestUpdateKhongTonTaiTra404(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("FOR UPDATE").WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()

	r := adminRequest(http.MethodPatch, "/api/admin/users/999", `{"role":"seller","full_name":"A"}`)
	r.SetPathValue("id", "999")
	w := httptest.NewRecorder()
	h.Update(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status=%d, muốn 404", w.Code)
	}
}

// ── ToggleStatus ─────────────────────────────────────────────────────────

func TestToggleStatusTuKhoaChinhMinhBiChan(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("FOR UPDATE").WithArgs(int64(1)).
		WillReturnRows(sqlmock.NewRows(userCols).AddRow(userRow(1, "admin@test.com", "admin", true)...))
	mock.ExpectRollback()

	r := adminRequest(http.MethodPatch, "/api/admin/users/1/status", "")
	r.SetPathValue("id", "1")
	w := httptest.NewRecorder()
	h.ToggleStatus(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d body=%s, muốn 422", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "tự khoá") {
		t.Errorf("message = %s", w.Body.String())
	}
}

func TestToggleStatusKhoaAdminCuoiCungBiChan(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("FOR UPDATE").WithArgs(int64(2)).
		WillReturnRows(sqlmock.NewRows(userCols).AddRow(userRow(2, "khac@test.com", "admin", true)...))
	mock.ExpectQuery("SELECT COUNT\\(\\*\\) FROM users WHERE role='admin' AND is_active=1 AND id<>\\?").
		WithArgs(int64(2)).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))
	mock.ExpectRollback()

	r := adminRequest(http.MethodPatch, "/api/admin/users/2/status", "")
	r.SetPathValue("id", "2")
	w := httptest.NewRecorder()
	h.ToggleStatus(w, r)

	if w.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "ít nhất 1 admin") {
		t.Errorf("message = %s", w.Body.String())
	}
}

// Khoá tài khoản phải xoá HẾT token của họ — bắt buộc đăng xuất ngay, không
// đợi token tự hết hạn.
func TestToggleStatusKhoaXoaHetToken(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("FOR UPDATE").WithArgs(int64(2)).
		WillReturnRows(sqlmock.NewRows(userCols).AddRow(userRow(2, "seller@test.com", "seller", true)...))
	mock.ExpectExec("UPDATE users SET is_active=\\?,updated_at=\\? WHERE id=\\?").
		WithArgs(false, sqlmock.AnyArg(), int64(2)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("DELETE FROM personal_access_tokens WHERE tokenable_id=\\? AND tokenable_type=\\?").
		WithArgs(int64(2), `App\Models\User`).
		WillReturnResult(sqlmock.NewResult(0, 3))
	mock.ExpectCommit()

	r := adminRequest(http.MethodPatch, "/api/admin/users/2/status", "")
	r.SetPathValue("id", "2")
	w := httptest.NewRecorder()
	h.ToggleStatus(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "Đã khoá") {
		t.Errorf("message = %s", w.Body.String())
	}
}

// Mở khoá lại thì KHÔNG được đụng vào bảng token — chỉ khoá mới cần đăng xuất.
func TestToggleStatusMoKhoaKhongXoaToken(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectBegin()
	mock.ExpectQuery("FOR UPDATE").WithArgs(int64(2)).
		WillReturnRows(sqlmock.NewRows(userCols).AddRow(userRow(2, "seller@test.com", "seller", false)...))
	mock.ExpectExec("UPDATE users SET is_active=\\?,updated_at=\\? WHERE id=\\?").
		WithArgs(true, sqlmock.AnyArg(), int64(2)).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	r := adminRequest(http.MethodPatch, "/api/admin/users/2/status", "")
	r.SetPathValue("id", "2")
	w := httptest.NewRecorder()
	h.ToggleStatus(w, r)

	if w.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Errorf("mở khoá không được có thao tác thừa: %v", err)
	}
}

// ── Users / Show ─────────────────────────────────────────────────────────

func TestUsersLocTheoRoleVaProject(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectQuery("SELECT id,name,email,role,project,seller_name,full_name,is_active FROM users WHERE role=\\? AND project=\\?").
		WithArgs("seller", "Happy Project").
		WillReturnRows(sqlmock.NewRows([]string{"id", "name", "email", "role", "project", "seller_name", "full_name", "is_active"}).
			AddRow(1, "Tên", "a@test.com", "seller", "Happy Project", nil, nil, true))

	r := adminRequest(http.MethodGet, "/api/users?role=seller&project=Happy+Project", "")
	w := httptest.NewRecorder()
	h.Users(w, r)

	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "a@test.com") {
		t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
	}
}

func TestShowKhongTonTaiTra404(t *testing.T) {
	h, mock, done := newHandlerMock(t)
	defer done()

	mock.ExpectQuery("SELECT " + colsRegex + " FROM users WHERE id=\\?$").WillReturnError(sql.ErrNoRows)

	r := adminRequest(http.MethodGet, "/api/users/999", "")
	r.SetPathValue("id", "999")
	w := httptest.NewRecorder()
	h.Show(w, r)

	if w.Code != http.StatusNotFound {
		t.Fatalf("status=%d, muốn 404", w.Code)
	}
}

func TestPathIDKhongHopLeTra404(t *testing.T) {
	h, _, done := newHandlerMock(t)
	defer done()

	for _, id := range []string{"abc", "0", "-1"} {
		r := adminRequest(http.MethodGet, "/api/users/"+id, "")
		r.SetPathValue("id", id)
		w := httptest.NewRecorder()
		h.Show(w, r)
		if w.Code != http.StatusNotFound {
			t.Errorf("id=%q: status=%d, muốn 404", id, w.Code)
		}
	}
}
