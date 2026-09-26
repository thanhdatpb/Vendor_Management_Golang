package pricing

import (
	"math"
	"testing"
)

// GOLDEN TEST — lưới an toàn quan trọng nhất của cả bản port.
//
// Mọi con số kỳ vọng dưới đây được copy nguyên từ
// backend/tests/Unit/PriceSheetSummaryTest.php, mà bản PHP đó lại sinh ra bằng
// cách chạy thẳng computeSizeRow/summarizeSheet của frontend trên đúng bộ dữ
// liệu này (node, 2026-08-13 và 2026-09-22) — KHÔNG tính tay.
//
// Test đỏ nghĩa là ba bản (JS, PHP, Go) đã lệch nhau, không phải test sai.

// PHP so bằng assertSame(round($v, 10), ...). Sai số 1e-9 ở đây tương đương:
// nó bắt mọi lệch có thật và bỏ qua nhiễu biểu diễn nhị phân.
const tolerance = 1e-9

func closeTo(t *testing.T, field string, got, want float64) {
	t.Helper()
	if math.Abs(got-want) > tolerance {
		t.Errorf("trường %s = %.12f, muốn %.12f", field, got, want)
	}
}

func settings() map[string]any {
	return map[string]any{
		"price":          20.0,
		"quantity":       2.0,
		"shipPerOrder":   5.0,
		"shipPerItem":    1.5,
		"couponUsd":      2.0,
		"couponPct":      10.0,
		"variableFeePct": 3.0,
		"amzFeePct":      17.0,
		"importTax":      0.4,
	}
}

// settingsWith trả một bản settings mới có các khoá bị ghi đè — tương đương
// array_merge của PHP, và không làm bẩn fixture dùng chung.
func settingsWith(overrides map[string]any) map[string]any {
	s := settings()
	for k, v := range overrides {
		s[k] = v
	}
	return s
}

func productTypeWithCustomize() map[string]any {
	return map[string]any{
		"id":   "pt1",
		"name": "Legend Shirt",
		"phoi": 1.25,
		"customizeInfos": []any{
			map[string]any{"id": "ci1", "name": "Logo"},
			map[string]any{"id": "ci2", "name": "Box"},
		},
		"sizes": []any{
			map[string]any{
				"id": "s1", "label": "M", "sizeAdd": 2.0, "itemCost": 6.5,
				"customize": map[string]any{"ci1": 1.0, "ci2": 0.5},
			},
			// sizeAdd gõ dấu phẩy — đúng cách người dùng nhập trong sheet thật.
			map[string]any{
				"id": "s2", "label": "L", "sizeAdd": "3,5", "itemCost": 7.0,
				"customize": map[string]any{"ci1": 1.0},
				"isLib":     true, "shipCostItem": 0.8, "totalShipCost": 4.2,
			},
		},
	}
}

// Dòng thư viện theo bản chỉnh 2026-09: Item Cost = Total (Fulfill).
func fulfillSize() map[string]any {
	return map[string]any{
		"id": "s4", "label": "XL", "sizeAdd": 2.0, "itemCost": 10.1, "p1": 6.0,
		"customize": map[string]any{"ci1": 1.0, "ci2": 0.5},
		"isLib":     true, "costBasis": "fulfill", "shipCostItem": 1.1, "totalShipCost": 4.2,
	}
}

func fulfillSizeWith(overrides map[string]any) map[string]any {
	s := fulfillSize()
	for k, v := range overrides {
		s[k] = v
	}
	return s
}

func sheet() map[string]any {
	return map[string]any{
		"id":       "sheet_x",
		"name":     "X",
		"settings": settings(),
		"productTypes": []any{
			productTypeWithCustomize(),
			map[string]any{
				"id": "pt2", "name": "Night Light", "phoi": "",
				"customizeInfos": []any{},
				"sizes": []any{
					map[string]any{"id": "s3", "label": "S", "sizeAdd": "", "itemCost": ""},
				},
			},
		},
	}
}

func sizeAt(productType map[string]any, i int) map[string]any {
	return asSlice(productType["sizes"])[i].(map[string]any)
}

func TestComputeSizeRowKhopTungConSoVoiPricingEngine(t *testing.T) {
	s := settings()
	pt := productTypeWithCustomize()

	row := ComputeSizeRow(s, pt, sizeAt(pt, 0))
	closeTo(t, "qty", row.Qty, 2.0)
	closeTo(t, "unitPrice", row.UnitPrice, 24.75)
	closeTo(t, "totalPrice", row.TotalPrice, 57.5)
	closeTo(t, "couponAmt", row.CouponAmt, 6.95)
	closeTo(t, "amzFee", row.AmzFee, 8.5935)
	closeTo(t, "variableFee", row.VariableFee, 1.2765)
	closeTo(t, "totalCost", row.TotalCost, 20.3)
	closeTo(t, "profit", row.Profit, 28.6065)
	closeTo(t, "profitAfter", row.ProfitAfter, 20.38)
	closeTo(t, "margin", row.Margin, 49.7504347826)

	// Size lấy từ thư viện: ship phía CHI PHÍ đọc từ record, không dùng
	// Ship/Item + Ship/Order của Price Setting.
	lib := ComputeSizeRow(s, pt, sizeAt(pt, 1))
	closeTo(t, "qty", lib.Qty, 2.0)
	closeTo(t, "unitPrice", lib.UnitPrice, 25.75)
	closeTo(t, "totalPrice", lib.TotalPrice, 59.5)
	closeTo(t, "couponAmt", lib.CouponAmt, 7.15)
	closeTo(t, "amzFee", lib.AmzFee, 8.8995)
	closeTo(t, "variableFee", lib.VariableFee, 1.3305)
	closeTo(t, "totalCost", lib.TotalCost, 19.8)
	closeTo(t, "profit", lib.Profit, 30.8005)
	closeTo(t, "profitAfter", lib.ProfitAfter, 22.32)
	closeTo(t, "margin", lib.Margin, 51.7655462185)
}

// Bản chỉnh Luận Nguyễn 2026-07-16: Variable Fee khác 0 kể cả khi coupon = 0.
func TestVariableFeeKhacKhongKhiKhongCoCoupon(t *testing.T) {
	pt := productTypeWithCustomize()
	row := ComputeSizeRow(
		settingsWith(map[string]any{"couponUsd": 0.0, "couponPct": 0.0}),
		pt, sizeAt(pt, 0),
	)

	closeTo(t, "couponAmt", row.CouponAmt, 0)
	if row.VariableFee <= 0 {
		t.Fatalf("variableFee = %v, phải lớn hơn 0", row.VariableFee)
	}
	// Var% × (Unit × qty − 0) = 3% × 24.75 × 2
	closeTo(t, "variableFee", row.VariableFee, 1.485)
}

// Quantity trống / ≤ 0 phải thành 1, không zero-hoá cả bảng.
func TestQuantityTrongDuocCoiLaMot(t *testing.T) {
	pt := productTypeWithCustomize()

	for _, quantity := range []any{nil, "", 0.0, -3.0} {
		row := ComputeSizeRow(
			settingsWith(map[string]any{"quantity": quantity}),
			pt, sizeAt(pt, 0),
		)
		if row.Qty != 1 {
			t.Errorf("quantity=%#v: qty = %v, muốn 1", quantity, row.Qty)
		}
	}
}

// Bản chỉnh 2026-09: dòng thư viện có Item Cost = Total (Fulfill), đã gồm ship.
// Số kỳ vọng sinh bằng computeSizeRow của frontend (node, 2026-09-22).
func TestDongTotalFulfillKhongCongShipLanNua(t *testing.T) {
	s := settings()
	pt := productTypeWithCustomize()

	// qty = 2: sản phẩm đầu trọn Total, sản phẩm thêm P1 + ship/item.
	// totalShipCost còn sót trong bản lưu KHÔNG được cộng vào.
	row := ComputeSizeRow(s, pt, fulfillSize())
	closeTo(t, "totalCost", row.TotalCost, 18.0)
	closeTo(t, "profit", row.Profit, 30.9065)
	closeTo(t, "profitAfter", row.ProfitAfter, 22.68)

	one := ComputeSizeRow(settingsWith(map[string]any{"quantity": 1.0}), pt, fulfillSize())
	closeTo(t, "totalCost", one.TotalCost, 10.5)
	closeTo(t, "profit", one.Profit, 16.19825)
	closeTo(t, "profitAfter", one.ProfitAfter, 11.115)

	// Thiếu P1 thì sản phẩm thêm tính bằng Item Cost.
	noP1 := ComputeSizeRow(s, pt, fulfillSizeWith(map[string]any{"p1": ""}))
	closeTo(t, "totalCost", noP1.TotalCost, 22.1)
	closeTo(t, "profit", noP1.Profit, 26.8065)
	closeTo(t, "profitAfter", noP1.ProfitAfter, 18.58)
}

func TestSizeChuaCoGiaVonKhongTinhVaoAvgMargin(t *testing.T) {
	missing := fulfillSizeWith(map[string]any{"itemCost": "", "costMissing": true})

	row := ComputeSizeRow(settings(), productTypeWithCustomize(), missing)
	if !row.CostUnknown {
		t.Fatal("costUnknown = false, muốn true")
	}

	withMissing := sheet()
	pt0 := asSlice(withMissing["productTypes"])[0].(map[string]any)
	pt0["sizes"] = append(asSlice(pt0["sizes"]), missing)

	got := Summarize(withMissing)
	before := Summarize(sheet())

	if got.Count != 4 {
		t.Errorf("count = %d, muốn 4 (size thiếu giá vốn vẫn được đếm)", got.Count)
	}
	if got.AvgMargin == nil || before.AvgMargin == nil {
		t.Fatal("avgMargin không được nil ở ca này")
	}
	closeTo(t, "avgMargin", *got.AvgMargin, *before.AvgMargin)

	onlyMissing := map[string]any{
		"settings": settings(),
		"productTypes": []any{
			map[string]any{"customizeInfos": []any{}, "sizes": []any{missing}},
		},
	}
	if s := Summarize(onlyMissing); s.AvgMargin != nil {
		t.Errorf("avgMargin = %v, muốn nil khi mọi size đều thiếu giá vốn", *s.AvgMargin)
	}
}

func TestSummarizeTraDungSoSizeKhoangGiaVaAvgMargin(t *testing.T) {
	s := Summarize(sheet())

	if s.Count != 3 {
		t.Errorf("count = %d, muốn 3", s.Count)
	}
	closeTo(t, "minPrice", *s.MinPrice, 48.0)
	closeTo(t, "maxPrice", *s.MaxPrice, 59.5)
	closeTo(t, "avgMargin", *s.AvgMargin, 57.1442158893)
}

// 0% và "chưa có dữ liệu" là hai chuyện khác nhau — danh sách hiện dấu gạch.
func TestSummarizeBangRongTraNilThayViZero(t *testing.T) {
	s := Summarize(map[string]any{"settings": map[string]any{}, "productTypes": []any{}})

	if s.Count != 0 {
		t.Errorf("count = %d, muốn 0", s.Count)
	}
	if s.MinPrice != nil || s.MaxPrice != nil || s.AvgMargin != nil {
		t.Error("minPrice/maxPrice/avgMargin phải nil khi bảng rỗng")
	}
}

func TestSummarizeBoQuaDuLieuRacThayViNo(t *testing.T) {
	s := Summarize(map[string]any{
		"settings": settings(),
		"productTypes": []any{
			"không phải mảng",
			map[string]any{"sizes": []any{
				"rác",
				map[string]any{"label": "M", "sizeAdd": 1.0},
			}},
		},
	})

	if s.Count != 1 {
		t.Errorf("count = %d, muốn 1", s.Count)
	}
}

func TestProductTypeNamesBoTenRongVaGiuThuTu(t *testing.T) {
	names := ProductTypeNames(sheet())

	want := []string{"Legend Shirt", "Night Light"}
	if len(names) != len(want) {
		t.Fatalf("names = %v, muốn %v", names, want)
	}
	for i := range want {
		if names[i] != want[i] {
			t.Errorf("names[%d] = %q, muốn %q", i, names[i], want[i])
		}
	}
}

// Cột avg_margin là decimal(12,4). Margin = profit / totalPrice × 100, nên Seller
// gõ nhầm một giá cực nhỏ là ra hàng trăm triệu phần trăm — MySQL bật strict sẽ
// ném 1264 Out of range và MẤT LUÔN lần lưu đó.
//
// SQLite bỏ qua độ chính xác của decimal nên test tích hợp không thấy gì; đây là
// lý do ca này phải là unit test.
func TestMarginKhongLamTranCotDecimal(t *testing.T) {
	overflow := map[string]any{
		// totalPrice = 0.0001, giá vốn 1000 -> margin khoảng -1 tỷ %.
		"settings": map[string]any{"price": 0.0001, "quantity": 1.0, "amzFeePct": 0.0},
		"productTypes": []any{
			map[string]any{
				"id": "pt1", "name": "Loi go nham", "customizeInfos": []any{},
				"sizes": []any{
					map[string]any{"id": "sz1", "label": "S", "sizeAdd": 0.0, "itemCost": 1000.0},
				},
			},
		},
	}

	raw := Summarize(overflow)
	if raw.AvgMargin == nil || *raw.AvgMargin >= -maxMarginColumn {
		t.Fatalf("ca thử phải thực sự vượt tầm cột, avgMargin = %v", raw.AvgMargin)
	}

	cols := SummaryColumns(overflow)
	if cols.AvgMargin == nil || *cols.AvgMargin != -maxMarginColumn {
		t.Fatalf("avg_margin = %v, muốn %v", cols.AvgMargin, -maxMarginColumn)
	}
}

func TestSummaryColumnsGiuDungSoKhiKhongTran(t *testing.T) {
	cols := SummaryColumns(sheet())

	if cols.SizeCount != 3 {
		t.Errorf("size_count = %d, muốn 3", cols.SizeCount)
	}
	closeTo(t, "min_price", *cols.MinPrice, 48.0)
	closeTo(t, "max_price", *cols.MaxPrice, 59.5)
	closeTo(t, "avg_margin", *cols.AvgMargin, 57.1442158893)
	if len(cols.ProductTypeNames) != 2 || cols.ProductTypeNames[0] != "Legend Shirt" {
		t.Errorf("product_type_names = %v", cols.ProductTypeNames)
	}
}

func TestSummaryColumnsBangRongTraNil(t *testing.T) {
	cols := SummaryColumns(map[string]any{"settings": map[string]any{}, "productTypes": []any{}})

	if cols.SizeCount != 0 {
		t.Errorf("size_count = %d, muốn 0", cols.SizeCount)
	}
	if cols.MinPrice != nil || cols.AvgMargin != nil {
		t.Error("min_price và avg_margin phải nil khi bảng rỗng")
	}
	// Mảng rỗng, không phải nil: cột này đi thẳng ra JSON của danh sách.
	if cols.ProductTypeNames == nil || len(cols.ProductTypeNames) != 0 {
		t.Errorf("product_type_names = %#v, muốn mảng rỗng", cols.ProductTypeNames)
	}
}

func TestVendorRefSuyLaiTuProductTypeKhiThieu(t *testing.T) {
	explicit := SummaryColumns(map[string]any{"vendorRef": "  V-01  "})
	if explicit.VendorRef == nil || *explicit.VendorRef != "V-01" {
		t.Errorf("vendorRef = %v, muốn V-01 (đã trim)", explicit.VendorRef)
	}

	derived := VendorRef(map[string]any{
		"productTypes": []any{
			map[string]any{"vendorCode": "V-01"},
			map[string]any{"libRef": map[string]any{"vendorCode": "V-02"}},
			map[string]any{"vendorCode": "V-01"}, // trùng thì không lặp
			map[string]any{"name": "không có mã"},
		},
	})
	if derived == nil || *derived != "V-01, V-02" {
		t.Errorf("vendorRef suy lại = %v, muốn \"V-01, V-02\"", derived)
	}

	if none := VendorRef(map[string]any{"productTypes": []any{}}); none != nil {
		t.Errorf("vendorRef = %v, muốn nil khi không có mã nào", *none)
	}
}
