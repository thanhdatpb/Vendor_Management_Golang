<?php

namespace App\Support;

/**
 * Rút blob `vendor_library` thành INDEX gọn cho bảng tính giá.
 *
 * Blob thư viện là một longText cho toàn hệ thống (ảnh, notes, link folder,
 * generalInfo…). Mỗi lần Seller mở một bảng giá là một lần tải NGUYÊN blob về
 * chỉ để lấy danh sách size + giá vốn. Index này trả đúng phần cần dùng:
 * record (vendor × product type) → các size kèm vài cột giá.
 *
 * Đây cũng là chỗ thực thi phân quyền giá: role không được xem giá thì các khoá
 * giá bị loại NGAY Ở ĐÂY, không đi ra khỏi server (xem VendorFieldVisibility).
 */
final class VendorLibraryIndexBuilder
{
    /**
     * Suy ra project từ tên file — khớp `extractFileProject` bên frontend.
     */
    public static function fileProject(?string $filename): ?string
    {
        if (!$filename) {
            return null;
        }

        $name = strtolower($filename);
        foreach (['hapify84' => 'p.hapify84', 'happy' => 'p.happy', 'creative' => 'p.creative', 'global' => 'p.global'] as $project => $needle) {
            if (str_contains($name, $needle)) {
                return $project;
            }
        }

        return null;
    }

    /**
     * File có thuộc phạm vi project của user không.
     * File không suy ra được project → dùng chung (giống frontend).
     */
    public static function fileInProject(?string $filename, ?string $projectKey): bool
    {
        if ($projectKey === null || $projectKey === '') {
            return true;
        }

        $fileProject = self::fileProject($filename);
        if ($fileProject === null) {
            return true;
        }

        return str_contains($projectKey, $fileProject) || str_contains($fileProject, $projectKey);
    }

    /**
     * Khoá định danh record theo (file, vendor, product type) — ổn định giữa các
     * lần import nếu 3 thành phần không đổi. Cho phép 2 vendor cùng tên phôi tồn
     * tại song song thay vì đè nhau.
     */
    public static function recordKey(string $filename, string $vendorCode, string $productType): string
    {
        $parts = array_map(
            static fn ($p) => strtolower(trim($p)),
            [$filename, $vendorCode, $productType]
        );

        return substr(sha1(implode('|', $parts)), 0, 16);
    }

    /**
     * Thông tin phôi (mục 02, không phải giá) từ Section 1 của Excel — chất
     * liệu, ảnh đầu tiên, chi tiết size, AVG TG — gom theo `kyHieu` (vendor gặp
     * trước thắng, cùng quy ước "vendor gặp trước" đang dùng ở chỗ khác trong
     * hệ thống). Không phải khoá giá nên KHÔNG cần lọc theo `$seesPrices`.
     *
     * @param  array<int,mixed>  $rows  `$file['generalInfo']`
     * @return array<string,array<string,string>>  kyHieu (lowercase) → info
     */
    private static function indexGeneralInfoByVendor(array $rows): array
    {
        $byVendor = [];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            $vendorCode = strtolower(trim((string) ($row['kyHieu'] ?? '')));
            if ($vendorCode === '' || isset($byVendor[$vendorCode])) {
                continue;
            }

            $images = is_array($row['images'] ?? null) ? $row['images'] : [];

            $byVendor[$vendorCode] = [
                'chatLieu'      => (string) ($row['chatLieu'] ?? ''),
                'chiTietSize'   => (string) ($row['chiTietSize'] ?? ''),
                'image'         => (string) ($images[0] ?? ''),
                'avgTimeVendor' => (string) ($row['avgTimeVendor'] ?? ''),
                'avgTimeActual' => (string) ($row['avgTimeActual'] ?? ''),
            ];
        }

        return $byVendor;
    }

    /**
     * @param  array<int,mixed>  $files  blob thư viện đã json_decode
     * @return list<array<string,mixed>>
     */
    public static function build(array $files, ?string $projectKey, bool $seesPrices): array
    {
        $sizeFields = $seesPrices
            ? array_merge(VendorFieldVisibility::SIZE_BASE_FIELDS, VendorFieldVisibility::PRICE_FIELDS)
            : VendorFieldVisibility::SIZE_BASE_FIELDS;

        $records = [];

        foreach ($files as $file) {
            if (!is_array($file)) {
                continue;
            }

            $filename = (string) ($file['filename'] ?? '');
            if (!self::fileInProject($filename, $projectKey)) {
                continue;
            }

            $generalByVendor = self::indexGeneralInfoByVendor(
                is_array($file['generalInfo'] ?? null) ? $file['generalInfo'] : []
            );

            $pricing = is_array($file['pricing'] ?? null) ? $file['pricing'] : [];
            foreach ($pricing as $row) {
                if (!is_array($row)) {
                    continue;
                }

                $productType = trim((string) ($row['productType'] ?? ''));
                if ($productType === '') {
                    continue;
                }

                $vendorCode = trim((string) ($row['kyHieu'] ?? ''));
                $key        = self::recordKey($filename, $vendorCode, $productType);

                if (!isset($records[$key])) {
                    $general = $generalByVendor[strtolower($vendorCode)] ?? [];
                    $records[$key] = [
                        'recordKey'     => $key,
                        'productType'   => $productType,
                        'vendorCode'    => $vendorCode,
                        'filename'      => $filename,
                        'project'       => self::fileProject($filename),
                        'sizes'         => [],
                        'chatLieu'      => $general['chatLieu'] ?? '',
                        'chiTietSize'   => $general['chiTietSize'] ?? '',
                        'image'         => $general['image'] ?? '',
                        'avgTimeVendor' => $general['avgTimeVendor'] ?? '',
                        'avgTimeActual' => $general['avgTimeActual'] ?? '',
                    ];
                }

                $sizeLabel = trim((string) ($row['size'] ?? ''));
                if ($sizeLabel === '' || $sizeLabel === 'N/A') {
                    continue;
                }

                // Size trùng trong cùng record: bản đầu tiên thắng (giống frontend).
                foreach ($records[$key]['sizes'] as $existing) {
                    if (strcasecmp($existing['size'], $sizeLabel) === 0) {
                        continue 2;
                    }
                }

                $size = ['size' => $sizeLabel];
                foreach ($sizeFields as $field) {
                    if ($field === 'size') {
                        continue;
                    }
                    if (array_key_exists($field, $row) && $row[$field] !== null && $row[$field] !== '') {
                        $size[$field] = $row[$field];
                    }
                }

                $records[$key]['sizes'][] = $size;
            }
        }

        // Record không có size nào thì bảng tính giá không dùng được → bỏ.
        return array_values(array_filter(
            $records,
            static fn (array $record) => $record['sizes'] !== []
        ));
    }
}
