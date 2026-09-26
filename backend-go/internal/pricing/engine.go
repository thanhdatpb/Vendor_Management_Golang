// Package pricing là bản port thuần Go của công thức bảng tính giá.
//
// Nguồn sự thật gốc: frontend/src/utils/pricingEngine.js (bản chỉnh Luận Nguyễn
// 2026-07-16 + bản chỉnh Total Fulfill 2026-09). Bản PHP
// backend/app/Support/PriceSheetSummary.php là bản port thứ hai của cùng công
// thức; đây là bản thứ ba.
//
// Vì vậy: mọi thay đổi ở đây phải đi kèm cập nhật golden test, và bộ số trong
// engine_test.go phải giữ y nguyên bộ số của
// tests/Unit/PriceSheetSummaryTest.php và pricingEngine.golden.test.js.
//
// Package này KHÔNG được import store hay httpx — nó phải test được không cần DB.
package pricing

import "math"

// Row là kết quả tính một dòng size. Tên field giữ đúng khoá của bản JS/PHP để
// đối chiếu golden test không phải dịch tên.
type Row struct {
	Qty         float64
	CostUnknown bool
	UnitPrice   float64
	TotalPrice  float64
	CouponAmt   float64
	AmzFee      float64
	VariableFee float64
	TotalCost   float64
	Profit      float64
	ProfitAfter float64
	Margin      float64
	MarginAfter float64
}

// ComputeSizeRow tính một dòng size.
//
// THỨ TỰ PHÉP TÍNH PHẢI GIỮ NGUYÊN như bản JS/PHP. Đổi thứ tự không làm sai
// toán học nhưng làm lệch dấu phẩy động, và golden test so tới 10 chữ số thập
// phân sẽ đỏ.
func ComputeSizeRow(settings, productType, size map[string]any) Row {
	price := Num(settings["price"])
	shipPerItem := Num(settings["shipPerItem"])
	shipPerOrder := Num(settings["shipPerOrder"])
	importTax := Num(settings["importTax"])
	phoi := Num(productType["phoi"])
	sizeAdd := Num(size["sizeAdd"])
	itemCost := Num(size["itemCost"])

	qty := Num(settings["quantity"])
	if qty <= 0 {
		// Quantity trống / 0 / âm thì coi như 1, không zero-hoá cả bảng.
		qty = 1
	}

	customizeSum := 0.0
	customize, _ := asMap(size["customize"])
	for _, info := range asSlice(productType["customizeInfos"]) {
		m, ok := asMap(info)
		if !ok {
			continue
		}
		id, ok := m["id"].(string)
		if !ok || id == "" {
			continue
		}
		customizeSum += Num(customize[id])
	}

	unitPrice := price + phoi + sizeAdd + customizeSum
	goodsAmt := unitPrice * qty
	totalPrice := (unitPrice+shipPerItem)*qty + shipPerOrder

	// Coupon % chỉ tính trên PHẦN HÀNG, không gồm Ship/Order.
	couponAmt := Num(settings["couponUsd"]) + (Num(settings["couponPct"])/100)*goodsAmt
	amzFee := (Num(settings["amzFeePct"]) / 100) * (totalPrice - couponAmt)
	// Variable Fee khác 0 kể cả khi coupon = 0 (bản chỉnh 2026-07-16).
	variableFee := (Num(settings["variableFeePct"]) / 100) * (unitPrice*qty - couponAmt)

	isLib := phpTruthy(size["isLib"])
	shipCostItem := shipPerItem
	if isLib {
		shipCostItem = Num(size["shipCostItem"])
	}
	// Bản chỉnh 2026-09: dòng thư viện có Item Cost = Total (Fulfill), đã gồm ship.
	fulfillBasis := isLib && asString(size["costBasis"]) == "fulfill"

	var totalCost float64
	if fulfillBasis {
		// Sản phẩm đầu tính trọn Total; mỗi sản phẩm thêm tính P1 + ship/item
		// (thiếu P1 thì dùng Item Cost). totalShipCost còn sót trong bản lưu
		// KHÔNG được cộng vào.
		extraItemCost := itemCost
		if p1 := Num(size["p1"]); p1 > 0 {
			extraItemCost = p1
		}
		totalCost = (itemCost + importTax) + (qty-1)*(extraItemCost+shipCostItem+importTax)
	} else {
		totalShipCost := shipPerOrder
		if isLib {
			totalShipCost = Num(size["totalShipCost"])
		}
		totalCost = (itemCost+shipCostItem+importTax)*qty + (totalShipCost - shipCostItem)
	}

	profit := totalPrice - amzFee - totalCost
	profitAfter := totalPrice - amzFee - variableFee - couponAmt - totalCost

	row := Row{
		Qty: qty,
		// Dòng thư viện chưa có giá vốn: margin là số ảo, không vào avg margin.
		CostUnknown: isLib && phpTruthy(size["costMissing"]),
		UnitPrice:   unitPrice,
		TotalPrice:  totalPrice,
		CouponAmt:   couponAmt,
		AmzFee:      amzFee,
		VariableFee: variableFee,
		TotalCost:   totalCost,
		Profit:      profit,
		ProfitAfter: profitAfter,
	}
	// Bản gốc dùng truthiness của PHP/JS: totalPrice = 0 thì margin = 0, không NaN.
	if totalPrice != 0 {
		row.Margin = (profit / totalPrice) * 100
		row.MarginAfter = (profitAfter / totalPrice) * 100
	}
	return row
}

// Summary là những con số duy nhất màn hình danh sách bảng giá cần.
// Con trỏ nil nghĩa là "chưa có dữ liệu", khác hẳn 0 — danh sách hiện dấu gạch.
type Summary struct {
	Count     int
	MinPrice  *float64
	MaxPrice  *float64
	AvgMargin *float64
}

// Summarize tổng hợp một bảng tính giá, bỏ qua dữ liệu rác thay vì nổ.
func Summarize(sheet map[string]any) Summary {
	settings, _ := asMap(sheet["settings"])

	var prices, margins []float64
	for _, pt := range asSlice(sheet["productTypes"]) {
		productType, ok := asMap(pt)
		if !ok {
			continue
		}
		for _, sz := range asSlice(productType["sizes"]) {
			size, ok := asMap(sz)
			if !ok {
				continue
			}
			row := ComputeSizeRow(settings, productType, size)
			prices = append(prices, row.TotalPrice)
			// Size chưa có giá vốn vẫn đếm và vẫn góp khoảng giá, nhưng không
			// được vào avg margin.
			if !row.CostUnknown {
				margins = append(margins, row.Margin)
			}
		}
	}

	if len(prices) == 0 {
		return Summary{}
	}

	lo, hi := prices[0], prices[0]
	for _, p := range prices[1:] {
		if p < lo {
			lo = p
		}
		if p > hi {
			hi = p
		}
	}

	out := Summary{Count: len(prices), MinPrice: &lo, MaxPrice: &hi}
	if len(margins) > 0 {
		sum := 0.0
		for _, m := range margins {
			sum += m
		}
		avg := sum / float64(len(margins))
		out.AvgMargin = &avg
	}
	return out
}

// Trần của các cột decimal trong price_sheets — phải khớp migration
// add_summary_columns_to_price_sheets_table.
//
//	min_price / max_price : decimal(14,4) -> 10 chữ số phần nguyên
//	avg_margin            : decimal(12,4) ->  8 chữ số phần nguyên
const (
	maxPriceColumn  = 9999999999.9999
	maxMarginColumn = 99999999.9999
)

// Columns là toàn bộ cột tổng hợp của một bảng, đã chặn tràn.
type Columns struct {
	VendorRef        *string
	SourceFile       *string
	ProductTypeNames []string
	SizeCount        int
	MinPrice         *float64
	MaxPrice         *float64
	AvgMargin        *float64
}

// SummaryColumns gom ba nơi cùng ghi các cột này (upsert, bù dữ liệu khi mở
// danh sách, command backfill) về một hàm, để công thức và việc chặn tràn không
// bao giờ lệch nhau giữa ba nơi.
func SummaryColumns(sheet map[string]any) Columns {
	s := Summarize(sheet)

	cols := Columns{
		VendorRef:        VendorRef(sheet),
		ProductTypeNames: ProductTypeNames(sheet),
		SizeCount:        s.Count,
		MinPrice:         clamp(s.MinPrice, maxPriceColumn),
		MaxPrice:         clamp(s.MaxPrice, maxPriceColumn),
		AvgMargin:        clamp(s.AvgMargin, maxMarginColumn),
	}
	if src, ok := sheet["_sourceFile"].(string); ok {
		cols.SourceFile = &src
	}
	return cols
}

// clamp chặn giá trị trong tầm cột decimal.
//
// Margin = profit / totalPrice × 100, nên Seller gõ nhầm một giá cực nhỏ cạnh
// giá vốn bình thường là ra hàng trăm triệu phần trăm. MySQL bật strict sẽ ném
// 1264 Out of range và mất luôn lần lưu đó. Con số sau khi kẹp cũng vô nghĩa như
// trước khi kẹp, nhưng người dùng giữ được dữ liệu và tự thấy bảng mình có gì sai.
func clamp(value *float64, max float64) *float64 {
	if value == nil || math.IsInf(*value, 0) || math.IsNaN(*value) {
		return nil
	}
	v := math.Max(-max, math.Min(max, *value))
	return &v
}

// VendorRef trả cột Vendor của màn danh sách bảng tính giá.
//
// vendorRef chỉ được đặt một lần lúc tạo bảng, nên bảng tạo từ record thư viện
// chưa tra được ký hiệu vendor sẽ nằm mãi ở dấu gạch. Thiếu thì suy lại từ chính
// các Product Type của bảng, để lần lưu kế tiếp là cột đó đúng.
func VendorRef(sheet map[string]any) *string {
	if explicit := trimSpace(asString(sheet["vendorRef"])); explicit != "" {
		return &explicit
	}

	var codes []string
	seen := map[string]bool{}
	for _, pt := range asSlice(sheet["productTypes"]) {
		productType, ok := asMap(pt)
		if !ok {
			continue
		}
		code := trimSpace(asString(productType["vendorCode"]))
		if code == "" {
			if libRef, ok := asMap(productType["libRef"]); ok {
				code = trimSpace(asString(libRef["vendorCode"]))
			}
		}
		if code != "" && !seen[code] {
			seen[code] = true
			codes = append(codes, code)
		}
	}
	if len(codes) == 0 {
		return nil
	}
	joined := join(codes, ", ")
	return &joined
}

// ProductTypeNames trả tên các Product Type, bỏ tên rỗng và giữ thứ tự.
// Màn danh sách hiện dạng chip và cho tìm kiếm trên các tên này.
func ProductTypeNames(sheet map[string]any) []string {
	names := []string{}
	for _, pt := range asSlice(sheet["productTypes"]) {
		productType, ok := asMap(pt)
		if !ok {
			continue
		}
		if name := trimSpace(asString(productType["name"])); name != "" {
			names = append(names, name)
		}
	}
	return names
}
