package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Sáu envelope lỗi phải giữ nguyên từng ký tự: frontend đã chạy production nhiều
// tháng trên đúng các chuỗi này.

func body(t *testing.T, write func(http.ResponseWriter)) (int, string) {
	t.Helper()
	rec := httptest.NewRecorder()
	write(rec)
	return rec.Code, strings.TrimSpace(rec.Body.String())
}

func TestEnvelopeLoiGiuNguyenTungKyTu(t *testing.T) {
	cases := []struct {
		name       string
		write      func(http.ResponseWriter)
		wantStatus int
		wantBody   string
	}{
		{
			"chua xac thuc",
			Unauthenticated,
			http.StatusUnauthorized,
			// Dấu chấm cuối câu là của Laravel.
			`{"message":"Unauthenticated."}`,
		},
		{
			"admin middleware",
			AdminForbidden,
			http.StatusForbidden,
			`{"message":"Forbidden"}`,
		},
		{
			"role middleware",
			RoleForbidden,
			http.StatusForbidden,
			`{"success":false,"message":"Bạn không có quyền thực hiện thao tác này"}`,
		},
		{
			"403 co cau rieng",
			func(w http.ResponseWriter) { Forbidden(w, "Bạn không có quyền xem bảng tính giá.") },
			http.StatusForbidden,
			`{"message":"Bạn không có quyền xem bảng tính giá."}`,
		},
	}

	for _, c := range cases {
		status, got := body(t, c.write)
		if status != c.wantStatus {
			t.Errorf("%s: status = %d, muốn %d", c.name, status, c.wantStatus)
		}
		if got != c.wantBody {
			t.Errorf("%s:\n got %s\nmuốn %s", c.name, got, c.wantBody)
		}
	}
}

// Envelope của BaseApiController — chỉ vendor import dùng, nhưng phải đúng.
func TestEnvelopeBaseApiController(t *testing.T) {
	status, got := body(t, func(w http.ResponseWriter) {
		APISuccess(w, map[string]int{"imported": 12}, "Đã import thành công", 0)
	})
	if status != http.StatusOK {
		t.Errorf("status = %d, muốn 200", status)
	}
	if got != `{"success":true,"message":"Đã import thành công","data":{"imported":12}}` {
		t.Errorf("got %s", got)
	}

	// Message rỗng rơi về mặc định của bản PHP.
	_, def := body(t, func(w http.ResponseWriter) { APIError(w, "", 0, nil) })
	if def != `{"success":false,"message":"Error","data":null}` {
		t.Errorf("mặc định = %s", def)
	}
}

// Laravel lấy câu ĐẦU TIÊN theo thứ tự khai báo rule làm trường message. Map của
// Go duyệt ngẫu nhiên nên phải tự giữ thứ tự, nếu không message đổi mỗi lần chạy.
func TestValidationLayCauDauTienTheoThuTuKhaiBao(t *testing.T) {
	for i := 0; i < 20; i++ { // lặp để bắt được nếu ai đó thay bằng map
		v := NewValidation()
		v.Add("email", "The email field is required.")
		v.Add("password", "The password field is required.")
		v.Add("email", "The email must be a valid email address.")

		if got := v.Message(); got != "The email field is required." {
			t.Fatalf("message = %q, muốn câu đầu của trường đầu", got)
		}
	}
}

func TestValidationRa422DungHinhDang(t *testing.T) {
	v := NewValidation()
	v.Add("file", "The file field is required.")

	status, got := body(t, func(w http.ResponseWriter) { WriteValidationFailed(w, v) })

	if status != http.StatusUnprocessableEntity {
		t.Errorf("status = %d, muốn 422", status)
	}
	want := `{"message":"The file field is required.","errors":{"file":["The file field is required."]}}`
	if got != want {
		t.Errorf("\n got %s\nmuốn %s", got, want)
	}

	if !v.Failed() {
		t.Error("Failed() phải true khi có lỗi")
	}
	if NewValidation().Failed() {
		t.Error("Failed() phải false khi chưa có lỗi nào")
	}
}

// 409 của bảng tính giá: code luôn được đặt, kể cả khi nơi gọi quên.
func TestVersionConflictLuonCoCode(t *testing.T) {
	status, got := body(t, func(w http.ResponseWriter) {
		WriteVersionConflict(w, VersionConflict{CurrentVersion: 7, UpdatedBy: "Dat"})
	})

	if status != http.StatusConflict {
		t.Errorf("status = %d, muốn 409", status)
	}
	if !strings.Contains(got, `"code":"version_conflict"`) {
		t.Errorf("thiếu code trong %s", got)
	}
	if !strings.Contains(got, `"currentVersion":7`) {
		t.Errorf("thiếu currentVersion trong %s", got)
	}
	// Message mặc định là câu người dùng đọc trên UI.
	if !strings.Contains(got, "đã được người khác cập nhật") {
		t.Errorf("thiếu message mặc định trong %s", got)
	}
}

// Nơi gọi truyền status 0 thì rơi về mặc định của bản PHP: 200 cho success,
// 400 cho error. Không được thành 0 — net/http sẽ panic.
func TestStatusMacDinhKhiNoiGoiKhongTruyen(t *testing.T) {
	status, _ := body(t, func(w http.ResponseWriter) { APISuccess(w, nil, "", 0) })
	if status != http.StatusOK {
		t.Errorf("APISuccess status = %d, muốn 200", status)
	}

	status, _ = body(t, func(w http.ResponseWriter) { APIError(w, "hỏng", 0, nil) })
	if status != http.StatusBadRequest {
		t.Errorf("APIError status = %d, muốn 400", status)
	}

	// Status truyền tường minh thì phải được tôn trọng.
	status, _ = body(t, func(w http.ResponseWriter) { APIError(w, "hỏng", http.StatusInternalServerError, nil) })
	if status != http.StatusInternalServerError {
		t.Errorf("status = %d, muốn 500", status)
	}
}

// Validation chưa có lỗi nào thì Message() phải trả chuỗi rỗng, không panic vì
// đọc phần tử đầu của slice rỗng.
func TestValidationRongKhongPanic(t *testing.T) {
	v := NewValidation()

	if got := v.Message(); got != "" {
		t.Errorf("Message() = %q, muốn chuỗi rỗng", got)
	}
	if len(v.Fields()) != 0 {
		t.Errorf("Fields() = %v, muốn rỗng", v.Fields())
	}
}

// Nhiều câu lỗi cho cùng một trường phải giữ đủ và đúng thứ tự — Laravel trả cả
// mảng, UI hiện từng dòng.
func TestValidationGiuDuCacCauLoiCuaMotTruong(t *testing.T) {
	v := NewValidation()
	v.Add("email", "The email field is required.")
	v.Add("email", "The email must be a valid email address.")

	got := v.Fields()["email"]
	if len(got) != 2 || got[0] != "The email field is required." {
		t.Errorf("errors[email] = %v", got)
	}
}
