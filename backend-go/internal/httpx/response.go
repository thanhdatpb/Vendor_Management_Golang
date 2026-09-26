package httpx

import (
	"encoding/json"
	"net/http"
)

// API hiện tại có SÁU envelope lỗi khác nhau và frontend đọc đúng từng dạng.
// Hợp nhất chúng là đổi contract, nên file này giữ nguyên cả sáu.
//
//	401 chưa xác thực       {"message":"Unauthenticated."}
//	422 validate thất bại   {"message":"…","errors":{"field":["…"]}}
//	403 RoleMiddleware      {"success":false,"message":"Bạn không có quyền thực hiện thao tác này"}
//	403 AdminMiddleware     {"message":"Forbidden"}
//	BaseApiController       {"success":bool,"message":string,"data":any}
//	409 xung đột bảng giá   {"message":…,"code":"version_conflict",…}

// JSON ghi body JSON với status cho trước. Mọi hàm dưới đây đi qua nó.
func JSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// Message là envelope một dòng: {"message": "..."}.
type Message struct {
	Message string `json:"message"`
}

// Unauthenticated trả đúng body Sanctum trả khi thiếu hoặc sai token.
// Dấu chấm cuối câu là của Laravel, không được bỏ.
func Unauthenticated(w http.ResponseWriter) {
	JSON(w, http.StatusUnauthorized, Message{Message: "Unauthenticated."})
}

// AdminForbidden là body của AdminMiddleware. Ngắn gọn và KHÁC body của
// RoleMiddleware — đây không phải sơ suất cần sửa, frontend phân biệt hai dạng.
func AdminForbidden(w http.ResponseWriter) {
	JSON(w, http.StatusForbidden, Message{Message: "Forbidden"})
}

// RoleDenied là body của RoleMiddleware: có thêm cờ success, và câu tiếng Việt
// được hiển thị thẳng cho người dùng.
type RoleDenied struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// RoleForbidden trả đúng body RoleMiddleware đang trả.
func RoleForbidden(w http.ResponseWriter) {
	JSON(w, http.StatusForbidden, RoleDenied{
		Success: false,
		Message: "Bạn không có quyền thực hiện thao tác này",
	})
}

// Forbidden trả 403 với một câu cụ thể, dùng cho các chỗ tự kiểm quyền trong
// handler (ví dụ bảng tính giá: "Bạn không có quyền xem bảng tính giá.").
func Forbidden(w http.ResponseWriter, message string) {
	JSON(w, http.StatusForbidden, Message{Message: message})
}

// APIResponse là envelope của BaseApiController. Chỉ vendor import dùng nó —
// giữ nguyên phạm vi đó, đừng lan ra các handler khác.
type APIResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Data    any    `json:"data"`
}

// APISuccess là hàm success() của BaseApiController.
func APISuccess(w http.ResponseWriter, data any, message string, status int) {
	if message == "" {
		message = "Success"
	}
	if status == 0 {
		status = http.StatusOK
	}
	JSON(w, status, APIResponse{Success: true, Message: message, Data: data})
}

// APIError là hàm error() của BaseApiController.
func APIError(w http.ResponseWriter, message string, status int, data any) {
	if message == "" {
		message = "Error"
	}
	if status == 0 {
		status = http.StatusBadRequest
	}
	JSON(w, status, APIResponse{Success: false, Message: message, Data: data})
}

// Validation gom lỗi validate theo đúng hình dạng Laravel trả về.
//
// Thứ tự trường phải giữ được: Laravel lấy câu đầu tiên làm "message", và "đầu
// tiên" là theo thứ tự khai báo rule, không phải thứ tự ngẫu nhiên của map.
type Validation struct {
	order  []string
	fields map[string][]string
}

func NewValidation() *Validation {
	return &Validation{fields: map[string][]string{}}
}

// Add thêm một câu lỗi cho một trường, giữ nguyên thứ tự trường được thêm vào.
func (v *Validation) Add(field, message string) {
	if _, seen := v.fields[field]; !seen {
		v.order = append(v.order, field)
	}
	v.fields[field] = append(v.fields[field], message)
}

// Failed cho biết có lỗi nào không.
func (v *Validation) Failed() bool { return len(v.order) > 0 }

// Message là câu đầu tiên — đúng cách Laravel dựng trường "message" của 422.
func (v *Validation) Message() string {
	if !v.Failed() {
		return ""
	}
	return v.fields[v.order[0]][0]
}

// Fields trả bản đồ lỗi để đưa vào body.
func (v *Validation) Fields() map[string][]string { return v.fields }

// WriteValidationFailed ghi 422 đúng hình dạng Laravel.
func WriteValidationFailed(w http.ResponseWriter, v *Validation) {
	JSON(w, http.StatusUnprocessableEntity, struct {
		Message string              `json:"message"`
		Errors  map[string][]string `json:"errors"`
	}{Message: v.Message(), Errors: v.Fields()})
}

// VersionConflict là body 409 của bảng tính giá. Client đọc từng trường: code để
// phân biệt với 409 khác, current để dựng lại bảng đang có trên server.
type VersionConflict struct {
	Message        string `json:"message"`
	Code           string `json:"code"`
	CurrentVersion int    `json:"currentVersion"`
	UpdatedBy      any    `json:"updatedBy"`
	UpdatedAt      any    `json:"updatedAt"`
	Current        any    `json:"current"`
}

// WriteVersionConflict ghi 409 khi expectedVersion của client lệch với server.
func WriteVersionConflict(w http.ResponseWriter, c VersionConflict) {
	if c.Message == "" {
		c.Message = "Bảng tính giá này đã được người khác cập nhật."
	}
	c.Code = "version_conflict"
	JSON(w, http.StatusConflict, c)
}
