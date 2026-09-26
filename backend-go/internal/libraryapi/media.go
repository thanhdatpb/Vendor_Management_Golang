package libraryapi

import (
	"io"
	"net/http"
	"sort"
	"strings"

	"vendorhub/internal/httpx"
)

func (h *Handler) UploadImages(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 200*(10<<20)+(2<<20))
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Dữ liệu upload không hợp lệ"})
		return
	}
	keys := make([]string, 0)
	for key := range r.MultipartForm.File {
		if key == "images" || strings.HasPrefix(key, "images[") {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)
	count := 0
	for _, key := range keys {
		count += len(r.MultipartForm.File[key])
	}
	if count < 1 || count > 200 {
		validation := httpx.NewValidation()
		validation.Add("images", "The images field must have between 1 and 200 items.")
		httpx.WriteValidationFailed(w, validation)
		return
	}
	urls := map[string]string{}
	sequence := 0
	for _, field := range keys {
		for _, file := range r.MultipartForm.File[field] {
			_, url, err := h.media.Save(r.Context(), file, "vendor-library", 10<<20, false)
			if err != nil {
				validation := httpx.NewValidation()
				validation.Add("images", err.Error())
				httpx.WriteValidationFailed(w, validation)
				return
			}
			key := strings.TrimSuffix(strings.TrimPrefix(field, "images["), "]")
			if field == "images" || key == "" {
				key = stringKey(sequence)
			}
			urls[key] = "/api/vendor-library/images/" + baseName(url)
			sequence++
		}
	}
	h.announce("images")
	httpx.JSON(w, http.StatusOK, map[string]any{"urls": urls})
}

func (h *Handler) Image(w http.ResponseWriter, r *http.Request) {
	filename := r.PathValue("filename")
	object, err := h.media.Read(r.Context(), "vendor-library", filename)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer object.Body.Close()
	w.Header().Set("Cache-Control", "private, max-age=86400")
	if object.ContentType != "" {
		w.Header().Set("Content-Type", object.ContentType)
	}
	if !object.Modified.IsZero() {
		w.Header().Set("Last-Modified", object.Modified.UTC().Format(http.TimeFormat))
	}
	if object.Size >= 0 {
		w.Header().Set("Content-Length", stringKey64(object.Size))
	}
	w.WriteHeader(http.StatusOK)
	_, _ = io.Copy(w, object.Body)
}

func baseName(raw string) string {
	parts := strings.Split(strings.TrimRight(raw, "/"), "/")
	return parts[len(parts)-1]
}

func stringKey(value int) string {
	const digits = "0123456789"
	if value < 10 {
		return digits[value : value+1]
	}
	result := ""
	for value > 0 {
		result = digits[value%10:value%10+1] + result
		value /= 10
	}
	return result
}

func stringKey64(value int64) string {
	if value == 0 {
		return "0"
	}
	const digits = "0123456789"
	result := ""
	for value > 0 {
		result = digits[value%10:value%10+1] + result
		value /= 10
	}
	return result
}
