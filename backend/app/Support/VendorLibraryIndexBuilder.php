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
    /** Ngưỡng an toàn cho URL ảnh — xem generalInfoOfFile(). */
    private const MAX_IMAGE_URL_LENGTH = 300;

    /**
     * Số ảnh tối đa kèm theo mỗi record. Bảng tính giá hiện dải thông tin phôi
     * y như một dòng của Thư viện Vendor (ảnh, chất liệu, chi tiết size, AVG
     * TG) nên cần nhiều hơn một ảnh — nhưng index vẫn phải GỌN, không cõng cả
     * album (xem test_index_nhe_hon_han_blob_day_du).
     */
    private const MAX_IMAGES_PER_RECORD = 4;

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
     * Danh sách project được chia sẻ TƯỜNG MINH cho file (Vendor/Admin đặt trong
     * hộp thoại Chia sẻ), hoặc null nếu file chưa từng được chia sẻ.
     *
     * Khớp `fileSharedProjects` bên frontend (constants/projects.js).
     */
    public static function fileSharedProjects(array $file): ?array
    {
        $list = $file['projects'] ?? null;
        if (!is_array($list)) {
            return null;
        }

        $ids = [];
        foreach ($list as $id) {
            $id = strtolower(trim((string) $id));
            if ($id !== '') {
                $ids[] = $id;
            }
        }

        return $ids;
    }

    /**
     * File có thuộc phạm vi project của user không.
     *
     * Ưu tiên danh sách chia sẻ tường minh; mảng RỖNG = chia sẻ cho mọi project.
     * File chưa chia sẻ thì giữ NGUYÊN cách cũ là suy theo ký hiệu `P.xxx` trong
     * tên file — nhờ vậy các file đã import từ trước không đổi phạm vi hiển thị.
     * File không suy ra được project → dùng chung (giống frontend).
     */
    public static function fileVisibleToProject(array $file, ?string $projectKey): bool
    {
        if ($projectKey === null || $projectKey === '') {
            return true;
        }

        $matches = static fn (string $id): bool =>
            str_contains($projectKey, $id) || str_contains($id, $projectKey);

        $shared = self::fileSharedProjects($file);
        if ($shared !== null) {
            if ($shared === []) {
                return true;
            }

            foreach ($shared as $id) {
                if ($matches($id)) {
                    return true;
                }
            }

            return false;
        }

        $fileProject = self::fileProject((string) ($file['filename'] ?? ''));

        return $fileProject === null || $matches($fileProject);
    }

    /**
     * Nhãn project của file dùng cho index: chỉ có nghĩa khi file thuộc đúng MỘT
     * project, còn lại null (= dùng chung).
     */
    public static function fileProjectTag(array $file): ?string
    {
        $shared = self::fileSharedProjects($file);
        if ($shared !== null) {
            return count($shared) === 1 ? $shared[0] : null;
        }

        return self::fileProject((string) ($file['filename'] ?? ''));
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
     * liệu, ảnh, chi tiết size, AVG TG. Không phải khoá giá nên KHÔNG cần lọc
     * theo `$seesPrices`.
     *
     * Trả về 2 dạng tra cứu của CÙNG một file:
     *   'byVendor' — theo `kyHieu` VÀ theo `vendorName` (bí danh, vì có file chỉ
     *                điền một trong hai cột); vendor gặp trước thắng, cùng quy
     *                ước "vendor gặp trước" đang dùng ở chỗ khác trong hệ thống;
     *   'rows'     — danh sách phẳng, để suy vendor theo TÊN PHÔI khi phần "Về
     *                giá" không ghi Ký hiệu dòng nào (xem resolveGeneralInfo).
     *
     * @param  array<int,mixed>  $rows  `$file['generalInfo']`
     * @return array{byVendor: array<string,array<string,mixed>>, rows: list<array<string,mixed>>}
     */
    private static function generalInfoOfFile(array $rows): array
    {
        $byVendor = [];
        $list     = [];

        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }

            // Ảnh nhúng qua formula Excel đôi khi là base64/data-URI khổng lồ
            // thay vì một URL bình thường — index GỌN không được cõng nó
            // (đúng mục đích ban đầu "không kèm ảnh/generalInfo" của index này,
            // xem test_index_nhe_hon_han_blob_day_du). URL ảnh thật không bao
            // giờ cần dài quá ngưỡng này.
            $images = [];
            foreach (is_array($row['images'] ?? null) ? $row['images'] : [] as $img) {
                $img = (string) $img;
                if ($img === '' || mb_strlen($img) > self::MAX_IMAGE_URL_LENGTH) {
                    continue;
                }
                $images[] = $img;
                if (count($images) >= self::MAX_IMAGES_PER_RECORD) {
                    break;
                }
            }

            $chiTietSizeImage = (string) ($row['chiTietSizeImage'] ?? '');
            if (mb_strlen($chiTietSizeImage) > self::MAX_IMAGE_URL_LENGTH) {
                $chiTietSizeImage = '';
            }

            $info = [
                'chatLieu'         => (string) ($row['chatLieu'] ?? ''),
                'chiTietSize'      => (string) ($row['chiTietSize'] ?? ''),
                // `image` = ảnh đại diện, GIỮ NGUYÊN cho code cũ đang đọc field
                // này (bảng giá đã lưu, client bản cũ) — `images` là phần thêm.
                'image'            => $images[0] ?? '',
                'images'           => $images,
                'chiTietSizeImage' => $chiTietSizeImage,
                'avgTimeVendor'    => (string) ($row['avgTimeVendor'] ?? ''),
                'avgTimeActual'    => (string) ($row['avgTimeActual'] ?? ''),
            ];

            foreach ([$row['kyHieu'] ?? '', $row['vendorName'] ?? ''] as $alias) {
                $alias = strtolower(trim((string) $alias));
                if ($alias !== '' && !isset($byVendor[$alias])) {
                    $byVendor[$alias] = $info;
                }
            }

            $vendorCode = trim((string) ($row['kyHieu'] ?? ''));
            if ($vendorCode === '') {
                $vendorCode = trim((string) ($row['vendorName'] ?? ''));
            }

            $list[] = [
                'vendorCode'  => $vendorCode,
                'productType' => trim((string) ($row['productType'] ?? '')),
                'info'        => $info,
            ];
        }

        return ['byVendor' => $byVendor, 'rows' => $list];
    }

    /**
     * Info phôi + vendor cho MỘT record của phần "Về giá".
     *
     * Bug thật (2026-09): file HC_Football Jersey_P.Global_16 có đủ thông tin
     * phôi ở Section 1 (vendor CN1, chất liệu, AVG TG), nhưng template phần "Về
     * giá" của file đó KHÔNG có cột Ký hiệu → mọi dòng giá parse ra `kyHieu`
     * rỗng (vendorExcel.js), record trong index không tra được vendor nào, và
     * dải thông tin phôi trên bảng tính giá hiện toàn "—". Suy ngược từ Section 1:
     *   1) khớp thẳng theo Ký hiệu / Vendor Name;
     *   2) chưa khớp → khớp theo TÊN PHÔI nếu Section 1 có ĐÚNG một dòng cùng phôi;
     *   3) vẫn chưa → file chỉ có ĐÚNG một dòng thông tin phôi thì lấy dòng đó.
     * Nhiều dòng mà không dòng nào khớp thì để trống — KHÔNG đoán bừa.
     *
     * `vendorInferred` là nhãn CHỜ, KHÔNG ghi đè `vendorCode`: record vẫn giữ ký
     * hiệu thô (rỗng) để recordKey của bảng đã lưu không đổi, và để bước gộp
     * record vendor trống bên frontend (mergeBlankVendorRecords) còn nhận ra đâu
     * là dòng thiếu vendor. Frontend chốt nhãn sau bước gộp đó.
     *
     * @param  array{byVendor: array<string,array<string,mixed>>, rows: list<array<string,mixed>>}  $general
     * @return array{info: array<string,mixed>, vendorInferred: string}
     */
    private static function resolveGeneralInfo(array $general, string $vendorCode, string $productType): array
    {
        $direct = $general['byVendor'][strtolower($vendorCode)] ?? null;
        if ($direct !== null) {
            return ['info' => $direct, 'vendorInferred' => ''];
        }

        $sameType = array_values(array_filter(
            $general['rows'],
            static fn (array $r) => $r['productType'] !== ''
                && strcasecmp($r['productType'], trim($productType)) === 0
        ));

        $row = count($sameType) === 1
            ? $sameType[0]
            : (count($general['rows']) === 1 ? $general['rows'][0] : null);

        if ($row === null) {
            return ['info' => [], 'vendorInferred' => ''];
        }

        return [
            'info'           => $row['info'],
            'vendorInferred' => $vendorCode === '' ? $row['vendorCode'] : '',
        ];
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
            if (!self::fileVisibleToProject($file, $projectKey)) {
                continue;
            }

            $general = self::generalInfoOfFile(
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
                    $resolved = self::resolveGeneralInfo($general, $vendorCode, $productType);
                    $info     = $resolved['info'];
                    $records[$key] = [
                        'recordKey'     => $key,
                        'productType'   => $productType,
                        'vendorCode'    => $vendorCode,
                        // Vendor suy ra từ Section 1 khi dòng giá không ghi Ký
                        // hiệu — frontend chốt lại sau bước gộp record vendor
                        // trống (applyInferredVendor, vendorLibraryIndex.js).
                        'vendorInferred'   => $resolved['vendorInferred'],
                        'filename'      => $filename,
                        'project'       => self::fileProjectTag($file),
                        'sizes'         => [],
                        'chatLieu'         => $info['chatLieu'] ?? '',
                        'chiTietSize'      => $info['chiTietSize'] ?? '',
                        'image'            => $info['image'] ?? '',
                        'images'           => $info['images'] ?? [],
                        'chiTietSizeImage' => $info['chiTietSizeImage'] ?? '',
                        'avgTimeVendor'    => $info['avgTimeVendor'] ?? '',
                        'avgTimeActual'    => $info['avgTimeActual'] ?? '',
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
