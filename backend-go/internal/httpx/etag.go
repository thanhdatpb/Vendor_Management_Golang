package httpx

import (
	"crypto/sha1"
	"encoding/hex"
	"net/http"
	"strings"
)

// ETag của Thư viện Vendor.
//
// Đây là request nặng nhất của hệ thống: một blob vài MB mỗi lần mở trang. ETag
// cho phép client làm mới NỀN (quay lại tab, Pusher báo đổi) nhận 304 rỗng thay
// vì tải lại cả blob.
//
// ROLE PHẢI NẰM TRONG ETAG. Body khác nhau theo role — bản của CSF không cùng
// cột với bản của Seller — nên dùng chung một ETag là phát nhầm bản đã lọc cho
// người được xem đủ, và ngược lại.

// LibraryETag dựng ETag từ phạm vi, mốc sửa và các phần định danh riêng.
//
// stamp là updated_at của dòng vendor_library. Lấy nó bằng truy vấn CHỈ chọn
// id + updated_at, không kéo cột data: mọi request 304 mà vẫn bốc vài MB từ
// MySQL lên rồi vứt đi là phí đúng thứ ETag sinh ra để tiết kiệm.
func LibraryETag(scope, stamp string, parts ...string) string {
	if stamp == "" {
		stamp = "0"
	}

	segments := make([]string, 0, len(parts)+2)
	segments = append(segments, scope, stamp)
	segments = append(segments, parts...)

	sum := sha1.Sum([]byte(strings.Join(segments, "|")))
	return `"` + hex.EncodeToString(sum[:]) + `"`
}

// ETagMatches so header If-None-Match với ETag hiện tại.
//
// Xử được cả ba dạng client hoặc proxy thật sự gửi: danh sách ngăn bởi dấu
// phẩy, dấu sao, và tiền tố W/ của weak validator.
func ETagMatches(header, etag string) bool {
	header = strings.TrimSpace(header)
	if header == "" {
		return false
	}

	for _, candidate := range strings.Split(header, ",") {
		candidate = strings.TrimSpace(candidate)
		if candidate == "*" {
			return true
		}
		if strings.TrimPrefix(candidate, "W/") == etag {
			return true
		}
	}
	return false
}

// WriteLibraryCacheHeaders gắn ETag và Cache-Control cho response đọc thư viện.
//
// private, must-revalidate: dữ liệu khác nhau theo role nên proxy chung tuyệt
// đối không được cache, và client phải hỏi lại server mỗi lần.
func WriteLibraryCacheHeaders(w http.ResponseWriter, etag string) {
	w.Header().Set("ETag", etag)
	w.Header().Set("Cache-Control", "private, must-revalidate")
}

// NotModified trả 304 rỗng kèm ETag.
func NotModified(w http.ResponseWriter, etag string) {
	w.Header().Set("ETag", etag)
	w.WriteHeader(http.StatusNotModified)
}

// WriteRawJSON ghi thẳng chuỗi JSON đã có sẵn ra response.
//
// Dùng cho đường tắt của blob thư viện: role thấy đủ mọi trường thì trả NGUYÊN
// chuỗi đã lưu, không unmarshal rồi marshal lại vài MB cho không.
func WriteRawJSON(w http.ResponseWriter, etag string, body []byte) {
	w.Header().Set("Content-Type", "application/json")
	WriteLibraryCacheHeaders(w, etag)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(body)
}
