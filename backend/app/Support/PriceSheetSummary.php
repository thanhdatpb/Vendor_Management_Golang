<?php

namespace App\Support;

/**
 * Bản port PHP của frontend/src/utils/pricingEngine.js.
 *
 * Lý do tồn tại: màn hình danh sách bảng tính giá chỉ cần vài con số tổng hợp
 * (số size, khoảng giá, avg margin). Trước đây server trả nguyên cột `data`
 * (settings + productTypes + 20 bản history) rồi frontend mới tự tính — payload
 * phình theo số lần bấm Lưu chứ không theo dữ liệu thật. Tính sẵn ở server cho
 * phép `GET /price-sheets` chỉ trả các cột tổng hợp.
 *
 * ⚠ Công thức PHẢI khớp từng ký tự với `computeSizeRow`/`summarizeSheet` bên JS
 * (bản chỉnh Luận Nguyễn 2026-07-16). Test đối chiếu: tests/Unit/PriceSheetSummaryTest.php
 * dùng cùng bộ số với src/utils/__tests__/pricingEngine.golden.test.js.
 */
final class PriceSheetSummary
{
    /**
     * Tương đương `num()` bên JS: parseFloat sau khi đổi dấu phẩy thập phân đầu
     * tiên thành dấu chấm và bỏ mọi ký tự không phải số.
     */
    public static function num($value): float
    {
        if ($value === null || $value === '' || is_bool($value) || is_array($value)) {
            return 0.0;
        }
        if (is_int($value) || is_float($value)) {
            return is_finite((float) $value) ? (float) $value : 0.0;
        }

        $text = preg_replace('/,/', '.', (string) $value, 1);
        $text = preg_replace('/[^\d.\-]/', '', $text);

        // (float) của PHP cắt phần đuôi không hợp lệ giống parseFloat của JS.
        $parsed = (float) $text;

        return is_finite($parsed) ? $parsed : 0.0;
    }

    /**
     * Tính một dòng size. Giữ nguyên thứ tự phép tính của JS để tránh lệch số
     * do dấu phẩy động.
     *
     * @param  array<string,mixed>  $settings
     * @param  array<string,mixed>  $productType
     * @param  array<string,mixed>  $size
     * @return array<string,float>
     */
    public static function computeSizeRow(array $settings, array $productType, array $size): array
    {
        $price        = self::num($settings['price'] ?? null);
        $shipPerItem  = self::num($settings['shipPerItem'] ?? null);
        $shipPerOrder = self::num($settings['shipPerOrder'] ?? null);
        $importTax    = self::num($settings['importTax'] ?? null);
        $phoi         = self::num($productType['phoi'] ?? null);
        $sizeAdd      = self::num($size['sizeAdd'] ?? null);
        $itemCost     = self::num($size['itemCost'] ?? null);

        $qtyRaw = self::num($settings['quantity'] ?? null);
        $qty    = $qtyRaw > 0 ? $qtyRaw : 1.0;

        $customizeSum = 0.0;
        foreach (($productType['customizeInfos'] ?? []) as $info) {
            $id = $info['id'] ?? null;
            $customizeSum += self::num($id === null ? null : ($size['customize'][$id] ?? null));
        }

        $unitPrice  = $price + $phoi + $sizeAdd + $customizeSum;
        $goodsAmt   = $unitPrice * $qty;
        $totalPrice = ($unitPrice + $shipPerItem) * $qty + $shipPerOrder;

        $couponAmt   = self::num($settings['couponUsd'] ?? null)
            + (self::num($settings['couponPct'] ?? null) / 100) * $goodsAmt;
        $amzFee      = (self::num($settings['amzFeePct'] ?? null) / 100) * ($totalPrice - $couponAmt);
        $variableFee = (self::num($settings['variableFeePct'] ?? null) / 100) * ($unitPrice * $qty - $couponAmt);

        $isLib         = !empty($size['isLib']);
        $shipCostItem  = $isLib ? self::num($size['shipCostItem'] ?? null) : $shipPerItem;
        $totalShipCost = $isLib ? self::num($size['totalShipCost'] ?? null) : $shipPerOrder;

        $totalCost = ($itemCost + $shipCostItem + $importTax) * $qty + ($totalShipCost - $shipCostItem);

        $profit      = $totalPrice - $amzFee - $totalCost;
        $profitAfter = $totalPrice - $amzFee - $variableFee - $couponAmt - $totalCost;

        return [
            'qty'         => $qty,
            'unitPrice'   => $unitPrice,
            'totalPrice'  => $totalPrice,
            'couponAmt'   => $couponAmt,
            'amzFee'      => $amzFee,
            'variableFee' => $variableFee,
            'totalCost'   => $totalCost,
            'profit'      => $profit,
            'profitAfter' => $profitAfter,
            'margin'      => $totalPrice ? ($profit / $totalPrice) * 100 : 0.0,
            'marginAfter' => $totalPrice ? ($profitAfter / $totalPrice) * 100 : 0.0,
        ];
    }

    /**
     * Tổng hợp một bảng tính giá — đúng những gì màn hình danh sách cần.
     *
     * @param  array<string,mixed>  $sheet
     * @return array{count:int,minPrice:?float,maxPrice:?float,avgMargin:?float}
     */
    public static function summarize(array $sheet): array
    {
        $settings = is_array($sheet['settings'] ?? null) ? $sheet['settings'] : [];

        $prices  = [];
        $margins = [];
        foreach (($sheet['productTypes'] ?? []) as $productType) {
            if (!is_array($productType)) {
                continue;
            }
            foreach (($productType['sizes'] ?? []) as $size) {
                if (!is_array($size)) {
                    continue;
                }
                $row       = self::computeSizeRow($settings, $productType, $size);
                $prices[]  = $row['totalPrice'];
                $margins[] = $row['margin'];
            }
        }

        if ($prices === []) {
            return ['count' => 0, 'minPrice' => null, 'maxPrice' => null, 'avgMargin' => null];
        }

        return [
            'count'     => count($prices),
            'minPrice'  => min($prices),
            'maxPrice'  => max($prices),
            'avgMargin' => array_sum($margins) / count($margins),
        ];
    }

    /**
     * Trần của các cột decimal trong `price_sheets` — phải khớp migration
     * `add_summary_columns_to_price_sheets_table`.
     *   min_price / max_price : decimal(14,4) → 10 chữ số phần nguyên
     *   avg_margin            : decimal(12,4) →  8 chữ số phần nguyên
     */
    private const MAX_PRICE  = 9999999999.9999;
    private const MAX_MARGIN = 99999999.9999;

    /**
     * Toàn bộ cột tổng hợp của một bảng, đã chặn tràn.
     *
     * Ba nơi cùng ghi các cột này (upsert, bù dữ liệu khi mở danh sách, và
     * command backfill). Gom về một hàm để công thức và việc chặn tràn không
     * bao giờ lệch nhau giữa ba nơi.
     *
     * @param  array<string,mixed>  $sheet
     * @return array<string,mixed>
     */
    public static function summaryColumns(array $sheet): array
    {
        $summary = self::summarize($sheet);

        return [
            'vendor_ref'         => self::vendorRef($sheet),
            'source_file'        => $sheet['_sourceFile'] ?? null,
            'product_type_names' => json_encode(self::productTypeNames($sheet), JSON_UNESCAPED_UNICODE),
            'size_count'         => $summary['count'],
            'min_price'          => self::clamp($summary['minPrice'], self::MAX_PRICE),
            'max_price'          => self::clamp($summary['maxPrice'], self::MAX_PRICE),
            'avg_margin'         => self::clamp($summary['avgMargin'], self::MAX_MARGIN),
        ];
    }

    /**
     * Chặn giá trị trong tầm cột decimal.
     *
     * Margin = profit / totalPrice × 100. Seller gõ nhầm một giá cực nhỏ (vd
     * 0.0001) cạnh giá vốn bình thường là margin ra hàng trăm triệu phần trăm.
     * MySQL bật `strict` sẽ ném `1264 Out of range` → mất luôn lần lưu đó.
     * Con số sau khi kẹp cũng vô nghĩa như con số trước khi kẹp, nhưng người
     * dùng giữ được dữ liệu và tự thấy bảng của mình có gì đó sai.
     */
    private static function clamp(?float $value, float $max): ?float
    {
        if ($value === null || !is_finite($value)) {
            return null;
        }

        return max(-$max, min($max, $value));
    }

    /**
     * Tên các Product Type — màn hình danh sách hiện dạng chip và cho tìm kiếm,
     * nên vẫn phải có dù không trả nguyên `productTypes`.
     *
     * @param  array<string,mixed>  $sheet
     * @return list<string>
     */
    /**
     * Vendor của bảng — cột "Vendor" ở màn danh sách bảng tính giá.
     *
     * `vendorRef` chỉ được đặt MỘT LẦN lúc tạo bảng (CreateSheetModal), nên bảng
     * tạo từ record thư viện chưa tra được ký hiệu vendor (dòng "Về giá" thiếu
     * cột Ký hiệu — xem VendorLibraryIndexBuilder::resolveGeneralInfo) nằm mãi ở
     * "—" dù thư viện đã nhận ra vendor. Thiếu thì suy lại từ chính các Product
     * Type của bảng, để lần lưu kế tiếp là cột đó đúng.
     *
     * @param  array<string,mixed>  $sheet
     */
    public static function vendorRef(array $sheet): ?string
    {
        $explicit = trim((string) ($sheet['vendorRef'] ?? ''));
        if ($explicit !== '') {
            return $explicit;
        }

        $codes = [];
        foreach (($sheet['productTypes'] ?? []) as $productType) {
            if (!is_array($productType)) {
                continue;
            }
            $code = trim((string) ($productType['vendorCode'] ?? ''));
            if ($code === '' && is_array($productType['libRef'] ?? null)) {
                $code = trim((string) ($productType['libRef']['vendorCode'] ?? ''));
            }
            if ($code !== '' && !in_array($code, $codes, true)) {
                $codes[] = $code;
            }
        }

        return $codes === [] ? null : implode(', ', $codes);
    }

    public static function productTypeNames(array $sheet): array
    {
        $names = [];
        foreach (($sheet['productTypes'] ?? []) as $productType) {
            if (!is_array($productType)) {
                continue;
            }
            $name = trim((string) ($productType['name'] ?? ''));
            if ($name !== '') {
                $names[] = $name;
            }
        }

        return $names;
    }
}
