package library

import (
	"encoding/json"
	"strings"
	"testing"
)

// Bộ test này phủ đúng phạm vi của backend/tests/Feature/VendorLibraryIndexTest.php
// cộng các ca rút từ chính comment trong VendorLibraryIndexBuilder.php (bug
// 2026-09 về file không có cột Ký hiệu).

func priceRow(overrides map[string]any) map[string]any {
	row := map[string]any{
		"kyHieu": "HW1", "productType": "T-Shirt", "size": "M",
		"optional": "Basic", "pricing1": 6.5, "eco_price": 4.2, "eco_total": 10.7,
	}
	for k, v := range overrides {
		row[k] = v
	}
	return row
}

func oneFile(pricing []any, general []any) []any {
	file := map[string]any{
		"filename": "Thu vien P.happy.xlsx",
		"pricing":  pricing,
	}
	if general != nil {
		file["generalInfo"] = general
	}
	return []any{file}
}

func TestIndexTraDuRecordSizeVaGiaVonChoSeller(t *testing.T) {
	files := oneFile([]any{
		priceRow(nil),
		priceRow(map[string]any{"size": "L", "pricing1": 7.0}),
	}, nil)

	records := BuildIndex(files, "happy", true)

	if len(records) != 1 {
		t.Fatalf("có %d record, muốn 1", len(records))
	}
	r := records[0]
	if r.ProductType != "T-Shirt" || r.VendorCode != "HW1" {
		t.Errorf("record = %+v", r)
	}
	if len(r.Sizes) != 2 {
		t.Fatalf("có %d size, muốn 2", len(r.Sizes))
	}
	if v, _ := r.Sizes[0].Get("pricing1"); v != 6.5 {
		t.Errorf("pricing1 = %v, muốn 6.5", v)
	}
	if r.Project == nil || *r.Project != "happy" {
		t.Errorf("project = %v, muốn happy", r.Project)
	}
}

// Đây là hàng rào chống rò giá ở tầng index: role không được xem giá thì dòng
// size chỉ còn đúng các trường phi giá, và phải theo đúng thứ tự đó.
func TestRoleKhongCoQuyenGiaNhanIndexKhongChuaKhoaGiaNao(t *testing.T) {
	files := oneFile([]any{priceRow(nil)}, nil)

	forPd := BuildIndex(files, "happy", SeesPrices("pd"))
	keys := forPd[0].Sizes[0].Keys()

	if len(keys) != 2 || keys[0] != "size" || keys[1] != "optional" {
		t.Fatalf("khoá dòng size = %v, muốn [size optional]", keys)
	}

	// Kiểm cả ở tầng JSON: khoá giá không được lọt ra dưới bất kỳ hình thức nào.
	encoded, err := json.Marshal(forPd)
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}
	for _, field := range PriceFields {
		if strings.Contains(string(encoded), `"`+field+`"`) {
			t.Errorf("JSON của PD còn khoá giá %q", field)
		}
	}

	forSeller := BuildIndex(files, "happy", SeesPrices("seller"))
	if _, ok := forSeller[0].Sizes[0].Get("pricing1"); !ok {
		t.Error("seller phải nhận được pricing1")
	}
}

// Thứ tự khoá JSON phải khớp bản PHP: size, optional, rồi tới các khoá giá.
// map[string]any của Go sẽ sắp xếp theo bảng chữ cái nếu ai đó thay OrderedMap.
func TestThuTuKhoaTrongDongSizeGiongBanPhp(t *testing.T) {
	files := oneFile([]any{priceRow(nil)}, nil)

	records := BuildIndex(files, "happy", true)
	encoded, _ := json.Marshal(records[0].Sizes[0])

	want := `{"size":"M","optional":"Basic","pricing1":6.5,"eco_price":4.2,"eco_total":10.7}`
	if string(encoded) != want {
		t.Errorf("\n got %s\nmuốn %s", encoded, want)
	}
}

func TestIndexKemTheoInfoPhoiTuGeneralInfo(t *testing.T) {
	files := oneFile(
		[]any{priceRow(nil)},
		[]any{map[string]any{
			"kyHieu": "HW1", "productType": "T-Shirt",
			"chatLieu": "Cotton 100%", "chiTietSize": "S-M-L",
			"images":        []any{"https://cdn.example.com/a.jpg"},
			"avgTimeVendor": "5-7", "avgTimeActual": "6",
		}},
	)

	r := BuildIndex(files, "happy", true)[0]

	if r.ChatLieu != "Cotton 100%" || r.ChiTietSize != "S-M-L" {
		t.Errorf("info phôi = %+v", r)
	}
	if r.Image != "https://cdn.example.com/a.jpg" {
		t.Errorf("image = %q", r.Image)
	}
	if r.AvgTimeVendor != "5-7" || r.AvgTimeActual != "6" {
		t.Errorf("AVG TG = %q / %q", r.AvgTimeVendor, r.AvgTimeActual)
	}
}

// Ảnh nhúng qua formula Excel đôi khi là data-URI khổng lồ. Index gọn không
// được cõng nó, nhưng URL dài bình thường thì phải giữ nguyên.
func TestAnhDaiBatThuongBiLoaiConAnhBinhThuongGiuNguyen(t *testing.T) {
	normal := "https://cdn.example.com/" + strings.Repeat("a", 200) + ".jpg" // 248 ký tự
	huge := "data:image/png;base64," + strings.Repeat("A", 400)

	files := oneFile(
		[]any{priceRow(nil)},
		[]any{map[string]any{
			"kyHieu": "HW1", "productType": "T-Shirt",
			"images":           []any{huge, normal},
			"chiTietSizeImage": huge,
		}},
	)

	r := BuildIndex(files, "happy", true)[0]

	if len(r.Images) != 1 || r.Images[0] != normal {
		t.Errorf("images = %v, muốn chỉ giữ URL dài bình thường", r.Images)
	}
	if r.ChiTietSizeImage != "" {
		t.Errorf("chiTietSizeImage phải bị bỏ khi quá dài, nhận %d ký tự", len(r.ChiTietSizeImage))
	}
}

func TestIndexGiuNhieuAnhNhungCatBotConBon(t *testing.T) {
	files := oneFile(
		[]any{priceRow(nil)},
		[]any{map[string]any{
			"kyHieu": "HW1", "productType": "T-Shirt",
			"images": []any{"a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg", "f.jpg"},
		}},
	)

	r := BuildIndex(files, "happy", true)[0]

	if len(r.Images) != maxImagesPerRecord {
		t.Errorf("có %d ảnh, muốn %d", len(r.Images), maxImagesPerRecord)
	}
	if r.Image != "a.jpg" {
		t.Errorf("image đại diện = %q, muốn ảnh đầu tiên", r.Image)
	}
}

// Bug thật 2026-09: template "Về giá" không có cột Ký hiệu nên mọi dòng giá ra
// kyHieu rỗng. Phải suy ngược vendor từ Section 1 theo tên phôi.
func TestSuyVendorTuSection1KhiDongGiaKhongGhiKyHieu(t *testing.T) {
	files := oneFile(
		[]any{priceRow(map[string]any{"kyHieu": ""})},
		[]any{map[string]any{
			"kyHieu": "CN1", "productType": "T-Shirt", "chatLieu": "Polyester",
		}},
	)

	r := BuildIndex(files, "happy", true)[0]

	if r.VendorInferred != "CN1" {
		t.Errorf("vendorInferred = %q, muốn CN1", r.VendorInferred)
	}
	// vendorCode thô phải GIỮ rỗng: recordKey của bảng đã lưu không được đổi.
	if r.VendorCode != "" {
		t.Errorf("vendorCode = %q, phải giữ rỗng", r.VendorCode)
	}
	if r.ChatLieu != "Polyester" {
		t.Errorf("chatLieu = %q, phải lấy được từ Section 1", r.ChatLieu)
	}
}

// File chỉ có đúng một dòng thông tin phôi thì lấy dòng đó, dù tên phôi không khớp.
func TestSuyVendorKhiFileChiCoMotDongThongTinPhoi(t *testing.T) {
	files := oneFile(
		[]any{priceRow(map[string]any{"kyHieu": "", "productType": "Hoodie"})},
		[]any{map[string]any{"kyHieu": "CN1", "productType": "T-Shirt", "chatLieu": "Fleece"}},
	)

	r := BuildIndex(files, "happy", true)[0]

	if r.VendorInferred != "CN1" || r.ChatLieu != "Fleece" {
		t.Errorf("record = %+v, muốn suy được CN1/Fleece", r)
	}
}

// Nhiều dòng mà không dòng nào khớp thì để TRỐNG — không đoán bừa.
func TestKhongDoanBuaKhiNhieuDongDeuKhongKhop(t *testing.T) {
	files := oneFile(
		[]any{priceRow(map[string]any{"kyHieu": "", "productType": "Hoodie"})},
		[]any{
			map[string]any{"kyHieu": "CN1", "productType": "T-Shirt", "chatLieu": "Cotton"},
			map[string]any{"kyHieu": "CN2", "productType": "Mug", "chatLieu": "Ceramic"},
		},
	)

	r := BuildIndex(files, "happy", true)[0]

	if r.VendorInferred != "" || r.ChatLieu != "" {
		t.Errorf("record = %+v, muốn để trống thay vì đoán", r)
	}
}

// Dòng giá ĐÃ ghi Ký hiệu mà Section 1 không có vendor đó thì để TRỐNG, dừng ở
// bước 1: vendor khác là chất liệu khác, gán nhầm còn tệ hơn để trống.
func TestKyHieuLaThiDeTrongChuKhongLayDongKhac(t *testing.T) {
	files := oneFile(
		[]any{priceRow(map[string]any{"kyHieu": "KHONG_CO"})},
		[]any{map[string]any{"kyHieu": "CN1", "productType": "T-Shirt", "chatLieu": "Cotton"}},
	)

	r := BuildIndex(files, "happy", true)[0]

	if r.ChatLieu != "" || r.VendorInferred != "" {
		t.Errorf("record = %+v, muốn để trống", r)
	}
	if r.VendorCode != "KHONG_CO" {
		t.Errorf("vendorCode = %q, phải giữ nguyên ký hiệu thô", r.VendorCode)
	}
}

// Hai vendor cùng cấp một tên phôi là ca thật: phải ra 2 record, không đè nhau.
func TestHaiVendorCungTenPhoiKhongDeNhau(t *testing.T) {
	files := oneFile([]any{
		priceRow(map[string]any{"kyHieu": "HW1"}),
		priceRow(map[string]any{"kyHieu": "HW2"}),
	}, nil)

	records := BuildIndex(files, "happy", true)

	if len(records) != 2 {
		t.Fatalf("có %d record, muốn 2", len(records))
	}
	if records[0].RecordKey == records[1].RecordKey {
		t.Error("recordKey trùng nhau — 2 vendor bị gộp làm một")
	}
}

func TestRecordKeyOnDinhVaKhongPhanBietHoaThuong(t *testing.T) {
	a := RecordKey("Thu vien P.happy.xlsx", "HW1", "T-Shirt")
	b := RecordKey("  thu vien p.happy.xlsx ", " hw1 ", " t-shirt ")

	if a != b {
		t.Errorf("recordKey đổi theo hoa/thường hoặc khoảng trắng: %s vs %s", a, b)
	}
	if len(a) != 16 {
		t.Errorf("recordKey dài %d ký tự, muốn 16", len(a))
	}
	if a == RecordKey("Thu vien P.happy.xlsx", "HW2", "T-Shirt") {
		t.Error("đổi vendor mà recordKey không đổi")
	}
}

func TestSizeTrungThiBanDauTienThang(t *testing.T) {
	files := oneFile([]any{
		priceRow(map[string]any{"size": "M", "pricing1": 6.5}),
		priceRow(map[string]any{"size": "m", "pricing1": 99.0}), // khác hoa thường
	}, nil)

	r := BuildIndex(files, "happy", true)[0]

	if len(r.Sizes) != 1 {
		t.Fatalf("có %d size, muốn 1", len(r.Sizes))
	}
	if v, _ := r.Sizes[0].Get("pricing1"); v != 6.5 {
		t.Errorf("pricing1 = %v, muốn bản đầu tiên 6.5", v)
	}
}

func TestSizeRongHoacNAThiBoQua(t *testing.T) {
	files := oneFile([]any{
		priceRow(map[string]any{"size": ""}),
		priceRow(map[string]any{"size": "N/A"}),
		priceRow(map[string]any{"size": "   "}),
	}, nil)

	if records := BuildIndex(files, "happy", true); len(records) != 0 {
		t.Errorf("có %d record, muốn 0 — record không size phải bị bỏ", len(records))
	}
}

func TestDongGiaThieuProductTypeThiBoQua(t *testing.T) {
	files := oneFile([]any{
		priceRow(map[string]any{"productType": ""}),
		priceRow(map[string]any{"productType": "   "}),
	}, nil)

	if records := BuildIndex(files, "happy", true); len(records) != 0 {
		t.Errorf("có %d record, muốn 0", len(records))
	}
}

func TestLocDungProjectCuaUser(t *testing.T) {
	files := []any{
		map[string]any{"filename": "A P.happy.xlsx", "pricing": []any{priceRow(nil)}},
		map[string]any{"filename": "B P.global.xlsx", "pricing": []any{priceRow(nil)}},
	}

	happy := BuildIndex(files, "happy", true)
	if len(happy) != 1 || happy[0].Filename != "A P.happy.xlsx" {
		t.Errorf("lọc theo happy ra %d record: %+v", len(happy), happy)
	}

	// projectKey rỗng nghĩa là xem mọi project (Admin, CSF, Marvel).
	if all := BuildIndex(files, "", true); len(all) != 2 {
		t.Errorf("không lọc ra %d record, muốn 2", len(all))
	}
}

// Danh sách chia sẻ tường minh thắng suy đoán theo tên file; danh sách RỖNG
// nghĩa là chia sẻ cho mọi project.
func TestDanhSachChiaSeTuongMinhThangSuyDoanTenFile(t *testing.T) {
	// Tên file nói happy, nhưng đã chia sẻ tường minh cho global.
	shared := []any{map[string]any{
		"filename": "A P.happy.xlsx",
		"projects": []any{"global"},
		"pricing":  []any{priceRow(nil)},
	}}

	if got := BuildIndex(shared, "happy", true); len(got) != 0 {
		t.Error("file chia sẻ cho global vẫn lọt vào index của happy")
	}
	if got := BuildIndex(shared, "global", true); len(got) != 1 {
		t.Error("file chia sẻ cho global không vào được index của global")
	}

	everyone := []any{map[string]any{
		"filename": "A P.happy.xlsx",
		"projects": []any{},
		"pricing":  []any{priceRow(nil)},
	}}
	if got := BuildIndex(everyone, "global", true); len(got) != 1 {
		t.Error("danh sách chia sẻ rỗng phải nghĩa là mọi project đều thấy")
	}
}

func TestNhanProjectChiCoNghiaKhiFileThuocDungMotProject(t *testing.T) {
	one := FileProjectTag(map[string]any{"projects": []any{"happy"}})
	if one == nil || *one != "happy" {
		t.Errorf("nhãn = %v, muốn happy", one)
	}

	if many := FileProjectTag(map[string]any{"projects": []any{"happy", "global"}}); many != nil {
		t.Errorf("nhãn = %v, muốn nil khi file thuộc nhiều project", *many)
	}

	fromName := FileProjectTag(map[string]any{"filename": "A P.global.xlsx"})
	if fromName == nil || *fromName != "global" {
		t.Errorf("nhãn suy từ tên file = %v, muốn global", fromName)
	}

	if none := FileProjectTag(map[string]any{"filename": "khong co ma.xlsx"}); none != nil {
		t.Errorf("nhãn = %v, muốn nil", *none)
	}
}

// hapify84 phải được thử TRƯỚC happy, nếu không tên file P.Hapify84 sẽ bị nhận
// nhầm khi ai đó sắp xếp lại danh sách.
func TestFileProjectThuHapify84TruocHappy(t *testing.T) {
	cases := map[string]string{
		"HC_Jersey_P.Hapify84_16.xlsx": "hapify84",
		"HC_Jersey_P.Happy_16.xlsx":    "happy",
		"HC_Jersey_P.Creative.xlsx":    "creative",
		"HC_Jersey_P.Global_16.xlsx":   "global",
		"khong co ma.xlsx":             "",
		"":                             "",
	}

	for filename, want := range cases {
		if got := FileProject(filename); got != want {
			t.Errorf("FileProject(%q) = %q, muốn %q", filename, got, want)
		}
	}
}

// Blob thật đã qua nhiều lần import và có bản ghi méo mó — index không được nổ.
func TestBuildIndexBoQuaDuLieuRac(t *testing.T) {
	files := []any{
		"không phải object",
		nil,
		map[string]any{"filename": "A P.happy.xlsx"},                          // thiếu pricing
		map[string]any{"filename": "B P.happy.xlsx", "pricing": "không mảng"}, // pricing sai kiểu
		map[string]any{"filename": "C P.happy.xlsx", "pricing": []any{"rác", nil}},
		map[string]any{
			"filename":    "D P.happy.xlsx",
			"generalInfo": []any{"rác", nil},
			"pricing":     []any{priceRow(nil)},
		},
	}

	records := BuildIndex(files, "happy", true)

	if len(records) != 1 {
		t.Fatalf("có %d record, muốn 1 (chỉ file D hợp lệ)", len(records))
	}
	if records[0].Filename != "D P.happy.xlsx" {
		t.Errorf("record = %+v", records[0])
	}
}

// Mảng rỗng phải ra [] chứ không phải null: frontend duyệt thẳng kết quả.
func TestMangRongRaDauNgoacVuongChuKhongPhaiNull(t *testing.T) {
	encoded, err := json.Marshal(BuildIndex([]any{}, "happy", true))
	if err != nil {
		t.Fatalf("marshal lỗi: %v", err)
	}
	if string(encoded) != "[]" {
		t.Errorf("index rỗng = %s, muốn []", encoded)
	}

	files := oneFile([]any{priceRow(nil)}, nil)
	r := BuildIndex(files, "happy", true)[0]
	if encodedImages, _ := json.Marshal(r.Images); string(encodedImages) != "[]" {
		t.Errorf("images khi không có ảnh = %s, muốn []", encodedImages)
	}
}

// Index phải NHẸ HƠN HẲN blob đầy đủ — đó là toàn bộ lý do nó tồn tại.
func TestIndexNheHonHanBlobDayDu(t *testing.T) {
	heavy := map[string]any{
		"filename": "A P.happy.xlsx",
		"notes":    strings.Repeat("ghi chú dài ", 500),
		"pricing":  []any{priceRow(nil)},
		"generalInfo": []any{map[string]any{
			"kyHieu": "HW1", "productType": "T-Shirt",
			"images": []any{"data:image/png;base64," + strings.Repeat("A", 5000)},
		}},
	}

	blob, _ := json.Marshal([]any{heavy})
	index, _ := json.Marshal(BuildIndex([]any{heavy}, "happy", true))

	if len(index) >= len(blob)/2 {
		t.Errorf("index %d byte so với blob %d byte — không đủ gọn", len(index), len(blob))
	}
}

// Ô Excel mang giá trị số mà template lại coi là chữ là ca thật trong blob.
// toString phải ép giống PHP: số nguyên KHÔNG có phần thập phân.
func TestToStringEpKieuGiongPhp(t *testing.T) {
	cases := []struct {
		in   any
		want string
	}{
		{nil, ""},
		{"HW1", "HW1"},
		{6.0, "6"},
		{6.5, "6.5"},
		{-3.0, "-3"},
		{12, "12"},
		{true, "1"},
		{false, ""},
		{[]any{1, 2}, ""},            // kiểu lạ về chuỗi rỗng
		{map[string]any{"a": 1}, ""}, // kiểu lạ về chuỗi rỗng
	}

	for _, c := range cases {
		if got := toString(c.in); got != c.want {
			t.Errorf("toString(%#v) = %q, muốn %q", c.in, got, c.want)
		}
	}
}

// Ký hiệu vendor là số trong file Excel: record vẫn phải tra được thông tin phôi.
func TestKyHieuDangSoVanTraDuocThongTinPhoi(t *testing.T) {
	files := oneFile(
		[]any{priceRow(map[string]any{"kyHieu": 16.0})},
		[]any{map[string]any{"kyHieu": 16.0, "productType": "T-Shirt", "chatLieu": "Cotton"}},
	)

	r := BuildIndex(files, "happy", true)[0]

	if r.VendorCode != "16" {
		t.Errorf("vendorCode = %q, muốn \"16\"", r.VendorCode)
	}
	if r.ChatLieu != "Cotton" {
		t.Errorf("chatLieu = %q, phải tra được theo ký hiệu dạng số", r.ChatLieu)
	}
}

// generalInfo có dòng mà images sai kiểu hoặc thiếu hẳn: bỏ qua, không nổ.
func TestGeneralInfoImagesSaiKieuThiBoQua(t *testing.T) {
	files := oneFile(
		[]any{priceRow(nil)},
		[]any{map[string]any{
			"kyHieu": "HW1", "productType": "T-Shirt",
			"images": "không phải mảng",
		}},
	)

	r := BuildIndex(files, "happy", true)[0]

	if len(r.Images) != 0 || r.Image != "" {
		t.Errorf("images = %v, image = %q — muốn rỗng", r.Images, r.Image)
	}
}

// Dòng generalInfo chỉ có Vendor Name (không có Ký hiệu) vẫn phải tra được —
// có file chỉ điền một trong hai cột.
func TestTraDuocThongTinPhoiTheoVendorName(t *testing.T) {
	files := oneFile(
		[]any{priceRow(map[string]any{"kyHieu": "Hong Wei"})},
		[]any{map[string]any{
			"vendorName": "Hong Wei", "productType": "T-Shirt", "chatLieu": "Cotton",
		}},
	)

	r := BuildIndex(files, "happy", true)[0]

	if r.ChatLieu != "Cotton" {
		t.Errorf("chatLieu = %q, phải tra được theo Vendor Name", r.ChatLieu)
	}
}

// Vendor gặp TRƯỚC thắng khi hai dòng Section 1 cùng một ký hiệu.
func TestVendorGapTruocThangKhiTrungKyHieu(t *testing.T) {
	files := oneFile(
		[]any{priceRow(nil)},
		[]any{
			map[string]any{"kyHieu": "HW1", "productType": "T-Shirt", "chatLieu": "Dòng đầu"},
			map[string]any{"kyHieu": "HW1", "productType": "T-Shirt", "chatLieu": "Dòng sau"},
		},
	)

	r := BuildIndex(files, "happy", true)[0]

	if r.ChatLieu != "Dòng đầu" {
		t.Errorf("chatLieu = %q, muốn dòng gặp trước", r.ChatLieu)
	}
}

// Giá trị null và chuỗi rỗng bị BỎ khỏi dòng size (không ghi khoá), nhưng số 0
// thì GIỮ — 0 là một giá hợp lệ.
func TestDongSizeBoNullVaChuoiRongNhungGiuSoKhong(t *testing.T) {
	files := oneFile([]any{priceRow(map[string]any{
		"optional":  nil,
		"eco_price": "",
		"pricing1":  0.0,
	})}, nil)

	size := BuildIndex(files, "happy", true)[0].Sizes[0]

	if _, ok := size.Get("optional"); ok {
		t.Error("khoá null phải bị bỏ khỏi dòng size")
	}
	if _, ok := size.Get("eco_price"); ok {
		t.Error("khoá chuỗi rỗng phải bị bỏ khỏi dòng size")
	}
	if v, ok := size.Get("pricing1"); !ok || v != 0.0 {
		t.Errorf("pricing1 = %v (%v), số 0 phải được giữ", v, ok)
	}
}

// FilterLeadTime và FilterFilePrices gặp section sai kiểu thì bỏ qua section đó.
func TestBoLocBoQuaSectionSaiKieu(t *testing.T) {
	junk := []any{
		map[string]any{"generalInfo": "không phải mảng"},
		map[string]any{"generalInfo": []any{"rác", nil, 42.0}},
		map[string]any{"pricing": []any{nil}},
	}

	FilterLeadTime(junk, "pd")
	FilterPrices(junk, "pd")
	FilterFilePrices(map[string]any{"pricing": 42.0}, "pd")
}
