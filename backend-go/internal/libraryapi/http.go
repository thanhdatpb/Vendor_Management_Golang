package libraryapi

import (
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"vendorhub/internal/authn"
	"vendorhub/internal/httpx"
	lib "vendorhub/internal/library"
	"vendorhub/internal/media"
	"vendorhub/internal/realtime"
)

type Handler struct {
	store  *Store
	media  media.Storage
	stream realtime.Publisher
}

func (h *Handler) WithPublisher(stream realtime.Publisher) *Handler {
	h.stream = stream
	return h
}

func NewHandler(store *Store) *Handler { return &Handler{store: store} }

func (h *Handler) WithMediaRoot(root string) *Handler {
	h.media = media.Local{Root: root}
	return h
}

func (h *Handler) WithStorage(storage media.Storage) *Handler {
	h.media = storage
	return h
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	p, _ := authn.PrincipalFrom(r.Context())
	meta, err := h.store.Meta(r.Context())
	stampValue := "0"
	if err == nil {
		stampValue = stamp(meta.UpdatedAt)
	} else if !errors.Is(err, sql.ErrNoRows) {
		internalError(w)
		return
	}
	etag := httpx.LibraryETag("vendor-library", stampValue, lib.NormalizeRole(p.User.Role))
	if httpx.ETagMatches(r.Header.Get("If-None-Match"), etag) {
		httpx.NotModified(w, etag)
		return
	}
	row, err := h.store.First(r.Context())
	if errors.Is(err, sql.ErrNoRows) {
		writeCached(w, etag, []any{})
		return
	}
	if err != nil {
		internalError(w)
		return
	}
	if lib.SeesPrices(p.User.Role) && lib.SeesLeadTime(p.User.Role) {
		httpx.WriteRawJSON(w, etag, row.Data)
		return
	}
	files, err := decodeFiles(row.Data)
	if err != nil {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Dữ liệu thư viện không hợp lệ."})
		return
	}
	files = lib.FilterLeadTime(files, p.User.Role)
	files = lib.FilterPrices(files, p.User.Role)
	writeCached(w, etag, files)
}

func (h *Handler) Index(w http.ResponseWriter, r *http.Request) {
	p, _ := authn.PrincipalFrom(r.Context())
	meta, err := h.store.Meta(r.Context())
	stampValue := "0"
	if err == nil {
		stampValue = stamp(meta.UpdatedAt)
	} else if !errors.Is(err, sql.ErrNoRows) {
		internalError(w)
		return
	}
	project := projectKey(p.User.Role, p.User.Project, r.URL.Query().Get("project"), true)
	priced := lib.SeesPrices(p.User.Role)
	pricePart := "nopriced"
	if priced {
		pricePart = "priced"
	}
	etag := httpx.LibraryETag("vendor-library-index", stampValue, project, pricePart)
	if httpx.ETagMatches(r.Header.Get("If-None-Match"), etag) {
		httpx.NotModified(w, etag)
		return
	}
	row, err := h.store.First(r.Context())
	if errors.Is(err, sql.ErrNoRows) {
		writeCached(w, etag, []lib.Record{})
		return
	}
	if err != nil {
		internalError(w)
		return
	}
	files, err := decodeFiles(row.Data)
	if err != nil {
		files = []any{}
	}
	writeCached(w, etag, lib.BuildIndex(files, project, priced))
}

type fileSummary struct {
	ID           string         `json:"id"`
	Filename     string         `json:"filename"`
	Title        string         `json:"title"`
	ImportedAt   any            `json:"importedAt"`
	SourceTab    any            `json:"sourceTab"`
	Project      *string        `json:"project"`
	Vendors      []string       `json:"vendors"`
	ProductTypes []string       `json:"productTypes"`
	Counts       map[string]int `json:"counts"`
}

func (h *Handler) ListFiles(w http.ResponseWriter, r *http.Request) {
	p, _ := authn.PrincipalFrom(r.Context())
	meta, err := h.store.Meta(r.Context())
	stampValue := "0"
	if err == nil {
		stampValue = stamp(meta.UpdatedAt)
	} else if !errors.Is(err, sql.ErrNoRows) {
		internalError(w)
		return
	}
	project := projectKey(p.User.Role, p.User.Project, "", false)
	etag := httpx.LibraryETag("vendor-library-file-list", stampValue, project)
	if httpx.ETagMatches(r.Header.Get("If-None-Match"), etag) {
		httpx.NotModified(w, etag)
		return
	}
	row, err := h.store.First(r.Context())
	if errors.Is(err, sql.ErrNoRows) {
		writeCached(w, etag, []fileSummary{})
		return
	}
	if err != nil {
		internalError(w)
		return
	}
	files, err := decodeFiles(row.Data)
	if err != nil {
		files = []any{}
	}
	list := make([]fileSummary, 0, len(files))
	for _, item := range files {
		file, ok := item.(map[string]any)
		if !ok || anyString(file["id"]) == "" {
			continue
		}
		if project != "" && !lib.FileVisibleToProject(file, project) {
			continue
		}
		general, _ := file["generalInfo"].([]any)
		pricing, _ := file["pricing"].([]any)
		vendors, types := uniqueGeneral(general)
		list = append(list, fileSummary{ID: anyString(file["id"]), Filename: anyString(file["filename"]), Title: anyString(file["title"]),
			ImportedAt: file["importedAt"], SourceTab: file["sourceTab"], Project: lib.FileProjectTag(file), Vendors: vendors,
			ProductTypes: types, Counts: map[string]int{"generalInfo": len(general), "pricing": len(pricing)}})
	}
	sort.SliceStable(list, func(i, j int) bool { return anyString(list[i].ImportedAt) > anyString(list[j].ImportedAt) })
	writeCached(w, etag, list)
}

func uniqueGeneral(rows []any) ([]string, []string) {
	vendors, types := []string{}, []string{}
	seenV, seenT := map[string]bool{}, map[string]bool{}
	for _, item := range rows {
		row, ok := item.(map[string]any)
		if !ok {
			continue
		}
		vendor := strings.TrimSpace(anyString(row["vendorName"]))
		if vendor == "" {
			vendor = strings.TrimSpace(anyString(row["kyHieu"]))
		}
		typeName := strings.TrimSpace(anyString(row["productType"]))
		if vendor != "" && !seenV[vendor] {
			seenV[vendor] = true
			vendors = append(vendors, vendor)
		}
		if typeName != "" && !seenT[typeName] {
			seenT[typeName] = true
			types = append(types, typeName)
		}
	}
	return vendors, types
}

func (h *Handler) ShowFile(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	h.respondFile(w, r, "id:"+id, false, func(file map[string]any) bool { return anyString(file["id"]) == id })
}

func (h *Handler) ShowFileByName(w http.ResponseWriter, r *http.Request) {
	name := normalizeFilename(r.PathValue("filename"))
	h.respondFile(w, r, "name:"+name, true, func(file map[string]any) bool { return normalizeFilename(anyString(file["filename"])) == name })
}

func (h *Handler) respondFile(w http.ResponseWriter, r *http.Request, subject string, newest bool, match func(map[string]any) bool) {
	p, _ := authn.PrincipalFrom(r.Context())
	meta, err := h.store.Meta(r.Context())
	if errors.Is(err, sql.ErrNoRows) {
		httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Thư viện đang trống."})
		return
	}
	if err != nil {
		internalError(w)
		return
	}
	project := projectKey(p.User.Role, p.User.Project, "", false)
	etag := httpx.LibraryETag("vendor-library-file", stamp(meta.UpdatedAt), subject, lib.NormalizeRole(p.User.Role), project)
	if httpx.ETagMatches(r.Header.Get("If-None-Match"), etag) {
		httpx.NotModified(w, etag)
		return
	}
	row, err := h.store.First(r.Context())
	if err != nil {
		internalError(w)
		return
	}
	files, err := decodeFiles(row.Data)
	if err != nil {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Dữ liệu thư viện không hợp lệ."})
		return
	}
	var found map[string]any
	for _, item := range files {
		file, ok := item.(map[string]any)
		if !ok || !match(file) {
			continue
		}
		if !newest {
			found = file
			break
		}
		if found == nil || anyString(file["importedAt"]) > anyString(found["importedAt"]) {
			found = file
		}
	}
	if found == nil {
		httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Không tìm thấy file này trong thư viện."})
		return
	}
	if project != "" && !lib.FileVisibleToProject(found, project) {
		httpx.JSON(w, http.StatusForbidden, httpx.Message{Message: "File này thuộc một project khác với tài khoản của bạn."})
		return
	}
	visible := lib.FilterFilePrices(found, p.User.Role)
	lib.FilterLeadTime([]any{visible}, p.User.Role)
	general, _ := visible["generalInfo"].([]any)
	pricing, _ := visible["pricing"].([]any)
	visible["counts"] = map[string]int{"generalInfo": len(general), "pricing": len(pricing)}
	writeCached(w, etag, visible)
}

func (h *Handler) Save(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<20)
	raw, err := io.ReadAll(r.Body)
	if err != nil || !json.Valid(raw) || string(raw) == "null" {
		httpx.JSON(w, http.StatusUnprocessableEntity, map[string]string{"error": "Invalid JSON"})
		return
	}
	if err := h.store.Save(r.Context(), raw); err != nil {
		internalError(w)
		return
	}
	h.announce("import")
	httpx.JSON(w, http.StatusOK, httpx.Message{Message: "Library saved successfully"})
}

func (h *Handler) UpdateSampleStatus(w http.ResponseWriter, r *http.Request) {
	var input struct {
		RowID        any    `json:"rowId"`
		SampleStatus string `json:"sampleStatus"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	rowID := anyString(input.RowID)
	v := httpx.NewValidation()
	if rowID == "" {
		v.Add("rowId", "The row id field is required.")
	}
	if input.SampleStatus != "has_sample" && input.SampleStatus != "no_sample" {
		v.Add("sampleStatus", "The selected sample status is invalid.")
	}
	if v.Failed() {
		httpx.WriteValidationFailed(w, v)
		return
	}
	if !h.updateField(w, r, rowID, "sampleStatus", input.SampleStatus) {
		return
	}
	h.announce("sample-status")
	httpx.JSON(w, http.StatusOK, map[string]any{"message": "Đã cập nhật trạng thái sample.", "rowId": rowID, "sampleStatus": input.SampleStatus})
}

func (h *Handler) UpdateBestSeller(w http.ResponseWriter, r *http.Request) {
	var input struct {
		RowID        any   `json:"rowId"`
		IsBestSeller *bool `json:"isBestSeller"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	rowID := anyString(input.RowID)
	v := httpx.NewValidation()
	if rowID == "" {
		v.Add("rowId", "The row id field is required.")
	}
	if input.IsBestSeller == nil {
		v.Add("isBestSeller", "The is best seller field is required.")
	}
	if v.Failed() {
		httpx.WriteValidationFailed(w, v)
		return
	}
	if !h.updateField(w, r, rowID, "bestSeller", *input.IsBestSeller) {
		return
	}
	h.announce("best-seller")
	httpx.JSON(w, http.StatusOK, map[string]any{"message": "Đã cập nhật Best Seller.", "rowId": rowID, "isBestSeller": *input.IsBestSeller})
}

func (h *Handler) announce(reason string) {
	if h.stream != nil {
		h.stream.Trigger("vendor-library", "VendorLibraryChanged", map[string]any{"reason": reason, "updatedAt": time.Now().UTC().Format(time.RFC3339)})
	}
}

func (h *Handler) updateField(w http.ResponseWriter, r *http.Request, rowID, field string, value any) bool {
	err := h.store.UpdateGeneralField(r.Context(), rowID, field, value)
	if errors.Is(err, sql.ErrNoRows) {
		httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Thư viện trống, không thể cập nhật."})
		return false
	}
	if errors.Is(err, ErrInvalidData) {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "Dữ liệu thư viện không hợp lệ."})
		return false
	}
	if errors.Is(err, ErrRowNotFound) {
		httpx.JSON(w, http.StatusNotFound, httpx.Message{Message: "Không tìm thấy dòng cần cập nhật."})
		return false
	}
	if err != nil {
		internalError(w)
		return false
	}
	return true
}

func (h *Handler) Restore(w http.ResponseWriter, r *http.Request) {
	row, err := h.store.First(r.Context())
	if errors.Is(err, sql.ErrNoRows) {
		httpx.JSON(w, http.StatusNotFound, map[string]string{"error": "Không có dữ liệu nào trong thư viện."})
		return
	}
	if err != nil {
		internalError(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(row.Data)
}

func decodeBody(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if json.NewDecoder(r.Body).Decode(dst) != nil {
		httpx.JSON(w, http.StatusBadRequest, httpx.Message{Message: "Dữ liệu JSON không hợp lệ"})
		return false
	}
	return true
}
func writeCached(w http.ResponseWriter, etag string, body any) {
	httpx.WriteLibraryCacheHeaders(w, etag)
	httpx.JSON(w, http.StatusOK, body)
}
func internalError(w http.ResponseWriter) {
	httpx.JSON(w, http.StatusInternalServerError, httpx.Message{Message: "Server Error"})
}
