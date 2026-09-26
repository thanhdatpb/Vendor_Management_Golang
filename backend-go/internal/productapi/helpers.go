package productapi

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"vendorhub/internal/dbjson"
	"vendorhub/internal/httpx"
	"vendorhub/internal/media"
)

var productCasts = map[string]dbjson.Cast{
	"id": dbjson.Integer, "vendor_id": dbjson.Integer, "created_by": dbjson.Integer,
	"submitted_by": dbjson.Integer, "reviewed_by": dbjson.Integer,
	"media_urls": dbjson.JSON, "product_type_links": dbjson.JSON,
	"product_video_links": dbjson.JSON, "assigned_vendors": dbjson.JSON,
	"created_at": dbjson.LaravelTime, "updated_at": dbjson.LaravelTime,
	"deleted_at": dbjson.LaravelTime, "submitted_at": dbjson.LaravelTime,
	"reviewed_at": dbjson.LaravelTime,
}

var writable = map[string]int{
	"vendor_id": 0, "deadline_date": 0, "product_type": 255,
	"product_type_link": 500, "product_type_links": 0, "product_video_links": 0,
	"other_specs": 0, "good_review": 0, "bad_review": 0,
	"production_time": 255, "shipping_time": 255, "total_cost": 255,
	"material": 0, "print_area": 0, "packaging_links": 0,
	"other_packaging": 0, "seller_name": 255,
}

type upload struct {
	header *multipart.FileHeader
}

func decodeInput(w http.ResponseWriter, r *http.Request) (map[string]any, []upload, bool) {
	contentType := strings.ToLower(r.Header.Get("Content-Type"))
	if strings.HasPrefix(contentType, "multipart/form-data") {
		r.Body = http.MaxBytesReader(w, r.Body, 100<<20)
		if err := r.ParseMultipartForm(32 << 20); err != nil {
			httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Dữ liệu upload không hợp lệ"})
			return nil, nil, false
		}
		in := make(map[string]any, len(r.MultipartForm.Value))
		for key, values := range r.MultipartForm.Value {
			if len(values) > 0 {
				in[key] = values[len(values)-1]
			}
		}
		files := r.MultipartForm.File["media[]"]
		if len(files) == 0 {
			files = r.MultipartForm.File["media"]
		}
		out := make([]upload, 0, len(files))
		for _, file := range files {
			out = append(out, upload{header: file})
		}
		return in, out, true
	}

	r.Body = http.MaxBytesReader(w, r.Body, 4<<20)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		serverError(w)
		return nil, nil, false
	}
	var in map[string]any
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if decoder.Decode(&in) != nil {
		httpx.JSON(w, http.StatusBadRequest, httpx.Message{Message: "Dữ liệu JSON không hợp lệ"})
		return nil, nil, false
	}
	return in, nil, true
}

func cleanInput(in map[string]any, partial bool) (map[string]any, *httpx.Validation) {
	out := map[string]any{}
	v := httpx.NewValidation()
	for key, value := range in {
		max, allowed := writable[key]
		if !allowed {
			continue
		}
		if key == "vendor_id" {
			if value == nil || strings.TrimSpace(fmt.Sprint(value)) == "" {
				out[key] = nil
				continue
			}
			id, ok := positiveInt(value)
			if !ok {
				v.Add(key, "The selected vendor id is invalid.")
				continue
			}
			out[key] = id
			continue
		}
		if key == "product_type_links" || key == "product_video_links" {
			encoded, ok := jsonArray(value)
			if !ok {
				v.Add(key, "The "+strings.ReplaceAll(key, "_", " ")+" field is invalid.")
				continue
			}
			out[key] = encoded
			continue
		}
		if value == nil {
			out[key] = nil
			continue
		}
		s := fmt.Sprint(value)
		if max > 0 && len([]rune(s)) > max {
			v.Add(key, "The "+strings.ReplaceAll(key, "_", " ")+" field must not be greater than "+strconv.Itoa(max)+" characters.")
			continue
		}
		if key == "deadline_date" && s != "" {
			if _, err := time.Parse("2006-01-02", s); err != nil {
				v.Add(key, "The deadline date is not a valid date.")
				continue
			}
		}
		out[key] = nullableString(s)
	}
	_ = partial
	return out, v
}

func jsonArray(value any) ([]byte, bool) {
	if value == nil || strings.TrimSpace(fmt.Sprint(value)) == "" {
		return nil, true
	}
	var parsed any
	switch x := value.(type) {
	case string:
		if json.Unmarshal([]byte(x), &parsed) != nil {
			parsed = []any{x}
		}
	default:
		parsed = x
	}
	if _, ok := parsed.([]any); !ok {
		return nil, false
	}
	raw, err := json.Marshal(parsed)
	return raw, err == nil
}

type execer interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func insertMap(ctx context.Context, db execer, table string, values map[string]any) (int64, error) {
	keys := sortedKeys(values)
	marks := make([]string, len(keys))
	args := make([]any, len(keys))
	for i, key := range keys {
		marks[i] = "?"
		args[i] = values[key]
	}
	result, err := db.ExecContext(ctx, "INSERT INTO "+table+" ("+strings.Join(keys, ",")+") VALUES ("+strings.Join(marks, ",")+")", args...)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func updateMap(ctx context.Context, db execer, id int64, values map[string]any) error {
	keys := sortedKeys(values)
	sets := make([]string, len(keys))
	args := make([]any, 0, len(keys)+1)
	for i, key := range keys {
		sets[i] = key + "=?"
		args = append(args, values[key])
	}
	args = append(args, id)
	_, err := db.ExecContext(ctx, "UPDATE products SET "+strings.Join(sets, ",")+" WHERE id=? AND deleted_at IS NULL", args...)
	return err
}

func sortedKeys(values map[string]any) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func saveUploads(ctx context.Context, files []upload, storage media.Storage) ([]string, string, string, error) {
	if len(files) == 0 {
		return nil, "", "", nil
	}
	urls := make([]string, 0, len(files))
	var first, kind string
	for _, item := range files {
		ext := strings.ToLower(filepath.Ext(item.header.Filename))
		mediaKind := "image"
		if ext == ".mp4" || ext == ".webm" {
			mediaKind = "video"
		}
		path, url, err := storage.Save(ctx, item.header, "products", 20<<20, true)
		if err != nil {
			return nil, "", "", err
		}
		urls = append(urls, url)
		if first == "" {
			first, kind = path, mediaKind
		}
	}
	return urls, first, kind, nil
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func positiveInt(value any) (int64, bool) {
	n, err := strconv.ParseInt(strings.TrimSpace(fmt.Sprint(value)), 10, 64)
	return n, err == nil && n > 0
}

func pathID(r *http.Request) (int64, bool) { return positiveInt(r.PathValue("id")) }

func queryInt(r *http.Request, key string, fallback int) int {
	n, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil {
		return fallback
	}
	return n
}

func serverError(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusInternalServerError, httpx.Message{Message: "Server Error"})
}

func notFound(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Not Found"})
}
