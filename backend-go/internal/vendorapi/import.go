package vendorapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"vendorhub/internal/httpx"
)

type importVendor struct {
	Name          string           `json:"name"`
	Overview      any              `json:"overview"`
	AvgTimeVendor any              `json:"avg_time_vendor"`
	AvgTimeActual any              `json:"avg_time_actual"`
	Notes         any              `json:"notes"`
	ImageFilename string           `json:"image_filename"`
	Products      []map[string]any `json:"products"`
}

func (h *Handler) Import(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, (15<<20)+(1<<20))
	if err := r.ParseMultipartForm(16 << 20); err != nil {
		httpx.JSON(w, http.StatusUnprocessableEntity, httpx.Message{Message: "File Excel không hợp lệ"})
		return
	}
	file, header, err := r.FormFile("file")
	validation := httpx.NewValidation()
	if err != nil {
		validation.Add("file", "The file field is required.")
		httpx.WriteValidationFailed(w, validation)
		return
	}
	defer file.Close()
	extension := strings.ToLower(filepath.Ext(header.Filename))
	if extension != ".xlsx" && extension != ".xls" {
		validation.Add("file", "The file field must be a file of type: xlsx, xls.")
		httpx.WriteValidationFailed(w, validation)
		return
	}
	tempDir, err := os.MkdirTemp("", "vendorhub-import-")
	if err != nil {
		serverError(w)
		return
	}
	defer os.RemoveAll(tempDir)
	inputPath := filepath.Join(tempDir, "input"+extension)
	input, err := os.OpenFile(inputPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		serverError(w)
		return
	}
	written, copyErr := io.Copy(input, io.LimitReader(file, (15<<20)+1))
	closeErr := input.Close()
	if copyErr != nil || closeErr != nil || written > 15<<20 {
		validation.Add("file", "The file field must not be greater than 15360 kilobytes.")
		httpx.WriteValidationFailed(w, validation)
		return
	}
	outputPath := filepath.Join(tempDir, "output.json")
	imageDir := filepath.Join(tempDir, "images")
	if err := os.MkdirAll(imageDir, 0o700); err != nil {
		serverError(w)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 120*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, "node", h.extractScript, inputPath, outputPath, imageDir)
	if output, err := command.CombinedOutput(); err != nil {
		message := "Lỗi khi đọc file Excel"
		if ctx.Err() != nil {
			message = "Đọc file Excel quá thời gian cho phép"
		} else if len(output) > 0 {
			message += ": " + trimProcessOutput(string(output))
		}
		httpx.JSON(w, http.StatusInternalServerError, map[string]any{"success": false, "message": message, "data": nil})
		return
	}
	raw, err := os.ReadFile(outputPath)
	if err != nil {
		httpx.JSON(w, http.StatusInternalServerError, map[string]any{"success": false, "message": "Lỗi không tạo được dữ liệu trích xuất.", "data": nil})
		return
	}
	var vendors []importVendor
	if json.Unmarshal(raw, &vendors) != nil || len(vendors) == 0 {
		httpx.JSON(w, http.StatusBadRequest, map[string]any{"success": false, "message": "File Excel không có dữ liệu hợp lệ.", "data": nil})
		return
	}

	tx, err := h.db.BeginTx(r.Context(), nil)
	if err != nil {
		serverError(w)
		return
	}
	defer tx.Rollback()
	imported := 0
	for _, vendor := range vendors {
		mediaURL := ""
		if vendor.ImageFilename != "" && filepath.Base(vendor.ImageFilename) == vendor.ImageFilename {
			_, mediaURL, _ = h.media.SavePath(r.Context(), filepath.Join(imageDir, vendor.ImageFilename), "vendors", 50<<20, false)
		}
		for _, product := range vendor.Products {
			productType := strings.TrimSpace(stringValue(product["product_type"]))
			if productType == "" {
				continue
			}
			values := map[string]any{
				"size": product["size"], "optional": product["optional"],
				"pricing1": product["pricing1"], "pricing2": product["pricing2"],
				"eco_price": product["eco_price"], "eco_total": product["eco_total"],
				"fast_price": product["fast_price"], "fast_total": product["fast_total"],
				"express_price": product["express_price"], "express_total": product["express_total"],
				"overnight_price": product["overnight_price"], "overnight_total": product["overnight_total"],
				"overview": vendor.Overview, "avg_time_vendor": vendor.AvgTimeVendor,
				"avg_time_actual": vendor.AvgTimeActual, "notes": vendor.Notes,
				"updated_at": time.Now().UTC(),
			}
			if mediaURL != "" {
				values["media_url"] = mediaURL
			}
			var id int64
			err = tx.QueryRowContext(r.Context(), `SELECT id FROM vendors WHERE name=? AND product_type=? AND deleted_at IS NULL LIMIT 1`, vendor.Name, productType).Scan(&id)
			if errors.Is(err, sql.ErrNoRows) {
				values["name"], values["product_type"], values["created_at"] = vendor.Name, productType, time.Now().UTC()
				_, err = insert(r.Context(), tx, "vendors", values)
			} else if err == nil {
				err = update(r.Context(), tx, "vendors", id, values)
			}
			if err != nil {
				serverError(w)
				return
			}
			imported++
		}
	}
	if tx.Commit() != nil {
		serverError(w)
		return
	}
	message := "Đã import thành công " + stringInt(imported) + " sản phẩm từ " + stringInt(len(vendors)) + " vendors."
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "message": message, "data": map[string]int{"imported": imported, "vendors": len(vendors)}})
}

func trimProcessOutput(output string) string {
	output = strings.TrimSpace(output)
	if len(output) > 500 {
		output = output[len(output)-500:]
	}
	return output
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return ""
}

func stringInt(value int) string {
	return strconv.Itoa(value)
}
