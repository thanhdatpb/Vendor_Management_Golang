<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillVendorAssignedTime extends Command
{
    /**
     * Vá dữ liệu avg_time_vendor/avg_time_actual còn thiếu trong các bản ghi
     * products.assigned_vendors ĐÃ TỒN TẠI TRƯỚC khi VendorsSection.jsx được sửa
     * để copy 2 field này khi gán vendor từ Thư Viện Excel (assigned_vendors là
     * snapshot JSON tại thời điểm gán, không link sống tới vendor_library).
     *
     * Chỉ vá các vendor entry có is_excel=true + source_file_id + excel_row_id
     * (định danh dòng gốc trong vendor_library) và đang thiếu avg_time_vendor
     * lẫn avg_time_actual — tra ngược vendor_library để lấy đúng giá trị hiện tại.
     */
    protected $signature = 'app:backfill-vendor-assigned-time {--dry-run : Chỉ xem trước, không ghi vào DB}';

    protected $description = 'Vá avg_time_vendor/avg_time_actual còn thiếu trong products.assigned_vendors (dữ liệu gán vendor cũ trước khi field này được thêm)';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $libraryRow = DB::table('vendor_library')->orderBy('id')->first();
        if (!$libraryRow) {
            $this->error('Không có dữ liệu trong bảng vendor_library.');
            return self::FAILURE;
        }

        $libraryData = json_decode($libraryRow->data, true);
        if (!is_array($libraryData)) {
            $this->error('Dữ liệu vendor_library không hợp lệ (không parse được JSON).');
            return self::FAILURE;
        }

        // Lookup: "fileId|rowId" -> ['avgTimeVendor' => ..., 'avgTimeActual' => ...]
        $lookup = [];
        foreach ($libraryData as $file) {
            $fileId = $file['id'] ?? null;
            if ($fileId === null || empty($file['generalInfo']) || !is_array($file['generalInfo'])) {
                continue;
            }
            foreach ($file['generalInfo'] as $row) {
                $rowId = $row['id'] ?? null;
                if ($rowId === null) {
                    continue;
                }
                $lookup[$fileId . '|' . $rowId] = [
                    'avgTimeVendor' => $row['avgTimeVendor'] ?? '',
                    'avgTimeActual' => $row['avgTimeActual'] ?? '',
                ];
            }
        }

        $this->info('Đã nạp ' . count($lookup) . ' dòng từ Thư Viện Vendor để tra cứu.');

        $productsScanned = 0;
        $productsUpdated = 0;
        $entriesPatched = 0;
        $entriesNotFound = 0;

        Product::whereNotNull('assigned_vendors')->chunkById(50, function ($products) use (
            $lookup, $dryRun,
            &$productsScanned, &$productsUpdated, &$entriesPatched, &$entriesNotFound
        ) {
            foreach ($products as $product) {
                $productsScanned++;
                $vendors = $product->assigned_vendors;
                if (!is_array($vendors) || count($vendors) === 0) {
                    continue;
                }

                $changed = false;
                foreach ($vendors as &$v) {
                    if (!is_array($v) || empty($v['is_excel'])) {
                        continue;
                    }
                    $hasTime = !empty($v['avg_time_vendor']) || !empty($v['avg_time_actual']);
                    if ($hasTime) {
                        continue;
                    }
                    $fileId = $v['source_file_id'] ?? null;
                    $rowId = $v['excel_row_id'] ?? null;
                    if ($fileId === null || $rowId === null) {
                        continue;
                    }
                    $key = $fileId . '|' . $rowId;
                    if (!isset($lookup[$key])) {
                        $entriesNotFound++;
                        continue;
                    }
                    $v['avg_time_vendor'] = $lookup[$key]['avgTimeVendor'];
                    $v['avg_time_actual'] = $lookup[$key]['avgTimeActual'];
                    $changed = true;
                    $entriesPatched++;
                }
                unset($v);

                if ($changed) {
                    $productsUpdated++;
                    $this->line("  Product #{$product->id} ({$product->product_type}): vá thời gian vendor.");
                    if (!$dryRun) {
                        $product->assigned_vendors = $vendors;
                        $product->save();
                    }
                }
            }
        });

        $this->newLine();
        $this->info("Quét {$productsScanned} sản phẩm có assigned_vendors.");
        $this->info("{$productsUpdated} sản phẩm được vá, {$entriesPatched} dòng vendor được cập nhật.");
        if ($entriesNotFound > 0) {
            $this->warn("{$entriesNotFound} dòng vendor không tìm thấy trong Thư Viện Vendor hiện tại (có thể đã bị xoá/sửa) — bỏ qua.");
        }
        if ($dryRun) {
            $this->comment('Chế độ --dry-run: CHƯA ghi gì vào DB. Chạy lại không kèm --dry-run để áp dụng thật.');
        }

        return self::SUCCESS;
    }
}
