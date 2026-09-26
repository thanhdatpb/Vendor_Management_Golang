package library

import (
	"fmt"
	"strings"
	"testing"
)

// Port của backend/tests/Unit/VendorFieldVisibilityTest.php, cộng các ca chống
// rò giá lấy từ VendorLibraryPriceLeakTest.php và VendorLibraryLeadTimeTest.php.
//
// Ba nhóm test này là CỔNG CHẶN MERGE của phase Vendor Library: chúng là thứ duy
// nhất chứng minh giá không đi ra khỏi server cho CSF / PD / Marvel.

func TestRoleChiDocKhongDuocThayGia(t *testing.T) {
	for _, role := range []string{"csf", "pd", "marvel", "CSF", "Marvel"} {
		if SeesPrices(role) {
			t.Errorf("role %q thấy được giá, không được phép", role)
		}
	}
}

func TestRoleLamGiaVanThayGia(t *testing.T) {
	for _, role := range []string{"admin", "seller", "vendor", "staff_a", "staff_b", "Staff B"} {
		if !SeesPrices(role) {
			t.Errorf("role %q không thấy giá, phải thấy", role)
		}
	}
}

// Danh sách CHO PHÉP, không phải danh sách cấm: role mới thêm vào hệ thống mà
// quên khai báo thì mặc định KHÔNG thấy giá, chứ không lộ sạch.
func TestRoleLaHoacRongMacDinhKhongThayGia(t *testing.T) {
	for _, role := range []string{"", "guest", "intern", "staff_z", "  ", "ADMINISTRATOR"} {
		if SeesPrices(role) {
			t.Errorf("role %q mặc định phải KHÔNG thấy giá", role)
		}
	}
}

// CSF xem được 2 cột AVG TG (cần để trả lời khách về thời gian giao); PD và
// Marvel thì không. Đây là điểm DUY NHẤT khác nhau giữa CSF và PD/Marvel.
func TestChiCsfXemDuocAvgTimeTrongNhomChiDoc(t *testing.T) {
	if !SeesLeadTime("csf") {
		t.Error("CSF phải xem được AVG TG")
	}
	for _, role := range []string{"pd", "marvel"} {
		if SeesLeadTime(role) {
			t.Errorf("role %q không được xem AVG TG", role)
		}
	}
	// Nhưng CSF vẫn không thấy giá.
	if SeesPrices("csf") {
		t.Error("CSF không được thấy giá")
	}
}

func TestFilterRowBoSachKhoaGiaChoRoleChiDoc(t *testing.T) {
	row := map[string]any{
		"size":      "M",
		"optional":  "Basic",
		"pricing1":  6.5,
		"eco_price": 4.2,
		"eco_total": 10.7,
		"itemCost":  6.5,
	}

	filtered := FilterRow(row, "pd")

	if len(filtered) != 2 || filtered["size"] != "M" || filtered["optional"] != "Basic" {
		t.Errorf("filterRow = %#v, muốn chỉ còn size và optional", filtered)
	}
	// Dòng gốc không được sửa: nó thường thuộc bản cache dùng chung.
	if len(row) != 6 {
		t.Errorf("dòng gốc bị sửa: %#v", row)
	}
}

func TestFilterRowGiuNguyenChoRoleCoQuyen(t *testing.T) {
	row := map[string]any{"size": "M", "pricing1": 6.5}

	filtered := FilterRow(row, "seller")

	if len(filtered) != 2 || filtered["pricing1"] != 6.5 {
		t.Errorf("filterRow = %#v, muốn giữ nguyên cho seller", filtered)
	}
}

// Mọi trường ship của thư viện phải nằm trong danh sách khoá giá — thêm phương
// thức ship mới mà quên khai báo là đúng cách rò rỉ giá phát sinh.
func TestMoiPhuongThucShipDeuCoDuBaKhoaGia(t *testing.T) {
	has := make(map[string]bool, len(PriceFields))
	for _, f := range PriceFields {
		has[f] = true
	}

	for _, method := range []string{"eco", "ground", "express", "twoday", "overnight"} {
		for _, suffix := range []string{"_price", "_total", "_price_item2"} {
			field := method + suffix
			if !has[field] {
				t.Errorf("thiếu %s trong PriceFields", field)
			}
		}
	}
}

func TestVisibleSizeFieldsChoRoleChiDoc(t *testing.T) {
	forPd := VisibleSizeFields("pd")
	if len(forPd) != 2 || forPd[0] != "size" || forPd[1] != "optional" {
		t.Errorf("VisibleSizeFields(pd) = %v, muốn [size optional]", forPd)
	}

	forSeller := VisibleSizeFields("seller")
	if len(forSeller) != len(SizeBaseFields)+len(PriceFields) {
		t.Errorf("VisibleSizeFields(seller) có %d trường, muốn %d",
			len(forSeller), len(SizeBaseFields)+len(PriceFields))
	}
	if !strings.Contains(fmt.Sprint(forSeller), "pricing1") {
		t.Error("seller phải nhận được pricing1")
	}

	// Không được trả về chính SizeBaseFields: người gọi append vào là làm hỏng
	// hằng dùng chung cho mọi request sau đó.
	forPd = append(forPd, "bi_them_vao")
	if len(SizeBaseFields) != 2 {
		t.Fatalf("SizeBaseFields bị sửa thành %v — VisibleSizeFields phải trả bản sao", SizeBaseFields)
	}
}

func libraryBlob() []any {
	return []any{
		map[string]any{
			"filename": "Thu vien P.happy.xlsx",
			"pricing": []any{
				map[string]any{
					"kyHieu": "HW1", "productType": "T-Shirt", "size": "M",
					"optional": "Basic", "linkTemplate": "https://example.test/tpl",
					"pricing1": 6.5, "eco_price": 4.2, "eco_total": 10.7,
					"overnight_total": 21.0, "itemCost": 6.5,
				},
			},
			"generalInfo": []any{
				map[string]any{
					"kyHieu": "HW1", "material": "Cotton",
					"avgTimeVendor": "5-7", "avgTimeActual": "6",
					"targetCost": 4.0, "total_price": 12.0,
				},
			},
		},
	}
}

func TestFilterPricesBoSachKhoaGiaKhoiCaBlob(t *testing.T) {
	files := FilterPrices(libraryBlob(), "csf")

	file := files[0].(map[string]any)
	pricing := file["pricing"].([]any)[0].(map[string]any)
	general := file["generalInfo"].([]any)[0].(map[string]any)

	for _, field := range PriceFields {
		if _, leaked := pricing[field]; leaked {
			t.Errorf("dòng pricing còn khoá giá %q", field)
		}
		if _, leaked := general[field]; leaked {
			t.Errorf("dòng generalInfo còn khoá giá %q", field)
		}
	}

	// Khoá phi giá phải được GIỮ: UI của CSF/PD/Marvel dựa vào chúng để suy ra
	// Link Template cho từng phôi.
	for _, keep := range []string{"kyHieu", "productType", "size", "optional", "linkTemplate"} {
		if _, ok := pricing[keep]; !ok {
			t.Errorf("dòng pricing mất khoá phi giá %q", keep)
		}
	}
	if general["material"] != "Cotton" {
		t.Error("generalInfo mất trường material")
	}
}

func TestFilterPricesGiuNguyenChoRoleCoQuyen(t *testing.T) {
	files := FilterPrices(libraryBlob(), "vendor")

	pricing := files[0].(map[string]any)["pricing"].([]any)[0].(map[string]any)
	if pricing["pricing1"] != 6.5 || pricing["eco_total"] != 10.7 {
		t.Errorf("role vendor bị lọc mất giá: %#v", pricing)
	}
}

func TestFilterLeadTimeChiBoHaiCotThoiGian(t *testing.T) {
	// PD không xem được AVG TG.
	files := FilterLeadTime(libraryBlob(), "pd")
	general := files[0].(map[string]any)["generalInfo"].([]any)[0].(map[string]any)
	for _, field := range LeadTimeFields {
		if _, leaked := general[field]; leaked {
			t.Errorf("PD còn thấy %q", field)
		}
	}
	if general["material"] != "Cotton" {
		t.Error("FilterLeadTime không được bỏ trường khác ngoài 2 cột thời gian")
	}

	// CSF xem được, blob phải nguyên vẹn.
	csf := FilterLeadTime(libraryBlob(), "csf")
	csfGeneral := csf[0].(map[string]any)["generalInfo"].([]any)[0].(map[string]any)
	if csfGeneral["avgTimeVendor"] != "5-7" {
		t.Error("CSF phải vẫn thấy avgTimeVendor")
	}
}

// Hai bộ lọc chạy nối nhau là đường thật của getLibrary cho role chỉ-đọc:
// PD không thấy giá VÀ không thấy AVG TG.
func TestLocGiaVaLocThoiGianKetHopChoPd(t *testing.T) {
	files := FilterLeadTime(FilterPrices(libraryBlob(), "pd"), "pd")

	general := files[0].(map[string]any)["generalInfo"].([]any)[0].(map[string]any)
	banned := append(append([]string{}, PriceFields...), LeadTimeFields...)
	for _, field := range banned {
		if _, leaked := general[field]; leaked {
			t.Errorf("PD còn thấy %q sau khi qua cả hai bộ lọc", field)
		}
	}
	if len(general) != 2 { // chỉ còn kyHieu + material
		t.Errorf("generalInfo còn lại %#v, muốn chỉ kyHieu và material", general)
	}
}

// Dữ liệu rác trong blob (dòng không phải object, thiếu section) không được làm
// nổ bộ lọc — blob thật đã qua nhiều lần import và có bản ghi cũ méo mó.
func TestBoLocBoQuaDuLieuRac(t *testing.T) {
	junk := []any{
		"không phải object",
		map[string]any{"pricing": "không phải mảng"},
		map[string]any{"pricing": []any{"rác", nil}},
		map[string]any{},
	}

	FilterPrices(junk, "pd")
	FilterLeadTime(junk, "pd")
}
