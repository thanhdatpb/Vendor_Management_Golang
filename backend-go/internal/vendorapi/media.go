package vendorapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"vendorhub/internal/httpx"
)

func (h *Handler) UploadMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	var raw []byte
	var thumbnail sql.NullString
	if err := h.db.QueryRowContext(r.Context(), `SELECT media_urls,media_url FROM vendors WHERE id=? AND deleted_at IS NULL`, id).Scan(&raw, &thumbnail); errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	} else if err != nil {
		serverError(w)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 20*(50<<20)+(2<<20))
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Dữ liệu upload không hợp lệ"})
		return
	}
	files := r.MultipartForm.File["media[]"]
	if len(files) == 0 {
		files = r.MultipartForm.File["media"]
	}
	validation := httpx.NewValidation()
	if len(files) < 1 || len(files) > 20 {
		validation.Add("media", "The media field must have between 1 and 20 items.")
		httpx.WriteValidationFailed(w, validation)
		return
	}
	current := []string{}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &current)
	}
	newURLs := make([]string, 0, len(files))
	for _, file := range files {
		_, url, err := h.media.Save(r.Context(), file, "vendors", 50<<20, true)
		if err != nil {
			validation.Add("media", err.Error())
			httpx.WriteValidationFailed(w, validation)
			return
		}
		newURLs = append(newURLs, url)
	}
	all := append(current, newURLs...)
	encoded, _ := json.Marshal(all)
	first := any(nil)
	if len(all) > 0 {
		first = all[0]
	} else if thumbnail.Valid {
		first = thumbnail.String
	}
	if _, err := h.db.ExecContext(r.Context(), `UPDATE vendors SET media_urls=?,media_url=?,updated_at=? WHERE id=? AND deleted_at IS NULL`, encoded, first, time.Now().UTC(), id); err != nil {
		serverError(w)
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "message": "Upload thành công!", "media_urls": all, "media_url": first})
}

func (h *Handler) DeleteMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		notFound(w)
		return
	}
	var input struct {
		Index any `json:"index"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.UseNumber()
	if decoder.Decode(&input) != nil {
		httpx.JSON(w, http.StatusBadRequest, httpx.Message{Message: "Dữ liệu JSON không hợp lệ"})
		return
	}
	index, err := strconv.Atoi(strings.TrimSpace(fmt.Sprint(input.Index)))
	validation := httpx.NewValidation()
	if err != nil || index < 0 {
		validation.Add("index", "The index field must be an integer.")
		httpx.WriteValidationFailed(w, validation)
		return
	}
	var raw []byte
	if err := h.db.QueryRowContext(r.Context(), `SELECT media_urls FROM vendors WHERE id=? AND deleted_at IS NULL`, id).Scan(&raw); errors.Is(err, sql.ErrNoRows) {
		notFound(w)
		return
	} else if err != nil {
		serverError(w)
		return
	}
	current := []string{}
	_ = json.Unmarshal(raw, &current)
	if index >= len(current) {
		httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Media không tồn tại"})
		return
	}
	deleted := current[index]
	current = append(current[:index], current[index+1:]...)
	encoded, _ := json.Marshal(current)
	var first any
	if len(current) > 0 {
		first = current[0]
	}
	if _, err := h.db.ExecContext(r.Context(), `UPDATE vendors SET media_urls=?,media_url=?,updated_at=? WHERE id=? AND deleted_at IS NULL`, encoded, first, time.Now().UTC(), id); err != nil {
		serverError(w)
		return
	}
	_ = h.media.DeleteURL(r.Context(), deleted)
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "message": "Đã xóa media!", "media_urls": current, "media_url": first})
}

// LegacyMedia serves files created by the historical Excel importer. New files
// are stored under the shared public media root and no longer use this endpoint.
func (h *Handler) LegacyMedia(w http.ResponseWriter, r *http.Request) {
	filename := r.URL.Query().Get("f")
	if filepath.Base(filename) != filename || filename == "" || filename == "." {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(filepath.Dir(h.mediaRoot), "vendors", filename)
	file, err := os.Open(path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		http.NotFound(w, r)
		return
	}
	http.ServeContent(w, r, filename, info.ModTime(), file)
}
