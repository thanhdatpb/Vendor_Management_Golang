<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

/** Read-only gate kiểm chứng dữ liệu media đã sẵn sàng chạy R2-only. */
class AuditMediaStorage extends Command
{
    protected $signature = 'app:audit-media-storage
        {--disk=s3 : Disk object storage cần kiểm tra}
        {--require-r2-ready : Trả exit code 1 nếu còn URL local hoặc thiếu object trên R2}';

    protected $description = 'Audit URL media trong DB, file local và object trên R2 mà không thay đổi dữ liệu';

    /** @var array<string, true> */
    private array $keys = [];

    private int $references = 0;

    private int $localUrls = 0;

    private int $protectedUrls = 0;

    private int $externalUrls = 0;

    private int $unknownReferences = 0;

    public function handle(): int
    {
        $disk = (string) $this->option('disk');
        $baseUrl = rtrim((string) config("filesystems.disks.{$disk}.url", ''), '/');

        $this->scanProducts($baseUrl);
        $this->scanVendors($baseUrl);
        $this->scanVendorLibrary($baseUrl);

        $localPublicFiles = $this->localPublicFileCount();
        $legacyVendorFiles = $this->legacyVendorFileCount();
        $missingObjects = $this->missingObjectKeys($disk);

        $this->table(['Chỉ số', 'Số lượng'], [
            ['Tham chiếu media trong DB', $this->references],
            ['URL local cần migrate', $this->localUrls],
            ['URL route xác thực Vendor Library', $this->protectedUrls],
            ['URL object storage', $this->externalUrls],
            ['Tham chiếu không nhận diện', $this->unknownReferences],
            ['Key media duy nhất cần có trên R2', count($this->keys)],
            ["Object thiếu trên {$disk}", count($missingObjects)],
            ['File backup storage/app/public', $localPublicFiles],
            ['File legacy storage/app/vendors', $legacyVendorFiles],
        ]);

        if ($missingObjects) {
            $this->warn('Object chưa có trên R2 (tối đa 50 key đầu):');
            foreach (array_slice($missingObjects, 0, 50) as $key) {
                $this->line("  - {$key}");
            }
        }

        if ($this->option('require-r2-ready')) {
            $problems = [];
            if ($baseUrl === '') {
                $problems[] = "filesystems.disks.{$disk}.url đang trống";
            }
            if ($this->localUrls > 0) {
                $problems[] = "còn {$this->localUrls} URL local trong DB";
            }
            if ($missingObjects) {
                $problems[] = 'còn '.count($missingObjects)." object thiếu trên {$disk}";
            }

            if ($problems) {
                $this->error('CHƯA ĐƯỢC CUTOVER: '.implode('; ', $problems).'.');

                return self::FAILURE;
            }

            $this->info('R2 READY: DB không còn URL local và mọi key media đều có trên object storage.');
        }

        $this->comment('Lệnh audit chỉ đọc; các file local được giữ nguyên làm rollback.');

        return self::SUCCESS;
    }

    private function scanProducts(string $baseUrl): void
    {
        if (! Schema::hasTable('products')) {
            return;
        }

        DB::table('products')->select(['id', 'media_path', 'media_url', 'media_urls'])->orderBy('id')
            ->chunkById(200, function ($rows) use ($baseUrl) {
                foreach ($rows as $row) {
                    $this->inspect($row->media_path ?? null, $baseUrl);
                    $this->inspect($row->media_url ?? null, $baseUrl);
                    $this->inspectJson($row->media_urls ?? null, $baseUrl);
                }
            });
    }

    private function scanVendors(string $baseUrl): void
    {
        if (! Schema::hasTable('vendors')) {
            return;
        }

        DB::table('vendors')->select(['id', 'media_url', 'media_urls'])->orderBy('id')
            ->chunkById(200, function ($rows) use ($baseUrl) {
                foreach ($rows as $row) {
                    $this->inspect($row->media_url ?? null, $baseUrl);
                    $this->inspectJson($row->media_urls ?? null, $baseUrl);
                }
            });
    }

    private function scanVendorLibrary(string $baseUrl): void
    {
        if (! Schema::hasTable('vendor_library')) {
            return;
        }

        foreach (DB::table('vendor_library')->pluck('data') as $json) {
            $this->walk(json_decode((string) $json, true), $baseUrl);
        }
    }

    private function inspectJson(mixed $json, string $baseUrl): void
    {
        $value = is_string($json) ? json_decode($json, true) : $json;
        $this->walk($value, $baseUrl);
    }

    private function walk(mixed $value, string $baseUrl): void
    {
        if (is_array($value)) {
            foreach ($value as $item) {
                $this->walk($item, $baseUrl);
            }
        } elseif (is_string($value)) {
            $this->inspect($value, $baseUrl);
        }
    }

    private function inspect(?string $reference, string $baseUrl): void
    {
        $reference = trim((string) $reference);
        if ($reference === '') {
            return;
        }

        $key = $this->mediaKey($reference);
        if (! $key) {
            return; // blob Vendor Library còn nhiều text/link không phải media
        }

        $this->references++;
        $this->keys[$key] = true;

        if (preg_match('#/media\.php\?f=#i', $reference)
            || preg_match('#(^|/)(storage)/(products|vendors|vendor-library)/#i', $reference)) {
            $this->localUrls++;
        } elseif (preg_match('#(^|/)api/vendor-library/images/#i', $reference)) {
            $this->protectedUrls++;
        } elseif ($baseUrl !== '' && str_starts_with($reference, $baseUrl)) {
            $this->externalUrls++;
        } elseif (str_starts_with($reference, 'http')) {
            $this->externalUrls++; // CDN/provider cũ nhưng key vẫn kiểm tra trên R2
        } elseif (preg_match('#^(products|vendors|vendor-library)/#', ltrim($reference, '/'))) {
            // media_path là key, không phải URL local.
        } else {
            $this->unknownReferences++;
        }
    }

    private function mediaKey(string $reference): ?string
    {
        if (preg_match('#/media\.php\?f=([^&]+)#i', $reference, $match)) {
            return 'vendors/'.basename(urldecode($match[1]));
        }

        $path = str_starts_with($reference, 'http')
            ? (string) (parse_url($reference, PHP_URL_PATH) ?: '')
            : $reference;
        $path = ltrim($path, '/');

        if (preg_match('#^api/vendor-library/images/([^/?]+)#', $path, $match)) {
            return 'vendor-library/'.urldecode($match[1]);
        }

        foreach (['products', 'vendors', 'vendor-library'] as $folder) {
            if (str_starts_with($path, $folder.'/')) {
                return $path;
            }
            $position = strpos($path, '/'.$folder.'/');
            if ($position !== false) {
                return substr($path, $position + 1);
            }
        }

        return null;
    }

    /** @return list<string> */
    private function missingObjectKeys(string $disk): array
    {
        $missing = [];
        foreach (array_keys($this->keys) as $key) {
            try {
                if (! Storage::disk($disk)->exists($key)) {
                    $missing[] = $key;
                }
            } catch (\Throwable $exception) {
                $this->error("Không đọc được disk {$disk}: {$exception->getMessage()}");

                return array_keys($this->keys);
            }
        }

        return $missing;
    }

    private function localPublicFileCount(): int
    {
        try {
            return count(Storage::disk('public')->allFiles());
        } catch (\Throwable) {
            return 0;
        }
    }

    private function legacyVendorFileCount(): int
    {
        $files = glob(storage_path('app/vendors/*')) ?: [];

        return count(array_filter($files, 'is_file'));
    }
}
