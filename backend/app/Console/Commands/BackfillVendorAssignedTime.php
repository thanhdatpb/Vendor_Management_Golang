<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class BackfillVendorAssignedTime extends Command
{
    /**
     * Vá dữ liệu avg_time_vendor/avg_time_actual còn thiếu trong các bản ghi
     * products.assigned_vendors ĐÃ TỒN TẠI TRƯỚC khi VendorsSection.jsx được sửa
     * để copy 2 field này khi gán vendor từ Thư Viện Excel (assigned_vendors là
     * snapshot JSON tại thời điểm gán, không link sống tới vendor_library).
     *
     * QUAN TRỌNG: id của mỗi dòng generalInfo trong vendor_library được sinh mới
     * ('row-' + Date.now() + random, xem frontend/src/utils/vendorExcel.js) MỖI
     * LẦN file được import/re-import — không ổn định. Vì vậy khớp theo id thường
     * MISS 100% với dữ liệu cũ nếu file từng được re-import từ lúc gán vendor.
     * Command này khớp theo id trước (rẻ, chính xác tuyệt đối nếu còn khớp), rồi
     * fallback khớp theo định danh nghiệp vụ (kyHieu / tên vendor + product type)
     * — CHỈ áp dụng khi khớp DUY NHẤT 1 kết quả trong toàn thư viện, để tránh vá
     * nhầm dữ liệu của vendor khác.
     */
    protected $signature = 'app:backfill-vendor-assigned-time {--dry-run : Chỉ xem trước, không ghi vào DB}';

    protected $description = 'Vá avg_time_vendor/avg_time_actual còn thiếu trong products.assigned_vendors (dữ liệu gán vendor cũ trước khi field này được thêm)';

    private function norm(?string $s): string
    {
        return trim(mb_strtolower((string) $s));
    }

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

        // byId: "fileId|rowId" -> time data (khớp tuyệt đối nếu id còn nguyên vẹn)
        // byKey: "loại:giá trị" -> mảng candidate time data (khớp nghiệp vụ, fallback)
        $byId = [];
        $byKey = [];
        $addKey = function (string $key, array $time) use (&$byKey) {
            $byKey[$key][] = $time;
        };

        foreach ($libraryData as $file) {
            $fileId = $file['id'] ?? null;
            if (empty($file['generalInfo']) || !is_array($file['generalInfo'])) {
                continue;
            }
            foreach ($file['generalInfo'] as $row) {
                $time = [
                    'avgTimeVendor' => $row['avgTimeVendor'] ?? '',
                    'avgTimeActual' => $row['avgTimeActual'] ?? '',
                ];
                if (empty($time['avgTimeVendor']) && empty($time['avgTimeActual'])) {
                    continue; // dòng thư viện cũng chưa có dữ liệu thời gian — không có gì để vá
                }

                $rowId = $row['id'] ?? null;
                if ($fileId !== null && $rowId !== null) {
                    $byId[$fileId . '|' . $rowId] = $time;
                }

                $kyHieu = $this->norm($row['kyHieu'] ?? '');
                $vendorName = $this->norm($row['vendorName'] ?? '');
                $productType = $this->norm($row['productType'] ?? '');

                if ($kyHieu !== '' && $productType !== '') {
                    $addKey('kh_pt:' . $kyHieu . '|' . $productType, $time);
                }
                if ($vendorName !== '' && $productType !== '') {
                    $addKey('vn_pt:' . $vendorName . '|' . $productType, $time);
                }
                if ($kyHieu !== '') {
                    $addKey('kh:' . $kyHieu, $time);
                }
            }
        }

        $this->info('Đã nạp dữ liệu Thư Viện Vendor để tra cứu (' . count($byId) . ' theo ID, ' . count($byKey) . ' khoá nghiệp vụ).');

        // Khớp DUY NHẤT: nếu candidate list có >1 phần tử VÀ chúng không đồng nhất giá trị
        // (thời gian khác nhau giữa các dòng trùng khoá) thì coi là mơ hồ, không áp dụng.
        $resolveUnique = function (array $candidates) {
            if (count($candidates) === 0) {
                return null;
            }
            $first = $candidates[0];
            foreach ($candidates as $c) {
                if ($c['avgTimeVendor'] !== $first['avgTimeVendor'] || $c['avgTimeActual'] !== $first['avgTimeActual']) {
                    return null; // trùng khoá nhưng giá trị khác nhau → mơ hồ, bỏ qua
                }
            }
            return $first;
        };

        $productsScanned = 0;
        $productsUpdated = 0;
        $entriesPatchedById = 0;
        $entriesPatchedByKey = 0;
        $entriesAmbiguous = 0;
        $entriesNotFound = 0;

        Product::whereNotNull('assigned_vendors')->chunkById(50, function ($products) use (
            $byId, $byKey, $resolveUnique, $dryRun,
            &$productsScanned, &$productsUpdated, &$entriesPatchedById, &$entriesPatchedByKey, &$entriesAmbiguous, &$entriesNotFound
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

                    $match = null;
                    $matchedBy = null;

                    $fileId = $v['source_file_id'] ?? null;
                    $rowId = $v['excel_row_id'] ?? null;
                    if ($fileId !== null && $rowId !== null && isset($byId[$fileId . '|' . $rowId])) {
                        $match = $byId[$fileId . '|' . $rowId];
                        $matchedBy = 'id';
                    }

                    if ($match === null) {
                        $kyHieu = $this->norm($v['kyHieu'] ?? '');
                        $vendorName = $this->norm($v['name'] ?? '');
                        $productType = $this->norm($v['vendor_type'] ?? '');

                        foreach ([
                            $kyHieu !== '' && $productType !== '' ? 'kh_pt:' . $kyHieu . '|' . $productType : null,
                            $vendorName !== '' && $productType !== '' ? 'vn_pt:' . $vendorName . '|' . $productType : null,
                            $kyHieu !== '' ? 'kh:' . $kyHieu : null,
                        ] as $tryKey) {
                            if ($tryKey === null || !isset($byKey[$tryKey])) {
                                continue;
                            }
                            $resolved = $resolveUnique($byKey[$tryKey]);
                            if ($resolved !== null) {
                                $match = $resolved;
                                $matchedBy = 'key';
                                break;
                            }
                            $entriesAmbiguous++;
                        }
                    }

                    if ($match === null) {
                        $entriesNotFound++;
                        continue;
                    }

                    $v['avg_time_vendor'] = $match['avgTimeVendor'];
                    $v['avg_time_actual'] = $match['avgTimeActual'];
                    $changed = true;
                    if ($matchedBy === 'id') {
                        $entriesPatchedById++;
                    } else {
                        $entriesPatchedByKey++;
                    }
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
        $this->info("{$productsUpdated} sản phẩm được vá — {$entriesPatchedById} dòng khớp theo ID, {$entriesPatchedByKey} dòng khớp theo tên/ký hiệu.");
        if ($entriesAmbiguous > 0) {
            $this->warn("{$entriesAmbiguous} lượt khớp bị mơ hồ (trùng khoá nhưng thời gian khác nhau giữa các dòng) — bỏ qua để an toàn.");
        }
        if ($entriesNotFound > 0) {
            $this->warn("{$entriesNotFound} dòng vendor không tìm thấy trong Thư Viện Vendor hiện tại (đã bị xoá/đổi tên/không đủ dữ liệu để khớp) — bỏ qua.");
        }
        if ($dryRun) {
            $this->comment('Chế độ --dry-run: CHƯA ghi gì vào DB. Chạy lại không kèm --dry-run để áp dụng thật.');
        } elseif ($productsUpdated > 0) {
            // ProductController::index() cache 1h theo products_cache_version — nếu không
            // bust ở đây, danh sách sản phẩm (cả Seller lẫn Vendor) tiếp tục trả dữ liệu
            // cũ tới khi cache tự hết hạn, dù DB đã được vá đúng.
            Cache::increment('products_cache_version');
            Cache::forget('products_pending');
            Cache::forget('products_approved');
            $this->info('Đã xoá cache danh sách sản phẩm — Seller/Vendor sẽ thấy dữ liệu mới ngay khi tải lại trang.');
        }

        return self::SUCCESS;
    }
}
