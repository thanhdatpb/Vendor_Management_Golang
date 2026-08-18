<?php

namespace Tests\Unit;

use App\Support\PriceSheetSummary;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;

/**
 * Mục 17 — server tính sẵn số tổng hợp cho danh sách bảng tính giá.
 *
 * Đây là lưới an toàn quan trọng nhất của PR: nếu bản port PHP lệch khỏi
 * `pricingEngine.js` thì danh sách sẽ hiện những con số KHÁC với con số trong
 * workspace, mà không ai báo lỗi.
 *
 * Các giá trị kỳ vọng dưới đây được sinh ra bằng cách chạy thẳng
 * `computeSizeRow`/`summarizeSheet` của frontend trên đúng bộ dữ liệu này
 * (node, 2026-08-13) — KHÔNG tính tay. Test đỏ nghĩa là hai bên đã lệch nhau.
 */
#[Group('milestone-d')]
class PriceSheetSummaryTest extends TestCase
{
    /** Khớp `num()` của pricingEngine.js, kể cả các ca đầu vào bẩn. */
    public function test_num_khop_voi_ham_num_ben_javascript(): void
    {
        $this->assertSame(0.0, PriceSheetSummary::num(null));
        $this->assertSame(0.0, PriceSheetSummary::num(''));
        $this->assertSame(0.0, PriceSheetSummary::num('abc'));
        $this->assertSame(12.5, PriceSheetSummary::num('$12.50'));
        // Người dùng Việt gõ dấu phẩy thập phân — chỉ dấu phẩy ĐẦU TIÊN được đổi.
        $this->assertSame(13.2, PriceSheetSummary::num('13,2'));
        $this->assertSame(-5.0, PriceSheetSummary::num('-5'));
        // parseFloat cắt phần đuôi không hợp lệ thay vì trả NaN.
        $this->assertSame(1.2, PriceSheetSummary::num('1.2.3'));
        $this->assertSame(7.0, PriceSheetSummary::num(7));
    }

    public function test_compute_size_row_khop_tung_con_so_voi_pricing_engine(): void
    {
        $settings    = $this->settings();
        $productType = $this->productTypeWithCustomize();

        $this->assertRow($settings, $productType, $productType['sizes'][0], [
            'qty'         => 2.0,
            'unitPrice'   => 24.75,
            'totalPrice'  => 57.5,
            'couponAmt'   => 6.95,
            'amzFee'      => 8.5935,
            'variableFee' => 1.2765,
            'totalCost'   => 20.3,
            'profit'      => 28.6065,
            'profitAfter' => 20.38,
            'margin'      => 49.7504347826,
        ]);

        // Size lấy từ thư viện: ship phía CHI PHÍ đọc từ record, không dùng
        // Ship/Item + Ship/Order của Price Setting.
        $this->assertRow($settings, $productType, $productType['sizes'][1], [
            'qty'         => 2.0,
            'unitPrice'   => 25.75,
            'totalPrice'  => 59.5,
            'couponAmt'   => 7.15,
            'amzFee'      => 8.8995,
            'variableFee' => 1.3305,
            'totalCost'   => 19.8,
            'profit'      => 30.8005,
            'profitAfter' => 22.32,
            'margin'      => 51.7655462185,
        ]);
    }

    /** Bản chỉnh Luận Nguyễn 2026-07-16: Variable Fee ≠ 0 kể cả khi coupon = 0. */
    public function test_variable_fee_khac_khong_khi_khong_co_coupon(): void
    {
        $settings = array_merge($this->settings(), ['couponUsd' => 0, 'couponPct' => 0]);
        $row      = PriceSheetSummary::computeSizeRow(
            $settings,
            $this->productTypeWithCustomize(),
            $this->productTypeWithCustomize()['sizes'][0]
        );

        $this->assertSame(0.0, round($row['couponAmt'], 10));
        $this->assertGreaterThan(0, $row['variableFee']);
        // Var% × (Unit × qty − 0) = 3% × 24.75 × 2
        $this->assertSame(1.485, round($row['variableFee'], 10));
    }

    /** Quantity trống / ≤ 0 → coi như 1, không zero-hoá cả bảng. */
    public function test_quantity_trong_duoc_coi_la_mot(): void
    {
        $productType = $this->productTypeWithCustomize();

        foreach ([null, '', 0, -3] as $quantity) {
            $row = PriceSheetSummary::computeSizeRow(
                array_merge($this->settings(), ['quantity' => $quantity]),
                $productType,
                $productType['sizes'][0]
            );

            $this->assertSame(1.0, $row['qty'], 'quantity=' . var_export($quantity, true));
        }
    }

    public function test_summarize_tra_dung_so_size_khoang_gia_va_avg_margin(): void
    {
        $summary = PriceSheetSummary::summarize($this->sheet());

        $this->assertSame(3, $summary['count']);
        $this->assertSame(48.0, round($summary['minPrice'], 10));
        $this->assertSame(59.5, round($summary['maxPrice'], 10));
        $this->assertSame(57.1442158893, round($summary['avgMargin'], 10));
    }

    public function test_summarize_bang_rong_tra_null_thay_vi_zero(): void
    {
        $summary = PriceSheetSummary::summarize(['settings' => [], 'productTypes' => []]);

        $this->assertSame(0, $summary['count']);
        $this->assertNull($summary['minPrice']);
        $this->assertNull($summary['maxPrice']);
        // 0% và "chưa có dữ liệu" là hai chuyện khác nhau — danh sách hiện "—".
        $this->assertNull($summary['avgMargin']);
    }

    public function test_summarize_bo_qua_du_lieu_rac_thay_vi_no(): void
    {
        $sheet = [
            'settings'     => $this->settings(),
            'productTypes' => ['không phải mảng', ['sizes' => ['rác', ['label' => 'M', 'sizeAdd' => 1]]]],
        ];

        $summary = PriceSheetSummary::summarize($sheet);

        $this->assertSame(1, $summary['count']);
    }

    public function test_product_type_names_bo_ten_rong_va_giu_thu_tu(): void
    {
        $names = PriceSheetSummary::productTypeNames($this->sheet());

        $this->assertSame(['Legend Shirt', 'Night Light'], $names);
    }

    /**
     * Cột `avg_margin` là decimal(12,4). Margin = profit / totalPrice × 100, nên
     * Seller gõ nhầm một giá cực nhỏ là ra hàng trăm triệu phần trăm — MySQL bật
     * `strict` sẽ ném `1264 Out of range` và MẤT LUÔN lần lưu đó.
     *
     * SQLite bỏ qua độ chính xác của decimal nên test tích hợp không thấy gì.
     */
    public function test_margin_khong_lam_tran_cot_decimal(): void
    {
        $sheet = [
            // totalPrice = 0.0001, giá vốn 1000 → margin khoảng -1 tỷ %.
            'settings'     => ['price' => 0.0001, 'quantity' => 1, 'amzFeePct' => 0],
            'productTypes' => [[
                'id' => 'pt1', 'name' => 'Loi go nham', 'customizeInfos' => [],
                'sizes' => [['id' => 'sz1', 'label' => 'S', 'sizeAdd' => 0, 'itemCost' => 1000]],
            ]],
        ];

        $raw = PriceSheetSummary::summarize($sheet);
        $this->assertLessThan(-99999999.9999, $raw['avgMargin'], 'ca thử phải thực sự vượt tầm cột');

        $columns = PriceSheetSummary::summaryColumns($sheet);
        $this->assertSame(-99999999.9999, $columns['avg_margin']);
        $this->assertLessThanOrEqual(8, strlen((string) (int) abs($columns['avg_margin'])));
    }

    public function test_summary_columns_giu_dung_so_khi_khong_tran(): void
    {
        $columns = PriceSheetSummary::summaryColumns($this->sheet());

        $this->assertSame(3, $columns['size_count']);
        $this->assertSame(48.0, round($columns['min_price'], 10));
        $this->assertSame(59.5, round($columns['max_price'], 10));
        $this->assertSame(57.1442158893, round($columns['avg_margin'], 10));
        $this->assertSame(['Legend Shirt', 'Night Light'], json_decode($columns['product_type_names'], true));
    }

    public function test_summary_columns_bang_rong_tra_null(): void
    {
        $columns = PriceSheetSummary::summaryColumns(['settings' => [], 'productTypes' => []]);

        $this->assertSame(0, $columns['size_count']);
        $this->assertNull($columns['min_price']);
        $this->assertNull($columns['avg_margin']);
        $this->assertSame([], json_decode($columns['product_type_names'], true));
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** @param array<string,float> $expected */
    private function assertRow(array $settings, array $productType, array $size, array $expected): array
    {
        $row = PriceSheetSummary::computeSizeRow($settings, $productType, $size);

        foreach ($expected as $field => $value) {
            $this->assertSame($value, round($row[$field], 10), "trường {$field}");
        }

        return $row;
    }

    /** @return array<string,mixed> */
    private function settings(): array
    {
        return [
            'price'          => 20,
            'quantity'       => 2,
            'shipPerOrder'   => 5,
            'shipPerItem'    => 1.5,
            'couponUsd'      => 2,
            'couponPct'      => 10,
            'variableFeePct' => 3,
            'amzFeePct'      => 17,
            'importTax'      => 0.4,
        ];
    }

    /** @return array<string,mixed> */
    private function productTypeWithCustomize(): array
    {
        return [
            'id'             => 'pt1',
            'name'           => 'Legend Shirt',
            'phoi'           => 1.25,
            'customizeInfos' => [['id' => 'ci1', 'name' => 'Logo'], ['id' => 'ci2', 'name' => 'Box']],
            'sizes'          => [
                ['id' => 's1', 'label' => 'M', 'sizeAdd' => 2, 'itemCost' => 6.5, 'customize' => ['ci1' => 1, 'ci2' => 0.5]],
                // sizeAdd gõ dấu phẩy — đúng cách người dùng nhập trong sheet thật.
                ['id' => 's2', 'label' => 'L', 'sizeAdd' => '3,5', 'itemCost' => 7, 'customize' => ['ci1' => 1],
                 'isLib' => true, 'shipCostItem' => 0.8, 'totalShipCost' => 4.2],
            ],
        ];
    }

    /** @return array<string,mixed> */
    private function sheet(): array
    {
        return [
            'id'           => 'sheet_x',
            'name'         => 'X',
            'settings'     => $this->settings(),
            'productTypes' => [
                $this->productTypeWithCustomize(),
                [
                    'id'             => 'pt2',
                    'name'           => 'Night Light',
                    'phoi'           => '',
                    'customizeInfos' => [],
                    'sizes'          => [['id' => 's3', 'label' => 'S', 'sizeAdd' => '', 'itemCost' => '']],
                ],
            ],
        ];
    }
}
