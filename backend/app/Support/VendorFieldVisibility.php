<?php

namespace App\Support;

/**
 * MỘT CHỖ DUY NHẤT quyết định role nào được thấy trường giá của Thư viện Vendor.
 *
 * Trước đây quy tắc này nằm rải rác trong 2 component viewer ở frontend
 * (VendorLibraryViewer + VendorLibraryCsfPdViewer), mỗi lần đổi phân quyền phải
 * sửa 2 nơi và dễ sót — đó chính là cách lỗi rò rỉ giá phát sinh. Server phải là
 * nơi thực thi, không phải chỗ ẩn cột trên UI.
 *
 * Bản song sinh phía frontend: frontend/src/constants/vendorFieldVisibility.js
 * (chỉ để dựng cột — nguồn sự thật về BẢO MẬT là file này).
 */
final class VendorFieldVisibility
{
    /**
     * Role được phép nhận trường giá. Danh sách CHO PHÉP (không phải danh sách
     * cấm): role lạ / chưa khai báo mặc định KHÔNG thấy giá.
     */
    public const PRICE_ROLES = ['admin', 'seller', 'vendor', 'staffa', 'staffb'];

    /**
     * Mọi khoá mang tiền trong một dòng "Về giá" của thư viện.
     * Thêm phương thức ship mới → thêm khoá vào đây, không thêm chỗ nào khác.
     */
    public const PRICE_FIELDS = [
        'pricing1',
        'pricing2',
        'eco_price',
        'eco_total',
        'eco_price_item2',
        'ground_price',
        'ground_total',
        'ground_price_item2',
        'express_price',
        'express_total',
        'express_price_item2',
        'twoday_price',
        'twoday_total',
        'twoday_price_item2',
        'overnight_price',
        'overnight_total',
        'overnight_price_item2',
        'fast_price',
        'fast_total',
        'fast_price_item2',
        'targetCost',
        'target_cost',
        'economyPrice',
        'economy_price',
        'totalPrice',
        'total_price',
        'itemCost',
        'item_cost',
        'unitPrice',
        'unit_price',
    ];

    /**
     * Thời gian sản xuất / vận chuyển trung bình của phôi — 2 cột "AVG TG".
     *
     * CSF VẪN xem được (họ cần để trả lời khách hàng về thời gian giao).
     * PD và Marvel thì không.
     */
    public const LEAD_TIME_FIELDS = ['avgTimeVendor', 'avgTimeActual'];

    /**
     * Role được xem 2 cột thời gian. Cũng là danh sách CHO PHÉP: role lạ mặc
     * định KHÔNG thấy, giống quy tắc của giá.
     */
    public const LEAD_TIME_ROLES = ['admin', 'seller', 'vendor', 'staffa', 'staffb', 'csf'];

    /** Các trường phi giá mà bảng tính giá cần cho mỗi dòng size. */
    public const SIZE_BASE_FIELDS = ['size', 'optional'];

    /** Chuẩn hoá role: bỏ dấu _/-/space, chữ thường (khớp _getUserProjectKey của frontend). */
    public static function normalizeRole($role): string
    {
        return strtolower(preg_replace('/[_\-\s]/', '', (string) $role));
    }

    public static function seesPrices($role): bool
    {
        return in_array(self::normalizeRole($role), self::PRICE_ROLES, true);
    }

    /**
     * Danh sách khoá được phép xuất hiện trong một dòng size trả về cho role này.
     *
     * @return list<string>
     */
    public static function visibleSizeFields($role): array
    {
        return self::seesPrices($role)
            ? array_merge(self::SIZE_BASE_FIELDS, self::PRICE_FIELDS)
            : self::SIZE_BASE_FIELDS;
    }

    public static function seesLeadTime($role): bool
    {
        return in_array(self::normalizeRole($role), self::LEAD_TIME_ROLES, true);
    }

    /**
     * Bỏ 2 cột thời gian khỏi mảng `generalInfo` của một file thư viện.
     * Trả về chính mảng đầu vào nếu role được phép xem — không tốn công sao chép.
     *
     * @param  array<int,mixed>  $files  blob thư viện đã json_decode
     * @return array<int,mixed>
     */
    public static function filterLeadTime(array $files, $role): array
    {
        if (self::seesLeadTime($role)) {
            return $files;
        }

        foreach ($files as &$file) {
            if (!is_array($file) || !is_array($file['generalInfo'] ?? null)) {
                continue;
            }
            foreach ($file['generalInfo'] as &$row) {
                if (is_array($row)) {
                    foreach (self::LEAD_TIME_FIELDS as $field) {
                        unset($row[$field]);
                    }
                }
            }
            unset($row);
        }
        unset($file);

        return $files;
    }

    /**
     * Bỏ mọi khoá giá khỏi CẢ blob thư viện.
     *
     * Bản nhiều-file của `filterFilePrices`, dùng cho `getLibrary` — đường vào
     * cũ và nặng nhất của thư viện. Trước đây chỗ đó chỉ lọc 2 cột thời gian,
     * nên CSF/PD/Marvel vẫn nhận đủ 30 khoá giá và frontend mới giấu đi ở tầng
     * render; CLAUDE.md §6.5 nói rõ giá không được có mặt trong response.
     *
     * Trả về chính mảng đầu vào nếu role được xem giá — không tốn công sao chép,
     * giống cách `filterLeadTime` làm.
     *
     * @param  array<int,mixed>  $files  blob thư viện đã json_decode
     * @return array<int,mixed>
     */
    public static function filterPrices(array $files, $role): array
    {
        if (self::seesPrices($role)) {
            return $files;
        }

        foreach ($files as &$file) {
            if (is_array($file)) {
                $file = self::filterFilePrices($file, $role);
            }
        }
        unset($file);

        return $files;
    }

    /**
     * Bỏ mọi khoá giá khỏi MỘT file thư viện (cả `pricing` lẫn `generalInfo`).
     *
     * Dùng cho endpoint trả một file theo id: đó là đường MỚI vào cùng dữ liệu
     * mà `getLibrary` đang phục vụ, nên nó phải tự lọc chứ không được trông chờ
     * UI giấu cột — nếu không sẽ thành lỗ thủng thứ hai bên cạnh `getLibrary`
     * (xem tests/Feature/VendorLibraryPriceLeakTest.php, nhóm pending).
     *
     * Các khoá phi giá của dòng `pricing` (kyHieu, productType, size,
     * linkTemplate) được GIỮ: giao diện CSF/PD/Marvel dựa vào chúng để suy ra
     * Link Template cho từng phôi.
     *
     * @param  array<string,mixed>  $file
     * @return array<string,mixed>
     */
    public static function filterFilePrices(array $file, $role): array
    {
        if (self::seesPrices($role)) {
            return $file;
        }

        foreach (['pricing', 'generalInfo'] as $section) {
            if (!is_array($file[$section] ?? null)) {
                continue;
            }
            foreach ($file[$section] as &$row) {
                if (!is_array($row)) {
                    continue;
                }
                foreach (self::PRICE_FIELDS as $field) {
                    unset($row[$field]);
                }
            }
            unset($row);
        }

        return $file;
    }

    /**
     * Lọc một dòng dữ liệu về đúng các khoá role được thấy.
     *
     * @param  array<string,mixed>  $row
     * @return array<string,mixed>
     */
    public static function filterRow(array $row, $role): array
    {
        if (self::seesPrices($role)) {
            return $row;
        }

        return array_diff_key($row, array_flip(self::PRICE_FIELDS));
    }
}
