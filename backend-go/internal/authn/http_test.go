package authn

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"golang.org/x/crypto/bcrypt"
)

// appKey32 là khoá 32 byte hợp lệ cho LaravelCipher — dùng chung cho các test
// cần vé chọn tài khoản.
var appKey32 = []byte("01234567890123456789012345678901"[:32])

func bcryptHash(t *testing.T, password string) string {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		t.Fatalf("tạo bcrypt hash lỗi: %v", err)
	}
	return string(hash)
}

func postJSON(handler http.HandlerFunc, path string, body any) *httptest.ResponseRecorder {
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func decodeBody[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var out T
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("body không phải JSON hợp lệ: %v\n%s", err, rec.Body.String())
	}
	return out
}

// accountColumns khớp đúng thứ tự userColumns trong store.go (id..is_active).
var accountColumns = []string{
	"id", "name", "full_name", "email", "password", "role", "project",
	"pd_projects", "seller_name", "avatar_url", "is_active",
}

func TestLoginThieuEmailHoacMatKhauTra422(t *testing.T) {
	store, _ := newStoreMock(t)
	h := NewHandler(store, nil)

	rec := postJSON(h.Login, "/api/login", map[string]string{"email": "", "password": ""})

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, muốn 422, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeBody[map[string]any](t, rec)
	if body["message"] != "The email field is required." {
		// Laravel lấy câu lỗi của TRƯỜNG ĐẦU khai báo trước (email trước password).
		t.Errorf("message = %v, muốn câu lỗi của email trước", body["message"])
	}
}

func TestLoginEmailKhongTonTaiTra401(t *testing.T) {
	store, mock := newStoreMock(t)
	h := NewHandler(store, nil)

	mock.ExpectQuery("SELECT").WithArgs("khong-ton-tai@test.com").
		WillReturnRows(sqlmock.NewRows(accountColumns))

	rec := postJSON(h.Login, "/api/login", map[string]string{"email": "khong-ton-tai@test.com", "password": "x"})

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, muốn 401", rec.Code)
	}
	body := decodeBody[map[string]any](t, rec)
	if body["message"] != "Email không tồn tại" {
		t.Errorf("message = %v", body["message"])
	}
}

func TestLoginMatKhauSaiTra401(t *testing.T) {
	store, mock := newStoreMock(t)
	h := NewHandler(store, nil)

	rows := sqlmock.NewRows(accountColumns).
		AddRow(int64(1), "Tên", nil, "a@test.com", bcryptHash(t, "dung-mat-khau"), "seller", nil, nil, nil, nil, true)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)

	rec := postJSON(h.Login, "/api/login", map[string]string{"email": "a@test.com", "password": "sai-mat-khau"})

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, muốn 401", rec.Code)
	}
	body := decodeBody[map[string]any](t, rec)
	if body["message"] != "Mật khẩu sai" {
		t.Errorf("message = %v", body["message"])
	}
}

// Tài khoản có mật khẩu NULL (Seller chỉ đăng nhập bằng Google) không được
// làm hàm panic khi so bcrypt — phải bị coi là không khớp, không phải lỗi 500.
func TestLoginMatKhauNullKhongPanic(t *testing.T) {
	store, mock := newStoreMock(t)
	h := NewHandler(store, nil)

	rows := sqlmock.NewRows(accountColumns).
		AddRow(int64(1), "Tên", nil, "a@test.com", nil, "seller", nil, nil, nil, nil, true)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)

	rec := postJSON(h.Login, "/api/login", map[string]string{"email": "a@test.com", "password": "bat-ky"})

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, muốn 401 (không panic), body = %s", rec.Code, rec.Body.String())
	}
}

// Một email, một role -> đăng nhập thẳng, có token.
func TestLoginMotRoleDangNhapThang(t *testing.T) {
	store, mock := newStoreMock(t)
	h := NewHandler(store, nil)

	rows := sqlmock.NewRows(accountColumns).
		AddRow(int64(1), "Tên", nil, "a@test.com", bcryptHash(t, "matkhau"), "seller", nil, nil, nil, nil, true)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)
	mock.ExpectExec("INSERT INTO personal_access_tokens").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery("SELECT DISTINCT project").WillReturnRows(sqlmock.NewRows([]string{"project"}))

	rec := postJSON(h.Login, "/api/login", map[string]string{"email": "a@test.com", "password": "matkhau"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeBody[map[string]any](t, rec)
	if body["message"] != "Login success" {
		t.Errorf("message = %v", body["message"])
	}
	token, _ := body["token"].(string)
	if !strings.HasPrefix(token, "1|") {
		t.Errorf("token = %q, muốn tiền tố \"1|\"", token)
	}
}

// Một email, NHIỀU role khác nhau -> phải hỏi chọn tài khoản, không đăng nhập
// thẳng vào role đầu tiên tìm thấy.
func TestLoginNhieuRoleTraNeedsSelection(t *testing.T) {
	store, mock := newStoreMock(t)
	h := NewHandler(store, appKey32)

	hash := bcryptHash(t, "matkhau")
	rows := sqlmock.NewRows(accountColumns).
		AddRow(int64(1), "Tên", nil, "a@test.com", hash, "seller", nil, nil, nil, nil, true).
		AddRow(int64(2), "Tên", nil, "a@test.com", hash, "vendor", nil, nil, nil, nil, true)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)

	rec := postJSON(h.Login, "/api/login", map[string]string{"email": "a@test.com", "password": "matkhau"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeBody[map[string]any](t, rec)
	if needs, _ := body["needs_selection"].(bool); !needs {
		t.Fatalf("needs_selection = %v, muốn true", body["needs_selection"])
	}
	if _, ok := body["ticket"].(string); !ok {
		t.Error("thiếu ticket")
	}
	accounts, _ := body["accounts"].([]any)
	if len(accounts) != 2 {
		t.Errorf("accounts = %v, muốn 2", accounts)
	}
}

// Cùng role, khác project (vd PD làm 2 project) -> vào thẳng, KHÔNG hỏi chọn —
// đúng quy tắc "chỉ hỏi khi khác VAI TRÒ".
func TestLoginCungRoleKhacProjectVaoThang(t *testing.T) {
	store, mock := newStoreMock(t)
	h := NewHandler(store, appKey32)

	hash := bcryptHash(t, "matkhau")
	projectA, projectB := "Happy", "Global"
	rows := sqlmock.NewRows(accountColumns).
		AddRow(int64(1), "Tên", nil, "a@test.com", hash, "pd", projectA, nil, nil, nil, true).
		AddRow(int64(2), "Tên", nil, "a@test.com", hash, "pd", projectB, nil, nil, nil, true)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)
	mock.ExpectExec("INSERT INTO personal_access_tokens").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery("SELECT DISTINCT project").WillReturnRows(sqlmock.NewRows([]string{"project"}).AddRow(projectA).AddRow(projectB))

	rec := postJSON(h.Login, "/api/login", map[string]string{"email": "a@test.com", "password": "matkhau"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeBody[map[string]any](t, rec)
	if _, needsSelection := body["needs_selection"]; needsSelection {
		t.Error("cùng role khác project không được hỏi chọn tài khoản")
	}
}

// Nhiều role nhưng APP_KEY chưa cấu hình (cipher nil) -> 503, không được panic
// hay âm thầm cho vào role sai.
func TestLoginNhieuRoleKhongCoAppKeyTra503(t *testing.T) {
	store, mock := newStoreMock(t)
	h := NewHandler(store, nil) // appKey rỗng -> cipher nil

	hash := bcryptHash(t, "matkhau")
	rows := sqlmock.NewRows(accountColumns).
		AddRow(int64(1), "Tên", nil, "a@test.com", hash, "seller", nil, nil, nil, nil, true).
		AddRow(int64(2), "Tên", nil, "a@test.com", hash, "vendor", nil, nil, nil, nil, true)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)

	rec := postJSON(h.Login, "/api/login", map[string]string{"email": "a@test.com", "password": "matkhau"})

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, muốn 503", rec.Code)
	}
}

// Email viết hoa + khoảng trắng vẫn phải đăng nhập được — chuẩn hoá trước khi
// query, đúng cách ActiveAccountsByEmail đã làm.
func TestLoginEmailKhongPhanBietHoaThuong(t *testing.T) {
	store, mock := newStoreMock(t)
	h := NewHandler(store, nil)

	rows := sqlmock.NewRows(accountColumns).
		AddRow(int64(1), "Tên", nil, "a@test.com", bcryptHash(t, "matkhau"), "seller", nil, nil, nil, nil, true)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)
	mock.ExpectExec("INSERT INTO personal_access_tokens").WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectQuery("SELECT DISTINCT project").WillReturnRows(sqlmock.NewRows([]string{"project"}))

	rec := postJSON(h.Login, "/api/login", map[string]string{"email": "  A@Test.com  ", "password": "matkhau"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

func TestLoginJsonHongTra400(t *testing.T) {
	store, _ := newStoreMock(t)
	h := NewHandler(store, nil)

	req := httptest.NewRequest(http.MethodPost, "/api/login", strings.NewReader("{khong phai json"))
	rec := httptest.NewRecorder()
	h.Login(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("status = %d, muốn 400", rec.Code)
	}
}

// ── SelectAccount ──────────────────────────────────────────────────────────

func ticketFor(t *testing.T, cipher *LaravelCipher, email string, exp int64) string {
	t.Helper()
	raw, _ := json.Marshal(map[string]any{"email": email, "exp": exp})
	token, err := cipher.EncryptString(raw)
	if err != nil {
		t.Fatalf("tạo ticket lỗi: %v", err)
	}
	return token
}

func TestSelectAccountThieuTruongTra422(t *testing.T) {
	store, _ := newStoreMock(t)
	h := NewHandler(store, appKey32)

	rec := postJSON(h.SelectAccount, "/api/select-account", map[string]any{"ticket": "", "account_id": nil})

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, muốn 422", rec.Code)
	}
}

func TestSelectAccountKhongCoAppKeyTra422(t *testing.T) {
	store, _ := newStoreMock(t)
	h := NewHandler(store, nil)

	rec := postJSON(h.SelectAccount, "/api/select-account", map[string]any{"ticket": "abc", "account_id": 1})

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, muốn 422", rec.Code)
	}
	body := decodeBody[map[string]any](t, rec)
	if body["message"] != "Phiên chọn tài khoản không hợp lệ" {
		t.Errorf("message = %v", body["message"])
	}
}

func TestSelectAccountTicketGiaMaoTra422(t *testing.T) {
	store, _ := newStoreMock(t)
	h := NewHandler(store, appKey32)

	rec := postJSON(h.SelectAccount, "/api/select-account", map[string]any{"ticket": "khong-phai-ticket-that", "account_id": 1})

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, muốn 422", rec.Code)
	}
}

func TestSelectAccountTicketHetHanTra422(t *testing.T) {
	store, _ := newStoreMock(t)
	cipher, _ := NewLaravelCipher(appKey32)
	h := NewHandler(store, appKey32)

	expired := ticketFor(t, cipher, "a@test.com", time.Now().Unix()-1)
	rec := postJSON(h.SelectAccount, "/api/select-account", map[string]any{"ticket": expired, "account_id": 1})

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, muốn 422", rec.Code)
	}
	body := decodeBody[map[string]any](t, rec)
	if body["message"] != "Phiên đã hết hạn, vui lòng đăng nhập lại" {
		t.Errorf("message = %v", body["message"])
	}
}

func TestSelectAccountKhongKhopTaiKhoanTra422(t *testing.T) {
	store, mock := newStoreMock(t)
	cipher, _ := NewLaravelCipher(appKey32)
	h := NewHandler(store, appKey32)

	valid := ticketFor(t, cipher, "a@test.com", time.Now().Unix()+600)
	mock.ExpectQuery("SELECT").WithArgs(int64(99), "a@test.com").
		WillReturnError(sql.ErrNoRows)

	rec := postJSON(h.SelectAccount, "/api/select-account", map[string]any{"ticket": valid, "account_id": 99})

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeBody[map[string]any](t, rec)
	if body["message"] != "Tài khoản không hợp lệ hoặc đã bị khoá" {
		t.Errorf("message = %v", body["message"])
	}
}

func TestSelectAccountThanhCongTraToken(t *testing.T) {
	store, mock := newStoreMock(t)
	cipher, _ := NewLaravelCipher(appKey32)
	h := NewHandler(store, appKey32)

	valid := ticketFor(t, cipher, "a@test.com", time.Now().Unix()+600)
	rows := sqlmock.NewRows(accountColumns).
		AddRow(int64(2), "Tên", nil, "a@test.com", nil, "vendor", nil, nil, nil, nil, true)
	mock.ExpectQuery("SELECT").WithArgs(int64(2), "a@test.com").WillReturnRows(rows)
	mock.ExpectExec("INSERT INTO personal_access_tokens").WillReturnResult(sqlmock.NewResult(5, 1))
	mock.ExpectQuery("SELECT DISTINCT project").WillReturnRows(sqlmock.NewRows([]string{"project"}))

	// account_id gửi dạng string (JS number lớn đôi khi serialize thành string) — integer() phải nhận cả hai.
	rec := postJSON(h.SelectAccount, "/api/select-account", map[string]any{"ticket": valid, "account_id": "2"})

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeBody[map[string]any](t, rec)
	if body["message"] != "Login success" {
		t.Errorf("message = %v", body["message"])
	}
}

// ── Me / Logout ─────────────────────────────────────────────────────────────

func TestMeTraProfileVaProjects(t *testing.T) {
	store, mock := newStoreMock(t)
	h := NewHandler(store, nil)

	mock.ExpectQuery("SELECT DISTINCT project").
		WithArgs("a@test.com", "pd").
		WillReturnRows(sqlmock.NewRows([]string{"project"}).AddRow("Happy"))

	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	ctx := ContextWithPrincipal(req.Context(), Principal{User: User{ID: 1, Email: "a@test.com", Role: "pd"}})
	rec := httptest.NewRecorder()
	h.Me(rec, req.WithContext(ctx))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeBody[map[string]any](t, rec)
	user, _ := body["user"].(map[string]any)
	if user["email"] != "a@test.com" {
		t.Errorf("user = %v", user)
	}
}

func TestLogoutXoaTokenVaTra200(t *testing.T) {
	store, mock := newStoreMock(t)
	h := NewHandler(store, nil)

	mock.ExpectExec("DELETE FROM personal_access_tokens").
		WithArgs(int64(9), int64(1), `App\Models\User`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	req := httptest.NewRequest(http.MethodPost, "/api/logout", nil)
	ctx := ContextWithPrincipal(req.Context(), Principal{User: User{ID: 1}, TokenID: 9})
	rec := httptest.NewRecorder()
	h.Logout(rec, req.WithContext(ctx))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	body := decodeBody[map[string]any](t, rec)
	if body["message"] != "Logout success" {
		t.Errorf("message = %v", body["message"])
	}
}

// ── integer() helper ────────────────────────────────────────────────────────

func TestIntegerXuDuCacDangGuiLenTuJson(t *testing.T) {
	cases := []struct {
		in     any
		want   int64
		wantOK bool
	}{
		{float64(5), 5, true},
		{float64(5.5), 0, false}, // không phải số nguyên
		{float64(0), 0, false},   // account_id phải > 0
		{float64(-1), -1, false},
		{"5", 5, true},
		{"khong-phai-so", 0, false},
		{nil, 0, false},
		{true, 0, false},
	}

	for _, c := range cases {
		got, ok := integer(c.in)
		if ok != c.wantOK || (ok && got != c.want) {
			t.Errorf("integer(%#v) = %v, %v — muốn %v, %v", c.in, got, ok, c.want, c.wantOK)
		}
	}
}
