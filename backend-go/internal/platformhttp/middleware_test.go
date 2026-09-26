package platformhttp

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func quietLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func ok(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"ok":true}`))
}

func call(handler http.Handler, method, origin string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, "/api/products", nil)
	if origin != "" {
		request.Header.Set("Origin", origin)
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)
	return recorder
}

// CORS chỉ được mở cho đúng FRONTEND_URL và cho localhost khi dev. Mở rộng hơn
// là cho bất kỳ trang nào gọi API bằng token của người đang đăng nhập.
func TestCorsChiMoChoFrontendVaLocalhost(t *testing.T) {
	handler := Chain(http.HandlerFunc(ok), "https://vendorhub.example.com", quietLogger())

	allowed := []string{
		"https://vendorhub.example.com",
		"https://vendorhub.example.com/", // dấu gạch cuối không được làm lệch
		"http://localhost:5173",
		"http://127.0.0.1:8000",
	}
	for _, origin := range allowed {
		got := call(handler, http.MethodGet, origin).Header().Get("Access-Control-Allow-Origin")
		if got == "" {
			t.Errorf("origin %q bị từ chối, phải được cho phép", origin)
		}
	}

	denied := []string{
		"https://evil.example.com",
		"https://vendorhub.example.com.evil.com",
		"http://localhost.evil.com",
	}
	for _, origin := range denied {
		if got := call(handler, http.MethodGet, origin).Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Errorf("origin %q được cho phép (%q), phải bị từ chối", origin, got)
		}
	}
}

// Origin được phép thì phải kèm Vary: Origin, nếu không proxy chung sẽ cache
// header của origin này rồi phát cho origin khác.
func TestOriginDuocPhepCoVaryVaDuHeader(t *testing.T) {
	handler := Chain(http.HandlerFunc(ok), "https://vendorhub.example.com", quietLogger())

	response := call(handler, http.MethodGet, "https://vendorhub.example.com")

	if response.Header().Get("Vary") != "Origin" {
		t.Errorf("Vary = %q, muốn Origin", response.Header().Get("Vary"))
	}
	headers := response.Header().Get("Access-Control-Allow-Headers")
	for _, needed := range []string{"Authorization", "Content-Type", "If-None-Match"} {
		if !strings.Contains(headers, needed) {
			t.Errorf("Access-Control-Allow-Headers thiếu %q: %q", needed, headers)
		}
	}
	methods := response.Header().Get("Access-Control-Allow-Methods")
	for _, needed := range []string{"GET", "POST", "PUT", "PATCH", "DELETE"} {
		if !strings.Contains(methods, needed) {
			t.Errorf("Access-Control-Allow-Methods thiếu %q: %q", needed, methods)
		}
	}
}

// Preflight trả 204 rỗng và KHÔNG chạy tới handler thật.
func TestPreflightTra204VaKhongChayHandler(t *testing.T) {
	reached := false
	handler := Chain(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	}), "https://vendorhub.example.com", quietLogger())

	response := call(handler, http.MethodOptions, "https://vendorhub.example.com")

	if response.Code != http.StatusNoContent {
		t.Errorf("status = %d, muốn 204", response.Code)
	}
	if response.Body.Len() != 0 {
		t.Errorf("preflight phải rỗng, nhận %d byte", response.Body.Len())
	}
	if reached {
		t.Error("preflight không được chạy tới handler thật")
	}
}

// Request không có Origin (gọi từ server, curl, healthcheck) vẫn phải đi qua.
func TestRequestKhongCoOriginVanDiQua(t *testing.T) {
	handler := Chain(http.HandlerFunc(ok), "https://vendorhub.example.com", quietLogger())

	response := call(handler, http.MethodGet, "")

	if response.Code != http.StatusOK {
		t.Errorf("status = %d, muốn 200", response.Code)
	}
	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("không có Origin thì không được đặt header CORS, nhận %q", got)
	}
}

// Panic trong handler phải thành 500 JSON, không làm chết cả tiến trình và
// không để lộ stack trace ra ngoài.
func TestPanicThanh500JsonKhongLoStack(t *testing.T) {
	handler := Chain(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("bí mật nội bộ: chuỗi kết nối DB")
	}), "https://vendorhub.example.com", quietLogger())

	response := call(handler, http.MethodGet, "https://vendorhub.example.com")

	if response.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, muốn 500", response.Code)
	}
	body := response.Body.String()
	if !strings.Contains(body, `"message"`) || !strings.Contains(body, "Server Error") {
		t.Errorf("body = %q, muốn envelope JSON Server Error", body)
	}
	if strings.Contains(body, "bí mật nội bộ") || strings.Contains(body, "goroutine") {
		t.Errorf("body làm lộ chi tiết nội bộ: %q", body)
	}
	if got := response.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q", got)
	}
}
