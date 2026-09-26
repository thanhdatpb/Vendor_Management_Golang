package authn

import (
	"database/sql"
	"database/sql/driver"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func passThrough() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p, ok := PrincipalFrom(r.Context())
		if !ok {
			w.WriteHeader(499) // đánh dấu "không thấy principal" để test phát hiện
			return
		}
		w.Header().Set("X-User-Email", p.User.Email)
		w.WriteHeader(http.StatusOK)
	})
}

// Require là middleware duy nhất gác toàn bộ route đã đăng nhập — sai ở đây
// nghĩa là hoặc chặn nhầm người hợp lệ, hoặc cho người không có token đi qua.

func TestRequireThieuHeaderTraUnauthenticated(t *testing.T) {
	store, _ := newStoreMock(t)
	handler := store.Require(passThrough())

	for _, header := range []string{"", "Token abc", "Bearer", "Bear abc123"} {
		req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
		if header != "" {
			req.Header.Set("Authorization", header)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Errorf("header=%q: status = %d, muốn 401", header, rec.Code)
		}
		if !strings.Contains(rec.Body.String(), "Unauthenticated") {
			t.Errorf("header=%q: body = %s", header, rec.Body.String())
		}
	}
}

// "bearer " chữ thường vẫn phải được nhận — Laravel dùng EqualFold, không phân
// biệt hoa thường ở tên scheme.
func TestRequireBearerKhongPhanBietHoaThuong(t *testing.T) {
	store, mock := newStoreMock(t)
	plain := "token-hop-le"

	rows := sqlmock.NewRows([]string{
		"pat.id", "pat.token", "pat.expires_at",
		"id", "name", "full_name", "email", "password", "role", "project",
		"pd_projects", "seller_name", "avatar_url", "is_active",
	}).AddRow(append([]driver.Value{int64(1), hashOf(plain), nil}, userRow(1, "a@test.com", "seller", true)...)...)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").
		WithArgs("1", `App\Models\User`).
		WillReturnRows(rows)
	mock.ExpectExec("UPDATE personal_access_tokens").WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("UPDATE users SET last_seen_at").WillReturnResult(sqlmock.NewResult(0, 1))

	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.Header.Set("Authorization", "bearer 1|"+plain)
	rec := httptest.NewRecorder()
	store.Require(passThrough()).ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("X-User-Email") != "a@test.com" {
		t.Error("principal không được đưa vào context")
	}
}

// Token sai (ErrUnauthenticated từ Store.Authenticate) phải ra 401, không lộ
// khác biệt giữa "token sai" và "token hết hạn"/"user bị khoá".
func TestRequireTokenSaiTra401(t *testing.T) {
	store, mock := newStoreMock(t)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").
		WithArgs("1", `App\Models\User`).
		WillReturnError(sql.ErrNoRows)

	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.Header.Set("Authorization", "Bearer 1|token-sai")
	rec := httptest.NewRecorder()
	store.Require(passThrough()).ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, muốn 401", rec.Code)
	}
}

// Lỗi DB thật (không phải "không tìm thấy") phải ra 500, không phải 401 — hai
// tình huống khác nhau: một là "bạn sai", một là "hệ thống hỏng".
func TestRequireLoiDbThatTra500(t *testing.T) {
	store, mock := newStoreMock(t)

	mock.ExpectQuery("SELECT pat.id, pat.token, pat.expires_at").
		WithArgs("1", `App\Models\User`).
		WillReturnError(sql.ErrConnDone)

	req := httptest.NewRequest(http.MethodGet, "/api/me", nil)
	req.Header.Set("Authorization", "Bearer 1|token")
	rec := httptest.NewRecorder()
	store.Require(passThrough()).ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, muốn 500", rec.Code)
	}
}

func TestRequireAdminKhongCoPrincipalBi403(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	RequireAdmin(passThrough()).ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, muốn 403", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "Forbidden") {
		t.Errorf("body = %s, muốn envelope AdminForbidden", rec.Body.String())
	}
}

func TestRequireAdminRoleKhongPhaiAdminBi403(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	ctx := ContextWithPrincipal(req.Context(), Principal{User: User{Role: "seller"}})
	RequireAdmin(passThrough()).ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, muốn 403", rec.Code)
	}
}

func TestRequireAdminChoQuaKhiLaAdmin(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/admin/users", nil)
	ctx := ContextWithPrincipal(req.Context(), Principal{User: User{Role: "admin", Email: "admin@test.com"}})
	RequireAdmin(passThrough()).ServeHTTP(rec, req.WithContext(ctx))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
}

// RequireRoles phải chuẩn hoá role giống HasRole (bỏ dấu _/-/khoảng trắng) —
// route assign-vendors dùng role:staff_b,vendor, hai tên gọi của cùng một vai.
func TestRequireRolesChapNhanBiDanhVaTuChoiRoleKhac(t *testing.T) {
	middleware := RequireRoles("staff_b", "vendor")

	cases := []struct {
		role string
		want int
	}{
		{"vendor", http.StatusOK},
		{"staff_b", http.StatusOK},
		{"Staff B", http.StatusOK}, // khác hoa/thường + khoảng trắng vẫn phải khớp
		{"seller", http.StatusForbidden},
		{"", http.StatusForbidden},
	}

	for _, c := range cases {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/api/products/1/assign-vendors", nil)
		ctx := ContextWithPrincipal(req.Context(), Principal{User: User{Role: c.role}})
		middleware(passThrough()).ServeHTTP(rec, req.WithContext(ctx))

		if rec.Code != c.want {
			t.Errorf("role=%q: status = %d, muốn %d", c.role, rec.Code, c.want)
		}
	}
}

func TestRequireRolesKhongCoPrincipalBi403(t *testing.T) {
	middleware := RequireRoles("admin")
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/x", nil)
	middleware(passThrough()).ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("status = %d, muốn 403", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"success":false`) {
		t.Errorf("body = %s, muốn envelope RoleForbidden", rec.Body.String())
	}
}

func TestPrincipalFromKhongCoTraFalse(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	if _, ok := PrincipalFrom(req.Context()); ok {
		t.Error("context rỗng phải trả ok=false")
	}
}
