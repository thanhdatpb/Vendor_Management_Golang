// Package library giữ các quy tắc của Thư viện Vendor không phụ thuộc HTTP hay DB.
//
// visibility.go là MỘT CHỖ DUY NHẤT quyết định role nào được thấy trường giá.
// Port của backend/app/Support/VendorFieldVisibility.php.
//
// Trước đây quy tắc này nằm rải rác trong 2 component viewer ở frontend, mỗi lần
// đổi phân quyền phải sửa 2 nơi và dễ sót — đó chính là cách lỗi rò rỉ giá phát
// sinh. Server phải là nơi thực thi, không phải chỗ ẩn cột trên UI.
//
// Bản song sinh phía frontend: frontend/src/constants/vendorFieldVisibility.js
// (chỉ để dựng cột — nguồn sự thật về BẢO MẬT là file này).
package library

import "strings"

// PriceRoles là role được phép nhận trường giá.
//
// Đây là danh sách CHO PHÉP, không phải danh sách cấm: role lạ hoặc chưa khai
// báo mặc định KHÔNG thấy giá. Thêm role mới mà quên khai báo thì nó bị che, chứ
// không lộ sạch.
var PriceRoles = map[string]bool{
	"admin": true, "seller": true, "vendor": true, "staffa": true, "staffb": true,
}

// PriceFields là mọi khoá mang tiền trong một dòng của thư viện.
//
// Thêm phương thức ship mới thì thêm khoá vào ĐÂY, không thêm chỗ nào khác.
var PriceFields = []string{
	"pricing1",
	"pricing2",
	"eco_price",
	"eco_total",
	"eco_price_item2",
	"ground_price",
	"ground_total",
	"ground_price_item2",
	"express_price",
	"express_total",
	"express_price_item2",
	"twoday_price",
	"twoday_total",
	"twoday_price_item2",
	"overnight_price",
	"overnight_total",
	"overnight_price_item2",
	"fast_price",
	"fast_total",
	"fast_price_item2",
	"targetCost",
	"target_cost",
	"economyPrice",
	"economy_price",
	"totalPrice",
	"total_price",
	"itemCost",
	"item_cost",
	"unitPrice",
	"unit_price",
}

// LeadTimeFields là 2 cột "AVG TG": thời gian sản xuất / vận chuyển trung bình.
var LeadTimeFields = []string{"avgTimeVendor", "avgTimeActual"}

// LeadTimeRoles là role được xem 2 cột thời gian. Cũng là danh sách CHO PHÉP.
//
// CSF VẪN xem được (họ cần để trả lời khách hàng về thời gian giao). PD và Marvel
// thì không.
var LeadTimeRoles = map[string]bool{
	"admin": true, "seller": true, "vendor": true, "staffa": true, "staffb": true, "csf": true,
}

// SizeBaseFields là các trường phi giá mà bảng tính giá cần cho mỗi dòng size.
var SizeBaseFields = []string{"size", "optional"}

// NormalizeRole hạ chữ thường và bỏ _ - khoảng trắng.
// Khớp _getUserProjectKey của frontend: "Staff B" và "staff_b" là cùng một role.
func NormalizeRole(role string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(role) {
		if r == '_' || r == '-' || r == ' ' {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// SeesPrices cho biết role có được nhận trường giá không.
func SeesPrices(role string) bool { return PriceRoles[NormalizeRole(role)] }

// SeesLeadTime cho biết role có được nhận 2 cột AVG TG không.
func SeesLeadTime(role string) bool { return LeadTimeRoles[NormalizeRole(role)] }

// VisibleSizeFields là danh sách khoá được phép xuất hiện trong một dòng size
// trả về cho role này.
func VisibleSizeFields(role string) []string {
	if !SeesPrices(role) {
		return append([]string(nil), SizeBaseFields...)
	}
	out := make([]string, 0, len(SizeBaseFields)+len(PriceFields))
	out = append(out, SizeBaseFields...)
	return append(out, PriceFields...)
}

// FilterLeadTime bỏ 2 cột thời gian khỏi mảng generalInfo của mỗi file.
//
// Trả về chính slice đầu vào nếu role được phép xem — không tốn công sao chép.
// Ngược lại sửa tại chỗ, đúng như bản PHP (map trong Go là kiểu tham chiếu nên
// hành vi giống hệt).
func FilterLeadTime(files []any, role string) []any {
	if SeesLeadTime(role) {
		return files
	}

	for _, f := range files {
		file, ok := f.(map[string]any)
		if !ok {
			continue
		}
		rows, ok := file["generalInfo"].([]any)
		if !ok {
			continue
		}
		for _, r := range rows {
			row, ok := r.(map[string]any)
			if !ok {
				continue
			}
			for _, field := range LeadTimeFields {
				delete(row, field)
			}
		}
	}
	return files
}

// FilterPrices bỏ mọi khoá giá khỏi CẢ blob thư viện.
//
// Bản nhiều-file của FilterFilePrices, dùng cho getLibrary — đường vào cũ và
// nặng nhất của thư viện. Trước đây chỗ đó chỉ lọc 2 cột thời gian, nên
// CSF/PD/Marvel vẫn nhận đủ 30 khoá giá và frontend mới giấu đi ở tầng render;
// CLAUDE.md mục 6.5 nói rõ giá không được có mặt trong response.
func FilterPrices(files []any, role string) []any {
	if SeesPrices(role) {
		return files
	}

	for _, f := range files {
		if file, ok := f.(map[string]any); ok {
			FilterFilePrices(file, role)
		}
	}
	return files
}

// FilterFilePrices bỏ mọi khoá giá khỏi MỘT file thư viện (cả pricing lẫn
// generalInfo).
//
// Dùng cho endpoint trả một file theo id: đó là đường MỚI vào cùng dữ liệu mà
// getLibrary đang phục vụ, nên nó phải tự lọc chứ không được trông chờ UI giấu
// cột — nếu không sẽ thành lỗ thủng thứ hai bên cạnh getLibrary.
//
// Các khoá phi giá của dòng pricing (kyHieu, productType, size, linkTemplate)
// được GIỮ: giao diện CSF/PD/Marvel dựa vào chúng để suy ra Link Template cho
// từng phôi.
func FilterFilePrices(file map[string]any, role string) map[string]any {
	if SeesPrices(role) {
		return file
	}

	for _, section := range []string{"pricing", "generalInfo"} {
		rows, ok := file[section].([]any)
		if !ok {
			continue
		}
		for _, r := range rows {
			row, ok := r.(map[string]any)
			if !ok {
				continue
			}
			for _, field := range PriceFields {
				delete(row, field)
			}
		}
	}
	return file
}

// FilterRow lọc một dòng dữ liệu về đúng các khoá role được thấy.
//
// Khác các hàm trên: trả về map MỚI, không sửa đầu vào — dòng gốc thường thuộc
// bản cache dùng chung, sửa tại chỗ là làm bẩn cache cho mọi role sau đó.
func FilterRow(row map[string]any, role string) map[string]any {
	if SeesPrices(role) {
		return row
	}

	priced := make(map[string]bool, len(PriceFields))
	for _, f := range PriceFields {
		priced[f] = true
	}

	out := make(map[string]any, len(row))
	for k, v := range row {
		if !priced[k] {
			out[k] = v
		}
	}
	return out
}
