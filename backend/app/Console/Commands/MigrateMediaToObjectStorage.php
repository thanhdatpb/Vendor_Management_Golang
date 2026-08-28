<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\Vendor;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Chuyển toàn bộ media đang nằm trên đĩa server (storage/app/public) lên object
 * storage (Cloudflare R2 / S3), rồi cập nhật URL trong DB để không còn phụ thuộc
 * đĩa máy chủ — đổi/chuyển server sẽ không mất ảnh nữa.
 *
 * AN TOÀN:
 *  - COPY chứ KHÔNG xoá file gốc trên đĩa → còn nguyên bản dự phòng để rollback.
 *  - Giữ nguyên key (products/abc.jpg → products/abc.jpg) nên URL mới suy ra được
 *    từ dữ liệu cũ, và chạy lại lần nữa cũng không hỏng (idempotent).
 *  - Có --dry-run để xem trước khi ghi.
 *  - Chỉ ghi DB sau khi upload lên object storage thành công.
 */
class MigrateMediaToObjectStorage extends Command
{
    protected $signature = 'app:migrate-media-to-object-storage
        {--dry-run : Chỉ xem trước, không upload và không ghi DB}
        {--fail-on-missing : Trả exit code 1 nếu có file nguồn không tìm thấy}
        {--disk=s3 : Disk đích (mặc định s3 — trỏ tới R2 qua biến môi trường AWS_*)}';

    protected $description = 'Copy media từ đĩa server lên object storage (R2/S3) và cập nhật URL trong DB';

    private string $target;
    private bool $dryRun;
    private int $filesCopied = 0;
    private int $filesSkipped = 0;
    private int $filesMissing = 0;

    public function handle(): int
    {
        $this->dryRun = (bool) $this->option('dry-run');
        $this->target = (string) $this->option('disk');

        if ($this->target === 'public') {
            $this->error('Disk đích không thể là "public" — đó chính là đĩa server đang muốn rời khỏi.');
            return self::FAILURE;
        }

        if (!$this->assertTargetWritable()) {
            return self::FAILURE;
        }

        $this->info($this->dryRun
            ? "== DRY RUN — không ghi gì. Disk đích: {$this->target} =="
            : "== Bắt đầu chuyển media lên disk: {$this->target} ==");
        $this->newLine();

        $this->migrateProducts();
        $this->migrateVendors();
        $this->migrateVendorLibrary();

        $this->newLine();
        $this->info("File: {$this->filesCopied} đã copy, {$this->filesSkipped} bỏ qua (đã có sẵn trên đích), {$this->filesMissing} không tìm thấy trên đĩa server.");

        if ($this->dryRun) {
            $this->comment('DRY RUN: chưa ghi gì. Bỏ --dry-run để chạy thật.');
        } else {
            $this->info('Xong. File gốc trên đĩa server vẫn được GIỮ NGUYÊN làm bản dự phòng.');
            $this->warn('Bước cuối: đặt MEDIA_DISK=' . $this->target . ' trong .env để upload MỚI cũng đi thẳng lên object storage.');
        }

        if ($this->option('fail-on-missing') && $this->filesMissing > 0) {
            $this->error("Migration chưa đạt gate: còn {$this->filesMissing} file nguồn không tìm thấy.");
            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    /**
     * Xác nhận disk đích GHI ĐƯỢC THẬT, bằng cách ghi rồi xoá một file thăm dò.
     *
     * Không dùng exists('') để thăm dò: key rỗng không phải key hợp lệ, và nếu
     * disk đặt throw=false thì lỗi xác thực cũng chỉ trả về false — probe "đậu"
     * trong khi thực tế không ghi được, dẫn tới migrate ghi URL vào DB cho những
     * file chưa từng lên tới object storage.
     */
    private function assertTargetWritable(): bool
    {
        $probeKey = '.connectivity-probe-' . uniqid();

        try {
            $disk = Storage::disk($this->target);
            $disk->put($probeKey, 'ok');

            if (!$disk->exists($probeKey)) {
                $this->error("Disk '{$this->target}': ghi xong nhưng đọc lại không thấy file — kiểm tra lại AWS_BUCKET.");
                return false;
            }

            $disk->delete($probeKey);
        } catch (\Throwable $e) {
            $this->error("Không ghi được lên disk '{$this->target}': " . $e->getMessage());
            $this->newLine();
            $this->line('Kiểm tra lần lượt:');
            $this->line('  1. Đã cài driver:  composer require league/flysystem-aws-s3-v3');
            $this->line('  2. Đủ biến trong .env: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,');
            $this->line('     AWS_BUCKET, AWS_ENDPOINT, AWS_URL, AWS_DEFAULT_REGION=auto,');
            $this->line('     AWS_USE_PATH_STYLE_ENDPOINT=true');
            $this->line('  3. API token R2 có quyền Object Read & Write (không phải read-only)');
            $this->line('  4. Đã xoá cache config:  php artisan config:clear');

            return false;
        }

        $this->line("  <fg=green>✓</> Disk '{$this->target}' ghi/đọc/xoá được.");

        if ($this->externalBaseUrlMissing()) {
            $this->warn('  AWS_URL đang để trống! URL ghi vào DB sẽ không nhận diện được là');
            $this->warn('  object storage, khiến ảnh bị hiểu nhầm là file trên đĩa server.');
            $this->warn('  Điền AWS_URL (r2.dev hoặc custom domain) trước khi chạy thật.');

            if (!$this->dryRun) {
                return false;
            }
        }

        return true;
    }

    private function externalBaseUrlMissing(): bool
    {
        return trim((string) config('filesystems.disks.' . $this->target . '.url', '')) === '';
    }

    /**
     * Copy 1 file từ disk public lên disk đích, giữ nguyên key.
     * Trả về URL mới, hoặc null nếu file gốc không tồn tại.
     */
    private function copyToTarget(string $key): ?string
    {
        $key = ltrim($key, '/');
        if ($key === '') {
            return null;
        }

        if (!Storage::disk('public')->exists($key)) {
            $this->filesMissing++;
            $this->line("    <fg=yellow>không thấy file:</> {$key}");
            return null;
        }

        $newUrl = rtrim(Storage::disk($this->target)->url($key), '/');

        if ($this->dryRun) {
            $this->filesCopied++;
            return $newUrl;
        }

        if (Storage::disk($this->target)->exists($key)) {
            $this->filesSkipped++;
            return $newUrl;
        }

        $stream = Storage::disk('public')->readStream($key);
        if ($stream === false || $stream === null) {
            $this->filesMissing++;
            return null;
        }
        Storage::disk($this->target)->writeStream($key, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }
        $this->filesCopied++;

        return $newUrl;
    }

    /**
     * Ảnh vendor import qua endpoint cũ VendorImportController (route /vendors/
     * import, đã ngừng dùng trên UI nhưng dữ liệu cũ trong DB có thể còn) được
     * ghi thẳng ra 'storage/app/vendors/{file}' — KHÔNG nằm trong disk 'public'
     * ('storage/app/public/...') như products/vendors/vendor-library bình
     * thường, và URL lưu trong DB có dạng 'APP_URL/media.php?f={file}' chứ
     * không theo mẫu URL chung. Cần nhận diện + copy riêng, đọc thẳng bằng
     * file_get_contents() thay vì qua disk 'public' vì file không nằm ở đó.
     */
    private function legacyVendorImportFilename(string $url): ?string
    {
        if (preg_match('#/media\.php\?f=([^&]+)#i', $url, $m)) {
            $filename = urldecode($m[1]);
            // Cùng bộ ký tự an toàn media.php tự kiểm tra khi phục vụ file.
            if (preg_match('/^[A-Za-z0-9_.-]+$/', $filename)) {
                return $filename;
            }
        }

        return null;
    }

    private function copyLegacyVendorImportFile(string $filename): ?string
    {
        $localPath = storage_path('app/vendors/' . $filename);
        if (!file_exists($localPath)) {
            $this->filesMissing++;
            $this->line("    <fg=yellow>không thấy file (legacy vendor import):</> {$filename}");
            return null;
        }

        $key = 'vendors/' . $filename;
        $newUrl = rtrim(Storage::disk($this->target)->url($key), '/');

        if ($this->dryRun) {
            $this->filesCopied++;
            return $newUrl;
        }

        if (Storage::disk($this->target)->exists($key)) {
            $this->filesSkipped++;
            return $newUrl;
        }

        Storage::disk($this->target)->put($key, file_get_contents($localPath));
        $this->filesCopied++;

        return $newUrl;
    }

    /**
     * Migrate 1 URL media_url/media_urls của Vendor — thử nhận diện dạng legacy
     * (media.php?f=...) trước, không khớp thì rơi về đường xử lý chung.
     */
    private function migrateVendorMediaUrl(?string $url): ?string
    {
        if (!$url) {
            return null;
        }

        if ($filename = $this->legacyVendorImportFilename($url)) {
            return $this->copyLegacyVendorImportFile($filename);
        }

        if ($key = $this->localKeyFromUrl($url)) {
            return $this->copyToTarget($key);
        }

        return null;
    }

    /**
     * Tách key media ra khỏi URL bất kỳ bằng cách tìm tên thư mục media trong
     * đường dẫn — không phụ thuộc nhà cung cấp.
     *
     * Nhờ vậy lệnh này chạy lại được khi ĐỔI NHÀ CUNG CẤP (vd Supabase → Cloudflare
     * R2): URL cũ trong DB dù đang là URL Supabase vẫn tách ra đúng key
     * 'products/abc.jpg', copy lại từ bản gốc còn nguyên trên đĩa server rồi ghi
     * đè URL mới. Không dựa vào chuỗi '/storage/' vì Supabase cũng có '/storage/v1/'
     * trong đường dẫn công khai.
     */
    private function localKeyFromUrl(?string $url): ?string
    {
        if (!$url) {
            return null;
        }

        $path = str_starts_with($url, 'http')
            ? (string) (parse_url($url, PHP_URL_PATH) ?: '')
            : $url;
        $path = ltrim($path, '/');

        // Route xác thực ảnh Vendor Library (PR #264/266/268): 'api/vendor-library/
        // images/{filename}'. "images" ở đây CHỈ LÀ segment URL của route, không
        // phải tên thư mục con trên đĩa — file thật nằm ở 'vendor-library/{filename}'
        // (không có 'images/' ở giữa). Xét nhánh này TRƯỚC vòng lặp bên dưới, nếu
        // không sẽ suy nhầm ra 'vendor-library/images/{filename}' và không bao giờ
        // tìm thấy file để copy — dry-run trên production 2026-08-27 lộ đúng lỗi
        // này: cả 6 file đều báo "không tìm thấy" dù file còn nguyên trên đĩa.
        if (preg_match('#^api/vendor-library/images/([^/?]+)#', $path, $m)) {
            return 'vendor-library/' . $m[1];
        }

        foreach (['products', 'vendors', 'vendor-library'] as $folder) {
            if (str_starts_with($path, $folder . '/')) {
                return $path;
            }
            $pos = strpos($path, '/' . $folder . '/');
            if ($pos !== false) {
                return substr($path, $pos + 1);
            }
        }

        return null;
    }

    private function migrateProducts(): void
    {
        $this->info('— Products (ảnh/video sản phẩm)');
        $updated = 0;

        Product::whereNotNull('media_urls')->orWhereNotNull('media_path')->orWhereNotNull('media_url')
            ->chunkById(50, function ($products) use (&$updated) {
                foreach ($products as $product) {
                    $changed = false;

                    $urls = $product->media_urls ?? [];
                    if (is_array($urls)) {
                        foreach ($urls as $i => $url) {
                            $key = $this->localKeyFromUrl($url);
                            if (!$key) {
                                continue;
                            }
                            if ($newUrl = $this->copyToTarget($key)) {
                                $urls[$i] = $newUrl;
                                $changed = true;
                            }
                        }
                    }

                    if (!empty($product->media_url)) {
                        $key = $this->localKeyFromUrl($product->media_url);
                        if ($key && ($newUrl = $this->copyToTarget($key))) {
                            $product->media_url = $newUrl;
                            $changed = true;
                        }
                    }

                    // Chuẩn hoá cả media_path legacy (/storage/... hoặc URL cũ)
                    // về key thuần để runtime R2-only không còn phải đoán local URL.
                    if (!empty($product->media_path)) {
                        $mediaPathKey = $this->localKeyFromUrl($product->media_path) ?? ltrim($product->media_path, '/');
                        if ($this->copyToTarget($mediaPathKey) !== null && $product->media_path !== $mediaPathKey) {
                            $product->media_path = $mediaPathKey;
                            $changed = true;
                        }
                    }

                    if ($changed) {
                        $updated++;
                        $this->line("  Product #{$product->id}");
                        if (!$this->dryRun) {
                            $product->media_urls = $urls;
                            $product->save();
                        }
                    }
                }
            });

        $this->line("  → {$updated} product được cập nhật URL.");
    }

    private function migrateVendors(): void
    {
        $this->info('— Vendors (ảnh/video vendor)');
        $updated = 0;

        Vendor::whereNotNull('media_urls')->orWhereNotNull('media_url')
            ->chunkById(50, function ($vendors) use (&$updated) {
                foreach ($vendors as $vendor) {
                    $changed = false;

                    $urls = $vendor->media_urls ?? [];
                    if (is_array($urls)) {
                        foreach ($urls as $i => $url) {
                            if ($newUrl = $this->migrateVendorMediaUrl($url)) {
                                $urls[$i] = $newUrl;
                                $changed = true;
                            }
                        }
                    }

                    $single = $vendor->media_url;
                    if ($newUrl = $this->migrateVendorMediaUrl($single)) {
                        $single = $newUrl;
                        $changed = true;
                    }

                    if ($changed) {
                        $updated++;
                        $this->line("  Vendor #{$vendor->id}");
                        if (!$this->dryRun) {
                            $vendor->media_urls = $urls;
                            $vendor->media_url  = $single;
                            $vendor->save();
                        }
                    }
                }
            });

        $this->line("  → {$updated} vendor được cập nhật URL.");
    }

    /**
     * Ảnh nhúng từ Excel nằm rải rác trong blob JSON vendor_library.data
     * (mỗi dòng generalInfo có mảng images).
     *
     * KHÔNG được ghi đè URL trong blob bằng URL raw của disk đích: ảnh Vendor
     * Library luôn serve qua route xác thực '/api/vendor-library/images/
     * {filename}' (Hướng A, PR #264/266/268) — route tự chọn disk theo
     * MEDIA_DISK tại thời điểm request, nên blob giữ nguyên URL route bất kể
     * file vật lý đang nằm ở disk nào. Ghi URL raw R2 vào đây sẽ lộ ảnh công
     * khai không qua xác thực, phá vỡ đúng thiết kế bảo mật đã chọn.
     */
    private function migrateVendorLibrary(): void
    {
        $this->info('— Vendor Library (ảnh nhúng trong file Excel)');

        $row = DB::table('vendor_library')->orderBy('id')->first();
        if (!$row) {
            $this->line('  → Không có dữ liệu.');
            return;
        }

        $data = json_decode($row->data, true);
        if (!is_array($data)) {
            $this->warn('  → Blob JSON không hợp lệ, bỏ qua.');
            return;
        }

        $copied = 0;
        $walk = function ($node) use (&$walk, &$copied) {
            if (is_array($node)) {
                foreach ($node as $v) {
                    if (is_string($v)) {
                        $key = $this->localKeyFromUrl($v);
                        // Chỉ đụng tới URL trỏ vào thư mục ảnh của thư viện vendor
                        if ($key && str_starts_with($key, 'vendor-library/')) {
                            if ($this->copyToTarget($key) !== null) {
                                $copied++;
                            }
                        }
                    } elseif (is_array($v)) {
                        $walk($v);
                    }
                }
            }
        };
        $walk($data);

        $this->line("  → {$copied} file ảnh trong thư viện đã copy lên đích (URL trong DB giữ nguyên route xác thực).");
    }
}
