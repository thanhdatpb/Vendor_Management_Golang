package library

import (
	"crypto/sha1"
	"encoding/hex"
	"strconv"
	"strings"
	"unicode/utf8"
)

// index.go rút blob vendor_library thành INDEX gọn cho bảng tính giá.
// Port của backend/app/Support/VendorLibraryIndexBuilder.php.
//
// Blob thư viện là một longText cho toàn hệ thống (ảnh, notes, link folder,
// generalInfo…). Mỗi lần Seller mở một bảng giá là một lần tải NGUYÊN blob về
// chỉ để lấy danh sách size + giá vốn. Index này trả đúng phần cần dùng:
// record (vendor × product type) → các size kèm vài cột giá.
//
// Đây cũng là chỗ thực thi phân quyền giá: role không được xem giá thì các khoá
// giá bị loại NGAY Ở ĐÂY, không đi ra khỏi server (xem visibility.go).

const (
	// maxImageURLLength là ngưỡng an toàn cho URL ảnh. Ảnh nhúng qua formula
	// Excel đôi khi là base64 hoặc data-URI khổng lồ thay vì URL bình thường,
	// và index GỌN không được cõng nó. URL ảnh thật không bao giờ dài tới đây.
	maxImageURLLength = 300

	// maxImagesPerRecord: bảng tính giá hiện dải thông tin phôi y như một dòng
	// của Thư viện Vendor nên cần nhiều hơn một ảnh, nhưng index vẫn phải gọn.
	maxImagesPerRecord = 4
)

// projectNeedles khớp extractFileProject bên frontend.
// THỨ TỰ CÓ Ý NGHĨA: hapify84 phải được thử trước happy.
var projectNeedles = []struct{ project, needle string }{
	{"hapify84", "p.hapify84"},
	{"happy", "p.happy"},
	{"creative", "p.creative"},
	{"global", "p.global"},
}

// FileProject suy ra project từ tên file. Chuỗi rỗng nghĩa là không suy ra được.
func FileProject(filename string) string {
	if filename == "" {
		return ""
	}

	name := strings.ToLower(filename)
	for _, p := range projectNeedles {
		if strings.Contains(name, p.needle) {
			return p.project
		}
	}
	return ""
}

// FileSharedProjects trả danh sách project được chia sẻ TƯỜNG MINH cho file
// (Vendor hoặc Admin đặt trong hộp thoại Chia sẻ).
//
// ok = false nghĩa là file CHƯA TỪNG được chia sẻ — khác hẳn với chia sẻ cho
// danh sách rỗng, vốn nghĩa là chia sẻ cho mọi project.
func FileSharedProjects(file map[string]any) ([]string, bool) {
	raw, isList := file["projects"].([]any)
	if !isList {
		return nil, false
	}

	ids := []string{}
	for _, item := range raw {
		id := strings.ToLower(strings.TrimSpace(toString(item)))
		if id != "" {
			ids = append(ids, id)
		}
	}
	return ids, true
}

// projectMatches so hai mã project theo kiểu chứa nhau hai chiều, giống bản PHP.
func projectMatches(projectKey, id string) bool {
	return strings.Contains(projectKey, id) || strings.Contains(id, projectKey)
}

// FileVisibleToProject cho biết file có thuộc phạm vi project của user không.
//
// Ưu tiên danh sách chia sẻ tường minh; danh sách RỖNG nghĩa là chia sẻ cho mọi
// project. File chưa chia sẻ thì giữ NGUYÊN cách cũ là suy theo ký hiệu P.xxx
// trong tên file — nhờ vậy các file đã import từ trước không đổi phạm vi hiển
// thị. File không suy ra được project thì dùng chung, giống frontend.
func FileVisibleToProject(file map[string]any, projectKey string) bool {
	if projectKey == "" {
		return true
	}

	if shared, explicit := FileSharedProjects(file); explicit {
		if len(shared) == 0 {
			return true
		}
		for _, id := range shared {
			if projectMatches(projectKey, id) {
				return true
			}
		}
		return false
	}

	fileProject := FileProject(toString(file["filename"]))
	return fileProject == "" || projectMatches(projectKey, fileProject)
}

// FileProjectTag là nhãn project của file dùng cho index: chỉ có nghĩa khi file
// thuộc đúng MỘT project, còn lại nil (nghĩa là dùng chung).
func FileProjectTag(file map[string]any) *string {
	if shared, explicit := FileSharedProjects(file); explicit {
		if len(shared) == 1 {
			tag := shared[0]
			return &tag
		}
		return nil
	}

	if tag := FileProject(toString(file["filename"])); tag != "" {
		return &tag
	}
	return nil
}

// RecordKey định danh record theo (file, vendor, product type).
//
// Ổn định giữa các lần import nếu 3 thành phần không đổi, và cho phép 2 vendor
// cùng tên phôi tồn tại song song thay vì đè nhau.
func RecordKey(filename, vendorCode, productType string) string {
	parts := make([]string, 0, 3)
	for _, p := range []string{filename, vendorCode, productType} {
		parts = append(parts, strings.ToLower(strings.TrimSpace(p)))
	}

	sum := sha1.Sum([]byte(strings.Join(parts, "|")))
	return hex.EncodeToString(sum[:])[:16]
}

// phoiInfo là thông tin phôi lấy từ Section 1 của Excel — chất liệu, ảnh, chi
// tiết size, AVG TG. Không phải khoá giá nên KHÔNG cần lọc theo seesPrices.
type phoiInfo struct {
	ChatLieu         string
	ChiTietSize      string
	Image            string
	Images           []string
	ChiTietSizeImage string
	AvgTimeVendor    string
	AvgTimeActual    string
}

type generalRow struct {
	VendorCode  string
	ProductType string
	Info        phoiInfo
}

// generalInfo là hai dạng tra cứu của CÙNG một file.
type generalInfo struct {
	// byVendor tra theo kyHieu VÀ theo vendorName (bí danh, vì có file chỉ điền
	// một trong hai cột); vendor gặp trước thắng.
	byVendor map[string]phoiInfo
	// rows là danh sách phẳng, để suy vendor theo TÊN PHÔI khi phần "Về giá"
	// không ghi Ký hiệu dòng nào.
	rows []generalRow
}

func generalInfoOfFile(rows []any) generalInfo {
	out := generalInfo{byVendor: map[string]phoiInfo{}}

	for _, r := range rows {
		row, ok := r.(map[string]any)
		if !ok {
			continue
		}

		images := []string{}
		if raw, ok := row["images"].([]any); ok {
			for _, item := range raw {
				img := toString(item)
				if img == "" || utf8.RuneCountInString(img) > maxImageURLLength {
					continue
				}
				images = append(images, img)
				if len(images) >= maxImagesPerRecord {
					break
				}
			}
		}

		chiTietSizeImage := toString(row["chiTietSizeImage"])
		if utf8.RuneCountInString(chiTietSizeImage) > maxImageURLLength {
			chiTietSizeImage = ""
		}

		info := phoiInfo{
			ChatLieu:    toString(row["chatLieu"]),
			ChiTietSize: toString(row["chiTietSize"]),
			// image là ảnh đại diện, GIỮ NGUYÊN cho code cũ đang đọc field này
			// (bảng giá đã lưu, client bản cũ); images là phần thêm.
			Images:           images,
			ChiTietSizeImage: chiTietSizeImage,
			AvgTimeVendor:    toString(row["avgTimeVendor"]),
			AvgTimeActual:    toString(row["avgTimeActual"]),
		}
		if len(images) > 0 {
			info.Image = images[0]
		}

		for _, alias := range []string{toString(row["kyHieu"]), toString(row["vendorName"])} {
			alias = strings.ToLower(strings.TrimSpace(alias))
			if alias == "" {
				continue
			}
			if _, taken := out.byVendor[alias]; !taken {
				out.byVendor[alias] = info
			}
		}

		vendorCode := strings.TrimSpace(toString(row["kyHieu"]))
		if vendorCode == "" {
			vendorCode = strings.TrimSpace(toString(row["vendorName"]))
		}

		out.rows = append(out.rows, generalRow{
			VendorCode:  vendorCode,
			ProductType: strings.TrimSpace(toString(row["productType"])),
			Info:        info,
		})
	}

	return out
}

// resolveGeneralInfo tìm info phôi + vendor cho MỘT record của phần "Về giá".
//
// Bug thật (2026-09): file HC_Football Jersey_P.Global_16 có đủ thông tin phôi ở
// Section 1 (vendor CN1, chất liệu, AVG TG), nhưng template phần "Về giá" của
// file đó KHÔNG có cột Ký hiệu, nên mọi dòng giá parse ra kyHieu rỗng, record
// trong index không tra được vendor nào, và dải thông tin phôi trên bảng tính
// giá hiện toàn dấu gạch. Suy ngược từ Section 1:
//
//  1. khớp thẳng theo Ký hiệu hoặc Vendor Name;
//  2. dòng giá KHÔNG ghi Ký hiệu thì khớp theo TÊN PHÔI nếu Section 1 có ĐÚNG
//     một dòng cùng phôi;
//  3. vẫn chưa được thì file chỉ có ĐÚNG một dòng thông tin phôi mới lấy dòng đó.
//
// Nhiều dòng mà không dòng nào khớp thì để trống — KHÔNG đoán bừa.
//
// Dòng giá ĐÃ ghi Ký hiệu mà Section 1 không có vendor đó thì để TRỐNG, dừng ở
// bước 1: vendor khác là chất liệu và AVG TG khác, gán nhầm còn tệ hơn dấu gạch
// (2 vendor cùng cấp một tên phôi là ca thật).
func resolveGeneralInfo(general generalInfo, vendorCode, productType string) (phoiInfo, string) {
	if direct, ok := general.byVendor[strings.ToLower(vendorCode)]; ok {
		return direct, ""
	}

	if vendorCode != "" {
		return phoiInfo{}, ""
	}

	target := strings.TrimSpace(productType)
	var sameType []generalRow
	for _, r := range general.rows {
		if r.ProductType != "" && strings.EqualFold(r.ProductType, target) {
			sameType = append(sameType, r)
		}
	}

	var row *generalRow
	switch {
	case len(sameType) == 1:
		row = &sameType[0]
	case len(general.rows) == 1:
		row = &general.rows[0]
	}

	if row == nil {
		return phoiInfo{}, ""
	}

	// vendorInferred là nhãn CHỜ, KHÔNG ghi đè vendorCode: record vẫn giữ ký
	// hiệu thô (rỗng) để recordKey của bảng đã lưu không đổi, và để bước gộp
	// record vendor trống bên frontend còn nhận ra đâu là dòng thiếu vendor.
	return row.Info, row.VendorCode
}

// Record là một dòng của index: một vendor nhân một product type trong một file.
//
// Thứ tự field quyết định thứ tự khoá JSON, và phải khớp bản PHP.
type Record struct {
	RecordKey        string        `json:"recordKey"`
	ProductType      string        `json:"productType"`
	VendorCode       string        `json:"vendorCode"`
	VendorInferred   string        `json:"vendorInferred"`
	Filename         string        `json:"filename"`
	Project          *string       `json:"project"`
	Sizes            []*OrderedMap `json:"sizes"`
	ChatLieu         string        `json:"chatLieu"`
	ChiTietSize      string        `json:"chiTietSize"`
	Image            string        `json:"image"`
	Images           []string      `json:"images"`
	ChiTietSizeImage string        `json:"chiTietSizeImage"`
	AvgTimeVendor    string        `json:"avgTimeVendor"`
	AvgTimeActual    string        `json:"avgTimeActual"`
}

// BuildIndex dựng index từ blob thư viện.
//
// projectKey rỗng nghĩa là xem mọi project. seesPrices quyết định các khoá giá
// có được đi ra khỏi server hay không — lấy bằng SeesPrices(role), đừng tự suy.
func BuildIndex(files []any, projectKey string, seesPrices bool) []Record {
	sizeFields := SizeBaseFields
	if seesPrices {
		sizeFields = VisibleSizeFields("admin")
	}

	// Giữ thứ tự gặp record, đúng như mảng kết hợp của PHP.
	order := []string{}
	records := map[string]*Record{}

	for _, f := range files {
		file, ok := f.(map[string]any)
		if !ok {
			continue
		}

		filename := toString(file["filename"])
		if !FileVisibleToProject(file, projectKey) {
			continue
		}

		generalRows, _ := file["generalInfo"].([]any)
		general := generalInfoOfFile(generalRows)

		pricing, _ := file["pricing"].([]any)
		for _, p := range pricing {
			row, ok := p.(map[string]any)
			if !ok {
				continue
			}

			productType := strings.TrimSpace(toString(row["productType"]))
			if productType == "" {
				continue
			}

			vendorCode := strings.TrimSpace(toString(row["kyHieu"]))
			key := RecordKey(filename, vendorCode, productType)

			if _, exists := records[key]; !exists {
				info, inferred := resolveGeneralInfo(general, vendorCode, productType)
				images := info.Images
				if images == nil {
					images = []string{}
				}
				records[key] = &Record{
					RecordKey:      key,
					ProductType:    productType,
					VendorCode:     vendorCode,
					VendorInferred: inferred,
					Filename:       filename,
					Project:        FileProjectTag(file),
					Sizes:          []*OrderedMap{},

					ChatLieu:         info.ChatLieu,
					ChiTietSize:      info.ChiTietSize,
					Image:            info.Image,
					Images:           images,
					ChiTietSizeImage: info.ChiTietSizeImage,
					AvgTimeVendor:    info.AvgTimeVendor,
					AvgTimeActual:    info.AvgTimeActual,
				}
				order = append(order, key)
			}

			sizeLabel := strings.TrimSpace(toString(row["size"]))
			if sizeLabel == "" || sizeLabel == "N/A" {
				continue
			}

			// Size trùng trong cùng record: bản đầu tiên thắng, giống frontend.
			if hasSize(records[key].Sizes, sizeLabel) {
				continue
			}

			size := NewOrderedMap()
			size.Set("size", sizeLabel)
			for _, field := range sizeFields {
				if field == "size" {
					continue
				}
				value, present := row[field]
				if !present || value == nil {
					continue
				}
				if s, isString := value.(string); isString && s == "" {
					continue
				}
				size.Set(field, value)
			}

			records[key].Sizes = append(records[key].Sizes, size)
		}
	}

	// Record không có size nào thì bảng tính giá không dùng được, bỏ đi.
	out := []Record{}
	for _, key := range order {
		if len(records[key].Sizes) > 0 {
			out = append(out, *records[key])
		}
	}
	return out
}

func hasSize(sizes []*OrderedMap, label string) bool {
	for _, existing := range sizes {
		if current, ok := existing.Get("size"); ok {
			if strings.EqualFold(toString(current), label) {
				return true
			}
		}
	}
	return false
}

// toString mô phỏng phép ép (string) của PHP cho các giá trị đến từ JSON.
//
// Số nguyên in không có phần thập phân (PHP ép (string) 6.0 ra "6"), đúng như
// khi blob chứa một ô Excel mang giá trị số mà template lại coi là chữ.
func toString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case bool:
		if v {
			return "1"
		}
		return ""
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	case int:
		return strconv.Itoa(v)
	default:
		return ""
	}
}
