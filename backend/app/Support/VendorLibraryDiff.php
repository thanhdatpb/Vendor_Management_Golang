<?php

namespace App\Support;

/**
 * So sánh 2 bản thư viện Vendor (blob trước/sau khi ghi) để biết CHÍNH XÁC
 * file nào đổi, đổi gì — phục vụ nội dung thông báo `library_updated`.
 *
 * `saveLibrary()` nhận nguyên blob JSON rồi ghi đè, nên server không tự biết
 * file nào vừa đổi trừ khi so sánh thủ công trước/sau như lớp này làm.
 *
 * Thuần logic, không đụng DB/Eloquent — dễ test độc lập.
 */
final class VendorLibraryDiff
{
    /**
     * @param  array<int,mixed>  $oldFiles  blob cũ đã json_decode (mảng rỗng nếu lần đầu import)
     * @param  array<int,mixed>  $newFiles  blob mới đã json_decode
     * @return list<array{filename:string,newProductTypes:list<string>,updatedRows:int,file:array}>
     */
    public static function changedFiles(array $oldFiles, array $newFiles): array
    {
        $oldByName = self::indexByFilename($oldFiles);
        $changed = [];

        foreach ($newFiles as $file) {
            if (!is_array($file)) {
                continue;
            }
            $filename = trim((string) ($file['filename'] ?? ''));
            if ($filename === '') {
                continue;
            }

            $oldFile = $oldByName[$filename] ?? null;
            $diff = self::diffOneFile(is_array($oldFile) ? $oldFile : null, $file);

            if (!empty($diff['newProductTypes']) || $diff['updatedRows'] > 0) {
                $changed[] = [
                    'filename'        => $filename,
                    'newProductTypes' => $diff['newProductTypes'],
                    'updatedRows'     => $diff['updatedRows'],
                    'file'            => $file,
                ];
            }
        }

        return $changed;
    }

    /** @return array<string,array> filename => file object (bỏ file thiếu tên / không phải mảng) */
    private static function indexByFilename(array $files): array
    {
        $map = [];
        foreach ($files as $file) {
            if (is_array($file)) {
                $name = trim((string) ($file['filename'] ?? ''));
                if ($name !== '') {
                    $map[$name] = $file;
                }
            }
        }
        return $map;
    }

    /**
     * @return array{newProductTypes:list<string>, updatedRows:int}
     */
    private static function diffOneFile(?array $oldFile, array $newFile): array
    {
        $oldRows = self::indexRows($oldFile);
        $newRows = self::indexRows($newFile);

        $oldRecordKeys = [];
        foreach (array_keys($oldRows) as $rowKey) {
            [$recordKey] = explode('|', $rowKey, 2);
            $oldRecordKeys[$recordKey] = true;
        }

        $newProductTypesByRecord = [];
        $updatedRows = 0;

        foreach ($newRows as $rowKey => $signature) {
            [$recordKey] = explode('|', $rowKey, 2);

            if (!isset($oldRecordKeys[$recordKey])) {
                // Cả record (kyHieu + productType) chưa từng tồn tại trong file cũ
                // → đây là một phôi mới, không tính vào "dòng cập nhật".
                $newProductTypesByRecord[$recordKey] = self::productTypeOf($recordKey);
                continue;
            }

            if (!isset($oldRows[$rowKey])) {
                // Record đã có nhưng size này mới thêm — tính là 1 dòng cập nhật.
                $updatedRows++;
                continue;
            }

            if ($oldRows[$rowKey] !== $signature) {
                $updatedRows++;
            }
        }

        return [
            'newProductTypes' => array_values(array_unique($newProductTypesByRecord)),
            'updatedRows'     => $updatedRows,
        ];
    }

    /**
     * Khoá "kyHieu::productType|size" → chữ ký nội dung dòng giá, dùng để so
     * đổi/không đổi giữa 2 lần lưu. Bỏ khoá `id` khỏi chữ ký: id có thể được
     * client sinh lại giữa 2 lần lưu dù nội dung không đổi thật sự.
     *
     * @return array<string,string> rowKey => md5 nội dung dòng
     */
    private static function indexRows(?array $file): array
    {
        if (!$file) {
            return [];
        }

        $pricing = is_array($file['pricing'] ?? null) ? $file['pricing'] : [];
        $rows = [];

        foreach ($pricing as $row) {
            if (!is_array($row)) {
                continue;
            }
            $productType = trim((string) ($row['productType'] ?? ''));
            if ($productType === '') {
                continue;
            }
            $vendorCode = trim((string) ($row['kyHieu'] ?? ''));
            $size       = trim((string) ($row['size'] ?? ''));
            $recordKey  = $vendorCode . '::' . $productType;
            $rowKey     = $recordKey . '|' . $size;

            $comparable = $row;
            unset($comparable['id']);
            ksort($comparable);

            $rows[$rowKey] = md5((string) json_encode($comparable));
        }

        return $rows;
    }

    private static function productTypeOf(string $recordKey): string
    {
        $parts = explode('::', $recordKey, 2);
        return $parts[1] ?? $parts[0];
    }
}
