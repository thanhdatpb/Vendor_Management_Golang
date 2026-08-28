<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\Vendor;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * `app:migrate-media-to-object-storage` — copy media từ đĩa server lên R2 rồi
 * cập nhật URL trong DB. An toàn dữ liệu là ưu tiên số 1: COPY chứ không xoá
 * bản gốc, không ghi DB nếu chưa chắc đã ghi lên đích thành công, và chạy lại
 * nhiều lần không được sinh lỗi hay ghi trùng.
 */
class MigrateMediaCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['filesystems.disks.s3.url' => 'https://pub-xxxxxxxxxxxxx.r2.dev']);
    }

    public function test_khong_cho_dich_la_public(): void
    {
        $this->artisan('app:migrate-media-to-object-storage', ['--disk' => 'public'])
            ->assertExitCode(1);
    }

    public function test_disk_khong_ghi_duoc_thi_dung_som_khong_dong_gi(): void
    {
        // Disk 'unconfigured' không tồn tại trong config/filesystems.php →
        // Storage::disk() ném lỗi khi thao tác → phải dừng SẠCH, không tiếp
        // tục sang bước migrate DB.
        Product::create([
            'product_type' => 'AOP',
            'total_cost'   => 12.00,
            'status'       => 'draft',
            'media_url'    => '/storage/products/a.jpg',
            'media_urls'   => ['/storage/products/a.jpg'],
        ]);

        $this->artisan('app:migrate-media-to-object-storage', ['--disk' => 'unconfigured-disk'])
            ->assertExitCode(1);

        $this->assertSame(
            ['/storage/products/a.jpg'],
            Product::first()->media_urls,
            'Disk không ghi được thì KHÔNG được đổi URL trong DB'
        );
    }

    public function test_dry_run_khong_ghi_db(): void
    {
        Storage::fake('public');
        Storage::fake('s3');
        Storage::disk('public')->put('products/a.jpg', 'noidung');
        $product = Product::create([
            'product_type' => 'AOP',
            'total_cost'   => 12.00,
            'status'       => 'draft',
            'media_urls'   => ['/storage/products/a.jpg'],
        ]);

        $this->artisan('app:migrate-media-to-object-storage', ['--disk' => 's3', '--dry-run' => true])
            ->assertExitCode(0);

        $this->assertSame(
            ['/storage/products/a.jpg'],
            $product->fresh()->media_urls,
            'DRY RUN không được ghi gì vào DB'
        );
        Storage::disk('s3')->assertMissing('products/a.jpg');
    }

    public function test_fail_on_missing_tra_exit_code_1_de_chan_cutover(): void
    {
        Storage::fake('public');
        Storage::fake('s3');
        Product::create([
            'product_type' => 'AOP',
            'total_cost'   => 12.00,
            'status'       => 'draft',
            'media_urls'   => ['/storage/products/missing.jpg'],
        ]);

        $this->artisan('app:migrate-media-to-object-storage', [
            '--disk' => 's3',
            '--dry-run' => true,
            '--fail-on-missing' => true,
        ])->assertExitCode(1);
    }

    public function test_copy_that_thi_cap_nhat_url_va_giu_nguyen_ban_goc(): void
    {
        Storage::fake('public');
        Storage::fake('s3');
        Storage::disk('public')->put('products/a.jpg', 'noidung-goc');
        $product = Product::create([
            'product_type' => 'AOP',
            'total_cost'   => 12.00,
            'status'       => 'draft',
            'media_url'    => '/storage/products/a.jpg',
            'media_urls'   => ['/storage/products/a.jpg'],
        ]);

        $this->artisan('app:migrate-media-to-object-storage', ['--disk' => 's3'])
            ->assertExitCode(0);

        // Storage::fake('s3') không tôn trọng 'url' tuỳ chỉnh trong test (luôn
        // trả '/storage/...' bất kể disk) — nên không so sánh chuỗi URL ở đây;
        // HandlesMediaStorageTest đã khoá riêng việc sinh URL đúng theo disk.
        // Điều thật sự cần đảm bảo: file có mặt ở CẢ HAI nơi sau migrate.
        $newUrls = $product->fresh()->media_urls;
        $this->assertStringContainsString('products/a.jpg', $newUrls[0]);
        $this->assertStringContainsString('products/a.jpg', $product->fresh()->media_url);

        // Bản gốc trên đĩa server PHẢI còn nguyên — đây là lưới an toàn chính.
        Storage::disk('public')->assertExists('products/a.jpg');
        Storage::disk('s3')->assertExists('products/a.jpg');
    }

    public function test_chay_lai_lan_hai_khong_loi_khong_ghi_trung(): void
    {
        Storage::fake('public');
        Storage::fake('s3');
        Storage::disk('public')->put('products/a.jpg', 'noidung');
        $product = Product::create([
            'product_type' => 'AOP',
            'total_cost'   => 12.00,
            'status'       => 'draft',
            'media_urls'   => ['/storage/products/a.jpg'],
        ]);

        $this->artisan('app:migrate-media-to-object-storage', ['--disk' => 's3'])->assertExitCode(0);
        $urlAfterFirst = $product->fresh()->media_urls[0];

        $this->artisan('app:migrate-media-to-object-storage', ['--disk' => 's3'])->assertExitCode(0);
        $urlAfterSecond = $product->fresh()->media_urls[0];

        $this->assertSame($urlAfterFirst, $urlAfterSecond, 'Chạy lại phải cho cùng 1 kết quả (idempotent)');
    }

    public function test_vendor_library_url_dang_route_xac_thuc_van_tim_thay_va_copy_duoc(): void
    {
        // Khoá lại lỗi thật đã lộ qua dry-run trên production 2026-08-27: URL
        // ảnh Vendor Library đi qua route xác thực '/api/vendor-library/images/
        // {filename}' (PR #264/266/268) bị suy NHẦM ra key đĩa
        // 'vendor-library/images/{filename}' (thừa 'images/') trong khi file
        // thật nằm ở 'vendor-library/{filename}' — khiến cả 6 file báo "không
        // tìm thấy" dù còn nguyên trên đĩa.
        Storage::fake('public');
        Storage::fake('s3');
        Storage::disk('public')->put('vendor-library/abc123.jpg', 'noidung-anh-that');

        DB::table('vendor_library')->insert([
            'data' => json_encode([
                'files' => [[
                    'generalInfo' => [[
                        'images' => ['/api/vendor-library/images/abc123.jpg'],
                    ]],
                ]],
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->artisan('app:migrate-media-to-object-storage', ['--disk' => 's3'])
            ->assertExitCode(0);

        // File gốc PHẢI còn nguyên, và bản copy PHẢI nằm đúng key 'vendor-library/
        // abc123.jpg' — không phải 'vendor-library/images/abc123.jpg'.
        Storage::disk('public')->assertExists('vendor-library/abc123.jpg');
        Storage::disk('s3')->assertExists('vendor-library/abc123.jpg');
        Storage::disk('s3')->assertMissing('vendor-library/images/abc123.jpg');

        // Blob DB PHẢI giữ NGUYÊN URL route xác thực — route tự chọn disk theo
        // MEDIA_DISK lúc request, ghi URL raw của disk đích vào đây sẽ lộ ảnh
        // công khai không qua xác thực (phá vỡ thiết kế bảo mật Hướng A).
        $row = DB::table('vendor_library')->first();
        $data = json_decode($row->data, true);
        $urlAfter = $data['files'][0]['generalInfo'][0]['images'][0];
        $this->assertSame('/api/vendor-library/images/abc123.jpg', $urlAfter);
    }

    public function test_vendor_media_url_dang_legacy_media_php_van_tim_thay_va_copy_len_dung_key(): void
    {
        // Endpoint import cũ (VendorImportController, route /vendors/import, đã
        // ngừng dùng trên UI) từng ghi ảnh thẳng ra 'storage/app/vendors/{file}'
        // — KHÔNG thuộc disk 'public' ('storage/app/public/...') như
        // products/vendors/vendor-library bình thường — và lưu URL dạng
        // 'APP_URL/media.php?f={file}'. Nếu lệnh migrate không nhận diện được
        // dạng URL này, ảnh sẽ mắc kẹt vĩnh viễn ở local disk, không lên R2.
        Storage::fake('s3');
        $legacyDir = storage_path('app/vendors');
        if (!is_dir($legacyDir)) {
            mkdir($legacyDir, 0755, true);
        }
        $legacyFile = $legacyDir . '/vendor_legacy_test_123.jpg';
        file_put_contents($legacyFile, 'noidung-anh-legacy');

        $vendor = Vendor::create([
            'name'         => 'Legacy Vendor',
            'product_type' => 'AOP',
            'media_url'    => 'http://localhost/media.php?f=vendor_legacy_test_123.jpg',
        ]);

        try {
            $this->artisan('app:migrate-media-to-object-storage', ['--disk' => 's3'])
                ->assertExitCode(0);

            Storage::disk('s3')->assertExists('vendors/vendor_legacy_test_123.jpg');
            $this->assertFileExists($legacyFile, 'File gốc PHẢI còn nguyên trên đĩa server (chỉ copy, không xoá)');

            $urlAfter = $vendor->fresh()->media_url;
            $this->assertStringContainsString('vendors/vendor_legacy_test_123.jpg', $urlAfter);
            $this->assertStringNotContainsString('media.php', $urlAfter, 'URL sau migrate phải hết phụ thuộc media.php (local disk)');
        } finally {
            @unlink($legacyFile);
        }
    }
}
