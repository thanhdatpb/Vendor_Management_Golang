package httpx

import (
	"net/http/httptest"
	"strings"
	"testing"
)

// Ca quan trọng nhất: hai role khác nhau KHÔNG được ra cùng ETag. Nếu trùng,
// client của Seller và của CSF dùng chung bản cache — tức phát bản đầy đủ giá
// cho role chỉ-đọc, hoặc phát bản đã lọc cho người được xem đủ.
func TestETagKhacNhauTheoRole(t *testing.T) {
	stamp := "2026-09-26 10:00:00"

	seller := LibraryETag("vendor-library", stamp, "seller")
	csf := LibraryETag("vendor-library", stamp, "csf")
	pd := LibraryETag("vendor-library", stamp, "pd")

	if seller == csf || seller == pd || csf == pd {
		t.Errorf("ETag trùng nhau giữa các role: seller=%s csf=%s pd=%s", seller, csf, pd)
	}
}

func TestETagDoiKhiDuLieuDoi(t *testing.T) {
	before := LibraryETag("vendor-library", "2026-09-26 10:00:00", "seller")
	after := LibraryETag("vendor-library", "2026-09-26 10:00:01", "seller")

	if before == after {
		t.Error("ETag phải đổi khi updated_at đổi")
	}
}

// Cùng đầu vào thì phải ra cùng ETag ở mọi tiến trình và mọi lần chạy — nếu
// không thì mọi request đều là cache miss.
func TestETagOnDinh(t *testing.T) {
	a := LibraryETag("vendor-library", "2026-09-26 10:00:00", "seller")
	b := LibraryETag("vendor-library", "2026-09-26 10:00:00", "seller")

	if a != b {
		t.Errorf("ETag không ổn định: %s vs %s", a, b)
	}
	// Phải có dấu nháy kép bao ngoài theo đúng RFC 7232.
	if !strings.HasPrefix(a, `"`) || !strings.HasSuffix(a, `"`) {
		t.Errorf("ETag %s thiếu dấu nháy kép bao ngoài", a)
	}
}

// Bảng thư viện rỗng: stamp trống rơi về "0" thay vì sinh ETag của chuỗi rỗng.
func TestETagBangRongVanHopLe(t *testing.T) {
	empty := LibraryETag("vendor-library", "", "seller")
	zero := LibraryETag("vendor-library", "0", "seller")

	if empty != zero {
		t.Errorf("stamp rỗng phải tương đương \"0\": %s vs %s", empty, zero)
	}
}

func TestETagMatchesXuDuMoiDangHeaderThucTe(t *testing.T) {
	etag := LibraryETag("vendor-library", "2026-09-26 10:00:00", "seller")

	match := []string{
		etag,
		" " + etag + " ",
		"W/" + etag,
		"*",
		`"caikhac", ` + etag,
	}
	for _, header := range match {
		if !ETagMatches(header, etag) {
			t.Errorf("If-None-Match %q phải khớp", header)
		}
	}

	noMatch := []string{"", "   ", `"caikhac"`, `W/"caikhac"`, `"caikhac", "themcai"`}
	for _, header := range noMatch {
		if ETagMatches(header, etag) {
			t.Errorf("If-None-Match %q KHÔNG được khớp", header)
		}
	}
}

func TestHeaderCacheChoResponseDocThuVien(t *testing.T) {
	rec := httptest.NewRecorder()
	WriteLibraryCacheHeaders(rec, `"abc"`)

	if got := rec.Header().Get("ETag"); got != `"abc"` {
		t.Errorf("ETag = %q", got)
	}
	// private: dữ liệu khác nhau theo role nên proxy chung không được cache.
	if got := rec.Header().Get("Cache-Control"); got != "private, must-revalidate" {
		t.Errorf("Cache-Control = %q, muốn \"private, must-revalidate\"", got)
	}
}

func TestNotModifiedTra304Rong(t *testing.T) {
	rec := httptest.NewRecorder()
	NotModified(rec, `"abc"`)

	if rec.Code != 304 {
		t.Errorf("status = %d, muốn 304", rec.Code)
	}
	if rec.Body.Len() != 0 {
		t.Errorf("304 phải rỗng, nhận %d byte", rec.Body.Len())
	}
	if rec.Header().Get("ETag") != `"abc"` {
		t.Error("304 vẫn phải mang ETag")
	}
}

// Đường tắt của blob: trả nguyên chuỗi đã lưu, không unmarshal rồi marshal lại.
func TestWriteRawJSONTraNguyenChuoiDaLuu(t *testing.T) {
	blob := []byte(`[{"filename":"Thu vien P.happy.xlsx","pricing":[]}]`)

	rec := httptest.NewRecorder()
	WriteRawJSON(rec, `"abc"`, blob)

	if rec.Body.String() != string(blob) {
		t.Errorf("body bị đổi:\n got %s\nmuốn %s", rec.Body.String(), blob)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q", got)
	}
	if rec.Header().Get("Cache-Control") == "" {
		t.Error("đường tắt vẫn phải gắn Cache-Control")
	}
}
