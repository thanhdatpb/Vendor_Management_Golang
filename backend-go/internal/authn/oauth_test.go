package authn

import (
	"database/sql/driver"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

// Port của SocialAuthController — 4 lớp kiểm tra ghi rõ trong comment PHP gốc:
//  1. email_verified == true
//  2. email tồn tại trong users (allowlist)
//  3. is_active == true
//  4. google_id khớp (chặn account takeover)
//
// OAuthConfig để sẵn HTTPClient/TokenURL/UserInfoURL cho đúng mục đích test
// này: dựng httptest.Server giả Google, không gọi ra ngoài Internet.

func fakeGoogle(t *testing.T, profile googleProfile, tokenStatus, profileStatus int) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(tokenStatus)
		if tokenStatus >= 200 && tokenStatus < 300 {
			_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "fake-access-token"})
		}
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer fake-access-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.WriteHeader(profileStatus)
		if profileStatus >= 200 && profileStatus < 300 {
			_ = json.NewEncoder(w).Encode(profile)
		}
	})
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server
}

func newOAuthHandler(t *testing.T, server *httptest.Server, cfg OAuthConfig) (*OAuthHandler, *Store, sqlmock.Sqlmock) {
	t.Helper()
	store, mock := newStoreMock(t)
	cfg.ClientID = "client-id"
	cfg.ClientSecret = "client-secret"
	cfg.RedirectURI = "http://localhost:8001/api/auth/google/callback"
	if cfg.FrontendURL == "" {
		cfg.FrontendURL = "http://localhost:5173"
	}
	if cfg.AppKey == nil {
		cfg.AppKey = appKey32
	}
	if server != nil {
		cfg.TokenURL = server.URL + "/token"
		cfg.UserInfoURL = server.URL + "/userinfo"
	}
	return NewOAuthHandler(store, cfg), store, mock
}

func TestRedirectChuaCauHinhTraVeLoginLoi(t *testing.T) {
	h, _, _ := newOAuthHandler(t, nil, OAuthConfig{})
	h.config.ClientID = "" // cố ý thiếu cấu hình

	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/redirect", nil)
	rec := httptest.NewRecorder()
	h.Redirect(rec, req)

	loc := rec.Header().Get("Location")
	if !strings.Contains(loc, "/login") || !strings.Contains(loc, "error=oauth_failed") {
		t.Errorf("Location = %q", loc)
	}
}

func TestRedirectDatCookieStateVaTroSangGoogle(t *testing.T) {
	h, _, _ := newOAuthHandler(t, nil, OAuthConfig{})

	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/redirect", nil)
	rec := httptest.NewRecorder()
	h.Redirect(rec, req)

	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d, muốn 302", rec.Code)
	}
	loc, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatalf("Location không phải URL hợp lệ: %v", err)
	}
	if !strings.Contains(loc.String(), "accounts.google.com") {
		t.Errorf("Location = %q, muốn trỏ tới Google", loc)
	}
	if loc.Query().Get("client_id") != "client-id" {
		t.Errorf("client_id = %q", loc.Query().Get("client_id"))
	}
	if loc.Query().Get("state") == "" {
		t.Error("thiếu state param")
	}

	cookies := rec.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != oauthStateCookie {
		t.Fatalf("cookies = %v, muốn 1 cookie state", cookies)
	}
	if cookies[0].Value != loc.Query().Get("state") {
		t.Error("giá trị cookie phải khớp state gửi cho Google")
	}
	if !cookies[0].HttpOnly {
		t.Error("cookie state phải HttpOnly")
	}
}

func callbackRequest(state, code, errParam, cookieState string) *http.Request {
	q := url.Values{}
	if state != "" {
		q.Set("state", state)
	}
	if code != "" {
		q.Set("code", code)
	}
	if errParam != "" {
		q.Set("error", errParam)
	}
	req := httptest.NewRequest(http.MethodGet, "/api/auth/google/callback?"+q.Encode(), nil)
	if cookieState != "" {
		req.AddCookie(&http.Cookie{Name: oauthStateCookie, Value: cookieState})
	}
	return req
}

func redirectError(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	loc, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatalf("Location không hợp lệ: %v (raw=%q)", err, rec.Header().Get("Location"))
	}
	return loc.Query().Get("error")
}

func TestCallbackStateKhongKhopBiTuChoi(t *testing.T) {
	h, _, _ := newOAuthHandler(t, nil, OAuthConfig{})

	req := callbackRequest("state-tu-google", "code123", "", "state-khac-trong-cookie")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	if got := redirectError(t, rec); got != "oauth_failed" {
		t.Errorf("error = %q, muốn oauth_failed", got)
	}
}

func TestCallbackThieuCookieStateBiTuChoi(t *testing.T) {
	h, _, _ := newOAuthHandler(t, nil, OAuthConfig{})

	req := callbackRequest("state-tu-google", "code123", "", "")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	if got := redirectError(t, rec); got != "oauth_failed" {
		t.Errorf("error = %q, muốn oauth_failed", got)
	}
}

func TestCallbackGoogleTraErrorBiTuChoi(t *testing.T) {
	h, _, _ := newOAuthHandler(t, nil, OAuthConfig{})

	req := callbackRequest("s", "", "access_denied", "s")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	if got := redirectError(t, rec); got != "oauth_failed" {
		t.Errorf("error = %q, muốn oauth_failed", got)
	}
}

func TestCallbackTraoDoiTokenThatBai(t *testing.T) {
	server := fakeGoogle(t, googleProfile{}, http.StatusBadRequest, http.StatusOK)
	h, _, _ := newOAuthHandler(t, server, OAuthConfig{})

	req := callbackRequest("s", "code123", "", "s")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	if got := redirectError(t, rec); got != "oauth_failed" {
		t.Errorf("error = %q, muốn oauth_failed", got)
	}
}

// Lớp kiểm 1: email_verified phải true.
func TestCallbackEmailChuaXacMinhBiTuChoi(t *testing.T) {
	server := fakeGoogle(t, googleProfile{
		Subject: "g-1", Email: "a@test.com", EmailVerified: false,
	}, http.StatusOK, http.StatusOK)
	h, _, _ := newOAuthHandler(t, server, OAuthConfig{})

	req := callbackRequest("s", "code123", "", "s")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	if got := redirectError(t, rec); got != "email_not_verified" {
		t.Errorf("error = %q, muốn email_not_verified", got)
	}
}

// Lớp kiểm 2: email phải có trong allowlist users.
func TestCallbackEmailKhongTonTaiBiTuChoi(t *testing.T) {
	server := fakeGoogle(t, googleProfile{
		Subject: "g-1", Email: "khong-ton-tai@test.com", EmailVerified: true,
	}, http.StatusOK, http.StatusOK)
	h, _, mock := newOAuthHandler(t, server, OAuthConfig{})

	mock.ExpectQuery("SELECT").WithArgs("khong-ton-tai@test.com").
		WillReturnRows(sqlmock.NewRows(append(accountColumns, "google_id")))

	req := callbackRequest("s", "code123", "", "s")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	if got := redirectError(t, rec); got != "account_not_found" {
		t.Errorf("error = %q, muốn account_not_found", got)
	}
}

func oauthRow(id int64, role string, active bool, googleID string) []driver.Value {
	return append(userRow(id, "a@test.com", role, active), googleID)
}

// Lớp kiểm 3: phải còn ít nhất 1 tài khoản active.
func TestCallbackTatCaTaiKhoanBiKhoaBiTuChoi(t *testing.T) {
	server := fakeGoogle(t, googleProfile{
		Subject: "g-1", Email: "a@test.com", EmailVerified: true,
	}, http.StatusOK, http.StatusOK)
	h, _, mock := newOAuthHandler(t, server, OAuthConfig{})

	rows := sqlmock.NewRows(append(accountColumns, "google_id")).
		AddRow(oauthRow(1, "seller", false, "")...)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)

	req := callbackRequest("s", "code123", "", "s")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	if got := redirectError(t, rec); got != "account_disabled" {
		t.Errorf("error = %q, muốn account_disabled", got)
	}
}

// Lớp kiểm 4: google_id đã gắn cho một danh tính KHÁC thì từ chối — chặn
// account takeover (ai đó đoán được email nhưng không phải chủ tài khoản Google).
func TestCallbackGoogleIdKhacBiTuChoiChanTakeover(t *testing.T) {
	server := fakeGoogle(t, googleProfile{
		Subject: "g-KE-GIA-MAO", Email: "a@test.com", EmailVerified: true,
	}, http.StatusOK, http.StatusOK)
	h, _, mock := newOAuthHandler(t, server, OAuthConfig{})

	// Tài khoản đã gắn với danh tính Google THẬT (g-chu-that), khác với Subject
	// mà request này mang tới.
	rows := sqlmock.NewRows(append(accountColumns, "google_id")).
		AddRow(oauthRow(1, "seller", true, "g-chu-that")...)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)

	req := callbackRequest("s", "code123", "", "s")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	if got := redirectError(t, rec); got != "identity_mismatch" {
		t.Errorf("error = %q, muốn identity_mismatch", got)
	}
}

// Thành công, 1 role -> tạo token thẳng, KHÔNG hỏi chọn tài khoản.
func TestCallbackThanhCongMotRoleTaoTokenThang(t *testing.T) {
	server := fakeGoogle(t, googleProfile{
		Subject: "g-1", Email: "a@test.com", EmailVerified: true, Name: "Tên Mới", Picture: "https://pic",
	}, http.StatusOK, http.StatusOK)
	h, _, mock := newOAuthHandler(t, server, OAuthConfig{})

	rows := sqlmock.NewRows(append(accountColumns, "google_id")).
		AddRow(oauthRow(1, "seller", true, "g-1")...)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)
	// google_id đã khớp sẵn nên KHÔNG update google_id; vẫn update avatar_url
	// (Google có thể đổi ảnh), và full_name (account.FullName đang nil ở fixture).
	mock.ExpectExec("UPDATE users SET avatar_url").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE users SET full_name").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO personal_access_tokens").WillReturnResult(sqlmock.NewResult(1, 1))

	req := callbackRequest("s", "code123", "", "s")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	loc, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatalf("Location không hợp lệ: %v", err)
	}
	if !strings.Contains(loc.Path, "/auth/callback") {
		t.Errorf("path = %q", loc.Path)
	}
	if loc.Query().Get("token") == "" {
		t.Error("thiếu token trong redirect thành công")
	}
}

// Nhiều role -> KHÔNG tạo token, phải trả vé chọn tài khoản (select= + accounts=).
func TestCallbackThanhCongNhieuRoleTraVeChonTaiKhoan(t *testing.T) {
	server := fakeGoogle(t, googleProfile{
		Subject: "g-1", Email: "a@test.com", EmailVerified: true,
	}, http.StatusOK, http.StatusOK)
	h, _, mock := newOAuthHandler(t, server, OAuthConfig{})

	rows := sqlmock.NewRows(append(accountColumns, "google_id")).
		AddRow(oauthRow(1, "seller", true, "g-1")...).
		AddRow(oauthRow(2, "vendor", true, "")...)
	mock.ExpectQuery("SELECT").WithArgs("a@test.com").WillReturnRows(rows)
	mock.ExpectExec("UPDATE users SET").WillReturnResult(sqlmock.NewResult(0, 1))           // account 1: avatar
	mock.ExpectExec("UPDATE users SET").WillReturnResult(sqlmock.NewResult(0, 1))           // account 1: full_name
	mock.ExpectExec("UPDATE users SET google_id").WillReturnResult(sqlmock.NewResult(0, 1)) // account 2: gắn google_id lần đầu

	req := callbackRequest("s", "code123", "", "s")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	loc, err := url.Parse(rec.Header().Get("Location"))
	if err != nil {
		t.Fatalf("Location không hợp lệ: %v", err)
	}
	if loc.Query().Get("select") == "" || loc.Query().Get("accounts") == "" {
		t.Errorf("thiếu select/accounts trong redirect nhiều role: %q", loc)
	}
	if loc.Query().Get("token") != "" {
		t.Error("nhiều role không được phát token thẳng")
	}
}

func TestCallbackProfileKhongHopLeBiTuChoi(t *testing.T) {
	// userinfo trả 200 nhưng thiếu sub/email -> phải bị coi là lỗi, không panic.
	server := fakeGoogle(t, googleProfile{Email: ""}, http.StatusOK, http.StatusOK)
	h, _, _ := newOAuthHandler(t, server, OAuthConfig{})

	req := callbackRequest("s", "code123", "", "s")
	rec := httptest.NewRecorder()
	h.Callback(rec, req)

	if got := redirectError(t, rec); got != "oauth_failed" {
		t.Errorf("error = %q, muốn oauth_failed", got)
	}
}
